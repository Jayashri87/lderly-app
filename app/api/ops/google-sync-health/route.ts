import { NextRequest, NextResponse } from "next/server";
import {
  parseJsonBody,
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await GoogleWorkspaceProvider.getSyncHealth();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJsonBody<{ limit?: number }>(request);
  const limit = Math.max(1, Math.min(50, Number(body?.limit || 20)));
  const result = await withMutationAudit(
    request,
    {
      action: "ops.google_sync.retry",
      status: "success",
      details: {
        actor: auth.session.username || auth.session.uid,
        limit
      }
    },
    () => GoogleWorkspaceProvider.retryFailedSyncs({ limit })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, result: result.result });
}
