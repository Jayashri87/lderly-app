import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../../server/apiSecurity";
import { OpsReliability, RefundRequest } from "../../../../../../server/opsReliability";

const statuses: RefundRequest["status"][] = ["requested", "processing", "processed", "failed"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const { refundId } = await params;
  const body = await parseJsonBody<{
    status?: RefundRequest["status"];
    providerRefundId?: string;
    note?: string;
  }>(request);

  if (!body?.status || !statuses.includes(body.status)) {
    return jsonError("Valid refund status is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "payment.refund.status",
      resource: refundId,
      status: "success",
      details: {
        nextStatus: body.status
      }
    },
    () =>
      OpsReliability.updateRefundStatus({
        refundId,
        status: body.status!,
        providerRefundId: body.providerRefundId,
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ refund: result.refund });
}
