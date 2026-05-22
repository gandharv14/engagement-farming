import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { ensureAppUser } from "@/lib/app-user";
import type { AppRole } from "@/lib/roles";

const labelboxAuth0Domain = "labelbox.auth0.com";
const labelboxAuth0ClientId = "czniCboFUZXCkxEM0tPrEGBAAudZAucH";
const authorizationParameters: Record<string, string> = {
  scope: "openid profile email",
};
const appBaseUrl = getAppBaseUrl();

const auth0Connection = getOptionalEnv("AUTH0_CONNECTION");

if (auth0Connection) {
  authorizationParameters.connection = auth0Connection;
}

export const auth0 = new Auth0Client({
  domain: labelboxAuth0Domain,
  clientId: labelboxAuth0ClientId,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl,
  secret: process.env.AUTH0_SECRET,
  authorizationParameters,
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
    profile: "/api/auth/me",
    accessToken: "/api/auth/access-token",
    backChannelLogout: "/api/auth/backchannel-logout",
  },
  async onCallback(error, ctx, session) {
    if (error) {
      return NextResponse.redirect(new URL("/login?error=sso", ctx.appBaseUrl));
    }

    const appUser = session?.user ? await ensureAppUser(session.user) : null;
    const postLoginPath = getPostLoginPath(ctx.returnTo, appUser?.role);

    return NextResponse.redirect(new URL(postLoginPath, ctx.appBaseUrl));
  },
});

export function getAuth0AccessTokenOptions() {
  const audience = getOptionalEnv("AUTH0_AUDIENCE");

  return audience ? { audience } : undefined;
}

function getAppBaseUrl() {
  const configuredBaseUrl = process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL;

  if (!configuredBaseUrl) {
    return undefined;
  }

  const valueWithProtocol = getBaseUrlWithProtocol(configuredBaseUrl);

  try {
    const url = new URL(valueWithProtocol);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";

    if (process.env.VERCEL && isLocalhost) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function getBaseUrlWithProtocol(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("localhost") || value.startsWith("127.") || value.startsWith("[::1]")) {
    return `http://${value}`;
  }

  return `https://${value}`;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();

  return value || undefined;
}

function getPostLoginPath(returnTo: string | undefined, role: AppRole | undefined) {
  const safeReturnTo = getSafeRelativePath(returnTo);

  if (safeReturnTo && safeReturnTo !== "/" && !safeReturnTo.startsWith("/login")) {
    return safeReturnTo;
  }

  return getHomePathForRole(role);
}

function getSafeRelativePath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  return path;
}

function getHomePathForRole(role: AppRole | undefined) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "reviewer") {
    return "/review/queue";
  }

  return "/";
}
