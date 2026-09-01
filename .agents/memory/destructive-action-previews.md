---
name: Destructive-action previews share the action's selection rule
description: Why a "what will this destroy" warning must import the same predicate the destructive endpoint uses, not re-implement it
---

Any confirm dialog that previews the collateral damage of a destructive action (e.g. which
renters lose a booking when an admin removes days from a listing) must select those records
with the *same code* the destructive endpoint runs — extract the predicate into a shared
module and import it in both, rather than re-deriving it in a read endpoint or in the client.

**Why:** a preview that disagrees with the action is worse than no preview: the admin
confirms against a promise the system then breaks. The two drift silently because the rule
is subtle — which statuses count as "still active", whether the range is inclusive on both
ends, what a missing range means (whole listing, not zero rows).

**How to apply:**
- The read-only preview endpoint must not add its own filtering on top; only the projection
  (renter names, formatting) belongs there.
- The preview endpoint should be lenient where the action is strict — do not 400 on a past
  or out-of-period date, because the dialog re-queries on every keystroke of a date input.
- Key the client query on the exact parameters the confirm button will submit, so widening
  a range re-checks the whole widened range instead of showing a stale answer.
- Restate the consequence on the confirm button itself, not only in the alert above it.
