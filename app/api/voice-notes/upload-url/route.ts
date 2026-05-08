import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { createVoiceNoteUpload } from "../../../../server/voiceNoteProvider";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["caretaker", "admin"], { rateLimit: 80 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{
    bookingId?: string;
    userId?: string;
    contentType?: string;
  }>(request);

  if (!body?.bookingId || !body.userId) {
    return jsonError("Booking id and user id are required", 400);
  }

  const upload = await withMutationAudit(
    request,
    {
      action: "voice_note.upload_url",
      resource: body.bookingId,
      status: "success",
      details: {
        userId: body.userId,
        caretakerId: auth.session.uid || auth.session.username
      }
    },
    () =>
      createVoiceNoteUpload({
        bookingId: body.bookingId as string,
        userId: body.userId as string,
        caretakerId: auth.session.uid || auth.session.username,
        contentType: body.contentType || "audio/mpeg"
      })
  );

  return NextResponse.json({ upload });
}

