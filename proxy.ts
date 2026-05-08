import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/ops", "/partner"];

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const hasSession = Boolean(request.cookies.get("lderly_session")?.value);
  const pathname = request.nextUrl.pathname;

  if (protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
