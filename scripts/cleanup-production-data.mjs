import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

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

const requiredEnv = [
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY"
];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing cleanup env vars:\n- ${missingEnv.join("\n- ")}`);
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });

const database = getDatabase(app);
const executeCleanup = process.env.CLEANUP_PRODUCTION_DATA === "true";
const showPaths = process.env.SHOW_CLEANUP_PATHS === "true";
const demoPatterns = [/smoke/i, /demo-/i, /test-/i, /production smoke/i];

const isDemoLike = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return demoPatterns.some((pattern) => pattern.test(value));
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(isDemoLike);
  }

  if (typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => isDemoLike(key) || isDemoLike(entry));
  }

  return false;
};

const scanPath = async (path) => {
  const snapshot = await database.ref(path).get();
  const value = snapshot.val();

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value)
    .filter(([id, record]) => isDemoLike(id) || isDemoLike(record))
    .map(([id]) => `${path}/${id}`);
};

const pathsToScan = [
  "bookings/byId",
  "emergencyEscalations/byId",
  "incidents/byId",
  "operations/internalAlerts/byId",
  "operations/recoveryQueue/byId",
  "operations/recoveryActions",
  "notifications/byId",
  "supportTickets/byId",
  "complaints/byId",
  "refunds/byId",
  "reports/byId",
  "caretakerAttendance/activeShifts"
];

const matchedPaths = (await Promise.all(pathsToScan.map(scanPath))).flat();

console.log(
  JSON.stringify(
    {
      mode: executeCleanup ? "execute" : "dry-run",
      matchedRecords: matchedPaths.length,
      paths: showPaths ? matchedPaths : "hidden; set SHOW_CLEANUP_PATHS=true to print paths"
    },
    null,
    2
  )
);

if (!executeCleanup || matchedPaths.length === 0) {
  process.exit(0);
}

const updates = Object.fromEntries(matchedPaths.map((path) => [path, null]));
await database.ref().update(updates);
console.log(`Removed ${matchedPaths.length} demo/smoke/test record(s).`);
