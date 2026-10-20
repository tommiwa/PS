# Client parking timezone audit

## Shared date-helper behavior

The existing authenticated `GET /api/app-configs/timezone` endpoint initializes
one in-memory timezone source before the authenticated application mounts.
The unauthenticated login and terms pages do not wait on parking configuration.
Only a missing or empty setting selects the backend default,
`America/Los_Angeles`. Failed initial requests and invalid zones show a retry
screen instead of rendering a guessed parking date.

The source is refreshed every five minutes and on window focus. A successful
timezone save publishes the saved value immediately in that browser; other
open clients receive changes on their next successful refresh. Background
failures retain the last verified setting. The async formatting helpers and
sync Today/Tomorrow/This Week helpers all read this source.

Tomorrow and week-end computations advance calendar dates without converting
the arithmetic result back from UTC into the parking zone. This handles both
DST-length days and extreme positive timezone offsets.

## Audited consumers

- `client/src/lib/parking-search.ts`: date keywords and quick filters,
  effective button labels, empty headings, and mobile base tile rejection
  all use the sync helpers. No booking or API data shapes changed.
- `client/src/hooks/use-parking-search.ts`: subscribes to timezone changes,
  recomputing applied criteria while preserving input, filters, and debounce.
- `client/src/pages/search.tsx`: mobile result labels already use the shared
  helpers; the hook subscription rerenders these and the filtering pipeline
  together. The page mounts only after timezone initialization.
- `client/src/pages/admin-data-management.tsx`: a successful timezone save
  updates the shared source and invalidates the refresh query.
- All exports in `client/src/lib/timezone.ts`: asynchronous helpers now load
  the actual config endpoint and share the initialized value. Date-only
  `YYYY-MM-DD` storage/display values retain their original meaning.

## Intentionally unchanged

Desktop search retains its existing device-local base availability checks
and UTC-derived result labels. The search page's final booking-date fallback
and calendar Date construction also remain unchanged. Changing these paths,
server-side caches, BC timezone policy, or other application-wide date logic
would exceed this focused helper-initialization change. No booking endpoints,
payloads, database date columns, or backend timezone behavior were changed.

## Verification

Focused unit tests cover initialization, concurrent loads, failed loads/retry,
invalid settings, cache refresh, subscriptions, stale-request/admin-save races,
Pacific and Eastern midnight differences, DST spring gaps and repeated autumn
hours, leap/year boundaries, UTC+14, and the mobile base/date-filter pipeline.
Structural wiring checks cover the authenticated render gate and memoized
search subscription. These are not interactive browser tests.
