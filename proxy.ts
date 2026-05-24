import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed middleware → proxy. Edge runtime is NOT supported in proxy.
// Keep this file lightweight: optimistic checks only. Real auth happens in route handlers.

const PUBLIC_PATHS = [
  "/login",
  "/mfa",
  "/forgot-password",
  "/reset-password",
  "/favicon.ico",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets and Next internals.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/recaptcha") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/static") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get(process.env.SESSION_COOKIE_NAME || "mkt_session")?.value;

  if (!sessionCookie) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
