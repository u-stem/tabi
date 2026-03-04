import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MOBILE_UA_REGEX, SP_PREFIX, SP_ROUTES, VIEW_MODE_COOKIE } from "@/lib/view-mode";

const protectedPaths = ["/home", "/trips", "/bookmarks", "/friends", "/settings", "/my", "/sp", "/admin"];
const guestOnlyPaths = ["/", "/auth/login", "/auth/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── SP ↔ Desktop redirect ──────────────────────────────
  const viewMode = request.cookies.get(VIEW_MODE_COOKIE)?.value;
  const ua = request.headers.get("user-agent") ?? "";
  const isMobileUA = MOBILE_UA_REGEX.test(ua);
  const isOnSp = pathname.startsWith(SP_PREFIX);
  // /print and /export have no SP counterparts; skip SP redirect for these sub-paths
  const isSpExcludedSubpath = /\/(print|export)(\/|$)/.test(pathname);
  const isOnAuthenticatedRoute =
    !isSpExcludedSubpath &&
    SP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  let desiredMode: "desktop" | "sp";
  if (viewMode === "desktop" || viewMode === "sp") {
    desiredMode = viewMode;
  } else {
    desiredMode = isMobileUA ? "sp" : "desktop";
  }

  if (desiredMode === "sp" && !isOnSp && isOnAuthenticatedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `${SP_PREFIX}${pathname}`;
    return NextResponse.redirect(url);
  }

  if (desiredMode === "desktop" && isOnSp) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(SP_PREFIX.length) || "/home";
    return NextResponse.redirect(url);
  }

  // Redirect /sp/[path] to /[path] when the path has no SP counterpart (e.g. /sp/admin → /admin).
  // SP_ROUTES lists the only routes that have dedicated SP pages.
  if (isOnSp) {
    const desktopPathname = pathname.slice(SP_PREFIX.length) || "/home";
    const hasSpCounterpart = SP_ROUTES.some(
      (route) => desktopPathname === route || desktopPathname.startsWith(`${route}/`),
    );
    if (!hasSpCounterpart) {
      const url = request.nextUrl.clone();
      url.pathname = desktopPathname;
      return NextResponse.redirect(url);
    }
  }

  // ── Auth guard ─────────────────────────────────────────
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isGuestOnly = guestOnlyPaths.includes(pathname);

  if (!isProtected && !isGuestOnly) {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const apiUrl = request.nextUrl.origin;

  try {
    const res = await fetch(`${apiUrl}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
    });

    const body = res.ok ? await res.json() : null;
    const isAuthenticated = !!body?.session;

    if (isProtected && !isAuthenticated) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    if (isGuestOnly && isAuthenticated) {
      return NextResponse.redirect(new URL("/home", request.url));
    }

    return NextResponse.next();
  } catch (err) {
    console.error("[Proxy] Session check failed:", err);
    // Treat session check failure as unauthenticated for all routes that require auth.
    // This includes both explicitly protected paths and any other path in the matcher.
    if (isGuestOnly) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
}

export const config = {
  matcher: [
    "/home/:path*",
    "/trips/:path*",
    "/bookmarks/:path*",
    "/friends/:path*",
    "/settings/:path*",
    "/settings",
    "/my/:path*",
    "/my",
    "/sp/:path*",
    "/admin/:path*",
    "/admin",
    "/",
    "/auth/login",
    "/auth/signup",
  ],
};
