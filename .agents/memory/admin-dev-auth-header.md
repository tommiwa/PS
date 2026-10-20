---
name: Admin auth in dev testing
description: How to hit admin-only API endpoints from the shell during development without a full OIDC login.
---

`requireAdmin` in `server/replitAuth.ts` accepts an `x-demo-auth` request header when `process.env.NODE_ENV !== "production"`. The header value is a JSON string like `{"id":"...","email":"...","firstName":"...","lastName":"...","roles":["admin"]}`; the middleware upserts that user and treats the request as an authenticated admin.

**Why:** the app's real login is Replit OIDC ("Sign In with Replit"), which the Screenshot tool cannot complete — any `appPreview` screenshot of an admin-only route just shows the sign-in card. There is no dev-login page or stored Playwright auth state in this project (`playwright.config.ts` is API/DB-level only, no browser).

Privilege-changing actions must require a server-verified session even in development; do not rely on demo headers as evidence of authorization.

**Why:** demo headers are client-controlled, so trusting them for persistent role changes or administrative assignments permits unauthenticated privilege escalation on exposed development instances.

**How to apply:** do not assume demo authentication is allowed on every admin endpoint. Verify privilege-changing routes using real authorization middleware in HTTP tests with mocked storage, including forged demo-header cases. For endpoints that intentionally retain demo support, curl can use the header. Do not add an authentication bypass to verify signed-in UI.
