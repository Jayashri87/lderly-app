import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { ref, set } from "firebase/database";
import type { SessionUser, UserRole } from "@lderly/shared-types";
import { auth } from "../firebase";
import { db } from "../firebase";

export type { SessionUser, UserRole };

const roleLabels: Record<UserRole, string> = {
  customer: "Customer",
  caretaker: "Caretaker",
  admin: "Admin",
  superadmin: "Super Admin"
};

const toSessionUser = (user: User, role: UserRole): SessionUser => ({
  uid: user.uid,
  name: user.displayName || roleLabels[role],
  role,
  authMode: "firebase"
});

const demoUser = (role: UserRole): SessionUser => ({
  uid: `demo-${role}`,
  name: roleLabels[role],
  role,
  authMode: "demo"
});

let activeRole: UserRole = "customer";
let activeSession: SessionUser | null = null;

const roleKey = "lderly-role";
const demoSessionKey = "lderly-demo-session";

const canUseStorage = () => typeof window !== "undefined";

const readStoredRole = (): UserRole => {
  if (!canUseStorage()) {
    return activeRole;
  }

  const storedRole = window.localStorage.getItem(roleKey);
  return storedRole === "customer" ||
    storedRole === "caretaker" ||
    storedRole === "admin" ||
    storedRole === "superadmin"
    ? storedRole
    : activeRole;
};

const readDemoSession = (): SessionUser | null => {
  if (!canUseStorage()) {
    return null;
  }

  const storedSession = window.localStorage.getItem(demoSessionKey);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession) as SessionUser;
  } catch {
    window.localStorage.removeItem(demoSessionKey);
    return null;
  }
};

const storeSession = (session: SessionUser | null) => {
  if (!canUseStorage()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(demoSessionKey);
    return;
  }

  window.localStorage.setItem(roleKey, session.role);

  if (session.authMode === "demo") {
    window.localStorage.setItem(demoSessionKey, JSON.stringify(session));
  }
};

const persistSessionUser = async (session: SessionUser) => {
  if (!db || session.authMode !== "firebase") {
    return;
  }

  const idToken = await auth?.currentUser?.getIdToken();

  if (idToken && typeof window !== "undefined") {
    const response = await fetch("/api/auth/firebase-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idToken,
        role: session.role,
        name: session.name
      })
    }).catch(() => null);

    if (response?.ok && response.status !== 202) {
      await auth?.currentUser?.getIdToken(true).catch(() => undefined);
      return;
    }
  }

  await set(ref(db, `users/${session.uid}`), {
    uid: session.uid,
    name: session.name,
    role: session.role,
    authMode: session.authMode,
    roleSource: "client-fallback",
    updatedAt: Date.now()
  }).catch(() => undefined);
};

export const AuthService = {
  subscribe(callback: (user: SessionUser | null) => void) {
    activeRole = readStoredRole();
    activeSession = activeSession ?? readDemoSession();
    callback(activeSession);

    if (!auth) {
      return () => undefined;
    }

    return onAuthStateChanged(auth, (user) => {
      activeRole = readStoredRole();
      activeSession = user ? toSessionUser(user, activeRole) : readDemoSession();
      callback(activeSession);
    });
  },

  async continueAs(role: UserRole) {
    activeRole = role;

    if (!auth) {
      activeSession = demoUser(role);
      storeSession(activeSession);
      return activeSession;
    }

    try {
      const credential = await signInAnonymously(auth);
      activeSession = toSessionUser(credential.user, role);
    } catch {
      activeSession = demoUser(role);
    }

    storeSession(activeSession);
    await persistSessionUser(activeSession);
    return activeSession;
  },

  async continueWithGoogle(role: UserRole) {
    activeRole = role;

    if (!auth) {
      activeSession = demoUser(role);
      storeSession(activeSession);
      return activeSession;
    }

    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    activeSession = toSessionUser(credential.user, role);
    storeSession(activeSession);
    await persistSessionUser(activeSession);
    return activeSession;
  },

  storeSignedSession(session: SessionUser) {
    activeRole = session.role;
    activeSession = session;
    storeSession(activeSession);
    return activeSession;
  },

  async signOut() {
    activeSession = null;
    storeSession(null);

    if (typeof window !== "undefined") {
      await fetch("/api/auth/logout", {
        method: "POST"
      }).catch(() => undefined);
    }

    if (auth) {
      await signOut(auth);
    }
  },

  async signOutAllDevices() {
    activeSession = null;
    storeSession(null);

    if (typeof window !== "undefined") {
      await fetch("/api/auth/logout-all", {
        method: "POST"
      }).catch(() => undefined);
    }

    if (auth) {
      await signOut(auth);
    }
  }
};
