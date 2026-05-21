# RLS Verification

These checks apply only if you configure Auth0 access tokens with Supabase-compatible app role claims.

The current Labelbox SSO integration uses Auth0 for identity and enforces app roles in the Next.js server with `SUPABASE_SERVICE_ROLE_KEY`. For the deployed app, verify access boundaries through the signed-in UI instead:

- A default Labelbox SSO user should land on the tasker dashboard and be blocked from `/admin` and `/review/queue`.
- An email listed in `APP_ADMIN_EMAILS` should land on `/admin` after first login.
- A user whose Supabase `users.role` is `reviewer` should land on `/review/queue`.

If you re-enable direct client Supabase access, replace `$TASKER_JWT`, `$REVIEWER_JWT`, and `$ADMIN_JWT` with Auth0 access tokens that contain the required role claims.

## Tasker Must Not Read Forbidden Tables

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/program_economics?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result:

```json
[]
```

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/goodies_internal?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result:

```json
[]
```

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sprint_config?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result:

```json
[]
```

Taskers use the safe view instead:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sprint_public_config?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result contains only sprint phase, multiplier, goal rows, and day counts. It must not contain budget, revenue, base bonus amounts, bounty cents, or margin fields.

## Tasker Must Not Read Other Users' Earnings

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/earnings?select=*&user_id=neq.<tasker_user_id>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result:

```json
[]
```

The tasker can read only their own ledger:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/earnings?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result: rows where `user_id` is the tasker's own Supabase user id only.

## Tasker Must Not See Bottom Leaderboard

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/leaderboard_volume_top5?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TASKER_JWT"
```

Expected result: at most 5 rows.

Direct table access to all other taskers' row totals is blocked because `rows` only returns the tasker's own rows for `tasker` role.

## Reviewer Must Not Read Economics

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/program_economics?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $REVIEWER_JWT"
```

Expected result:

```json
[]
```

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/goodies_internal?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $REVIEWER_JWT"
```

Expected result:

```json
[]
```

## Admin Can Read Admin-Only Tables

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/program_economics?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Expected result: the single admin economics row.

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/goodies_internal?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Expected result: internal goodie cost rows.

## Captured Results

Record dated outputs here after running against the target Supabase project:

```text
Date:
Tasker token subject:
program_economics as tasker:
goodies_internal as tasker:
sprint_config as tasker:
other-user earnings as tasker:
leaderboard_volume_top5 count:
program_economics as reviewer:
program_economics as admin:
```
