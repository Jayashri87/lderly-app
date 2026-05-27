import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession
} from "../../../../server/apiSecurity";
import { computeRouteEta } from "../../../../server/locationProvider";
import type { CareLocation } from "../../../../services/bookingService";

const isValidLocation = (value: unknown): value is CareLocation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const location = value as CareLocation;
  return (
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lng) <= 180
  );
};

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 120,
    csrf: false
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    origin?: CareLocation;
    destination?: CareLocation;
  }>(request);

  if (!isValidLocation(body?.origin) || !isValidLocation(body?.destination)) {
    return jsonError("Valid origin and destination are required", 400);
  }

  const route = await computeRouteEta(body.origin, body.destination);

  return NextResponse.json({
    ok: true,
    route
  });
}
