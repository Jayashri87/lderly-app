import { getAdminDatabase } from "./firebaseAdmin";
import type { CareBooking, CareLocation } from "../services/bookingService";

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
  currentLocation?: CareLocation;
  lastSeenAt?: number;
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

const defaultCustomerLocation: CareLocation = { lat: 12.9716, lng: 77.5946 };
const defaultCaretakerLocation: CareLocation = { lat: 12.985, lng: 77.61 };

const distanceKm = (a: CareLocation, b: CareLocation) => {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const serviceSkillFit = (booking: CareBooking, caretaker: CaretakerRecord) => {
  const skills = caretaker.skills || [];
  const requiredSkills = booking.matching?.requiredSkills || [];

  if (!requiredSkills.length) {
    return 70;
  }

  const matches = requiredSkills.filter((skill) => skills.includes(skill)).length;
  return clamp((matches / requiredSkills.length) * 100);
};

const dispatchScoreFor = (booking: CareBooking, caretaker: CaretakerRecord) => {
  const reliabilityScore = scoreCaretaker(caretaker);
  const skillScore = serviceSkillFit(booking, caretaker);
  const zoneScore =
    caretaker.zone === booking.matching?.zone ||
    caretaker.serviceZones?.includes(booking.matching?.zone)
      ? 100
      : 45;
  const location = caretaker.currentLocation || defaultCaretakerLocation;
  const destination = booking.tracking?.customerLocation || defaultCustomerLocation;
  const proximityKm = distanceKm(location, destination);
  const proximityScore = clamp(100 - proximityKm * 12);
  const capacityScore =
    (caretaker.activeAssignments || 0) < Math.max(caretaker.maxAssignments || 1, 1)
      ? 100
      : 0;
  const availabilityScore =
    caretaker.available && caretaker.status !== "offline" && caretaker.status !== "on_visit"
      ? 100
      : caretaker.status === "standby"
        ? 70
        : 0;
  const preferredScore =
    booking.matching?.preferredCaretakerId &&
    booking.matching.preferredCaretakerId === caretaker.uid
      ? 100
      : 0;
  const matchScore = clamp(
    reliabilityScore * 0.28 +
      skillScore * 0.2 +
      proximityScore * 0.18 +
      availabilityScore * 0.16 +
      zoneScore * 0.1 +
      capacityScore * 0.06 +
      preferredScore * 0.02
  );

  return {
    matchScore,
    reliabilityScore,
    skillScore,
    proximityKm: Math.round(proximityKm * 10) / 10,
    proximityScore,
    availabilityScore,
    zoneScore,
    capacityScore
  };
};

const delayMinutesFor = (booking: CareBooking, timestamp: number) => {
  const assignmentPending = ["requested", "searching"].includes(booking.status);
  const arrivalPending = ["assigned", "accepted", "en_route"].includes(booking.status);
  const dueAt = assignmentPending
    ? booking.sla?.assignmentDueAt
    : arrivalPending
      ? booking.sla?.arrivalDueAt
      : 0;

  return dueAt ? Math.max(0, Math.round((timestamp - dueAt) / 60000)) : 0;
};

const activeBooking = (booking: CareBooking) =>
  booking.status &&
  !["completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
    booking.status
  );

export const CaregiverIntelligence = {
  async getReliabilitySnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [snapshot, bookingsSnapshot] = await Promise.all([
      database.ref("caretakers").get(),
      database.ref("bookings/byId").get()
    ]);
    const caretakers = snapshot.exists()
      ? (Object.entries(snapshot.val() as Record<string, CaretakerRecord>).map(
          ([uid, caretaker]) => ({
            ...caretaker,
            uid: caretaker.uid || uid
          })
        ) as CaretakerRecord[])
      : [];
    const bookings = Object.values(
      (bookingsSnapshot.val() || {}) as Record<string, CareBooking>
    ).filter(activeBooking);

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
          ],
          availabilityScore:
            caretaker.available && caretaker.status !== "offline" && caretaker.status !== "on_visit"
              ? 100
              : caretaker.status === "standby"
                ? 70
                : 0,
          activeBookingId: (caretaker as CaretakerRecord & { activeBookingId?: string })
            .activeBookingId || "",
          lastSeenAt: caretaker.lastSeenAt || 0
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
    const timestamp = Date.now();
    const scoredDispatch = bookings.map((booking) => {
      const candidates = caretakers
        .filter((caretaker) => caretaker.uid !== booking.caretakerId)
        .map((caretaker) => ({
          caretaker,
          ...dispatchScoreFor(booking, caretaker)
        }))
        .sort((a, b) => b.matchScore - a.matchScore);
      const recommended = candidates[0];
      const backup = candidates[1];
      const delayMinutes = delayMinutesFor(booking, timestamp);
      const risk =
        booking.sla?.status === "breached" || delayMinutes >= 5
          ? "breach"
          : booking.sla?.status === "watch" || delayMinutes > 0
            ? "watch"
            : "healthy";

      return {
        bookingId: booking.id,
        customerName: booking.customerName,
        serviceType: booking.serviceType,
        status: booking.status,
        priority: booking.matching?.priority || "normal",
        slaStatus: booking.sla?.status || "healthy",
        delayMinutes,
        currentCaretakerId: booking.caretakerId,
        currentCaretakerName: booking.caretakerName,
        recommendedCaretakerId: recommended?.caretaker.uid || "",
        recommendedCaretakerName: recommended?.caretaker.name || "",
        backupCaretakerId: backup?.caretaker.uid || "",
        backupCaretakerName: backup?.caretaker.name || "",
        matchScore: recommended?.matchScore || 0,
        backupScore: backup?.matchScore || 0,
        proximityKm: recommended?.proximityKm || 0,
        skillScore: recommended?.skillScore || 0,
        reliabilityScore: recommended?.reliabilityScore || 0,
        risk,
        reason: recommended
          ? `${recommended.caretaker.name} is the best match: ${recommended.matchScore}% fit, ${recommended.proximityKm} km away, ${recommended.skillScore}% skill fit.`
          : "No backup caregiver is currently available."
      };
    });
    const dispatchRecommendations = scoredDispatch
      .filter(
        (item) =>
          item.risk !== "healthy" ||
          ["requested", "searching"].includes(item.status) ||
          !item.currentCaretakerId
      )
      .sort((a, b) => {
        const riskWeight = { breach: 3, watch: 2, healthy: 1 };
        return (
          riskWeight[b.risk as keyof typeof riskWeight] -
            riskWeight[a.risk as keyof typeof riskWeight] ||
          b.matchScore - a.matchScore
        );
      })
      .slice(0, 8);
    const conflicts = caretakers
      .filter(
        (caretaker) =>
          (caretaker.activeAssignments || 0) >= Math.max(caretaker.maxAssignments || 1, 1) ||
          caretaker.status === "on_visit"
      )
      .map((caretaker) => ({
        caretakerId: caretaker.uid,
        caretakerName: caretaker.name || "Caregiver",
        activeAssignments: caretaker.activeAssignments || 0,
        maxAssignments: caretaker.maxAssignments || 0,
        status: caretaker.status || "available",
        severity:
          (caretaker.activeAssignments || 0) > Math.max(caretaker.maxAssignments || 1, 1)
            ? "breach"
            : "watch"
      }));

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        averageReliability,
        online,
        watch,
        recommendedCaretakerId: scoredCaretakers[0]?.uid || "",
        recommendation,
        delayedAssignments: dispatchRecommendations.filter((item) =>
          ["requested", "searching"].includes(item.status)
        ).length,
        reassignmentRecommendations: dispatchRecommendations.filter(
          (item) => item.currentCaretakerId && item.backupCaretakerId
        ).length,
        dispatchRecommendations,
        conflicts,
        caretakers: scoredCaretakers
      }
    };
  }
};
