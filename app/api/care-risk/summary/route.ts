import { NextRequest, NextResponse } from "next/server";
import { isNonEmptyString, requireApiSession } from "../../../../server/apiSecurity";
import { CareRiskProvider } from "../../../../server/careRiskProvider";
import { GoogleWorkspaceProvider } from "../../../../server/googleWorkspaceProvider";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["admin", "caretaker", "customer"], {
    rateLimit: 120
  });

  if (!auth.ok) {
    return auth.response;
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId") || "";
  const relationship = request.nextUrl.searchParams.get("relationship") || "";
  const userId = auth.session.role === "customer" ? auth.session.uid : requestedUserId || auth.session.uid;

  if (!isNonEmptyString(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await CareRiskProvider.getSummary({ userId, relationship });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await GoogleWorkspaceProvider.appendCareRiskToOpsSheet({
    userId: result.summary.userId,
    recipientName: result.summary.recipientName,
    relationship,
    riskScore: result.summary.riskScore,
    riskLevel: result.summary.riskLevel,
    fallRisk: result.summary.fallRisk,
    medicationRisk: result.summary.medicationRisk,
    vitalsRisk: result.summary.vitalsRisk,
    emergencyReadinessScore: result.summary.emergencyReadinessScore,
    openIncidents: result.summary.openIncidents,
    signals: result.summary.riskSignals,
    recommendations: result.summary.recommendations
  });

  return NextResponse.json({ summary: result.summary });
}
