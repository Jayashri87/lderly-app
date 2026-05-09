import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { TrustedBooking } from "../../../../server/trustedBooking";

const validStatuses = ["available", "standby", "offline", "on_visit"] as const;

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    available?: boolean;
    status?: (typeof validStatuses)[number];
    shiftEndsAt?: number;
  }>(request);
  const caretakerId =
    auth.session.role === "admin"
      ? body?.caretakerId || auth.session.uid || auth.session.username
      : auth.session.uid || auth.session.username;

  if (!body || typeof body.available !== "boolean" || !body.status) {
    return jsonError("Availability and status are required", 400);
  }

  if (!validStatuses.includes(body.status)) {
    return jsonError("Invalid caretaker status", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "caretaker.availability",
      resource: caretakerId,
      status: "success",
      details: {
        actor: auth.session.role,
        available: body.available,
        caretakerStatus: body.status
      }
    },
    () =>
      TrustedBooking.updateCaretakerAvailability(caretakerId, {
        available: body.available!,
        status: body.status!,
        shiftEndsAt: body.shiftEndsAt
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
