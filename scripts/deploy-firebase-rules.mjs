import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

const rules = JSON.parse(readFileSync("firebase.rules.json", "utf8"));
const auth = new GoogleAuth({
  credentials: {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey
  },
  scopes: [
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

const endpoint = `${databaseUrl.replace(/\/$/, "")}/.settings/rules.json`;
const response = await fetch(`${endpoint}?access_token=${encodeURIComponent(accessToken)}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(rules)
});

if (!response.ok) {
  console.error(`Rules deployment failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}

writeFileSync(
  ".firebase-rules-deployed.json",
  JSON.stringify(
    {
      deployedAt: new Date().toISOString(),
      databaseUrl,
      projectId
    },
    null,
    2
  )
);

console.log("Firebase Realtime Database rules deployed.");
