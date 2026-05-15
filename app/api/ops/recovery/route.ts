import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { OpsRecoveryProvider } from "../../../../server/opsRecoveryProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await OpsRecoveryProvider.getSnapshot();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 90 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    bookingId?: string;
    note?: string;
  }>(request);

  if (!body || !isNonEmptyString(body.bookingId)) {
    return NextResponse.json({ error: "Invalid recovery payload" }, { status: 400 });
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ops.recovery.execute",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () =>
      OpsRecoveryProvider.recoverBooking({
        bookingId: body.bookingId || "",
        actor: auth.session.username || "ops",
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
    booking: result.booking || null
  });
}
