import { NextRequest, NextResponse } from "next/server";
import { isNonEmptyString, requireApiSession } from "../../../../server/apiSecurity";
import { TrustProvider } from "../../../../server/trustProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 120
  });

  if (!auth.ok) {
    return auth.response;
  }

  const bookingId = request.nextUrl.searchParams.get("bookingId");

  if (!isNonEmptyString(bookingId)) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const result = await TrustProvider.visitProof(bookingId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ proof: result.proof });
}
