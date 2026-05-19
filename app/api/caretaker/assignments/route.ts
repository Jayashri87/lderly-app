import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";
import type { CareBooking, DispatchOffer } from "../../../../services/bookingService";

type CaretakerRecord = {
  uid?: string;
  name?: string;
  status?: string;
  available?: boolean;
  activeBookingId?: string;
  activeAssignments?: number;
  offers?: Record<
    string,
    DispatchOffer & {
      serviceType?: string;
      customerName?: string;
      destinationLabel?: string;
      expiresAt?: number;
    }
  >;
  rating?: number;
  punctualityScore?: number;
  repeatVisits?: number;
};

const activeStatuses = new Set([
  "searching",
  "assigned",
  "accepted",
  "en_route",
  "arrived",
  "in_progress"
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker"], {
    rateLimit: 120,
    csrf: false
  });

  if (!auth.ok) {
    return auth.response;
  }

  const database = getAdminDatabase();

  if (!database) {
    return NextResponse.json({ error: "Firebase Admin is not configured" }, { status: 503 });
  }

  const caretakerId = auth.session.uid || auth.session.username;

  if (!caretakerId) {
    return NextResponse.json({ error: "Caretaker session missing" }, { status: 401 });
  }

  const caretakerSnapshot = await database.ref(`caretakers/${caretakerId}`).get();
  const caretaker = (caretakerSnapshot.val() || {}) as CaretakerRecord;
  const bookingIds = new Set<string>();

  if (caretaker.activeBookingId) {
    bookingIds.add(caretaker.activeBookingId);
  }

  Object.keys(caretaker.offers || {}).forEach((bookingId) => bookingIds.add(bookingId));

  const bookings = (
    await Promise.all(
      Array.from(bookingIds).map(async (bookingId) => {
        const snapshot = await database.ref(`bookings/byId/${bookingId}`).get();
        return snapshot.val() as CareBooking | null;
      })
    )
  )
    .filter((booking): booking is CareBooking => Boolean(booking))
    .filter(
      (booking) =>
        activeStatuses.has(booking.status) &&
        (booking.caretakerId === caretakerId ||
          Boolean(booking.dispatch?.offers?.[caretakerId]) ||
          Boolean(caretaker.offers?.[booking.id]))
    )
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  const offers = Object.values(caretaker.offers || {}).filter(
    (offer) => offer.status === "sent" || offer.status === "accepted"
  );

  return NextResponse.json({
    caretaker: {
      uid: caretakerId,
      name: caretaker.name || auth.session.username || "Caregiver",
      status: caretaker.status || "offline",
      available: Boolean(caretaker.available),
      activeAssignments: caretaker.activeAssignments || 0,
      rating: caretaker.rating || 0,
      punctualityScore: caretaker.punctualityScore || 0,
      repeatVisits: caretaker.repeatVisits || 0
    },
    bookings,
    offers,
    serverTime: Date.now()
  });
}
