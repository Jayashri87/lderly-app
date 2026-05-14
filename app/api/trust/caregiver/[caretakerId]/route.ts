import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../../server/apiSecurity";
import { TrustProvider } from "../../../../../server/trustProvider";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caretakerId: string }> }
) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 120
  });

  if (!auth.ok) {
    return auth.response;
  }

  const { caretakerId } = await context.params;
  const result = await TrustProvider.caregiverProfile(caretakerId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ profile: result.profile });
}
