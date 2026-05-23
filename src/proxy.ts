import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { e2eRoleHeader, getE2EAuthRole } from "@/lib/e2e-auth";

const protectedPagePrefixes = [
  "/admin",
  "/earnings",
  "/goodies",
  "/guild",
  "/leaderboards",
  "/profile",
  "/review",
] as const;

export async function proxy(request: NextRequest) {
  if (request.method === "GET" && isProtectedPagePath(request.nextUrl.pathname) && !(await hasSession(request)) && !hasE2EAuth(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(loginUrl);
  }

  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

async function hasSession(request: NextRequest) {
  try {
    return Boolean(await auth0.getSession(request));
  } catch {
    return false;
  }
}

function isProtectedPagePath(pathname: string) {
  return pathname === "/" || protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasE2EAuth(request: NextRequest) {
  return Boolean(getE2EAuthRole(request.headers.get(e2eRoleHeader)));
}
