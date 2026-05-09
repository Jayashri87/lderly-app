import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { ReassuranceAI } from "../../../../server/reassuranceAI";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin", "caretaker"], {
    rateLimit: 80
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    bookingId?: string;
    serviceType?: string;
    recipientName?: string;
  }>(request);
  const userId =
    auth.session.role === "customer" ? auth.session.uid : body?.userId || auth.session.uid;

  if (
    !isNonEmptyString(userId) ||
    !isNonEmptyString(body?.serviceType) ||
    !isNonEmptyString(body?.recipientName)
  ) {
    return jsonError("User, service, and recipient are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ai.reassurance.generate",
      resource: body.bookingId || userId,
      status: "success",
      details: {
        actor: auth.session.role,
        serviceType: body.serviceType
      }
    },
    () =>
      ReassuranceAI.generate({
        userId,
        bookingId: body.bookingId,
        serviceType: body.serviceType!,
        recipientName: body.recipientName!
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ insight: result.insight });
}
