import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { ensureAppUser } from "@/lib/app-user";

const labelboxAuth0Domain = "labelbox.us.auth0.com";
const labelboxAuth0ClientId = "czniCboFUZXCkxEM0tPrEGBAAudZAucH";
const auth0Domain = process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? labelboxAuth0Domain;
const authorizationParameters: Record<string, string> = {
  scope: "openid profile email",
};

if (process.env.AUTH0_AUDIENCE) {
  authorizationParameters.audience = process.env.AUTH0_AUDIENCE;
}

if (process.env.AUTH0_CONNECTION) {
  authorizationParameters.connection = process.env.AUTH0_CONNECTION;
}

export const auth0 = new Auth0Client({
  domain: auth0Domain,
  clientId: process.env.AUTH0_CLIENT_ID ?? labelboxAuth0ClientId,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.AUTH0_BASE_URL,
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
      return NextResponse.redirect(
        new URL(`/forbidden?error=${encodeURIComponent(error.message)}`, ctx.appBaseUrl),
      );
    }

    if (session?.user) {
      await ensureAppUser(session.user);
    }

    return NextResponse.redirect(new URL(ctx.returnTo ?? "/", ctx.appBaseUrl));
  },
});
