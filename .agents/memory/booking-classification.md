---
name: Booking classification rule
description: How payroll/WPS vs peer-to-peer bookings are classified after the spot-swap incident fix
---

Rule: a parking spot with an individual owner (parking_spots.owner_id set) is ALWAYS peer-to-peer, regardless of listing.created_by_admin or spot.is_bci_managed. Use server/booking-classification.ts helpers; never test created_by_admin alone.

**Why:** An admin swap (unassign + reassign) used to soft-delete and re-create the owner's listings with created_by_admin=true and leave is_bci_managed=true, misrouting payments to payroll (Aug 2026 P100 incident).

**How to apply:** Any new code deciding owner display, payment routing, or payroll must use the shared classification helpers, never the raw flags. is_bci_managed also drives admin inventory grouping, so do NOT mass-flip it. Data repairs must never rewrite soft-deleted/historical listings or their bookings — that would transfer a prior owner's history to a new owner after a legitimate reassignment. Prod DB is read-only from the workspace; repairs ship as startup data-fix DML.
