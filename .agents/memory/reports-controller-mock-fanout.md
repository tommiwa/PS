---
name: Reports-controller full-module mocks
description: Several server test files fully mock ./reports-controller with an explicit export list, which breaks on any new export.
---

Multiple unrelated server test files (e.g. tests for swap-spot, booking-emails, listing-removal-notification, payment-notifications, schedule-release, spot-release-classification) call `vi.mock('./reports-controller', () => ({ getReportOverview: vi.fn(...), ..., computeMilestoneMetrics: vi.fn(...) }))` with a hardcoded, explicit list of every current export.

**Why:** `server/routes.ts` imports and registers every export from `reports-controller.ts` at module load time. These test files import `routes.ts` (directly or transitively) and mock out `reports-controller` module to keep unrelated dependencies (email sending, DB access) out of scope. Because the mock replaces the whole module, adding a new exported function to `reports-controller.ts` without adding it to each of these mocks makes `registerRoutes` throw `No "<name>" export is defined on the "./reports-controller" mock` at import time, failing those suites even though the feature under test is unrelated.

**How to apply:** whenever you add a new export to `server/reports-controller.ts` that gets wired into `server/routes.ts`, grep test files for `vi.mock('./reports-controller'` and add a matching `vi.fn(async () => ({}))` entry to each one. Run the full `npx vitest run` suite (not just your new test file) before finishing, since these failures don't show up when running a single targeted test file.
