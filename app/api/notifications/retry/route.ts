import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { NotificationRetryProvider } from "../../../../server/notificationRetryProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await withMutationAudit(
    request,
    {
      action: "notification.retry_due",
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () => NotificationRetryProvider.processDue()
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, run: result.run });
}
