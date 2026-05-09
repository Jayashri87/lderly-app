import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../server/apiSecurity";
import {
  SubscriptionProvider,
  type SubscriptionCadence
} from "../../../server/subscriptionProvider";

const cadences: SubscriptionCadence[] = ["monthly", "weekly"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "customer"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    recipientName?: string;
    packageId?: string;
    cadence?: SubscriptionCadence;
    serviceTypes?: string[];
    amountLabel?: string;
    startDate?: string;
  }>(request);
  const userId =
    auth.session.role === "customer"
      ? auth.session.uid
      : body?.userId || auth.session.uid;

  if (
    !body ||
    !isNonEmptyString(userId) ||
    !isNonEmptyString(body.recipientName) ||
    !isNonEmptyString(body.packageId) ||
    !body.cadence ||
    !cadences.includes(body.cadence)
  ) {
    return jsonError("Valid subscription details are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "subscription.create",
      resource: userId,
      status: "success",
      details: {
        actor: auth.session.role,
        cadence: body.cadence,
        packageId: body.packageId
      }
    },
    () =>
      SubscriptionProvider.createPlan({
        userId,
        recipientName: body.recipientName!,
        packageId: body.packageId!,
        cadence: body.cadence!,
        serviceTypes: body.serviceTypes || ["Companion check-in"],
        amountLabel: body.amountLabel || "Custom",
        startDate: body.startDate
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, subscription: result.subscription });
}
