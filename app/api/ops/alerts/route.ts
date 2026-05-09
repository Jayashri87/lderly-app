import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  dispatchInternalOpsAlert,
  type InternalOpsAlertKind
} from "../../../../server/internalOpsProvider";

const alertKinds: InternalOpsAlertKind[] = [
  "ai_risk",
  "emergency",
  "incident",
  "late_checkin",
  "sla_breach"
];
const severities = ["low", "medium", "high", "critical"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    kind?: string;
    title?: string;
    message?: string;
    bookingId?: string;
    severity?: string;
  }>(request);

  if (
    !body ||
    !body.kind ||
    !alertKinds.includes(body.kind as InternalOpsAlertKind) ||
    !isNonEmptyString(body.title) ||
    !isNonEmptyString(body.message)
  ) {
    return NextResponse.json({ error: "Invalid ops alert payload" }, { status: 400 });
  }

  if (body.severity && !severities.includes(body.severity)) {
    return NextResponse.json({ error: "Invalid alert severity" }, { status: 400 });
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ops.internal_alert",
      resource: body.bookingId || body.kind,
      status: "success",
      details: {
        kind: body.kind,
        severity: body.severity || "medium"
      }
    },
    () =>
      dispatchInternalOpsAlert({
        kind: body.kind as InternalOpsAlertKind,
        title: body.title || "",
        message: body.message || "",
        bookingId: body.bookingId,
        severity: body.severity as "low" | "medium" | "high" | "critical" | undefined
      })
  );

  return NextResponse.json(result);
}
