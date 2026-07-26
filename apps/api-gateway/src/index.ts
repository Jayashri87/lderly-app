import * as Sentry from "@sentry/node";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { z } from "zod";
import { RuViewMQTTClient } from "@lderly/ruview-integration";

const envSchema = z.object({
  API_GATEWAY_PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  NEXT_API_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  MQTT_HOST: z.string().default("localhost"),
  MQTT_PORT: z.coerce.number().int().default(1883),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
});

const env = envSchema.parse(process.env);

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1
  });
}

const app = express();
const startedAt = Date.now();
let proxiedRequests = 0;
let rejectedRequests = 0;

// Initialize Redis
const redisClient = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    })
  : null;

if (redisClient) {
  redisClient.on("error", (error) => {
    Sentry.captureException(error);
    console.error("api-gateway redis error", error);
  });
  await redisClient.connect();
}

// Initialize RuView MQTT Client
let ruviewClient: RuViewMQTTClient | null = null;
let ruviewHealthy = false;

try {
  ruviewClient = new RuViewMQTTClient({
    mqttHost: env.MQTT_HOST,
    mqttPort: env.MQTT_PORT,
    mqttUsername: env.MQTT_USERNAME,
    mqttPassword: env.MQTT_PASSWORD,
  });

  await ruviewClient.connect();
  ruviewHealthy = true;
  console.log("[RuView] Connected to MQTT broker");

  // Log health alerts
  ruviewClient.onHealthAlert((alert) => {
    console.log(`[RuView Alert] ${alert.type.toUpperCase()}: ${alert.message} (${alert.nodeId})`);
    Sentry.captureMessage(`RuView Alert: ${alert.message}`, alert.severity === 'critical' ? 'fatal' : 'warning');
  });
} catch (error) {
  console.error("[RuView] Failed to connect to MQTT broker:", error);
  Sentry.captureException(error);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

const extractBearerToken = (authorization?: string) => {
  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
};

const verifyGatewayJwt = (authorization?: string) => {
  if (!env.JWT_SECRET) {
    return null;
  }

  const token = extractBearerToken(authorization);

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
};

// Health check endpoint
app.get("/health", async (_request, response) => {
  const redisHealthy = redisClient ? (await redisClient.ping()) === "PONG" : true;

  response.json({
    status: redisHealthy && ruviewHealthy ? "healthy" : "degraded",
    service: "api-gateway",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    checks: {
      redis: redisClient ? redisHealthy : "not_configured",
      ruview: ruviewHealthy ? "connected" : "disconnected"
    }
  });
});

// Metrics endpoint
app.get("/metrics", (_request, response) => {
  response.json({
    service: "api-gateway",
    proxiedRequests,
    rejectedRequests,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ruviewConnected: ruviewHealthy
  });
});

// Status endpoint
app.get("/status", (_request, response) => {
  response.json({
    service: "api-gateway",
    mode: "staged",
    sourceOfTruth: "nextjs-app-api",
    nextApiOrigin: env.NEXT_API_ORIGIN,
    ruview: {
      enabled: ruviewClient !== null,
      healthy: ruviewHealthy
    }
  });
});

// RuView Vitals API endpoints
app.get("/api/vitals", (_request, response) => {
  if (!ruviewClient) {
    return response.status(503).json({ error: "RuView not connected" });
  }

  const updates = ruviewClient.getAllSensorUpdates();
  const vitals = Array.from(updates.values()).map((update) => ({
    nodeId: update.nodeId,
    vitalSigns: update.vitalSigns,
    timestamp: update.timestamp
  }));

  response.json(vitals);
});

app.get("/api/vitals/:nodeId", (_request, response) => {
  if (!ruviewClient) {
    return response.status(503).json({ error: "RuView not connected" });
  }

  const { nodeId } = _request.params;
  const update = ruviewClient.getSensorUpdate(nodeId);

  if (!update) {
    return response.status(404).json({ error: "Node not found" });
  }

  response.json({
    nodeId: update.nodeId,
    vitalSigns: update.vitalSigns,
    timestamp: update.timestamp
  });
});

// Main proxy handler
app.use("/api", async (request, response) => {
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  const jwtPayload = verifyGatewayJwt(request.headers.authorization);

  if (!safeMethods.has(request.method) && env.JWT_SECRET && !jwtPayload) {
    rejectedRequests += 1;
    response.status(401).json({ error: "Gateway token required" });
    return;
  }

  const targetUrl = new URL(request.originalUrl, env.NEXT_API_ORIGIN);
  proxiedRequests += 1;

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        "x-api-gateway": "lderly",
        ...(request.headers.authorization ? { authorization: request.headers.authorization } : {})
      },
      body: safeMethods.has(request.method) ? undefined : JSON.stringify(request.body)
    });

    response.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!["set-cookie", "content-encoding"].includes(key.toLowerCase())) {
        response.setHeader(key, value);
      }
    });
    response.send(await upstream.text());
  } catch (error) {
    Sentry.captureException(error);
    response.status(502).json({ error: "Upstream API unavailable" });
  }
});

app.listen(env.API_GATEWAY_PORT, () => {
  console.log(`LDERLY API gateway listening on ${env.API_GATEWAY_PORT}`);
});
