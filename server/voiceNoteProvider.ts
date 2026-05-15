import { getAdminDatabase, getAdminStorageBucket } from "./firebaseAdmin";
import {
  assertMockProviderAllowed,
  mockProvidersFailClosed
} from "./mockProviderPolicy";

export type VoiceNoteRequest = {
  bookingId: string;
  userId: string;
  caretakerId: string;
  contentType: string;
};

export type VoiceNoteUpload = {
  id: string;
  mode: "firebase-storage" | "mock";
  uploadUrl: string;
  storagePath: string;
  expiresAt: number;
};

export const hasVoiceNoteStorageConfig = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
);
export const voiceNoteMockFailClosed =
  mockProvidersFailClosed || hasVoiceNoteStorageConfig;

const safeContentType = (contentType: string) =>
  contentType.startsWith("audio/") ? contentType : "audio/mpeg";

export const createVoiceNoteUpload = async ({
  bookingId,
  userId,
  caretakerId,
  contentType
}: VoiceNoteRequest): Promise<VoiceNoteUpload> => {
  const id = `voice-note-${Date.now()}`;
  const normalizedContentType = safeContentType(contentType);
  const extension = normalizedContentType.includes("webm")
    ? "webm"
    : normalizedContentType.includes("wav")
      ? "wav"
      : "mp3";
  const storagePath = `voice-notes/${bookingId}/${id}.${extension}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const bucket = getAdminStorageBucket();
  const database = getAdminDatabase();

  if (!bucket) {
    assertMockProviderAllowed("Voice note upload");

    return {
      id,
      mode: "mock",
      uploadUrl: `/api/voice-notes/mock-upload/${id}`,
      storagePath,
      expiresAt
    };
  }

  const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType: normalizedContentType
  });

  if (database) {
    await database.ref(`voiceNotes/byId/${id}`).set({
      id,
      bookingId,
      userId,
      caretakerId,
      contentType: normalizedContentType,
      storagePath,
      status: "upload_url_created",
      createdAt: Date.now(),
      expiresAt
    });
    await database.ref(`voiceNotes/byBooking/${bookingId}/${id}`).set(true);
    await database.ref(`voiceNotes/byUser/${userId}/${id}`).set(true);
  }

  return {
    id,
    mode: "firebase-storage",
    uploadUrl,
    storagePath,
    expiresAt
  };
};
