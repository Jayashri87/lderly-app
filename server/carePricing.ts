import type { CarePackage, CareProfile, FamilyMemberAccess } from "../services/profileService";
import { getAdminDatabase } from "./firebaseAdmin";

export type PricingQuoteInput = {
  serviceType: string;
  durationLabel: string;
  priority?: "normal" | "urgent" | "critical";
  distanceKm?: number;
  recurring?: boolean;
};

export type PricingQuote = {
  currency: "INR";
  baseAmount: number;
  durationMultiplier: number;
  travelFee: number;
  urgencyFee: number;
  subscriptionDiscount: number;
  estimatedTotal: number;
  displayTotal: string;
  explanation: string[];
};

const serviceBase = (serviceType: string) => {
  const service = serviceType.toLowerCase();

  if (service.includes("hospital") || service.includes("overnight")) {
    return 1499;
  }
  if (service.includes("doctor") || service.includes("lab")) {
    return 899;
  }
  if (service.includes("medicine")) {
    return 399;
  }
  if (service.includes("festival") || service.includes("birthday") || service.includes("occasion")) {
    return 999;
  }
  return 499;
};

const durationMultiplier = (durationLabel: string) => {
  const duration = durationLabel.toLowerCase();

  if (duration.includes("overnight")) {
    return 3.5;
  }
  if (duration.includes("full")) {
    return 3;
  }
  if (duration.includes("half")) {
    return 1.8;
  }
  if (duration.includes("recurring")) {
    return 0.85;
  }
  return 1;
};

export const buildPricingQuote = (input: PricingQuoteInput): PricingQuote => {
  const baseAmount = serviceBase(input.serviceType);
  const multiplier = durationMultiplier(input.durationLabel);
  const travelFee = Math.max(0, Math.round(((input.distanceKm || 0) - 3) * 25));
  const urgencyFee =
    input.priority === "critical" ? 500 : input.priority === "urgent" ? 250 : 0;
  const subtotal = Math.round(baseAmount * multiplier + travelFee + urgencyFee);
  const subscriptionDiscount = input.recurring ? Math.round(subtotal * 0.1) : 0;
  const estimatedTotal = subtotal - subscriptionDiscount;

  return {
    currency: "INR",
    baseAmount,
    durationMultiplier: multiplier,
    travelFee,
    urgencyFee,
    subscriptionDiscount,
    estimatedTotal,
    displayTotal: `Rs ${estimatedTotal.toLocaleString("en-IN")}`,
    explanation: [
      `${input.serviceType} base care`,
      `${input.durationLabel} duration`,
      travelFee ? "travel support included" : "nearby caregiver pricing",
      urgencyFee ? "urgent care priority" : "standard priority",
      subscriptionDiscount ? "recurring care discount applied" : "single visit estimate"
    ]
  };
};

export const defaultCarePackages: Record<string, CarePackage> = {
  wellnessMonthly: {
    id: "wellnessMonthly",
    name: "Parent Wellness Monthly",
    priceLabel: "Rs 4,999 / month",
    cadence: "monthly",
    included: ["weekly check-ins", "medicine reminders", "voice summaries", "family alerts"],
    recommendedFor: "Families who want reassurance every week"
  },
  hospitalDay: {
    id: "hospitalDay",
    name: "Hospital Day Support",
    priceLabel: "From Rs 1,499",
    cadence: "single",
    included: ["attender support", "doctor notes", "report handover", "family update"],
    recommendedFor: "Doctor visits, lab visits, admission, or discharge"
  },
  nriCare: {
    id: "nriCare",
    name: "NRI Family Updates",
    priceLabel: "Rs 6,999 / month",
    cadence: "monthly",
    included: ["priority updates", "WhatsApp digest", "voice summary", "ops escalation"],
    recommendedFor: "Families coordinating care from outside India"
  }
};

export const CareProfileStore = {
  async saveProfile(userId: string, profile: Partial<CareProfile>) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const nextProfile = {
      ...profile,
      userId,
      carePackages: {
        ...defaultCarePackages,
        ...(profile.carePackages || {})
      },
      updatedAt: Date.now()
    };

    await database.ref(`profiles/${userId}`).update(nextProfile);
    return { ok: true as const, profile: nextProfile };
  },

  async addFamilyMember(userId: string, member: Omit<FamilyMemberAccess, "id" | "updatedAt">) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const id = `family-${Date.now()}`;
    const familyMember = {
      id,
      ...member,
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`profiles/${userId}/familyMembers/${id}`]: familyMember,
      [`familyAccess/byCustomer/${userId}/${id}`]: {
        id,
        userId,
        name: familyMember.name,
        relationship: familyMember.relationship,
        phone: familyMember.phone,
        permissions: familyMember.permissions,
        nriMode: familyMember.nriMode,
        status: "invited",
        updatedAt: familyMember.updatedAt
      },
      [`familyAccess/byPhone/${familyMember.phone.replace(/[.#$/[\]]/g, "_")}/${userId}`]:
        id
    });
    return { ok: true as const, familyMember };
  },

  async grantFamilyReportAccess({
    userId,
    familyMemberId,
    reportId,
    permissions
  }: {
    userId: string;
    familyMemberId: string;
    reportId: string;
    permissions: Array<"alerts" | "approve" | "monitor" | "pay">;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [familySnapshot, reportSnapshot] = await Promise.all([
      database.ref(`profiles/${userId}/familyMembers/${familyMemberId}`).get(),
      database.ref(`reports/byId/${reportId}`).get()
    ]);
    const familyMember = familySnapshot.val() as FamilyMemberAccess | null;
    const report = reportSnapshot.val() as { userId?: string } | null;

    if (!familyMember) {
      return { ok: false as const, status: 404, error: "Family member not found" };
    }

    if (!report || report.userId !== userId) {
      return { ok: false as const, status: 404, error: "Report not found for customer" };
    }

    const grant = {
      userId,
      familyMemberId,
      reportId,
      permissions,
      status: "active",
      grantedAt: Date.now()
    };

    await database.ref().update({
      [`reportAccess/byFamilyMember/${familyMemberId}/${reportId}`]: grant,
      [`reportAccess/byCustomer/${userId}/${familyMemberId}/${reportId}`]: true,
      [`reports/familyVisible/${userId}/${reportId}/${familyMemberId}`]: true
    });

    return {
      ok: true as const,
      grant
    };
  }
};
