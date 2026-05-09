import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { buildPricingQuote, PricingQuoteInput } from "../../../../server/carePricing";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 90 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<PricingQuoteInput>(request);

  if (!body?.serviceType || !body.durationLabel) {
    return jsonError("Service type and duration are required", 400);
  }

  const quote = await withMutationAudit(
    request,
    {
      action: "pricing.quote",
      resource: body.serviceType,
      status: "success",
      details: {
        actor: auth.session.role,
        duration: body.durationLabel
      }
    },
    async () => buildPricingQuote(body)
  );

  return NextResponse.json({ quote });
}
