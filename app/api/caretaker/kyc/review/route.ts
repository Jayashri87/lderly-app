import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../../server/apiSecurity";
import {
  isKycDocumentType,
  reviewKycDocument
} from "../../../../../server/kycProvider";
import { GoogleWorkspaceProvider } from "../../../../../server/googleWorkspaceProvider";

const validStatuses = ["approved", "rejected", "needs_resubmission"] as const;

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 40 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    caretakerId?: string;
    documentType?: unknown;
    status?: (typeof validStatuses)[number];
    note?: string;
  }>(request);

  if (
    !body?.caretakerId ||
    !isKycDocumentType(body.documentType) ||
    !body.status ||
    !validStatuses.includes(body.status)
  ) {
    return jsonError("Caretaker, document type, and valid review status are required", 400);
  }

  const documentType = body.documentType;
  const result = await withMutationAudit(
    request,
    {
      action: "caretaker.kyc_review",
      resource: body.caretakerId,
        status: "success",
        details: {
        documentType,
        reviewStatus: body.status
      }
    },
    () =>
      reviewKycDocument({
        caretakerId: body.caretakerId!,
        documentType,
        status: body.status!,
        reviewerId: auth.session.uid || auth.session.username,
        note: body.note || "Reviewed by operations"
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendKycReviewToOpsSheet({
    caretakerId: body.caretakerId,
    documentType,
    status: result.review.status,
    reviewerId: result.review.reviewerId,
    note: result.review.note
  });

  return NextResponse.json({ review: result.review });
}
