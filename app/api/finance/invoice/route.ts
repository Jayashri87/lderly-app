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
  const auth = await requireApiSession(request, ["admin", "customer"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    bookingId?: string;
    gstin?: string;
    billTo?: string;
  }>(request);

  if (!body || !isNonEmptyString(body.bookingId)) {
    return jsonError("Booking id is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "finance.invoice.generate",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.role
      }
    },
    () =>
      FinanceProvider.generateInvoice({
        bookingId: body.bookingId!,
        gstin: body.gstin,
        billTo: body.billTo
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, invoice: result.invoice });
}
