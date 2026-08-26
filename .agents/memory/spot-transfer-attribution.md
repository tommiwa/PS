---
name: Spot-transfer attribution
description: Rules for booking/listing attribution when a spot changes owner; tenure-scoped repairs and booking-time report classification
---

Booked listings survive a spot assignment in ACTIVE state (soft-delete only removes available listings), so any data repair keyed on "active listing + current spot owner" will misattribute pool-era or prior-owner history to the new owner unless it is tenure-scoped.

**Rules:**
- Ownership tenure comes from the spot assignment history; repairs that rewrite attribution must only touch listings created within — and bookings dated within — the current owner's tenure, and must prove a row is pool-era via the ownership state at its creation time (an A→B→A re-transfer must never touch A's legitimate first-tenure rows).
- Historical reports classify a booking by BOOKING-TIME context (its listing's attribution), NOT current spot ownership — and must load listings *including soft-deleted ones*, since bookings keep referencing listings after deletion. Live payment routing keeps using current-ownership classification; do not merge the two.

**Why:** an unscoped startup repair once credited a spot's entire pool-era booking history to its new owner, inflating the owner leaderboard and draining the Workplace Services report.

**How to apply:** any new data repair or report touching booking/listing attribution must consider transfer timelines; prod data fixes ship as idempotent startup repairs (prod DB is read-only from the workspace; they apply on publish).
