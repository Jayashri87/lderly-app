import { NextRequest, NextResponse } from "next/server";
import {
  requireApiSession,
  withMutationAudit
} from "../../../../server/apiSecurity";
import { OpsMaintenanceProvider } from "../../../../server/opsMaintenanceProvider";

const cronSecretConfigured = () => Boolean(process.env.CRON_SECRET);

const isAuthorizedCron = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
};

export async function GET(request: NextRequest) {
  if (!cronSecretConfigured()) {
    return NextResponse.json(
      { error: "Maintenance cron is not configured" },
      { status: 503 }
    );
  }

  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await OpsMaintenanceProvider.run({ actor: "cron" });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, record: result.record });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 20 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await withMutationAudit(
    request,
    {
      action: "ops.maintenance.run",
      status: "success",
      details: {
        actor: auth.session.username
      }
    },
    () =>
      OpsMaintenanceProvider.run({
        actor: auth.session.username || auth.session.uid || "admin"
      })
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, record: result.record });
}
