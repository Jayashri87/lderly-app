import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { AuditRetentionProvider } from "../../../../server/auditRetentionProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await AuditRetentionProvider.latest();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ manifest: result.manifest || null });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ops.audit_retention.run",
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () =>
      AuditRetentionProvider.run({
        actor: auth.session.username || auth.session.uid || "admin"
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, manifest: result.manifest });
}
