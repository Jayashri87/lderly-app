import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  AppCheck,
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "firebase/app-check";
import { Auth, getAuth } from "firebase/auth";
import { Database, getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export const app: FirebaseApp | null = hasFirebaseConfig
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

export const db: Database | null = app ? getDatabase(app) : null;

export const auth: Auth | null = app ? getAuth(app) : null;

const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
const appCheckDebugToken = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN;

let appCheck: AppCheck | null = null;
let fetchPatched = false;

if (typeof window !== "undefined" && app && appCheckSiteKey) {
  if (appCheckDebugToken) {
    Object.assign(window, {
      FIREBASE_APPCHECK_DEBUG_TOKEN: appCheckDebugToken
    });
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

const isInternalApiRequest = (input: RequestInfo | URL) => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const url = new URL(rawUrl, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

export const getFirebaseAppCheckToken = async () => {
  if (!appCheck) {
    return null;
  }

  try {
    return (await getToken(appCheck, false)).token;
  } catch {
    return null;
  }
};

export const installFirebaseAppCheckFetch = () => {
  if (typeof window === "undefined" || fetchPatched || !appCheck) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    if (!isInternalApiRequest(input)) {
      return originalFetch(input, init);
    }

    const token = await getFirebaseAppCheckToken();

    if (!token) {
      return originalFetch(input, init);
    }

    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init.headers || requestHeaders);
    headers.set("X-Firebase-AppCheck", token);

    return originalFetch(input, {
      ...init,
      headers
    });
  };

  fetchPatched = true;
};
