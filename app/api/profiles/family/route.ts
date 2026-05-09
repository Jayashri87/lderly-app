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
    member?: Omit<FamilyMemberAccess, "id" | "updatedAt">;
  }>(request);
  const userId =
    auth.session.role === "admin"
      ? body?.userId || auth.session.uid || auth.session.username
      : auth.session.uid || auth.session.username;

  if (!body?.member || !body.member.name || !body.member.phone || !userId) {
    return jsonError("Family member name and phone are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "profile.family.add",
      resource: userId,
      status: "success",
      details: {
        actor: auth.session.role,
        relationship: body.member.relationship
      }
    },
    () => CareProfileStore.addFamilyMember(userId, body.member!)
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ familyMember: result.familyMember });
}
