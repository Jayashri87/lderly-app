import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

const adminProjectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const adminClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

export const hasFirebaseAdminConfig = Boolean(
  adminProjectId && adminClientEmail && adminPrivateKey && databaseURL
);

const getAdminApp = () => {
  if (!hasFirebaseAdminConfig) {
    return null;
  }

  return getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: adminProjectId,
          clientEmail: adminClientEmail,
          privateKey: adminPrivateKey
        }),
        databaseURL,
        storageBucket
      });
};

export const getAdminDatabase = () => {
  const app = getAdminApp();

  if (!app) {
    return null;
  }

  return getDatabase(app);
};

export const getAdminAuth = () => {
  const app = getAdminApp();

  if (!app) {
    return null;
  }

  return getAuth(app);
};

export const getAdminStorageBucket = () => {
  const app = getAdminApp();

  if (!app || !storageBucket) {
    return null;
  }

  return getStorage(app).bucket();
};

export const getAdminMessaging = () => {
  const app = getAdminApp();

  if (!app) {
    return null;
  }

  return getMessaging(app);
};
