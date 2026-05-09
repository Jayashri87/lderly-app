import { NextRequest, NextResponse } from "next/server";
import {
  jsonError,
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { OpsReliability, SupportTicket } from "../../../../server/opsReliability";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["customer", "caretaker", "admin"], {
    rateLimit: 40
  });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<Partial<SupportTicket>>(request);

  if (!body?.bookingId || !body.subject || !body.description || !body.category) {
    return jsonError("Booking, subject, description, and category are required", 400);
  }

  const result = await withMutationAudit(
    request,
    {
      action: "support.ticket.create",
      resource: body.bookingId,
      status: "success",
      details: {
        actor: auth.session.role,
        category: body.category
      }
    },
    () =>
      OpsReliability.createSupportTicket({
        userId: body.userId || auth.session.uid || auth.session.username,
        bookingId: body.bookingId!,
        category: body.category as SupportTicket["category"],
        priority: body.priority || "normal",
        subject: body.subject!,
        description: body.description!,
        createdByRole: auth.session.role
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ticket: result.ticket });
}
