import { getAdminDatabase } from "./firebaseAdmin";

type UploadKind = "kyc" | "voice_note";
type ScanStatus = "pending" | "clean" | "infected" | "manual_review";

const scanUpdate = (status: ScanStatus, reviewerId: string, note = "") => ({
  malwareScan: {
    status,
    required: true,
    provider: "manual_ops",
    reviewerId,
    note,
    updatedAt: Date.now()
  }
});

export const UploadSafetyProvider = {
  async markScan({
    kind,
    caretakerId,
    documentType,
    uploadId,
    status,
    reviewerId,
    note
  }: {
    kind: UploadKind;
    caretakerId?: string;
    documentType?: string;
    uploadId?: string;
    status: ScanStatus;
    reviewerId: string;
    note?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const trusted = status === "clean";

    if (kind === "kyc") {
      if (!caretakerId || !documentType) {
        return { ok: false as const, status: 400, error: "caretakerId and documentType are required" };
      }

      const path = `caretakerKyc/byCaretaker/${caretakerId}/${documentType}`;
      const snapshot = await database.ref(path).get();

      if (!snapshot.exists()) {
        return { ok: false as const, status: 404, error: "KYC upload not found" };
      }

      await database.ref(path).update({
        ...scanUpdate(status, reviewerId, note),
        trustedForVerification: trusted
      });

      return { ok: true as const, upload: { kind, caretakerId, documentType, scanStatus: status } };
    }

    if (!uploadId) {
      return { ok: false as const, status: 400, error: "uploadId is required" };
    }

    const path = `voiceNotes/byId/${uploadId}`;
    const snapshot = await database.ref(path).get();

    if (!snapshot.exists()) {
      return { ok: false as const, status: 404, error: "Voice note upload not found" };
    }

    await database.ref(path).update({
      ...scanUpdate(status, reviewerId, note),
      trustedForPlayback: trusted
    });

    return { ok: true as const, upload: { kind, uploadId, scanStatus: status } };
  }
};
