import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession
} from "../../../../server/apiSecurity";
import { resolveLocation } from "../../../../server/locationProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin", "caretaker"], {
    rateLimit: 120
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ address?: string }>(request);

  if (!body?.address) {
    return jsonError("Address is required", 400);
  }

  const location = await resolveLocation(body.address);

  return NextResponse.json({ location });
}

