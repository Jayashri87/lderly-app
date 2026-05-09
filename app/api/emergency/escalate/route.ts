import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  EmergencyEscalation,
  type EmergencyEscalationStage
} from "../../../../server/emergencyEscalation";

const stages: EmergencyEscalationStage[] = [
  "ambulance",
  "customer",
  "family",
  "hospital",
  "ops"
];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 20
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    action?: "advance" | "create";
    userId?: string;
    bookingId?: string;
    reason?: string;
    locationLabel?: string;
    severity?: "high" | "critical";
    escalationId?: string;
    stage?: EmergencyEscalationStage;
    note?: string;
  }>(request);

  if (!body?.action) {
    return jsonError("Escalation action is required", 400);
  }

  if (body.action === "advance") {
    if (!isNonEmptyString(body.escalationId) || !body.stage || !stages.includes(body.stage)) {
      return jsonError("Escalation id and valid stage are required", 400);
    }

    const result = await withMutationAudit(
      request,
      {
        action: "emergency.escalation.advance",
        resource: body.escalationId,
        status: "success",
        details: {
          actor: auth.session.role,
          stage: body.stage
        }
      },
      () =>
        EmergencyEscalation.advance({
          escalationId: body.escalationId!,
          stage: body.stage!,
          note: body.note
        })
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, escalation: result.escalation });
  }

  if (!isNonEmptyString(body.reason)) {
    return jsonError("Emergency reason is required", 400);
  }

  const userId =
    auth.session.role === "customer"
      ? auth.session.uid
      : body.userId || auth.session.uid;

  if (!isNonEmptyString(userId)) {
    return jsonError("User id is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "emergency.escalation.create",
      resource: body.bookingId || userId,
      status: "success",
      details: {
        actor: auth.session.role,
        severity: body.severity || "critical"
      }
    },
    () =>
      EmergencyEscalation.create({
        userId,
        bookingId: body.bookingId,
        reason: body.reason!,
        locationLabel: body.locationLabel,
        severity: body.severity
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, escalation: result.escalation });
}
