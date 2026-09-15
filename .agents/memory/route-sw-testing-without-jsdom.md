---
name: Testing routing/PWA logic without jsdom
description: How to add automated coverage for App.tsx route-role gating and client/public/service-worker.js caching behavior in a vitest setup that has no jsdom/React Testing Library.
---

The project's `vitest.config.ts` runs with `environment: 'node'` and only includes
`server/**/*.test.ts` and `client/src/lib/**/*.test.ts` — there is no jsdom and no
`@testing-library/react`. Rendering pages/components in tests is not set up.

## Route role-gating
Pull the pure role-classification logic (which path requires which role) out of
`App.tsx` into a standalone module under `client/src/lib/` with no React/DOM
imports. Test it directly as data/logic, and add a completeness check that reads
`App.tsx`'s source text and regex-matches every `<Route path="...">` declaration,
comparing it against an expected list — this catches a route being added/removed/
reassigned without the classifier being updated, without ever rendering anything.

## Service worker caching/offline/update behavior
Don't duplicate the service worker's caching logic in a test double, and don't
modify `service-worker.js` just to make it testable — either drifts from the real
file. Instead, read the real `client/public/service-worker.js` source via `fs` and
execute it in a Node `vm.createContext` sandbox with mocked `self` (addEventListener
capturing install/activate/fetch/message handlers, skipWaiting, clients.claim),
mocked `caches` (an in-memory Map-backed implementation), and a mocked `fetch`.
Then dispatch synthetic install/activate/fetch/message events and assert on the
real strategy: network-first for code assets, stale-while-revalidate for images,
offline-fallback for navigation, and old-cache deletion + clients.claim on
activate (the mechanism that guarantees a new deployment doesn't leave users on
stale cached code).

**Why:** this exercises the actual shipped file with zero risk of the test
changing production behavior, and avoids adding a jsdom/RTL dependency just for
one feature area.

**How to apply:** when service-worker.js or App.tsx's route table changes again,
extend `client/src/lib/service-worker.test.ts` / `client/src/lib/route-map.test.ts`
rather than writing a new kind of harness.
