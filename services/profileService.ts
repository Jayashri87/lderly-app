import { onValue, ref, set } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";

export type CareRecipientProfile = {
  relationship: string;
  fullName: string;
  age: number;
  phone: string;
  address: string;
  healthNotes: string;
  allergies: string;
  mobility: string;
  language: string;
  medicationList?: string[];
  medicalConditions?: string[];
  dementiaSupport?: boolean;
  fallRisk?: "low" | "medium" | "high";
  emergencyContacts?: EmergencyContact[];
  updatedAt: number;
};

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  priority: number;
};

export type FamilyMemberAccess = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  permissions: Array<"monitor" | "approve" | "pay" | "alerts">;
  nriMode: boolean;
  updatedAt: number;
};

export type CarePackage = {
  id: string;
  name: string;
  priceLabel: string;
  cadence: "single" | "weekly" | "monthly";
  included: string[];
  recommendedFor: string;
};

export type CareProfile = {
  userId: string;
  elderName: string;
  age: number;
  primaryContact: string;
  emergencyContact: string;
  medicalNotes: string;
  allergies: string;
  subscriptionPlan: "Basic" | "Premium" | "Care Plus";
  careRecipients?: Record<string, CareRecipientProfile>;
  familyMembers?: Record<string, FamilyMemberAccess>;
  preferredCaregiverId?: string;
  carePackages?: Record<string, CarePackage>;
  notificationPreferences?: {
    whatsapp: boolean;
    sms: boolean;
    voiceSummary: boolean;
    nriDigest: boolean;
  };
  updatedAt: number;
};

const storageKey = "lderly-care-profile";
const now = () => Date.now();

const createDefaultProfile = (session?: SessionUser | null): CareProfile => ({
  userId: session?.uid || "demo-customer",
  elderName: "Parent Profile",
  age: 72,
  primaryContact: "+91 99169 60524",
  emergencyContact: "Son - +91 99169 60524",
  medicalNotes: "Hypertension history. Needs evening medicine reminder.",
  allergies: "No known allergies",
  subscriptionPlan: "Premium",
  careRecipients: {},
  familyMembers: {},
  preferredCaregiverId: "demo-caretaker",
  carePackages: {
    parentWellness: {
      id: "parentWellness",
      name: "Parent Wellness Plan",
      priceLabel: "Rs 4,999 / month",
      cadence: "monthly",
      included: ["4 check-ins", "medicine reminders", "family updates"],
      recommendedFor: "Families who want weekly reassurance"
    },
    hospitalSupport: {
      id: "hospitalSupport",
      name: "Hospital Support Pack",
      priceLabel: "From Rs 1,499",
      cadence: "single",
      included: ["attender support", "doctor notes", "discharge help"],
      recommendedFor: "Appointments, admission, or discharge days"
    }
  },
  notificationPreferences: {
    whatsapp: true,
    sms: false,
    voiceSummary: true,
    nriDigest: true
  },
  updatedAt: now()
});

let localProfile = createDefaultProfile();
const localSubscribers = new Set<(profile: CareProfile) => void>();

const canUseStorage = () => typeof window !== "undefined";
const clientDatabaseWritesEnabled = () =>
  typeof window === "undefined" ||
  window.localStorage.getItem("lderly-enable-client-db-writes") === "true";

const readLocalProfile = (session?: SessionUser | null) => {
  if (!canUseStorage()) {
    return localProfile;
  }

  const storedProfile = window.localStorage.getItem(storageKey);

  if (!storedProfile) {
    localProfile = createDefaultProfile(session);
    return localProfile;
  }

  try {
    localProfile = JSON.parse(storedProfile) as CareProfile;
  } catch {
    window.localStorage.removeItem(storageKey);
    localProfile = createDefaultProfile(session);
  }

  return localProfile;
};

const writeLocalProfile = (profile: CareProfile) => {
  localProfile = profile;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  }

  localSubscribers.forEach((callback) => callback(profile));
};

