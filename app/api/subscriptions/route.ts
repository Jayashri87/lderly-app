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
import { GoogleWorkspaceProvider } from "../../../server/googleWorkspaceProvider";

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

  await GoogleWorkspaceProvider.appendSubscriptionToOpsSheet({
    subscriptionId: result.subscription.id,
    userId: result.subscription.userId,
    recipientName: result.subscription.recipientName,
    packageId: result.subscription.packageId,
    cadence: result.subscription.cadence,
    serviceTypes: result.subscription.serviceTypes,
    amountLabel: result.subscription.amountLabel,
    status: result.subscription.status,
    nextBillingAt: result.subscription.nextBillingAt,
    nextVisitWindow: result.subscription.nextVisitWindow,
    actor: auth.session.role
  });

  return NextResponse.json({ ok: true, subscription: result.subscription });
}
