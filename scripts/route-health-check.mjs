const baseUrl =
  process.env.ROUTE_HEALTH_BASE_URL ||
  process.env.E2E_BASE_URL ||
  "https://lderly-app.vercel.app";

const routes = [
  { path: "/", requireNoStore: true },
  { path: "/signin", requireNoStore: true },
  { path: "/login", requireNoStore: true },
  { path: "/superadmin", requireNoStore: true },
  { path: "/partner", requireNoStore: true },
  { path: "/ops", requireNoStore: true },
  { path: "/offline", requireNoStore: true },
  { path: "/api/system/status", requireNoStore: true, json: true }
];

const failures = [];
const results = [];

const checkRoute = async ({ path, requireNoStore, json }) => {
  const url = new URL(path, baseUrl).toString();
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache"
    }
  });
  const elapsedMs = Date.now() - startedAt;
  const cacheControl = response.headers.get("cache-control") || "";
  const build = response.headers.get("x-lderly-build") || "";
  const contentType = response.headers.get("content-type") || "";

  results.push({
    path,
    status: response.status,
    elapsedMs,
    cacheControl,
    build: build || "missing"
  });

  if (!response.ok) {
    failures.push(`${path}: expected 2xx, received ${response.status}`);
  }

  if (requireNoStore && !cacheControl.includes("no-store")) {
    failures.push(`${path}: expected no-store cache policy, received "${cacheControl}"`);
  }

  if (!build) {
    failures.push(`${path}: missing X-LDERLY-Build header`);
  }

  if (json) {
    if (!contentType.includes("application/json")) {
      failures.push(`${path}: expected JSON response, received "${contentType}"`);
      return;
    }

    const payload = await response.json();

    if (!payload?.productionReadiness) {
      failures.push(`${path}: missing productionReadiness payload`);
    }
  } else {
    const text = await response.text();

    if (!text.includes("LDERLY")) {
      failures.push(`${path}: response does not include LDERLY app marker`);
    }
  }
};

for (const route of routes) {
  try {
    await checkRoute(route);
  } catch (error) {
    failures.push(`${route.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const buildIds = new Set(results.map((result) => result.build).filter((build) => build !== "missing"));

if (buildIds.size > 1) {
  failures.push(`Routes returned inconsistent build IDs: ${Array.from(buildIds).join(", ")}`);
}

console.table(results);

if (failures.length) {
  console.error("Route health check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Route health check passed for ${baseUrl}.`);
