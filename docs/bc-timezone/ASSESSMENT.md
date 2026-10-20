# ParkShare: BC permanent Pacific Time impact assessment

**Assessed:** October 20, 2026. **Decision:** affected; not ready on the evidence available.
**Scope:** investigation only. No application behavior, stored bookings, live settings, dependencies, database schema, or deployment changed.

## Executive conclusion

**High-priority readiness risk before November 1.** Victoria parking needs BC Pacific Time, UTC−7 year-round after the final March 8, 2026 spring-forward. ParkShare's Los Angeles assumptions will remain seasonal even with fully updated timezone data. Separately, the workspace's Node, isolated desktop Chromium, OS timezone data, and development database still apply the old Vancouver fall-back. Changing the setting to `America/Vancouver` alone would therefore be insufficient here.

The first UTC-offset divergence is **November 1, 2026 at 09:00 UTC**: BC should continue from 01:59:59 to 02:00:00, but Los Angeles and this workspace's stale Vancouver data repeat 01:00. Displayed times then lag by an hour. The first resulting **calendar-date disagreement** is November 2 at 07:00–07:59 UTC (BC 00:00–00:59; Los Angeles still the previous day). Winter month/year and week cutoffs are affected. Los Angeles catches up on March 14, 2027 at 10:00 UTC, then diverges again the following winter if unchanged.

Potential user consequences: Today/Tomorrow selecting the previous day, This Week selecting the prior week at a Sunday boundary, stale availability and past-booking controls, misleading email dates, incorrect “today” totals and default payroll months, and ownership/status jobs running at the wrong business-day boundary. These are not evidence that every booking moves: bookings and listing days are stored as **DATE**, not instants.

**Minimum remediation, in order, subject to separate approval:**
1. Verify the live locations, active timezone, deployed Node/ICU, actual supported clients, and database behavior using the read-only checks below. Establish modern Vancouver rules independently in each runtime that performs conversions.
2. Use `America/Vancouver` for verified Pacific-region business dates, defaults/seeding, and notification calculations; remove Los Angeles assumptions. Use existing **task #388** for synchronous client configuration work, rather than duplicating it. Preserve date-only values and historical DST rules.
3. Independently make business-day jobs, validations, report defaults, and overdue calculations explicit about the business timezone; align scheduler trigger and due-date selection. A global setting change does not reach these paths.
4. Gate release on the boundary and cross-device acceptance checks below. If displaying an abbreviation, use the official **PCT** label for the applicable period/location, separately from offset correctness.

## 1. Governing rules and location scope

Authoritative sources re-fetched in this assessment:

