import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";
import { Complaint, OpsReliability } from "../../../../server/opsReliability";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<Partial<Complaint>>(request);

  if (!body?.bookingId || !body.type || !body.summary) {
    return jsonError("Booking, complaint type, and summary are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "support.complaint.create",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.role,
        type: body.type,
        severity: body.severity || "medium"
      }
    },
    () =>
      OpsReliability.createComplaint({
        userId: body.userId || auth.session.uid || auth.session.username,
        bookingId: body.bookingId!,
        caretakerId: body.caretakerId || "",
        type: body.type as Complaint["type"],
        severity: body.severity || "medium",
        summary: body.summary!
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendFeedbackToOpsSheet({
    complaintId: result.complaint.id,
    bookingId: result.complaint.bookingId,
    userId: result.complaint.userId,
    caretakerId: result.complaint.caretakerId,
    type: result.complaint.type,
    severity: result.complaint.severity,
    summary: result.complaint.summary,
    status: result.complaint.status,
    actor: auth.session.role
  });

  return NextResponse.json({ complaint: result.complaint });
}
