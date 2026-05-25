import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";
import { PushProvider } from "../../../../server/pushProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], {
    rateLimit: 120
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
  }>(request);

  if (
    !body ||
    !isNonEmptyString(body.userId) ||
    !isNonEmptyString(body.title) ||
    !isNonEmptyString(body.body)
  ) {
    return jsonError("User, title, and body are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "notification.push_dispatch",
      resource: body.userId,
      status: "success",
      details: {
        actor: auth.session.role,
        title: body.title
      }
    },
    () =>
      PushProvider.dispatchToUser({
        userId: body.userId!,
        title: body.title!,
        body: body.body!,
        data: body.data || {}
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendPushNotificationToOpsSheet({
    dispatchId: result.dispatch.id,
    userId: body.userId,
    title: body.title,
    body: body.body,
    status: result.dispatch.status,
    mode: "mode" in result.dispatch ? result.dispatch.mode : "no_tokens",
    attempted: "attempted" in result.dispatch ? result.dispatch.attempted : 0,
    sent: result.dispatch.sent,
    failed: result.dispatch.failed,
    actor: auth.session.role
  });

  return NextResponse.json({ ok: true, dispatch: result.dispatch });
}
