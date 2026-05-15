import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import {
  createKycUpload,
  isKycDocumentType
} from "../../../../../server/kycProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], {
    rateLimit: 30
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    documentType?: unknown;
    contentType?: string;
  }>(request);

  const caretakerId =
    auth.session.role === "admin"
      ? body?.caretakerId
      : auth.session.uid || auth.session.username;

  if (!caretakerId || !isKycDocumentType(body?.documentType)) {
    return jsonError("Caretaker id and valid KYC document type are required", 400);
  }

  const documentType = body.documentType;
  let upload;

  try {
    upload = await withMutationAudit(
      request,
      {
        action: "caretaker.kyc_upload_url",
        resource: caretakerId,
        status: "success",
        details: {
          documentType
        }
      },
      () =>
        createKycUpload({
          caretakerId,
          documentType,
          contentType: body.contentType || "application/pdf"
        })
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "KYC storage is not available"
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ upload });
}
