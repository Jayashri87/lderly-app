import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { OpsBackupProvider } from "../../../../server/opsBackupProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await OpsBackupProvider.getLatest();

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
      action: "ops.backup_manifest.create",
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () =>
      OpsBackupProvider.createManifest({
        actor: auth.session.username || auth.session.uid || "admin"
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, manifest: result.manifest });
}