- [BC, March 2 announcement](https://news.gov.bc.ca/releases/2026AG0013-000209): March 8 is the final spring-forward; November 1 fall-back is cancelled for the Pacific region; UTC−7 is retained. Northeastern and southeastern mountain-time arrangements are separate.
- [BC, September 17 announcement](https://news.gov.bc.ca/releases/2026CITZ0009-001073): official display name **Pacific Time**, abbreviation **PCT**. This is **not** an IANA identifier to pass to `Intl` or PostgreSQL.
- [IANA tzdb NEWS](https://data.iana.org/time-zones/tzdb/NEWS): release **2026b**, April 22, adds Vancouver's permanent −07. It retains historical rules, temporarily models the standard/daylight designation change at November 1 02:00, and uses **MST** for post-transition −07 for compatibility. Thus a correct offset can accompany a non-PCT library label. Current NEWS also lists later releases through 2026e; “2026b or later with Vancouver behavior verified” is a minimum, not a claim that 2026b is the latest.

Development read-only location query returned **Victoria / 750 Pandora Ave**, which is in the affected Pacific region, plus a synthetic test office whose geography cannot be inferred. Repository seed commentary also names Victoria (`scripts/populate-production-data.ts:229`). Production locations were inaccessible. Do not infer the actual four locations from the overview in `replit.md`, nor apply Vancouver to every BC mountain community. The March announcement's examples of mountain practices are not proof that every regional rule remains unchanged in later tzdb releases; inventory live locations before selecting any other zone.

## 2. Evidence levels and environment readiness

| Layer | Verified observation | What it does NOT prove |
|---|---|---|
| Repository | Defaults, sync client helpers, host-local/UTC expressions and DB-session expressions below are present in the visible checkout. | That the private deployment runs exactly this revision. |
| Workspace server | Node **v20.20.0**, ICU **76.1**, embedded tz **2024b**; host resolves to **UTC**. Vancouver December 1 probe produces November 30 23:30 −08. | Production Node version, ICU, host zone, or readiness. |
| Workspace desktop browser | Isolated **HeadlessChrome 140.0.0.0 on Linux**, without loading/signing into the app, produces the same stale Vancouver offsets on the boundary matrix. | Actual staff desktop Chrome/Edge versions, Safari/iOS, Android, or installed PWA behavior. This was not a UI end-to-end test. |
| Workspace OS | Python `zoneinfo` at December 1 07:30 UTC returns Vancouver November 30 23:30 −08. | OS package version, or Node/browser dependency on that OS database. |
| Development DB | Read-only SQL session is **GMT**. Vancouver November 1 18:00 UTC yields **10:00**, winter December 1 07:30 yields **November 30 23:30**, and January 1 07:30 yields **December 31**. Config value is **America/Los_Angeles**; week start **sunday**. | Production settings or the timezone of each live application pool connection. |
| Production HTTP | Deployment metadata reports a private, successfully built autoscale app at `https://park-share-bci.replit.app`. GET `/api/app-configs` returns **307 to Replit's private-access shield**, before app data is visible. | Authenticated behavior or a correct timezone. Build success is not timezone validation. |
| Production DB | Read-only query attempted through production access; rejected because an authenticated user is required. No production data returned. | Production session timezone, tzdata, active config, or location inventory. |

**Dependencies are independent.** `date-fns-tz` delegates zone conversions to `Intl.DateTimeFormat` (see installed `dist/esm/_lib/tzTokenizeDate/index.js:51–85`). It does not ship a replacement rules database. A typical Node build embeds ICU timezone data: upgrading OS tzdata alone may leave Node's `Intl` unchanged; a Node major/minor label alone does not prove its rule version. Browsers may depend on their engine/platform's data and update schedules. PostgreSQL uses its own installed timezone rules (packaged or system, depending on build), not the Node process's ICU. Verify actual results in each.

PWA cache clearing updates application assets, **not the engine's timezone rules**. `client/public/service-worker.js:39` bypasses API caching; there is no bundled Vancouver rule replacement. An older installed PWA can still run on an older engine, and a long-lived tab may retain previously calculated dates. Existing helpers also cache settings for five minutes without automatically re-evaluating every mounted view at business midnight.

## 3. Reproducible boundary evidence

Run from the repository root, without starting the application:

```sh
node --import tsx docs/bc-timezone/probe.mjs
# Optional: use an already-installed Chromium binary, without downloading/upgrading:
node --import tsx docs/bc-timezone/probe.mjs --browser /path/to/chrome
```

The probe imports only timezone utilities, freezes its own process clock, asserts unaffected invariants, and evaluates job expressions in isolated child processes. It does **not** import startup, storage, routes, or email modules, connect to a database, run a job, or send notifications. Expected Vancouver values are explicit; post-change expectations do not rely on Vancouver data from the runtime being tested. Exit zero means the diagnostic completed and unaffected assertions passed, **not** that BC readiness passed.

### Offset matrix

Node `formatInTimeZone` returned the same values for Vancouver and Los Angeles in this workspace. The isolated Chromium `Intl` probe independently returned the same local fields/offsets (with locale punctuation differences).

| Input UTC | Expected Vancouver | Actual workspace Vancouver / Los Angeles |
|---|---|---|
| 2025-12-01 07:30 | 2025-11-30 23:30 −08 | Same — historical control |
| 2026-03-08 09:59:59 | 2026-03-08 01:59:59 −08 | Same |
| 2026-03-08 10:00 | 2026-03-08 03:00 −07 | Same — final spring-forward |
| 2026-11-01 08:59:59 | 2026-11-01 01:59:59 −07 | Same |
| 2026-11-01 09:00 | 2026-11-01 02:00 −07 | **2026-11-01 01:00 −08** |
| 2026-11-01 18:00 | 2026-11-01 11:00 −07 | **2026-11-01 10:00 −08** |
| 2026-11-02 07:30 | 2026-11-02 00:30 −07 | **2026-11-01 23:30 −08** |
| 2026-12-01 07:30 | 2026-12-01 00:30 −07 | **2026-11-30 23:30 −08** |
| 2027-01-01 07:30 | 2027-01-01 00:30 −07 | **2026-12-31 23:30 −08** |
| 2027-03-14 09:59:59 | 2027-03-14 02:59:59 −07 | **2027-03-14 01:59:59 −08** |
| 2027-03-14 10:00 | 2027-03-14 03:00 −07 | Same; stale rules create a spurious spring gap |
| 2027-07-01 07:30 | 2027-07-01 00:30 −07 | Same; summer agreement hides winter defects |

### Code/workflow evidence matrix

“Confirmed” below refers to utility outputs, read-only SQL, or isolated evaluation of the exact date expression. Consequences of writes/jobs are inferred from code; no destructive endpoint/job was executed.

| Workflow and severity | Reproduction, expected → actual | Relevant code / consequence |
|---|---|---|
| **Today / Tomorrow — high, confirmed helpers** | Freeze at `2026-12-06T07:30Z` (Sunday 00:30 BC). Today Dec 6 → **Dec 5**; Tomorrow Dec 7 → **Dec 6**. The merged fresh-mobile default also resolves to Dec 5. | `client/src/lib/timezone.ts:5,48–68`; `client/src/lib/parking-search.ts:23–24,44–45`; `client/src/hooks/use-parking-search.ts`. Sync helpers ignore configured timezone. |
| **This Week — high, confirmed helper** | Same Sunday input, Sunday-start week: start/end Dec 6–12 → **Dec 5–5**. Monday-start end remains Dec 6, but start is still Dec 5 instead of Dec 6. | Client helper `81–99`. Correct configured week-start logic does not fix an incorrect “today.” |
| **Availability / past-day controls — high, confirmed default helper, inferred endpoint impact** | Same input: Dec 5 should be past; `isDateInPast('2026-12-05')` → **false**, default server Today → **Dec 5**. | `server/timezone.ts:6,53–56,149–159`; `routes.ts:2604` availability, `6294` period removal, `6720,6794` booking swap eligibility. These can retain yesterday for an extra hour. Configured Vancouver still fails if data is stale. |
| **Listing creation / expiry / completion — high, confirmed host expression** | `2026-12-01T06:30Z` is Nov 30 23:30 BC. Expected cutoff Nov 30, November 30 listing/booking not yet past. With host UTC expression cutoff is **Dec 1**, so `'2026-11-30' < cutoff` is **true**. | `routes.ts:1664–1670,1932,2032,9954`; `server/index.ts:553–555,615–617`. Listing creation can reject a valid day; hourly expiry can mark it unused; BCI auto-completion can mark it completed/paid early. Existing host assumption, not a newly introduced BC-only bug. Production occurrence unverified. |
| **Scheduled assignments / releases — high, confirmed selector/trigger assumptions** | Same Nov 30 23:30 BC: December 1 should not yet be due. UTC-host selector says **due**; midnight cron is 00:00 UTC = **17:00 previous BC day**, seven hours early. A seasonal LA host instead triggers at **01:00 BC** after fall-back, one hour late. | `storage.ts:4522–4531,4573–4582`; `index.ts:983–1000`, no cron timezone option; `scheduled-releases.ts:6,28–32,48–54,118–120`. Both startup execution and cron can affect ownership/roles/listings; release writes/notifications were NOT run. |
| **Cancellation deadline — high, confirmed expression** | At `2026-12-01T06:30Z`, booking Dec 2 midnight BC is 24.5 hours away. Host-local `new Date('2026-12-02T00:00:00')`: UTC gives **17.5h** (24h policy rejects); stale LA/Vancouver gives **25.5h**. | `routes.ts:6921–6929`. Existing midnight-to-instant assumption; the 24-hour duration itself needs no change, but its booking-day anchor does. |
| **Calendar selected day / Today marker — medium, confirmed expression; UI unverified** | In an LA/Vancouver browser, `new Date('2026-12-01').getDate()` → **30**, expected selected day **1**. Calendar Today and month navigation use device-local `new Date()`, so a stale device still shows yesterday at winter BC 00:30. | `search.tsx:1104`; `parking-calendar.tsx:77,620,734,848`. Existing ISO-date parse/device-zone dependence; static code evidence, not an exercised calendar UI. |
| **Search result labels — medium, confirmed expression** | At `2026-12-01T06:30Z`, BC Today is Nov 30; desktop UTC `toISOString().split('T')[0]` says **Dec 1**. At Dec 6 07:30Z, the merged mobile helper instead says **Dec 5** vs expected Dec 6. | `search.tsx:898–906`, plus UTC fallback `409`. The merged mobile path now uses sync parking helpers; desktop retains UTC labels. Both dependencies require consideration without redesigning desktop search. |
| **Emails / alerts — medium, confirmed date expressions; delivery untested** | At Sunday input above, milestone's hardcoded LA “today” is **Dec 5**, expected Dec 6. `new Date('2026-12-01').toLocaleDateString(...)` in LA gives **Nov 30**, expected Dec 1 for a date-only booking. | `notification-service.ts:17–25` common date/range formatter used by booking/payment/availability/weekly messages; `3330–3337` milestone range/duration; maintenance times `1511,1546` host-local. No email sent. Date-only strings/noon-anchored alert ranges need not move; audit each caller rather than assuming all templates fail. |
| **Reports / payroll — high for defaults, confirmed expressions; report totals untested** | Sunday probe: configured/default Today is Dec 5 vs Dec 6. Nov 30 23:30 BC with UTC host: `now.getMonth()+1` is **12**, expected **11**. | `reports-controller.ts:67–84,143–153` default range/today; `routes.ts:5417–5424,5711–5720` mixed configured Today/host month and current payroll month. `storage.ts:3199,3491,3633` uses UTC Today for availability/active/history. Explicit date ranges are not inherently shifted. |
| **Overdue payment buckets — medium, confirmed development SQL** | At `2026-12-01T06:30Z`, booking Nov 23 should be **7** calendar days old in BC; GMT session-date expression gives **8**, changing the 0–7 vs 8–30 bucket. | `storage.ts:3395–3397,3423–3425,3433`, uses `CURRENT_DATE`. GMT happens to give the correct date during BC 00:00–00:59 but advances seven hours too early each evening. Changing Node/config alone cannot fix this. |

Important formatter distinction: the probe confirms `server/timezone.ts:70–72` retains the bare DATE string `2026-12-01` as **2026-12-01** with the installed `date-fns-tz`. Its timezone-less input is interpreted with the target zone by that library. Do not infer a date shift merely from the midnight-looking string; ordinary `new Date('YYYY-MM-DD')` and library parsing are different paths.

**Booking creation/validation boundary:** date-only availability equality/ranges do not inherently require timezone conversion. The booking path must still be acceptance-tested end-to-end against listing status, selected day, locks, and the various “past” checks after approved remediation. This assessment does not claim that every booking-creation route independently rejects past days using the shared helper.

## 4. What should remain unchanged

- `shared/schema.ts:258–264,379` stores listing days and booking day as SQL `DATE`; scheduled dates are also date-only. Do **not** shift existing day strings or bulk-rewrite bookings.
- The probe confirms client DB formatting retains `2026-12-01`, client date-only display is `12/01/2026`, and both the server's database DATE-object UTC-component branch and bare-date-string branch retain `2026-12-01`. This is not a guarantee about every formatter.
- Explicit `YYYY-MM-DD` comparisons and UTC-component calendar-day enumeration (`storage.ts:97–111`) need no inherent one-hour adjustment.
- Report filters on booking-date strings (`reports-controller.ts:119–123,404–410`) remain tied to the supplied dates. Payroll deduction-period calculation (`storage.ts:3643–3653`) derives from the booking day, with an existing twentieth-day rule; payroll summary uses calendar booking month (`routes.ts:5767–5770`). This assessment does not authorize reconciling those pre-existing policy differences.
- Lock expiry is elapsed milliseconds, e.g. `Date.now()+timeout`, compared with an instant; two minutes remains **120,000ms**. Thirty-day refresh token expiry remains **2,592,000,000ms** (`server/replitAuth.ts:58–68`). Their wall-clock labels may change; their durations should not. Retention/timeouts expressed as elapsed milliseconds similarly do not inherently need adjustment.
- Historical UTC instants and stored audit/payment/session timestamps must not be bulk shifted. Several schema timestamps are PostgreSQL **timestamp without time zone**, not `timestamptz`; confirm encoding/driver conventions before future display changes, rather than assuming every stored timestamp has an explicit offset.
- Preserve 2025 winter UTC−8 and the actual March 2026 spring-forward. A universal fixed −07 replacement or substituting Phoenix/Whitehorse for Vancouver would lose relevant local history. “Permanent” does not mean retroactive.

## 5. Safe remaining verification instructions

These checks are instructions for authorized access, not claims that they passed.

**Production runtime:** in an authorized deployed-runtime diagnostic session, run only the probe's pure `Intl`/date calculations. Do not run `npm run dev`, `npm start`, `server/index.ts`, a migration, or job exports: startup performs writes and can dispatch emails. Capture `process.version`, `process.versions.icu`, `process.versions.tz`, and `Intl.DateTimeFormat().resolvedOptions().timeZone`, then compare every matrix row. A workspace shell does not measure a deployed process. No public debug endpoint was added.

**Production database:** run the following SELECT-only queries through the authorized production read-only connection. Inspect the live application's connection timezone separately if diagnostic connections differ. The session timezone is not a tzdata version.

```sql
SELECT current_setting('TimeZone') AS session_timezone,
       TIMESTAMPTZ '2026-12-01 07:30:00+00'
         AT TIME ZONE 'America/Vancouver' AS vancouver_winter,
       TIMESTAMPTZ '2027-01-01 07:30:00+00'
         AT TIME ZONE 'America/Vancouver' AS vancouver_new_year;
-- Expected Vancouver values: 2026-12-01 00:30; 2027-01-01 00:30.
SELECT key, value FROM app_configs
 WHERE key IN ('timezone', 'week_start_day') ORDER BY key;
SELECT DISTINCT office, building FROM locations
 ORDER BY office, building LIMIT 30;
SELECT DATE '2026-12-01' AS date_only,
       (TIMESTAMPTZ '2026-12-01 06:30:00+00'
         AT TIME ZONE current_setting('TimeZone'))::date - DATE '2026-11-23'
         AS session_days_overdue,
       (TIMESTAMPTZ '2026-12-01 06:30:00+00'
         AT TIME ZONE INTERVAL '-07:00')::date - DATE '2026-11-23'
         AS expected_bc_days_overdue;
-- expected_bc_days_overdue = 7. Fixed offset is an oracle for this date only.
```

No `SET TIME ZONE`, DDL, connection-string changes, database imports, or service writes are needed for these checks.

**Actual desktop and mobile/PWA engines:** on representative supported Chrome/Edge desktop, Safari/iOS (tab and installed PWA), and Android Chrome (tab and installed PWA), run this pure console expression; record engine/OS version, default device zone, offset and date. Do not change the device clock:

```js
new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset'
}).format(new Date('2026-12-01T07:30:00Z'))
// Expected local fields: 2026-12-01 00:30, GMT-07:00 (punctuation may vary).
```

Repeat the full matrix, including historical controls. A phone-sized desktop Chromium viewport or mobile user-agent string is **not** a real Safari/iOS/Android timezone-data check. In a future safe fixture environment with emails/jobs disabled, check app flows at simulated instants, before/after midnight with a tab left open, on settings refresh, after a PWA app update, and on devices outside BC. Do not test live write endpoints against real bookings.

## 6. Acceptance gate and task overlap

For an approved implementation:

- All supported conversion layers return the Vancouver matrix; Los Angeles deliberately retains its own seasonal behavior. Validate offsets/date fields independently from PCT abbreviation rendering.
- At Dec 6 07:30 UTC, Today/Tomorrow are Dec 6/7, Sunday-start This Week is Dec 6–12, and Dec 5 is past. Check Monday-start separately.
- At Dec 1 and Jan 1 07:30 UTC, search/date inputs, selected calendar day, server validation, emails, report “today,” and default month agree with BC. Explicit historical ranges and booking-day totals remain unchanged.
- Listing validity, expired/unused status, BCI auto-completion and overdue buckets use the intended BC day. Verify with fixtures and mocked storage/email only.
- Scheduled assignment/release trigger time **and** due selector agree on BC midnight; no early ownership removal or late transfer, including startup recovery. Existing release tests mock the due selector (`scheduled-releases.test.ts:410–434`), so they do not validate its timezone.
- Cancellation instant anchors use BC midnight while retaining elapsed-hour policy. Lock/session expiry elapsed durations and historical timestamps do not change.
- Existing `server/timezone-utils.test.ts` verifies Los Angeles November fall-back, not permanent Vancouver; keep LA tests where applicable and add explicit Vancouver/winter midnight/year/week tests.

**Task #388** covers synchronous helpers following configured timezone; it does not by itself refresh ICU/browser/database data, remove all hardcodes, or fix host/SQL/cron assumptions.

**Task #387 (Mobile Search Date Defaults)** became visible when this report was synchronized with main. Its merged implementation was then inspected: `client/src/lib/parking-search.ts:23–24` defaults widths below 768px to Today and leaves desktop unfiltered; `client/src/hooks/use-parking-search.ts:21` clears to empty criteria; date parsing and mobile tile eligibility use the synchronous parking helpers (`parking-search.ts:44–48,158`). The isolated probe confirms fresh-mobile criteria resolves to **Dec 5** at `2026-12-06T07:30Z`, while cleared mobile and fresh desktop have no date restriction. Thus the new mobile default does not fix the BC timezone source; it exposes the same wrong-day calculation immediately on fresh mobile visits. Mobile result labels now use these helpers, while desktop retains UTC labels (`search.tsx:898–899`). No mobile redesign or duplicate implementation was made. These are code/pure-parser checks, not a newly performed mobile UI test. Task #388 remains separate implementation work, not part of this report.

## Assessment limitations

Verification completed: the isolated probe's date-only and elapsed-duration assertions passed; its explicit BC comparisons recorded the failures above. Existing timezone and mocked scheduled-release tests passed **31/31** using `npx vitest run server/timezone-utils.test.ts server/scheduled-releases.test.ts --reporter=dot`. Those existing tests do not establish BC readiness.

No production settings/data, authenticated production UI, deployed-runtime metadata beyond deployment status, or real mobile devices were accessible. Host-expression and email-format probes do not prove live job execution, delivery, or financial totals. The application was not started/restarted because startup has writes and notifications. This report and its diagnostic probe are the only deliverables; implementation remains subject to separate approval.
