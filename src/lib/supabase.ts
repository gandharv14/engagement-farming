import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import { auth0, getAuth0AccessTokenOptions } from "@/lib/auth0";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Memoized per request: callers create the client many times per render, and the
// non-admin path mints an Auth0 access token on each call. cache() dedupes both
// within a single server request and is a no-op outside a request scope (e.g. tests).
export const createSupabaseServerClient = cache(async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminClient = createSupabaseAdminClient();

  if (adminClient) {
    return adminClient;
  }

  if (!url || !anonKey) {
    return null;
  }

  const { token } = await auth0.getAccessToken(getAuth0AccessTokenOptions());

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
});
