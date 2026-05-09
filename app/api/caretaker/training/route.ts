import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { CareQualityProvider } from "../../../../server/careQualityProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    badgeId?: string;
    title?: string;
    expiresAt?: number;
  }>(request);

  if (
    !body ||
    !isNonEmptyString(body.caretakerId) ||
    !isNonEmptyString(body.badgeId) ||
    !isNonEmptyString(body.title)
  ) {
    return jsonError("Caretaker, badge, and title are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "caretaker.training.award",
      resource: body.caretakerId,
      status: "success",
      details: {
        badgeId: body.badgeId
      }
    },
    () =>
      CareQualityProvider.awardTrainingBadge({
        caretakerId: body.caretakerId!,
        badgeId: body.badgeId!,
        title: body.title!,
        expiresAt: body.expiresAt
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, badge: result.badge });
}
