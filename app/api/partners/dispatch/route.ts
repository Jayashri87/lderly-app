import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  PartnerMarketplace,
  type PartnerType
} from "../../../../server/partnerMarketplace";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";

const partnerTypes: PartnerType[] = [
  "ambulance",
  "diagnostic_lab",
  "hospital",
  "pharmacy",
  "physiotherapy"
];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    partnerType?: PartnerType;
    bookingId?: string;
    zone?: string;
    reason?: string;
  }>(request);

  if (
    !body?.partnerType ||
    !partnerTypes.includes(body.partnerType) ||
    !isNonEmptyString(body.reason)
  ) {
    return jsonError("Partner type and dispatch reason are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "partners.dispatch",
      resource: body.bookingId || body.partnerType,
      status: "success",
      details: {
        actor: auth.session.role,
        partnerType: body.partnerType
      }
    },
    () =>
      PartnerMarketplace.dispatch({
        partnerType: body.partnerType!,
        bookingId: body.bookingId,
        zone: body.zone,
        reason: body.reason!
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendPartnerDispatchToOpsSheet({
    dispatchId: result.dispatch.id,
    bookingId: result.dispatch.bookingId,
    partnerId: result.dispatch.partnerId,
    partnerName: result.dispatch.partnerName,
    partnerType: result.dispatch.partnerType,
    zone: result.dispatch.zone,
    reason: result.dispatch.reason,
    status: result.dispatch.status,
    etaMinutes: result.dispatch.etaMinutes,
    actor: auth.session.role
  });

  return NextResponse.json({ ok: true, dispatch: result.dispatch });
}
