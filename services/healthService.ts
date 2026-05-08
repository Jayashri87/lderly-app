import { onValue, ref, set } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";
import { NotificationService } from "./notificationService";

export type HealthSnapshot = {
  userId: string;
  medicineStatus: "due" | "completed" | "missed";
  nextMedicine: string;
  vitals: {
    heartRate: number;
    bloodPressure: string;
    oxygen: number;
  };
  wellness: "stable" | "watch" | "urgent";
  updatedAt: number;
  activity: Array<{
    label: string;
    at: number;
  }>;
};

const storageKey = "lderly-health-snapshot";
const now = () => Date.now();

const createDefaultHealth = (session?: SessionUser | null): HealthSnapshot => ({
  userId: session?.uid || "demo-customer",
  medicineStatus: "due",
  nextMedicine: "9:00 PM",
  vitals: {
    heartRate: 78,
    bloodPressure: "124/82",
    oxygen: 98
  },
  wellness: "stable",
  updatedAt: now(),
  activity: [{ label: "Vitals normal", at: now() }]
});

let localHealth = createDefaultHealth();
const localSubscribers = new Set<(health: HealthSnapshot) => void>();

const canUseStorage = () => typeof window !== "undefined";

const readLocalHealth = (session?: SessionUser | null) => {
  if (!canUseStorage()) {
    return localHealth;
  }

  const storedHealth = window.localStorage.getItem(storageKey);

  if (!storedHealth) {
    localHealth = createDefaultHealth(session);
    return localHealth;
  }

  try {
    localHealth = JSON.parse(storedHealth) as HealthSnapshot;
  } catch {
    window.localStorage.removeItem(storageKey);
    localHealth = createDefaultHealth(session);
  }

  return localHealth;
};

const writeLocalHealth = (health: HealthSnapshot) => {
  localHealth = health;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(health));
  }

  localSubscribers.forEach((callback) => callback(health));
};

const saveHealth = (health: HealthSnapshot) => {
  writeLocalHealth(health);

  if (!db) {
    return;
  }

  set(ref(db, `health/${health.userId}`), health).catch(() => {
    writeLocalHealth(health);
  });
};

const appendActivity = (health: HealthSnapshot, label: string): HealthSnapshot => {
  const timestamp = now();

  return {
    ...health,
    updatedAt: timestamp,
    activity: [...health.activity, { label, at: timestamp }]
  };
};

export const HealthService = {
  subscribe(session: SessionUser, callback: (health: HealthSnapshot) => void) {
    const health = readLocalHealth(session);
    callback(health);
    localSubscribers.add(callback);

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
      };
    }

    const healthRef = ref(db, `health/${health.userId}`);
    const unsubscribe = onValue(
      healthRef,
      (snapshot) => {
        const nextHealth =
          (snapshot.val() as HealthSnapshot | null) ?? readLocalHealth(session);
        writeLocalHealth(nextHealth);
      },
      () => {
        callback(readLocalHealth(session));
      }
    );

    return () => {
      localSubscribers.delete(callback);
      unsubscribe();
    };
  },

  completeMedicine() {
    saveHealth(
      appendActivity(
        {
          ...readLocalHealth(),
          medicineStatus: "completed",
          wellness: "stable"
        },
        "Medicine reminder completed"
      )
    );
  },

  markMissedMedicine() {
    const health = readLocalHealth();
    NotificationService.create({
      userId: health.userId,
      role: "admin",
      title: "Medicine missed",
      body: "A medicine dose was marked missed and needs follow-up.",
      priority: "urgent"
    });

    saveHealth(
      appendActivity(
        {
          ...health,
          medicineStatus: "missed",
          wellness: "watch"
        },
        "Medicine dose missed"
      )
    );
  },

  simulateVitalsCheck() {
    const health = readLocalHealth();
    const nextHeartRate = health.vitals.heartRate >= 88 ? 76 : health.vitals.heartRate + 6;
    const nextOxygen = health.vitals.oxygen <= 95 ? 98 : health.vitals.oxygen - 1;
    const wellness = nextHeartRate > 90 || nextOxygen < 95 ? "watch" : "stable";

    if (wellness === "watch") {
      NotificationService.create({
        userId: health.userId,
        role: "admin",
        title: "Vitals need attention",
        body: `Heart rate ${nextHeartRate}, oxygen ${nextOxygen}%.`,
        priority: "urgent"
      });
    }

    saveHealth(
      appendActivity(
        {
          ...health,
          vitals: {
            ...health.vitals,
            heartRate: nextHeartRate,
            oxygen: nextOxygen
          },
          wellness
        },
        "Vitals check recorded"
      )
    );
  }
};
