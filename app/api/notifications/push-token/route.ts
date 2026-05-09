import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { PushProvider, type PushPlatform } from "../../../../server/pushProvider";

const platforms: PushPlatform[] = ["android", "ios", "web"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 40
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    token?: string;
    platform?: PushPlatform;
    deviceId?: string;
  }>(request);

  if (!body || !isNonEmptyString(body.token) || !platforms.includes(body.platform || "web")) {
    return jsonError("Push token and platform are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "notification.push_token.register",
      resource: auth.session.uid || auth.session.username,
      status: "success",
      details: {
        platform: body.platform || "web",
        role: auth.session.role
      }
    },
    () =>
      PushProvider.registerToken({
        userId: auth.session.uid || auth.session.username,
        role: auth.session.role,
        token: body.token!,
        platform: body.platform || "web",
        deviceId: body.deviceId
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, token: result.token });
}
