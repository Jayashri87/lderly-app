import { existsSync, readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

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

const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!databaseUrl || !projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin or database environment variables.");
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  },
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
});
const client = await auth.getClient();
const token = await client.getAccessToken();
const accessToken = typeof token === "string" ? token : token.token;

if (!accessToken) {
  console.error("Could not create Firebase access token.");
  process.exit(1);
}

const databaseRoot = databaseUrl.replace(/\/$/, "");
const rulesResponse = await fetch(
  `${databaseRoot}/.settings/rules.json?access_token=${encodeURIComponent(accessToken)}`
);
const activeRules = await rulesResponse.json();
const instanceResponse = await fetch(
  `https://firebasedatabase.googleapis.com/v1beta/projects/${projectId}/locations/-/instances`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);
const instancePayload = await instanceResponse.json();
const anonRead = await fetch(`${databaseRoot}/.json?shallow=true`);
const anonWrite = await fetch(`${databaseRoot}/securityProbeCodex.json`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    shouldNotWrite: true,
    at: Date.now()
  })
});

const rootRead = activeRules?.rules?.[".read"];
const rootWrite = activeRules?.rules?.[".write"];
const failures = [
  ...(rulesResponse.ok ? [] : [`Could not fetch active rules: ${rulesResponse.status}`]),
  ...(rootRead === false ? [] : [`Root .read is not false: ${rootRead}`]),
  ...(rootWrite === false ? [] : [`Root .write is not false: ${rootWrite}`]),
  ...(anonRead.status === 401 || anonRead.status === 403
    ? []
    : [`Anonymous root read allowed: ${anonRead.status}`]),
  ...(anonWrite.status === 401 || anonWrite.status === 403
    ? []
    : [`Anonymous root write allowed: ${anonWrite.status}`])
];

console.log("Firebase Realtime Database security audit");
console.log("----------------------------------------");
console.log(`Project: ${projectId}`);
console.log(`Database: ${new URL(databaseUrl).host}`);
console.log(`Instances: ${(instancePayload.instances || []).map((item) => item.databaseUrl).join(", ")}`);
console.log(`Root .read: ${rootRead}`);
console.log(`Root .write: ${rootWrite}`);
console.log(`Anonymous root read: ${anonRead.status}`);
console.log(`Anonymous root write: ${anonWrite.status}`);

if (failures.length) {
  console.error(`\nSecurity audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("\nSecurity audit passed: anonymous database read/write is denied.");
