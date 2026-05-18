import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "../../../../server/apiSecurity";
import {
  CustomerLeadProvider,
  CustomerLeadStatus
} from "../../../../server/customerLeadProvider";

const allowedStatuses = new Set<CustomerLeadStatus>([
  "new",
  "contacted",
  "qualified",
  "customer_created",
  "not_reachable",
  "archived"
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 120 });

  if (!auth.ok) {
    return auth.response;
  }

  const result = await CustomerLeadProvider.getSnapshot();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ snapshot: result.snapshot });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 60 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json()) as {
    leadId?: string;
    status?: CustomerLeadStatus;
    notes?: string;
  };

  if (!body.leadId || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Valid leadId and status are required" }, { status: 400 });
  }

  const result = await CustomerLeadProvider.updateLead({
    leadId: body.leadId,
    status: body.status,
    notes: body.notes,
    actor: auth.session.username
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin"], { rateLimit: 30 });

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json()) as {
    action?: "create_customer";
    leadId?: string;
  };

  if (body.action !== "create_customer" || !body.leadId) {
    return NextResponse.json({ error: "Valid action and leadId are required" }, { status: 400 });
  }

  const result = await CustomerLeadProvider.createCustomerFromLead({
    leadId: body.leadId,
    actor: auth.session.username
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
