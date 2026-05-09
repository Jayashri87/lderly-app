import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  CareQualityProvider,
  type IncidentSeverity
} from "../../../../server/careQualityProvider";

const severities: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const categories = ["fall_risk", "medical", "safety", "service", "other"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    caretakerId?: string;
    bookingId?: string;
    severity?: IncidentSeverity;
    category?: "fall_risk" | "medical" | "safety" | "service" | "other";
    summary?: string;
  }>(request);

  if (
    !body ||
    !isNonEmptyString(body.userId) ||
    !body.severity ||
    !severities.includes(body.severity) ||
    !body.category ||
    !categories.includes(body.category) ||
    !isNonEmptyString(body.summary)
  ) {
    return jsonError("Valid incident details are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "care_quality.incident.create",
      resource: body.bookingId || body.userId,
      status: "success",
      details: {
        actor: auth.session.role,
        severity: body.severity,
        category: body.category
      }
    },
    () =>
      CareQualityProvider.createIncident({
        userId: body.userId!,
        caretakerId: body.caretakerId || auth.session.uid,
        bookingId: body.bookingId,
        severity: body.severity!,
        category: body.category!,
        summary: body.summary!
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, incident: result.incident });
}
