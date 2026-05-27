import { NextRequest, NextResponse } from "next/server";
import { requireAuthAttempt } from "../../../../../server/authGuards";

export async function POST(request: NextRequest) {
  const limited = requireAuthAttempt(request, "customer-otp", 8);
  if (limited) {
    return limited;
  }

  return NextResponse.json(
    {
      error:
        "Phone OTP login is disabled. Register your interest or use the customer ID created by LDERLY operations."
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
