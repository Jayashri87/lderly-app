import type { CareBooking } from "../services/bookingService";
import type { UserRole } from "../services/authService";

type RealtimeSession = {
  role: UserRole;
  uid?: string;
  username?: string;
};

const sessionIdsFor = (session: RealtimeSession) =>
  new Set([session.uid, session.username].filter(Boolean).map((value) => String(value)));

export const canAccessBookingRealtime = (session: RealtimeSession, booking: CareBooking) => {
  if (session.role === "admin" || session.role === "superadmin") {
    return true;
  }

  const ids = sessionIdsFor(session);

  if (session.role === "customer") {
    return ids.has(booking.customerId);
  }

  if (session.role === "caretaker") {
    if (ids.has(booking.caretakerId) || ids.has(booking.dispatch?.acceptedBy || "")) {
      return true;
    }

    return Object.entries(booking.dispatch?.offers || {}).some(
      ([caretakerId, offer]) => ids.has(caretakerId) && offer.status === "accepted"
    );
  }

  return false;
};

export const canUpdateBookingLocation = (session: RealtimeSession, booking: CareBooking) => {
  if (session.role === "admin" || session.role === "superadmin") {
    return true;
  }

  if (session.role !== "caretaker") {
    return false;
  }

  if (
    ["completed", "payment_settled", "report_generated", "cancelled", "none"].includes(
      booking.status
    )
  ) {
    return false;
  }

  return canAccessBookingRealtime(session, booking);
};
