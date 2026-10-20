---
name: Client timezone initialization
description: Why parking UI must wait for verified configuration and preserve date-only calendar semantics.
---

Do not guess the parking timezone while its configuration is loading or
refreshing. Keep the last verified setting during refresh; initial load
failures must be visible instead of silently selecting Pacific time.

**Why:** A guessed first date can initialize mobile Today searches to the wrong
day near midnight. A request failure is not evidence of the configured zone.

**How to apply:** New synchronous date-dependent UI must be mounted behind
timezone initialization and subscribe when memoizing relative-date criteria.
Keep calendar-day arithmetic separate from conversion of real instants;
formatting a UTC arithmetic container back into UTC+13/+14 shifts its day.
Do not expand a focused helper change into device-local desktop or backend
timezone standardization without explicit scope.
