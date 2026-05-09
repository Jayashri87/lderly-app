import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { CareProfileStore } from "../../../../server/carePricing";
import type { FamilyMemberAccess } from "../../../../services/profileService";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    familyMemberId?: string;
    reportId?: string;
    permissions?: FamilyMemberAccess["permissions"];
  }>(request);
  const userId =
    auth.session.role === "admin"
      ? body?.userId || auth.session.uid || auth.session.username
      : auth.session.uid || auth.session.username;

  if (!body?.familyMemberId || !body.reportId || !userId) {
    return jsonError("Family member and report are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "reports.family_access.grant",
      resource: body.reportId,
      status: "success",
      details: {
        actor: auth.session.role,
        familyMemberId: body.familyMemberId
      }
    },
    () =>
      CareProfileStore.grantFamilyReportAccess({
        userId,
        familyMemberId: body.familyMemberId!,
        reportId: body.reportId!,
        permissions: body.permissions || ["monitor", "alerts"]
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, grant: result.grant });
}
