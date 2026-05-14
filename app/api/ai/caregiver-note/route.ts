import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { AiIntelligenceProvider } from "../../../../server/aiIntelligenceProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    rawNote?: string;
    serviceType?: string;
    recipientName?: string;
  }>(request);

  if (!body || !isNonEmptyString(body.rawNote)) {
    return jsonError("Caregiver note is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ai.caregiver_note.cleanup",
      resource: body.serviceType || "caregiver-note",
      status: "success",
      details: {
        actor: auth.session.role
      }
    },
    () =>
      AiIntelligenceProvider.cleanCaregiverNote({
        rawNote: body.rawNote || "",
        serviceType: body.serviceType,
        recipientName: body.recipientName
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, note: result.note });
}
