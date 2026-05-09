import { getAdminDatabase } from "./firebaseAdmin";

const serviceCopy = (serviceType: string) => {
  const service = serviceType.toLowerCase();

  if (service.includes("medicine")) {
    return {
      headline: "Medicine support is being watched closely.",
      summary: "Your family will see timing, adherence, and follow-up notes in one calm update.",
      nextAction: "Keep the medicine schedule visible for the next caregiver."
    };
  }

  if (service.includes("doctor") || service.includes("hospital") || service.includes("lab")) {
    return {
      headline: "Health visit support is coordinated.",
      summary: "Appointment, travel, notes, reports, and family handover stay connected.",
      nextAction: "Share any new prescription or report as soon as the visit ends."
    };
  }

  if (service.includes("companion") || service.includes("walk") || service.includes("temple")) {
    return {
      headline: "Companionship care is ready.",
      summary: "The visit is focused on comfort, familiar presence, and family reassurance.",
      nextAction: "Ask for a voice note after the visit for a more personal update."
    };
  }

  return {
    headline: "Care is being coordinated calmly.",
    summary: "The care plan, caregiver updates, and family visibility are connected.",
    nextAction: "Review the live care feed after the caregiver starts the session."
  };
};

export const ReassuranceAI = {
  async generate({
    userId,
    bookingId = "",
    serviceType,
    recipientName
  }: {
    userId: string;
    bookingId?: string;
    serviceType: string;
    recipientName: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const copy = serviceCopy(serviceType);
    const id = `reassurance-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const insight = {
      id,
      userId,
      bookingId,
      serviceType,
      recipientName,
      headline: copy.headline.replace("Care", `${recipientName}'s care`),
      summary: copy.summary,
      emotionalMessage: `Everything we know right now is organized around one thing: keeping ${recipientName} safe, visible, and supported.`,
      nextAction: copy.nextAction,
      model: "deterministic-free-ai-placeholder",
      createdAt: Date.now()
    };

    await database.ref().update({
      [`aiReassurance/byId/${id}`]: insight,
      [`aiReassurance/byUser/${userId}/${id}`]: true,
      ...(bookingId ? { [`aiReassurance/byBooking/${bookingId}/${id}`]: true } : {})
    });

    return { ok: true as const, insight };
  }
};
