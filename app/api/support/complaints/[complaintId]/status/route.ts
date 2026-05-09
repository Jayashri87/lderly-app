import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../../server/apiSecurity";
import { Complaint, OpsReliability } from "../../../../../../server/opsReliability";

const statuses: Complaint["status"][] = ["open", "ops_review", "action_taken", "resolved"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ complaintId: string }> }
) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const { complaintId } = await params;
  const body = await parseJsonBody<{ status?: Complaint["status"]; note?: string }>(request);

  if (!body?.status || !statuses.includes(body.status)) {
    return jsonError("Valid complaint status is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "support.complaint.status",
      resource: complaintId,
      status: "success",
      details: {
        nextStatus: body.status
      }
    },
    () =>
      OpsReliability.updateComplaintStatus({
        complaintId,
        status: body.status!,
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ complaint: result.complaint });
}
