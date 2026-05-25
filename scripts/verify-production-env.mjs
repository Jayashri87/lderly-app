import { existsSync, readFileSync } from "node:fs";

const loadEnvFile = (path) => {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, rawKey, value] = match;
    const key = rawKey.replace(/^\uFEFF/, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const requiredPublic = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID"
];

const requiredServer = [
  "LDERLY_ADMIN_USERNAME",
  "LDERLY_ADMIN_PASSWORD",
  "LDERLY_CARETAKER_USERNAME",
  "LDERLY_CARETAKER_PASSWORD",
  "LDERLY_CUSTOMER_USERNAME",
  "LDERLY_CUSTOMER_PASSWORD",
  "LDERLY_AUTH_SECRET"
];

const requiredFirebaseAdmin = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY"
];

const forbiddenProduction = [
  "NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN",
  "LDERLY_ALLOW_PRODUCTION_MOCKS"
];

const secretLikePublic = Object.keys(process.env).filter(
  (key) =>
    key.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|PASSWORD|PRIVATE|AUTH_TOKEN|ACCESS_TOKEN|API_TOKEN|WEBHOOK|SID)/.test(key)
);

const missing = (names) => names.filter((name) => !process.env[name]);

const missingPublic = missing(requiredPublic);
const missingServer = missing(requiredServer);
const missingAdmin = missing(requiredFirebaseAdmin);
const unsafeProduction = forbiddenProduction.filter((name) => {
  if (name === "LDERLY_ALLOW_PRODUCTION_MOCKS") {
    return process.env[name] === "true";
  }

  return Boolean(process.env[name]);
});

console.log("LDERLY production environment check");
console.log("-----------------------------------");
console.log(`Public Firebase config: ${missingPublic.length ? "missing" : "ready"}`);
console.log(`Server credentials: ${missingServer.length ? "missing" : "ready"}`);
console.log(`Firebase Admin: ${missingAdmin.length ? "missing" : "ready"}`);
console.log(`Client secret exposure: ${secretLikePublic.length ? "blocked" : "clear"}`);
console.log(`Production-only safety: ${unsafeProduction.length ? "blocked" : "clear"}`);

if (missingPublic.length) {
  console.log(`\nMissing public vars:\n- ${missingPublic.join("\n- ")}`);
}

if (missingServer.length) {
  console.log(`\nMissing server vars:\n- ${missingServer.join("\n- ")}`);
}

if (missingAdmin.length) {
  console.log(`\nMissing Firebase Admin vars:\n- ${missingAdmin.join("\n- ")}`);
}

if (secretLikePublic.length) {
  console.log(`\nSecret-like variables must not be NEXT_PUBLIC_:\n- ${secretLikePublic.join("\n- ")}`);
}

if (unsafeProduction.length) {
  console.log(`\nUnsafe production vars must be cleared/disabled:\n- ${unsafeProduction.join("\n- ")}`);
}

if (
  missingPublic.length ||
  missingServer.length ||
  missingAdmin.length ||
  secretLikePublic.length ||
  unsafeProduction.length
) {
  process.exitCode = 1;
} else {
  console.log("\nAll required production variables are present.");
}
