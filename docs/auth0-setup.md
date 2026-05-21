# Auth0 Setup

## Application

Create a Regular Web Application in Auth0 and configure:

- Allowed Callback URLs: `http://localhost:3000/api/auth/callback`, plus the Vercel production callback URL.
- Allowed Logout URLs: `http://localhost:3000`, plus the production base URL.
- Allowed Web Origins: `http://localhost:3000`, plus the production base URL.

Set the app values in `.env.local` and Vercel project environment variables.

## API Audience

Set `AUTH0_AUDIENCE` to the Supabase project URL/audience configured for JWT verification. Configure Supabase JWT settings to trust the Auth0 JWKS endpoint:

```text
https://<tenant>.auth0.com/.well-known/jwks.json
```

## Role Claim Action

Create an Auth0 Action on the Login flow:

```js
exports.onExecutePostLogin = async (event, api) => {
  const allowedRoles = ["tasker", "reviewer", "admin"];
  const candidateRoles = [
    event.user.app_metadata?.role,
    ...(event.authorization?.roles ?? []),
  ];
  const role = candidateRoles
    .map((candidate) => (typeof candidate === "string" ? candidate.toLowerCase() : null))
    .find((candidate) => allowedRoles.includes(candidate));

  if (!role) {
    api.access.deny("Missing app role. Set app_metadata.role or assign an Auth0 role named tasker, reviewer, or admin.");
    return;
  }

  api.idToken.setCustomClaim("https://app/role", role);
  api.accessToken.setCustomClaim("https://app/role", role);

  // Supabase needs this database role claim in addition to the app role claim.
  api.accessToken.setCustomClaim("role", "authenticated");
};
```

Each user must have exactly one app role, either as `app_metadata.role` or as an Auth0 Dashboard role named `tasker`, `reviewer`, or `admin`.

## Callback User Upsert

The Next.js Auth0 callback upserts the user into Supabase with `SUPABASE_SERVICE_ROLE_KEY`. This keeps the Supabase `users` row aligned with Auth0 `sub`, email, display name, and role.

## Route Mapping

The SDK is configured with custom routes:

- Login: `/api/auth/login`
- Logout: `/api/auth/logout`
- Callback: `/api/auth/callback`
- Profile: `/api/auth/me`
- Access token: `/api/auth/access-token`
