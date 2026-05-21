# Sprint Arcade

Production-oriented Next.js app for a time-boxed gamification program around long-horizon labeling rows.

## Stack

- Next.js App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui
- Auth0 for login and role claims
- Supabase Postgres with RLS, triggers, and Realtime-ready tables
- lucide-react icons, recharts admin charts, framer-motion available for polish

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=
```

The app uses Auth0 routes mounted at `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`, and `/api/auth/me`.

## Supabase Migrations

Create/link a Supabase project, then apply migrations:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The first migration creates:

- All requested tables with RLS enabled.
- Admin-only tables for `program_economics`, `goodies_internal`, `sprint_config`, `pot_share_events`, and `admin_audit_log`.
- Safe public views for tasker-facing sprint config and top-5 leaderboards.
- Postgres trigger logic for quality bonuses, streaks, milestones, finale bounties, and pot-share event queueing.

## Auth0

Follow `docs/auth0-setup.md`. The critical claims are:

- `https://app/role`: one of `tasker`, `reviewer`, or `admin`.
- `role`: `authenticated`, so Supabase maps the JWT to the `authenticated` Postgres role.

## Security Notes

Tasker/reviewer access to economics is blocked in the database layer. Tasker UI queries use a Supabase client with the Auth0 access token in the `Authorization: Bearer <token>` header, so RLS applies even if a tasker directly queries Supabase with their JWT.

Run the checks in `docs/rls-verification.md` before using real sprint data.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
