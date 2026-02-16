import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/home", "/trips"];
const guestOnlyPaths = ["/", "/auth/login", "/auth/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    // On error, allow guest-only pages through but block protected pages
    if (isProtected) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/home/:path*", "/trips/:path*", "/", "/auth/login", "/auth/signup"],
};
