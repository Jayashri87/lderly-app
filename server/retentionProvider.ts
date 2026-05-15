import type { CareBooking } from "../services/bookingService";
import type { CareProfile } from "../services/profileService";
import type { VisitReport } from "../services/reportService";
import { getAdminDatabase } from "./firebaseAdmin";

type RetentionAction = {
  id: string;
  title: string;
  body: string;
  cta: string;
  kind: "rebook" | "recurring" | "family_digest" | "medical_followup";
  serviceType: string;
  priority: "normal" | "recommended" | "urgent";
};

const completedStatuses = ["completed", "payment_settled", "report_generated"];

const cleanService = (service?: string) =>
  (service || "Companion Care").split(" for ")[0].trim();

const newestFirst = <T extends { updatedAt?: number; createdAt?: number; completedAt?: number }>(
  items: T[]
) =>
  [...items].sort(
    (a, b) =>
      (b.completedAt || b.updatedAt || b.createdAt || 0) -
      (a.completedAt || a.updatedAt || a.createdAt || 0)
  );

export const RetentionProvider = {
  async summary({ userId, recipientName }: { userId: string; recipientName?: string }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const [bookingsSnapshot, reportsSnapshot, profileSnapshot, subscriptionsSnapshot] =
      await Promise.all([
        database.ref("bookings/byId").get(),
        database.ref(`reports/byUser/${userId}`).get(),
        database.ref(`profiles/${userId}`).get(),
        database.ref(`subscriptions/byUser/${userId}`).get()
      ]);
    const bookings = newestFirst(
      Object.values((bookingsSnapshot.val() || {}) as Record<string, CareBooking>).filter(
        (booking) => booking.customerId === userId
      )
    );
    const reports = newestFirst(
      Object.values((reportsSnapshot.val() || {}) as Record<string, VisitReport>)
    );
    const profile = profileSnapshot.val() as CareProfile | null;
    const subscriptions = Object.keys(
      (subscriptionsSnapshot.val() || {}) as Record<string, unknown>
    );
    const lastBooking = bookings[0];
    const lastCompleted = bookings.find((booking) => completedStatuses.includes(booking.status));
    const lastReport = reports[0];
    const recurringActive = subscriptions.length > 0;
    const serviceType = cleanService(lastReport?.serviceType || lastCompleted?.serviceType || lastBooking?.serviceType);
    const caretakerName =
      lastCompleted?.caretakerName || lastBooking?.caretakerName || "the familiar caregiver";
    const missedMedicine =
      lastReport?.medicineSummary?.toLowerCase().includes("miss") ||
      lastReport?.familySummary?.toLowerCase().includes("watch") ||
      lastReport?.caregiverNote?.toLowerCase().includes("watch");
    const actions: RetentionAction[] = [
      ...(lastCompleted
        ? [
            {
              id: "rebook-same-caregiver",
              title: `Rebook ${caretakerName}`,
              body: `${caretakerName} already knows ${recipientName || "your parent"}'s preferences. Repeat caregivers reduce family anxiety.`,
              cta: "Rebook familiar care",
              kind: "rebook" as const,
              serviceType,
              priority: "recommended" as const
            }
          ]
        : []),
      ...(!recurringActive
        ? [
            {
              id: "start-recurring-care",
              title: "Start a weekly reassurance plan",
              body: "A recurring visit keeps medicine, wellbeing, and family updates visible without booking every time.",
              cta: "Set weekly care",
              kind: "recurring" as const,
              serviceType: serviceType || "Parent Wellness Plan",
              priority: "recommended" as const
            }
          ]
        : []),
      ...(missedMedicine
        ? [
            {
              id: "medicine-followup",
              title: "Medicine follow-up recommended",
              body: "The last care summary has a watch signal. Schedule medicine help or ask ops to verify the next dose.",
              cta: "Book medicine help",
              kind: "medical_followup" as const,
              serviceType: "Medicine Help",
              priority: "urgent" as const
            }
          ]
        : []),
      {
        id: "family-digest",
        title: "Share a family reassurance digest",
        body: reports.length
          ? `${reports.length} visit update(s) can be summarized for siblings or NRI family members.`
          : "Once the first visit is completed, LDERLY will turn care notes into a family-ready summary.",
        cta: "Prepare digest",
        kind: "family_digest" as const,
        serviceType,
        priority: "normal" as const
      }
    ].slice(0, 4);
    const retentionScore = Math.min(
      100,
      62 + Math.min(18, reports.length * 4) + (recurringActive ? 15 : 0) + (lastCompleted ? 5 : 0)
    );
    const summary = {
      id: `retention-${userId}-${Date.now()}`,
      userId,
      recipientName: recipientName || profile?.elderName || "Parent",
      generatedAt: Date.now(),
      retentionScore,
      recurringActive,
      lastServiceType: serviceType,
      preferredCaregiverName: caretakerName,
      completedVisits: bookings.filter((booking) => completedStatuses.includes(booking.status)).length,
      familyDigestReady: reports.length > 0,
      headline: recurringActive
        ? "Care continuity is active"
        : "Turn this visit into ongoing reassurance",
      reassuranceLine: recurringActive
        ? `${recipientName || "Your parent"} has an active recurring care layer.`
        : `A weekly rhythm and familiar caregiver will make care feel more predictable for the family.`,
      nextBestAction: actions[0]?.cta || "Book the next care visit",
      actions
    };

    await database.ref(`retentionSummaries/byUser/${userId}/${summary.id}`).set(summary);

    return { ok: true as const, summary };
  }
};
