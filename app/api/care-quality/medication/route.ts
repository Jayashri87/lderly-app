import { NextRequest, NextResponse } from "next/server";
import {
  isNonEmptyString,
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import {
  CareQualityProvider,
  type MedicationStatus
} from "../../../../server/careQualityProvider";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";

const medicationStatuses: MedicationStatus[] = ["completed", "due", "missed", "skipped"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 60
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    action?: "adherence" | "schedule";
    userId?: string;
    recipientName?: string;
    medicines?: Array<{
      name: string;
      dosage: string;
      time: string;
      instructions?: string;
    }>;
    scheduleId?: string;
    medicineName?: string;
    status?: MedicationStatus;
    note?: string;
    bookingId?: string;
  }>(request);
  const userId =
    auth.session.role === "customer"
      ? auth.session.uid
      : body?.userId || auth.session.uid;

  if (!body?.action || !isNonEmptyString(userId)) {
    return jsonError("Medication action and user id are required", 400);
  }

  if (body.action === "schedule") {
    if (!isNonEmptyString(body.recipientName) || !body.medicines?.length) {
      return jsonError("Recipient and medicines are required", 400);
    }

    const result = await withMutationAudit(
      request,
      {
        action: "care_quality.medication_schedule",
        resource: userId,
        status: "success",
        details: {
          actor: auth.session.role
        }
      },
      () =>
        CareQualityProvider.upsertMedicationSchedule({
          userId,
          recipientName: body.recipientName!,
          medicines: body.medicines!
        })
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await GoogleWorkspaceProvider.appendMedicationToOpsSheet({
      event: "schedule",
      userId,
      recipientName: result.schedule.recipientName,
      scheduleId: result.schedule.id,
      medicines: result.schedule.medicines,
      actor: auth.session.role
    });

    return NextResponse.json({ ok: true, schedule: result.schedule });
  }

  if (
    !isNonEmptyString(body.medicineName) ||
    !body.status ||
    !medicationStatuses.includes(body.status)
  ) {
    return jsonError("Medicine name and valid status are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "care_quality.medication_adherence",
      resource: userId,
      status: "success",
      details: {
        actor: auth.session.role,
        medicationStatus: body.status
      }
    },
    () =>
      CareQualityProvider.recordMedicationAdherence({
        userId,
        scheduleId: body.scheduleId,
        medicineName: body.medicineName!,
        status: body.status!,
        note: body.note,
        bookingId: body.bookingId
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendMedicationToOpsSheet({
    event: "adherence",
    userId,
    scheduleId: result.adherence.scheduleId,
    medicineName: result.adherence.medicineName,
    status: result.adherence.status,
    note: result.adherence.note,
    bookingId: result.adherence.bookingId,
    actor: auth.session.role
  });

  return NextResponse.json({ ok: true, adherence: result.adherence });
}
