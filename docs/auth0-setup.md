# Auth0 Setup

## Application

Use the existing Labelbox Auth0 application:

```text
https://manage.auth0.com/dashboard/us/labelbox/applications/czniCboFUZXCkxEM0tPrEGBAAudZAucH/settings
```

The app is hard-wired to:

```env
AUTH0_ISSUER_BASE_URL=https://labelbox.auth0.com
AUTH0_CLIENT_ID=czniCboFUZXCkxEM0tPrEGBAAudZAucH
```

Set `AUTH0_CLIENT_SECRET` from that Auth0 application in `.env.local` and Vercel project environment variables. `AUTH0_ISSUER_BASE_URL` and `AUTH0_CLIENT_ID` are no longer required by the app.
Set `APP_BASE_URL` to `http://localhost:3000` locally and to the production origin on Vercel, such as `https://engagement-farming.vercel.app`. If `APP_BASE_URL` is omitted on Vercel, the SDK can infer the request origin; do not deploy a localhost `AUTH0_BASE_URL`.

Configure the Auth0 application with:

- Allowed Callback URLs: `http://localhost:3000/api/auth/callback`, plus the Vercel production callback URL.
- Allowed Logout URLs: `http://localhost:3000`, plus the production base URL.
- Allowed Web Origins: `http://localhost:3000`, plus the production base URL.

If the Labelbox SSO connection is not the only enabled connection for the app, set `AUTH0_CONNECTION` to the Auth0 connection name to force that SSO path during login.

## API Audience

Leave `AUTH0_AUDIENCE` blank for the standard Labelbox SSO login. The app requests only `openid profile email` during the interactive Auth0 redirect because the shared Labelbox Auth0 tenant rejects API audiences that are not registered in that tenant.

Only set `AUTH0_AUDIENCE` if there is an Auth0 API with exactly that identifier and you need Supabase client/realtime access tokens. Do not set it to the Supabase project URL unless the matching API exists in Auth0; otherwise Auth0 returns `access_denied: Service not found`.

If you do configure an Auth0 API audience for Supabase JWT verification, configure Supabase JWT settings to trust the Auth0 JWKS endpoint:

```text
https://<tenant>.auth0.com/.well-known/jwks.json
```

## App Roles

Auth0 is only used for identity. App authorization comes from the Supabase `users.role` column.

- On first login, the callback creates or updates the Supabase `users` row for the Auth0 `sub`.
- Existing Supabase roles are preserved.
- New users default to `DEFAULT_APP_ROLE`, which should usually be `tasker`.
- Emails listed in `APP_ADMIN_EMAILS` are bootstrapped as `admin` on first login.

```env
DEFAULT_APP_ROLE=tasker
APP_ADMIN_EMAILS=admin@example.com,another-admin@example.com
```

No Auth0 Login Action is required for app roles.

## Callback User Upsert

The Next.js Auth0 callback upserts the user into Supabase with `SUPABASE_SERVICE_ROLE_KEY`. This keeps the Supabase `users` row aligned with Auth0 `sub`, email, display name, and the app-managed role.

## Route Mapping

The SDK is configured with custom routes:

- Login: `/api/auth/login`
- Logout: `/api/auth/logout`
- Callback: `/api/auth/callback`
- Profile: `/api/auth/me`
- Access token: `/api/auth/access-token`
