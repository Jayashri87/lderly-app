import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { FinanceProvider } from "../../../../server/financeProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    bookingId?: string;
    caretakerId?: string;
    incentiveAmount?: number;
  }>(request);

  if (!body || !isNonEmptyString(body.bookingId)) {
    return jsonError("Booking id is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "finance.payout.create",
      resource: body.bookingId,
      status: "success",
      details: {
        caretakerId: body.caretakerId
      }
    },
    () =>
      FinanceProvider.createPayout({
        bookingId: body.bookingId!,
        caretakerId: body.caretakerId,
        incentiveAmount: body.incentiveAmount || 0
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, payout: result.payout });
}
