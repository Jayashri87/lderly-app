import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  CaretakerAttendance,
  type AttendanceAction
} from "../../../../server/caretakerAttendance";

const actions: AttendanceAction[] = [
  "break_end",
  "break_start",
  "check_in",
  "check_out"
];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    action?: AttendanceAction;
    lat?: number;
    lng?: number;
    accuracyMeters?: number;
    note?: string;
  }>(request);
  const caretakerId =
    auth.session.role === "admin"
      ? body?.caretakerId || auth.session.uid || auth.session.username
      : auth.session.uid || auth.session.username;

  if (!body?.action || !actions.includes(body.action)) {
    return jsonError("Valid attendance action is required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "caretaker.attendance",
      resource: caretakerId,
      status: "success",
      details: {
        attendanceAction: body.action,
        actor: auth.session.role
      }
    },
    () =>
      CaretakerAttendance.record({
        caretakerId,
        action: body.action!,
        location:
          typeof body.lat === "number" && typeof body.lng === "number"
            ? {
                lat: body.lat,
                lng: body.lng,
                ...(typeof body.accuracyMeters === "number"
                  ? { accuracyMeters: body.accuracyMeters }
                  : {})
              }
            : undefined,
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, shift: result.shift });
}