const saveProfile = (profile: CareProfile) => {
  const nextProfile = {
    ...profile,
    updatedAt: now()
  };

  writeLocalProfile(nextProfile);

  if (!db || !clientDatabaseWritesEnabled()) {
    return;
  }

  set(ref(db, `profiles/${nextProfile.userId}`), nextProfile).catch(() => {
    writeLocalProfile(nextProfile);
  });
};

const withLegacyProfileFields = (
  profile: CareProfile,
  recipient: CareRecipientProfile
) => ({
  ...profile,
  elderName: recipient.fullName || profile.elderName,
  age: recipient.age || profile.age,
  primaryContact: recipient.phone || profile.primaryContact,
  emergencyContact: recipient.phone
    ? `${recipient.relationship} - ${recipient.phone}`
    : profile.emergencyContact,
  medicalNotes: recipient.healthNotes || profile.medicalNotes,
  allergies: recipient.allergies || profile.allergies
});

export const ProfileService = {
  subscribe(session: SessionUser, callback: (profile: CareProfile) => void) {
    const profile = readLocalProfile(session);
    callback(profile);
    localSubscribers.add(callback);

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
      };
    }

    const profileRef = ref(db, `profiles/${profile.userId}`);
    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        const nextProfile =
          (snapshot.val() as CareProfile | null) ?? readLocalProfile(session);
        writeLocalProfile(nextProfile);
      },
      () => {
        callback(readLocalProfile(session));
      }
    );

    return () => {
      localSubscribers.delete(callback);
      unsubscribe();
    };
  },

  cyclePlan() {
    const profile = readLocalProfile();
    const nextPlan =
      profile.subscriptionPlan === "Basic"
        ? "Premium"
        : profile.subscriptionPlan === "Premium"
          ? "Care Plus"
          : "Basic";

    saveProfile({
      ...profile,
      subscriptionPlan: nextPlan
    });
  },

  updateMedicalNotes() {
    const profile = readLocalProfile();

    saveProfile({
      ...profile,
      medicalNotes:
        profile.medicalNotes ===
        "Hypertension history. Needs evening medicine reminder."
          ? "Hypertension history. Monitor BP weekly. Evening medicine reminder active."
          : "Hypertension history. Needs evening medicine reminder."
    });
  },

  saveCareRecipient(
    session: SessionUser,
    relationship: string,
    details: Omit<CareRecipientProfile, "relationship" | "updatedAt">
  ) {
    const profile = readLocalProfile(session);
    const recipient: CareRecipientProfile = {
      relationship,
      ...details,
      updatedAt: now()
    };

    saveProfile(
      withLegacyProfileFields(
        {
          ...profile,
          userId: session.uid,
          careRecipients: {
            ...(profile.careRecipients || {}),
            [relationship]: recipient
          }
        },
        recipient
      )
    );
  },

  saveFamilyMember(
    session: SessionUser,
    member: Omit<FamilyMemberAccess, "id" | "updatedAt">
  ) {
    const profile = readLocalProfile(session);
    const id = `family-${now()}`;

    saveProfile({
      ...profile,
      userId: session.uid,
      familyMembers: {
        ...(profile.familyMembers || {}),
        [id]: {
          id,
          ...member,
          updatedAt: now()
        }
      }
    });
  },

  selectPackage(session: SessionUser, packageId: string) {
    const profile = readLocalProfile(session);
    const plan =
      packageId === "parentWellness"
        ? "Premium"
        : packageId === "hospitalSupport"
          ? "Care Plus"
          : profile.subscriptionPlan;

    saveProfile({
      ...profile,
      userId: session.uid,
      subscriptionPlan: plan
    });
  },

  removeCareRecipient(session: SessionUser, relationship: string) {
    const profile = readLocalProfile(session);
    const { [relationship]: removed, ...nextRecipients } =
      profile.careRecipients || {};

    void removed;

    saveProfile({
      ...profile,
      userId: session.uid,
      careRecipients: nextRecipients
    });
  }
};
