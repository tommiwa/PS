---
name: Booking classification rule
description: How payroll/WPS vs peer-to-peer bookings are classified after the spot-swap incident fix
---

Rule: a parking spot with an individual owner (parking_spots.owner_id set) is ALWAYS peer-to-peer, regardless of listing.created_by_admin or spot.is_bci_managed. Use server/booking-classification.ts helpers; never test created_by_admin alone.

**Why:** An admin swap (unassign + reassign) used to soft-delete and re-create the owner's listings with created_by_admin=true and leave is_bci_managed=true, misrouting payments to payroll (Aug 2026 P100 incident).

**How to apply:** Any new code deciding owner display, payment routing, or payroll must use the shared classification helpers, never the raw flags. is_bci_managed also drives admin inventory grouping, so do NOT mass-flip it. Data repairs must never rewrite soft-deleted/historical listings or their bookings — that would transfer a prior owner's history to a new owner after a legitimate reassignment. Prod DB is read-only from the workspace; repairs ship as startup data-fix DML.

Clearing a spot's owner_id (release/unassign, including the scheduled-release cron) must also set is_bci_managed = true in the same update, or the spot becomes invisible in the Available pool and misclassifies for payment routing (Sep 2026 P158 incident).

A blanket "every unowned, non-BCI-managed spot is an orphaned release" data-repair is wrong: the admin Add Spot flow legitimately creates Personal spots with owner_id NULL and is_bci_managed false, awaiting a future owner. Scope repair migrations to unowned spots that also have a spot_assignment_history row with action IN ('unassigned','released') — that distinguishes a real past release from a never-yet-assigned Personal spot. Code review rejected an earlier version of this migration for missing that scoping.
