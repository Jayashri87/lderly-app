import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, withMutationAudit } from "../../../server/apiSecurity";
import { PartnerMarketplace } from "../../../server/partnerMarketplace";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await withMutationAudit(
    request,
    {
      action: "partners.seed",
      resource: "partners",
      status: "success",
      details: {
        actor: auth.session.role
      }
    },
    () => PartnerMarketplace.seedDefaults()
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, partners: result.partners });
}
