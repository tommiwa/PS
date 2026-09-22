---
name: Admin auth in dev testing
description: How to hit admin-only API endpoints from the shell during development without a full OIDC login.
---

`requireAdmin` in `server/replitAuth.ts` accepts an `x-demo-auth` request header when `process.env.NODE_ENV !== "production"`. The header value is a JSON string like `{"id":"...","email":"...","firstName":"...","lastName":"...","roles":["admin"]}`; the middleware upserts that user and treats the request as an authenticated admin.

**Why:** the app's real login is Replit OIDC ("Sign In with Replit"), which the Screenshot tool cannot complete — any `appPreview` screenshot of an admin-only route just shows the sign-in card. There is no dev-login page or stored Playwright auth state in this project (`playwright.config.ts` is API/DB-level only, no browser).

**How to apply:** to verify a new or changed admin API endpoint works end-to-end against real dev data, use `curl` with the `x-demo-auth` header instead of trying to screenshot the page. For UI verification, rely on code review plus vitest unit/controller tests (mock `./storage`) rather than a live screenshot.
