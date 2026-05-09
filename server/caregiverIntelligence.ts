import { getAdminDatabase } from "./firebaseAdmin";

type CaretakerRecord = {
  uid: string;
  name?: string;
  available?: boolean;
  status?: string;
  rating?: number;
  punctualityScore?: number;
  repeatVisits?: number;
  activeAssignments?: number;
  maxAssignments?: number;
  verified?: boolean;
  trained?: boolean;
  yearsExperience?: number;
  skills?: string[];
  languages?: string[];
  zone?: string;
  serviceZones?: string[];
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const scoreCaretaker = (caretaker: CaretakerRecord) => {
  const ratingScore = ((caretaker.rating || 4.5) / 5) * 28;
  const punctualityScore = ((caretaker.punctualityScore || 85) / 100) * 24;
  const repeatScore = Math.min(caretaker.repeatVisits || 0, 20);
  const verificationScore = (caretaker.verified ? 10 : 0) + (caretaker.trained ? 8 : 0);
  const loadPenalty =
    ((caretaker.activeAssignments || 0) / Math.max(caretaker.maxAssignments || 1, 1)) * 18;
  const onlineBonus = caretaker.available && caretaker.status !== "offline" ? 10 : 0;

  return clamp(ratingScore + punctualityScore + repeatScore + verificationScore + onlineBonus - loadPenalty);
};

const riskFor = (score: number, status?: string) => {
  if (status === "offline") {
    return "offline";
  }

  if (score >= 88) {
    return "trusted";
  }

  if (score >= 72) {
    return "watch";
  }

  return "manual_review";
};

export const CaregiverIntelligence = {
  async getReliabilitySnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("caretakers").get();
    const caretakers = snapshot.exists()
      ? (Object.entries(snapshot.val() as Record<string, CaretakerRecord>).map(
          ([uid, caretaker]) => ({
            ...caretaker,
            uid: caretaker.uid || uid
          })
        ) as CaretakerRecord[])
      : [];

    const scoredCaretakers = caretakers
      .map((caretaker) => {
        const reliabilityScore = scoreCaretaker(caretaker);

        return {
          uid: caretaker.uid,
          name: caretaker.name || "Caregiver",
          status: caretaker.status || (caretaker.available ? "available" : "offline"),
          zone: caretaker.zone || caretaker.serviceZones?.[0] || "Unassigned",
          reliabilityScore,
          risk: riskFor(reliabilityScore, caretaker.status),
          punctualityScore: caretaker.punctualityScore || 0,
          rating: caretaker.rating || 0,
          repeatVisits: caretaker.repeatVisits || 0,
          activeAssignments: caretaker.activeAssignments || 0,
          maxAssignments: caretaker.maxAssignments || 0,
          signals: [
            caretaker.verified ? "Verified" : "Verification pending",
            caretaker.trained ? "Training active" : "Training pending",
            `${caretaker.yearsExperience || 0} yrs experience`,
            `${caretaker.languages?.slice(0, 2).join(", ") || "Language pending"}`
          ]
        };
      })
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    const online = scoredCaretakers.filter((caretaker) => caretaker.status !== "offline").length;
    const watch = scoredCaretakers.filter(
      (caretaker) => caretaker.risk === "watch" || caretaker.risk === "manual_review"
    ).length;
    const averageReliability = scoredCaretakers.length
      ? clamp(
          scoredCaretakers.reduce((sum, caretaker) => sum + caretaker.reliabilityScore, 0) /
            scoredCaretakers.length
        )
      : 0;

    const recommendation = scoredCaretakers[0]
      ? `Auto-match ${scoredCaretakers[0].name} first for premium family visits.`
      : "Seed verified caregivers before opening dispatch.";

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        averageReliability,
        online,
        watch,
        recommendedCaretakerId: scoredCaretakers[0]?.uid || "",
        recommendation,
        caretakers: scoredCaretakers
      }
    };
  }
};
