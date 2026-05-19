import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { UploadSafetyProvider } from "../../../../server/uploadSafetyProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    kind?: "kyc" | "voice_note";
    caretakerId?: string;
    documentType?: string;
    uploadId?: string;
    status?: "pending" | "clean" | "infected" | "manual_review";
    note?: string;
  }>(request);

  if (!body?.kind || !body.status) {
    return jsonError("Upload kind and scan status are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ops.upload_safety.scan_update",
      resource: body.uploadId || `${body.caretakerId || ""}-${body.documentType || ""}`,
      status: "success",
      details: {
        actor: auth.session.username,
        kind: body.kind,
        scanStatus: body.status
      }
    },
    () =>
      UploadSafetyProvider.markScan({
        kind: body.kind!,
        caretakerId: body.caretakerId,
        documentType: body.documentType,
        uploadId: body.uploadId,
        status: body.status!,
        reviewerId: auth.session.username || auth.session.uid || "admin",
        note: body.note
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, upload: result.upload });
}
