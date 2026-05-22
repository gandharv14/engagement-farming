# E2E Testing

This app uses Auth0 SSO, so Playwright tests run with saved browser sessions for each role.

## One-time setup

Install the Chromium browser Playwright uses:

```bash
npx playwright install chromium
```

Start the app:

```bash
npm run dev
```

In another terminal, save one storage state per role. Sign in with the matching account, wait until the app lands on that role's home page, then close the browser window.

```bash
npx playwright codegen --save-storage=e2e/.auth/admin.json http://127.0.0.1:3000/login
npx playwright codegen --save-storage=e2e/.auth/reviewer.json http://127.0.0.1:3000/login
npx playwright codegen --save-storage=e2e/.auth/tasker.json http://127.0.0.1:3000/login
```

Add these test account emails to `.env.local` or `.env.test` so data-dependent tests can find the app user rows created after login:

```bash
E2E_ADMIN_EMAIL=admin@example.com
E2E_REVIEWER_EMAIL=reviewer@example.com
E2E_TASKER_EMAIL=tasker@example.com
```

The auth files under `e2e/.auth/` are ignored by git.

## Running tests

```bash
npm run test:e2e
```

Use headed mode while debugging:

```bash
npm run test:e2e:headed
```

Tests that need a saved Auth0 session or Supabase service-role access skip themselves when the matching local state/env is missing.
