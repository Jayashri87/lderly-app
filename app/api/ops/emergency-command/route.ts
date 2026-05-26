import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { EmergencyCommandCenter } from "../../../../server/emergencyCommandCenter";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await EmergencyCommandCenter.getSnapshot();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}

const actions = [
  "acknowledge",
  "resolve_incident",
  "escalate_booking",
  "advance_emergency",
  "resolve_alert"
];
const targetTypes = ["alert", "booking", "emergency", "incident"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 90 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    action?: string;
    targetType?: string;
    targetId?: string;
    note?: string;
  }>(request);

  if (
    !body ||
    !body.action ||
    !actions.includes(body.action) ||
    !body.targetType ||
    !targetTypes.includes(body.targetType) ||
    !isNonEmptyString(body.targetId)
  ) {
    return NextResponse.json({ error: "Invalid command action payload" }, { status: 400 });
  }

  const result = await withMutationAudit(
    request,
    {
      action: `ops.command_center.${body.action}`,
      resource: body.targetId,
      status: "success",
      details: {
        targetType: body.targetType,
        actor: auth.session.username
      }
    },
    () =>
      EmergencyCommandCenter.recordAction({
        action: body.action as
          | "acknowledge"
          | "resolve_incident"
          | "escalate_booking"
          | "advance_emergency"
          | "resolve_alert",
        targetType: body.targetType as "alert" | "booking" | "emergency" | "incident",
        targetId: body.targetId || "",
        note: body.note,
        actor: auth.session.username
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, action: result.action });
}
