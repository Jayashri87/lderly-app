import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const allowedPublicEnv = new Set([
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY",
  "NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_CLARITY_ID",
  "NEXT_PUBLIC_MIXPANEL_TOKEN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_VERCEL_ENV"
]);

const forbiddenPublicNameFragments = [
  "SECRET",
  "PASSWORD",
  "PRIVATE",
  "AUTH_TOKEN",
  "ACCESS_TOKEN",
  "API_TOKEN",
  "WEBHOOK",
  "SID"
];

const secretValuePatterns = [
  { name: "Razorpay live key", pattern: /\brzp_live_[A-Za-z0-9]{8,}\b/g },
  { name: "Vercel token", pattern: /\bvcp_[A-Za-z0-9]{20,}\b/g },
  { name: "PostHog key", pattern: /\bph[acx]_[A-Za-z0-9]{20,}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  {
    name: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g
  },
  {
    name: "hardcoded production password",
    pattern: /\bNokia5233!\b/g
  }
];

const allowedSecretValueFiles = new Set([".env.example"]);

const parseEnvFile = (path) => {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([^#=\s]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].replace(/^\uFEFF/, ""), match[2]])
  );
};

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((path) => !path.startsWith("package-lock.json"));

const failures = [];

for (const file of trackedFiles) {
  const content = readFileSync(file, "utf8");

  for (const { name, pattern } of secretValuePatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content) && !allowedSecretValueFiles.has(file)) {
      failures.push(`${file}: contains a ${name} pattern`);
    }
  }

  for (const match of content.matchAll(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g)) {
    const envName = match[0];

    if (!allowedPublicEnv.has(envName)) {
      failures.push(`${file}: uses unapproved browser-exposed env var ${envName}`);
    }

    if (forbiddenPublicNameFragments.some((fragment) => envName.includes(fragment))) {
      failures.push(`${file}: ${envName} looks secret-like but is browser-exposed`);
    }
  }
}

for (const envFile of [".env.example", ".env.local", ".env.production", ".env.production.local"]) {
  const env = parseEnvFile(envFile);

  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }

    if (!allowedPublicEnv.has(key)) {
      failures.push(`${envFile}: unapproved browser-exposed env var ${key}`);
    }

    if (forbiddenPublicNameFragments.some((fragment) => key.includes(fragment))) {
      failures.push(`${envFile}: ${key} looks secret-like but is browser-exposed`);
    }
  }

  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN
  ) {
    failures.push(`${envFile}: App Check debug token must not be set in production`);
  }
}

if (failures.length) {
  console.error("Secret exposure audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Secret exposure audit passed.");
