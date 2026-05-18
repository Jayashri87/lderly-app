import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { CareQualityProvider } from "../../../../server/careQualityProvider";

const moods = ["calm", "happy", "low", "anxious", "tired"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    userId?: string;
    caretakerId?: string;
    bookingId?: string;
    heartRate?: number;
    bloodPressure?: string;
    oxygen?: number;
    temperature?: number;
    mood?: "calm" | "happy" | "low" | "anxious" | "tired";
    note?: string;
  }>(request);

  if (
    !body ||
    !isNonEmptyString(body.userId) ||
    !body.heartRate ||
    !isNonEmptyString(body.bloodPressure) ||
    !body.oxygen ||
    body.heartRate < 35 ||
    body.heartRate > 180 ||
    body.oxygen < 70 ||
    body.oxygen > 100 ||
    (body.mood && !moods.includes(body.mood))
  ) {
    return jsonError("Valid vitals are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "care_quality.vitals.record",
      resource: body.bookingId || body.userId,
      status: "success",
      details: {
        actor: auth.session.role,
        oxygen: body.oxygen,
        heartRate: body.heartRate
      }
    },
    () =>
      CareQualityProvider.recordVitals({
        userId: body.userId!,
        caretakerId: body.caretakerId || auth.session.uid,
        bookingId: body.bookingId,
        heartRate: body.heartRate!,
        bloodPressure: body.bloodPressure!,
        oxygen: body.oxygen!,
        temperature: body.temperature,
        mood: body.mood,
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, vitals: result.vitals });
}
