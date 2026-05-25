import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";
import { OpsReliability } from "../../../../server/opsReliability";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ bookingId?: string; reason?: string }>(request);

  if (!body?.bookingId || !body.reason) {
    return jsonError("Booking id and refund reason are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "payment.refund.request",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.role,
        reason: body.reason
      }
    },
    () =>
      OpsReliability.requestRefund({
        bookingId: body.bookingId!,
        reason: body.reason!,
        requestedBy: auth.session.role
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendRefundToOpsSheet({
    refundId: result.refund.id,
    bookingId: result.refund.bookingId,
    userId: result.refund.userId,
    paymentId: result.refund.paymentId,
    amountPaise: result.refund.amountPaise,
    reason: result.refund.reason,
    status: result.refund.status,
    actor: auth.session.role
  });

  return NextResponse.json({ refund: result.refund });
}
