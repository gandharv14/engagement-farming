import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserRoleFromClaims } from "@/lib/roles";

const auth0Domain = process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const auth0 = new Auth0Client({
  domain: auth0Domain,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.AUTH0_BASE_URL,
  secret: process.env.AUTH0_SECRET,
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: "openid profile email offline_access",
  },
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
      const supabase = createSupabaseAdminClient();
      const role = getUserRoleFromClaims(session.user);

      if (supabase && role) {
        await supabase.from("users").upsert(
          {
            auth0_sub: session.user.sub,
            email: session.user.email ?? null,
            display_name: session.user.name ?? session.user.nickname ?? session.user.email ?? "Tasker",
            role,
          },
          { onConflict: "auth0_sub" },
        );
      }
    }

    return NextResponse.redirect(new URL(ctx.returnTo ?? "/", ctx.appBaseUrl));
  },
});
