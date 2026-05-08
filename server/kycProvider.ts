import { getAdminDatabase, getAdminStorageBucket } from "./firebaseAdmin";

export type KycDocumentType = "aadhaar" | "pan" | "face";

export type KycUploadRequest = {
  caretakerId: string;
  documentType: KycDocumentType;
  contentType: string;
};

const allowedDocumentTypes: KycDocumentType[] = ["aadhaar", "pan", "face"];

export const isKycDocumentType = (value: unknown): value is KycDocumentType =>
  typeof value === "string" && allowedDocumentTypes.includes(value as KycDocumentType);

const safeContentType = (contentType: string) => {
  if (contentType.startsWith("image/") || contentType === "application/pdf") {
    return contentType;
  }

  return "application/pdf";
};

const extensionFor = (contentType: string) => {
  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  return "pdf";
};

export const createKycUpload = async ({
  caretakerId,
  documentType,
  contentType
}: KycUploadRequest) => {
  const normalizedContentType = safeContentType(contentType);
  const id = `kyc-${documentType}-${Date.now()}`;
  const storagePath = `caretaker-kyc/${caretakerId}/${id}.${extensionFor(
    normalizedContentType
  )}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const bucket = getAdminStorageBucket();
  const database = getAdminDatabase();

  const upload = {
    id,
    mode: bucket ? "firebase-storage" : "mock",
    uploadUrl: `/api/kyc/mock-upload/${id}`,
    storagePath,
    expiresAt
  };

  if (bucket) {
    const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresAt,
      contentType: normalizedContentType
    });

    upload.uploadUrl = uploadUrl;
  }

  if (database) {
    await database.ref(`caretakerKyc/byCaretaker/${caretakerId}/${documentType}`).set({
      id,
      caretakerId,
      documentType,
      contentType: normalizedContentType,
      storagePath,
      status: "pending_review",
      createdAt: Date.now(),
      expiresAt
    });
  }

  return upload;
};
