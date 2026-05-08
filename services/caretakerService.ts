import { onValue, ref, set } from "firebase/database";
import { db } from "../firebase";
import { CaretakerMatchProfile } from "./bookingService";

const storageKey = "lderly-caretaker-seed-profiles";
const now = () => Date.now();

export type CaretakerProfile = CaretakerMatchProfile & {
  status: "available" | "on_visit" | "standby" | "offline";
  punctualityScore: number;
  repeatVisits: number;
  familiarFamilies: string[];
  serviceZones: string[];
  lastSeenAt: number;
};

export const seedCaretakers: CaretakerProfile[] = [
  {
    uid: "demo-caretaker",
    name: "Anita",
    available: true,
    status: "available",
    city: "Bengaluru",
    zone: "Central",
    serviceZones: ["Central", "Medical", "Diagnostics"],
    skills: [
      "doctor_visit",
      "lab_support",
      "hospital_attender",
      "medicine_help",
      "companionship",
      "daily_support"
    ],
    languages: ["English", "Hindi", "Kannada"],
    rating: 4.9,
    punctualityScore: 96,
    repeatVisits: 12,
    familiarFamilies: ["demo-customer"],
    activeAssignments: 0,
    maxAssignments: 3,
    verified: true,
    trained: true,
    yearsExperience: 6,
    lastSeenAt: now()
  },
  {
    uid: "caretaker-ramesh",
    name: "Ramesh",
    available: true,
    status: "standby",
    city: "Bengaluru",
    zone: "Medical",
    serviceZones: ["Medical", "Central"],
    skills: ["doctor_visit", "hospital_attender", "medicine_help"],
    languages: ["English", "Hindi", "Tamil"],
    rating: 4.8,
    punctualityScore: 93,
    repeatVisits: 8,
    familiarFamilies: [],
    activeAssignments: 1,
    maxAssignments: 2,
    verified: true,
    trained: true,
    yearsExperience: 8,
    lastSeenAt: now()
  },
  {
    uid: "caretaker-kavya",
    name: "Kavya",
    available: true,
    status: "available",
    city: "Bengaluru",
    zone: "Diagnostics",
    serviceZones: ["Diagnostics", "Central"],
    skills: ["lab_support", "doctor_visit", "daily_support", "companionship"],
    languages: ["English", "Kannada", "Telugu"],
    rating: 4.9,
    punctualityScore: 97,
    repeatVisits: 10,
    familiarFamilies: [],
    activeAssignments: 0,
    maxAssignments: 3,
    verified: true,
    trained: true,
    yearsExperience: 5,
    lastSeenAt: now()
  },
  {
    uid: "caretaker-meera",
    name: "Meera",
    available: true,
    status: "available",
    city: "Bengaluru",
    zone: "Central",
    serviceZones: ["Central", "Residential"],
    skills: ["companionship", "daily_support", "medicine_help"],
    languages: ["English", "Hindi", "Malayalam"],
    rating: 4.85,
    punctualityScore: 95,
    repeatVisits: 18,
    familiarFamilies: [],
    activeAssignments: 0,
    maxAssignments: 4,
    verified: true,
    trained: true,
    yearsExperience: 7,
    lastSeenAt: now()
  }
];

let localCaretakers = seedCaretakers;
const localSubscribers = new Set<(caretakers: CaretakerProfile[]) => void>();

const canUseStorage = () => typeof window !== "undefined";

const readLocalCaretakers = () => {
  if (!canUseStorage()) {
    return localCaretakers;
  }

  const storedCaretakers = window.localStorage.getItem(storageKey);

  if (!storedCaretakers) {
    return localCaretakers;
  }

  try {
    localCaretakers = JSON.parse(storedCaretakers) as CaretakerProfile[];
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return localCaretakers;
};

const writeLocalCaretakers = (caretakers: CaretakerProfile[]) => {
  localCaretakers = caretakers;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(caretakers));
  }

  localSubscribers.forEach((callback) => callback(caretakers));
};

const seedRemoteCaretakers = async (caretakers: CaretakerProfile[]) => {
  if (!db) {
    return;
  }

  const database = db;

  await Promise.all(
    caretakers.map((caretaker) =>
      set(ref(database, `caretakers/${caretaker.uid}`), caretaker)
    )
  ).catch(() => undefined);
};

export const CaretakerService = {
  subscribe(callback: (caretakers: CaretakerProfile[]) => void) {
    callback(readLocalCaretakers());
    localSubscribers.add(callback);

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
      };
    }

    const unsubscribe = onValue(
      ref(db, "caretakers"),
      (snapshot) => {
        const records = snapshot.val() as Record<string, CaretakerProfile> | null;
        const nextCaretakers = records ? Object.values(records) : readLocalCaretakers();
        writeLocalCaretakers(nextCaretakers);
      },
      () => {
        callback(readLocalCaretakers());
      }
    );

    return () => {
      localSubscribers.delete(callback);
      unsubscribe();
    };
  },

  seedDefaults() {
    writeLocalCaretakers(seedCaretakers);
    seedRemoteCaretakers(seedCaretakers);
  }
};
