import { getAdminAppCheck } from "./firebaseAdmin";

export const appCheckReadiness = {
  configured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY),
  enforceApi: process.env.LDERLY_ENFORCE_APP_CHECK === "true",
  debugAllowed: process.env.NODE_ENV !== "production" && Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN)
};

export const verifyAppCheckToken = async (token?: string | null) => {
  if (!appCheckReadiness.enforceApi) {
    return {
      ok: true as const,
      enforced: false,
      reason: "App Check enforcement is staged but not enabled."
    };
  }

  if (!token) {
    return { ok: false as const, status: 401, error: "Firebase App Check token is required" };
  }

  const appCheck = getAdminAppCheck();

  if (!appCheck) {
    return { ok: false as const, status: 503, error: "Firebase App Check is not configured" };
  }

  try {
    const result = await appCheck.verifyToken(token);

    return {
      ok: true as const,
      enforced: true,
      appId: result.appId
    };
  } catch {
    return { ok: false as const, status: 401, error: "Invalid Firebase App Check token" };
  }
};
