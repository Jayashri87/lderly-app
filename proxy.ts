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
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("X-LDERLY-Cache-Policy", "runtime-routes-no-store");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
