# Booking cancellation timezone correction

## Scope

Cancellation uses midnight at the **beginning of the stored booking day in the
configured parking timezone**, minus the configured number of elapsed hours.
Cancellation exactly at the deadline remains allowed. The API and the renter
page's confirmation, card actions, and compact actions use the same shared
calculation. The renter page subscribes to the existing initialized timezone
setting; no guessed device-local timezone is used.

Stored booking dates, policy settings, ownership checks, cancellation writes,
listing restoration, audit records, and notification routing are unchanged.
Paid peer-to-peer bookings retain the refund-settlement warning when eligible;
ineligible bookings get the cutoff explanation rather than a misleading
"Cancel Anyway" confirmation. No automatic refund was added.

## Evidence collected October 21, 2026

### Authorized production verification limits

- Deployment metadata reports a private autoscale deployment with a successful
  build.
- An unauthenticated GET of the deployed timezone config endpoint returns HTTP
  307 to Replit private-access authentication, before application settings.
- The production read-only settings query is blocked because an authenticated
  user is required. No production query results were returned.
- Available deployment request logs contain truncated configuration responses;
  these do not establish the active setting, cutoff, runtime timezone, deployed
  calculation, or affected booking's complete date/timestamps.
- Consequently the reported incident's cause is **not confirmed in production**.
  No live booking was cancelled or edited as a diagnostic, and no production
  setting, refund, or data repair was performed.

### Local reproduction and regression checks

At `2026-05-12T17:13:00Z` (10:13 a.m. Vancouver), a booking for `2026-05-13`
starts at `2026-05-13T07:00:00Z`: **13 hours 47 minutes** away. With a 12-hour
cutoff, cancellation must be allowed. The former UTC-host expression instead
anchors to `2026-05-13T00:00:00Z`, only **6 hours 47 minutes** away, and rejects.
This is a synthetic deterministic reproduction, not the affected booking.

Automated coverage:

- Reported scenario and one millisecond before, exactly at, and one millisecond
  after the cutoff, including 12- and 24-hour configurations.
- Local timezone independence under UTC, Vancouver, Tokyo, and Auckland.
- A non-Pacific configured parking timezone.
- Historical Vancouver winter, spring-forward, and fall-back boundaries; elapsed
  hours are not assumed to equal a calendar day.
- Mocked HTTP route success/rejection, ownership, missing authentication, missing
  booking, already-cancelled protection, absent-setting 24-hour default, paid
  booking settlement preservation, listing restoration, audit, and notifications.

The initial focused run of cancellation, booking-email, and existing timezone
tests passed (40 tests before the additional default-policy/paid regressions).
The configured full test suite is also run by task completion validation.
All cancellation tests use mocked storage and notifications, not live writes.

The development application was started using its existing workflow and reached
port 5000 without startup errors. A preview capture of `/my-bookings` showed the
sign-in screen only; this is **not** visual or interactive verification of the
authenticated renter controls. Those controls were checked through their shared
calculation, source wiring, and mocked API tests; no browser cancellation was
performed.

`npm run check` reports unrelated errors in reporting, audit, storage, and other
existing code (for example `borderOpacity` in `UtilizationReport.tsx` and missing
audit entity icons in `admin-audits.tsx`). It is not a passing project-wide type
check. No diagnostic points to the new cancellation helper, its tests, or the
changed renter calculations.

## Remaining timezone dependency

This change uses existing `date-fns-tz` / runtime timezone rules. It does not
update Node/ICU, browser timezone data, the configured parking zone, or BC's
permanent-time support. The separate BC readiness work remains necessary.
Historical rules and date-only storage must not be replaced with a universal
fixed UTC−7 offset.
