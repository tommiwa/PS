---
name: Program start date 2026-03-16
description: The parking program's effective launch date, used to bound "since launch" metrics; currently hardcoded in more than one place.
---

`2026-03-16` is the app/program's effective launch date. Metrics meant to reflect
activity "since the program started" (as opposed to true all-time history) filter
on this date rather than counting from the beginning of the bookings table.

**Why:** Historical/test bookings exist before this date. The admin renter/owner
leaderboard (`client/src/pages/admin-leaderboard.tsx`, `getDefaultDates()`) already
hardcodes `2026-03-16` as its default window start. The renter booking milestone
counter (`server/milestone-checker.ts`, `RENTER_MILESTONE_COUNT_START_DATE`) was
aligned to the same cutoff so lifetime counts mean "bookings since launch," not
"every row ever inserted."

**How to apply:** If this date is ever revisited (e.g. made configurable, or the
program's official start changes), update both locations together — they are not
sourced from one shared constant today, so a future agent must grep for
`2026-03-16` across `client/` and `server/` to find every place it needs to change.
