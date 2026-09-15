---
name: Migration idempotency is existence-based
description: server/migrations.ts skips a migration once its checkQuery is true (e.g. "table exists"); it never re-runs, even if you edit migrationStatements afterward.
---

The migration runner (`server/migrations.ts`) evaluates each entry's `checkQuery` on
every boot. If it returns true, the entry is skipped for good — there is no
run-once-by-name ledger and no re-diffing of `migrationStatements`.

**Why:** If you edit a migration's SQL (e.g. add a `WHERE` clause to a backfill
`INSERT`) after its tables already exist in an environment (dev, and eventually
prod once deployed), the edited SQL never executes there. The `checkQuery` still
reports "table exists" and the whole entry — including the backfill — is skipped.

**How to apply:** When you must correct a migration's logic after it has already
applied somewhere:
1. Fix `migrationStatements` in `migrations.ts` so any environment that has NOT
   yet run this migration (e.g. production, before its next deploy) gets the
   corrected version.
2. Separately run a one-off corrective query against any environment where the
   migration already applied (e.g. development), since the file edit alone won't
   reach it.
