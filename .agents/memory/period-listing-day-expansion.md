---
name: Period listings are expanded per day for display only
description: Why admin availability rows are not real records, and the rule for acting on one day of a period listing
---

A period listing is ONE `spot_listings` record covering a date range. The admin Booking
Availability list expands it into one row per day purely for display; those rows are not
records and their ids are synthetic (`<listingId>-YYYY-MM-DD`). Rows also carry explicit
`parentListingId` / `periodDayDate` fields — prefer those over parsing the id suffix.

**Rule:** any action that targets a single day of a period must be date-aware. Acting on
the parent record without a date destroys the whole range. To remove day(s), split the
period into surviving segments (insert replacements, re-point active bookings on surviving
dates, then cancel + soft-delete the original) rather than cancelling the parent.

**Why:** an admin removing three days from an Aug–Dec period lost the entire period, because
the cancel flow stripped the date suffix and cancelled the underlying record. The only other
code that ever split a period (the booking handler) hid the bug: periods that had been booked
already existed as single-day records, so only never-booked periods were destroyed.

**How to apply:**
- Replacement records must copy rate, notes, owner, admin/charity flags, the ORIGINAL period
  bounds, `originalListingType`, and the sale-event pricing fields. `createSpotListing` does
  not copy sale fields — insert directly when sale pricing must survive.
- A one-day surviving segment collapses into a `single` record that keeps the original period
  bounds, matching the booking-time split convention.
- Removing the whole range behaves like an outright cancel: cancel only, no soft delete. A
  real split cancels AND soft-deletes the original so it stops appearing anywhere.
- Recurring listings are deliberately excluded from per-day removal; they are cancelled whole.
