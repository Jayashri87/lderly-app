import { NextRequest } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import { getAdminDatabase } from "../../../../server/firebaseAdmin";
import { computeRouteEta } from "../../../../server/locationProvider";
import type { CareBooking, CareLocation } from "../../../../services/bookingService";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const validLocation = (value: unknown): value is CareLocation =>
  Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as CareLocation).lat === "number" &&
      typeof (value as CareLocation).lng === "number"
  );

const routeKeyFor = (caretaker?: CareLocation, customer?: CareLocation) =>
  validLocation(caretaker) && validLocation(customer)
    ? `${caretaker.lat.toFixed(5)},${caretaker.lng.toFixed(5)}:${customer.lat.toFixed(5)},${customer.lng.toFixed(5)}`
    : "";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 20,
    appCheck: false
  });

  if (!auth.ok) {
    return auth.response;
  }

  const bookingId = request.nextUrl.searchParams.get("bookingId") || "";
  if (!bookingId) {
    return new Response("bookingId is required", { status: 400 });
  }

  const database = getAdminDatabase();
  if (!database) {
    return new Response("Firebase Admin is not configured", { status: 503 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const bookingRef = database.ref(`bookings/byId/${bookingId}`);
      let closed = false;
      let lastRouteKey = "";
      let heartbeat = 0;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (!closed) {
          controller.enqueue(chunk);
        }
      };

      const sendRoute = async (booking: CareBooking | null) => {
        if (!booking?.tracking) {
          safeEnqueue(sse("pending", { ok: true, reason: "tracking_not_ready" }));
          return;
        }

        const caretaker = booking.tracking.caretakerLocation;
        const customer = booking.tracking.customerLocation;
        const routeKey = routeKeyFor(caretaker, customer);

        if (!routeKey || routeKey === lastRouteKey) {
          return;
        }

        lastRouteKey = routeKey;
        const route = await computeRouteEta(caretaker, customer);
        safeEnqueue(
          sse("route", {
            ok: true,
            bookingId,
            route,
            updatedAt: Date.now()
          })
        );
      };

      const onValue = (snapshot: unknown) => {
        const booking = (snapshot as { val: () => CareBooking | null }).val();
        sendRoute(booking).catch((error) => {
          safeEnqueue(
            sse("error", {
              ok: false,
              error: error instanceof Error ? error.message : "Route stream failed"
            })
          );
        });
      };

      bookingRef.on("value", onValue);
      safeEnqueue(sse("connected", { ok: true, bookingId, connectedAt: Date.now() }));
      heartbeat = setInterval(() => {
        safeEnqueue(sse("heartbeat", { ok: true, at: Date.now() }));
      }, 25_000) as unknown as number;

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        bookingRef.off("value", onValue);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
