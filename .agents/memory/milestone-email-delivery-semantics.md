---
name: Milestone email delivery semantics
description: Why owner milestone emails do not automatically retry ambiguous provider outcomes
---

Owner rental milestone delivery uses a strict at-most-once attempt policy. A pending claim may be claimed by one worker, but a record already marked as sending must not be automatically retried.

**Why:** The configured email providers do not offer a true idempotency key. If a process exits after the provider accepts a message but before the database records success, retrying the ambiguous record can send a duplicate milestone email and violate the one-email-per-threshold requirement.

**How to apply:** Recover work that is still pending, and record explicit provider failures as failed. Treat a record left in sending as operationally ambiguous and reconcile it manually unless a future provider or relay supplies real claim-ID idempotency.