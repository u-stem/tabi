import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MOBILE_UA_REGEX, SP_PREFIX, SP_ROUTES, VIEW_MODE_COOKIE } from "@/lib/view-mode";

const protectedPaths = ["/home", "/trips", "/bookmarks", "/friends", "/sp"];
const guestOnlyPaths = ["/", "/auth/login", "/auth/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── SP ↔ Desktop redirect ──────────────────────────────
  const viewMode = request.cookies.get(VIEW_MODE_COOKIE)?.value;
  const ua = request.headers.get("user-agent") ?? "";
  const isMobileUA = MOBILE_UA_REGEX.test(ua);
  const isOnSp = pathname.startsWith(SP_PREFIX);
  const isOnAuthenticatedRoute = SP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

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
    if (isProtected) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/home/:path*",
    "/trips/:path*",
    "/bookmarks/:path*",
    "/friends/:path*",
    "/sp/:path*",
    "/",
    "/auth/login",
    "/auth/signup",
  ],
};
