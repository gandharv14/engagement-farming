import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { ensureAppUser } from "@/lib/app-user";

const labelboxAuth0Domain = "labelbox.auth0.com";
const labelboxAuth0ClientId = "czniCboFUZXCkxEM0tPrEGBAAudZAucH";
const authorizationParameters: Record<string, string> = {
  scope: "openid profile email",
};
const appBaseUrl = getAppBaseUrl();

if (process.env.AUTH0_AUDIENCE) {
  authorizationParameters.audience = process.env.AUTH0_AUDIENCE;
}

if (process.env.AUTH0_CONNECTION) {
  authorizationParameters.connection = process.env.AUTH0_CONNECTION;
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

    if (session?.user) {
      await ensureAppUser(session.user);
    }

    return NextResponse.redirect(new URL(ctx.returnTo ?? "/", ctx.appBaseUrl));
  },
});

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
