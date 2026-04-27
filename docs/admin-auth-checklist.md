# Admin Pages — Authenticated Fetch Checklist

## Rule: All data-fetching in admin pages must send session credentials.

This checklist exists to catch unauthenticated `fetch()` calls in protected page
components before they reach production.

---

### How the default fetcher works

`queryClient.ts` registers a global `queryFn` (via `getQueryFn`) that automatically
includes `credentials: 'include'` on every request.  Any `useQuery` hook that omits
its own `queryFn` therefore sends session cookies automatically.

```ts
// Safe — uses the global queryFn with credentials
const { data } = useQuery({ queryKey: ["/api/admin/users"] });
```

---

### When you must write a custom `queryFn`

Some queries need dynamic URLs that cannot be expressed as a static query-key array
(e.g. pagination with conditional filters, multi-step URL construction).  In those
cases you are responsible for forwarding credentials manually.

**Always add `{ credentials: 'include' }` to every bare `fetch()` inside a
`queryFn` or any imperative fetch in an admin component:**

```ts
// Safe — credentials forwarded explicitly
queryFn: () =>
  fetch(`/api/admin/bookings?scope=${scope}`, { credentials: 'include' })
    .then(r => r.json()),
```

```ts
// UNSAFE — session cookie is not sent, returns 401 silently
queryFn: () =>
  fetch(`/api/admin/bookings?scope=${scope}`)
    .then(r => r.json()),
```

---

### Code review checklist

Before approving a PR that touches any file in `client/src/pages/admin*.tsx`:

- [ ] Every `useQuery` either **omits `queryFn`** (safe) or uses a custom `queryFn`
  that calls `fetch(url, { credentials: 'include' })`.
- [ ] Any imperative `fetch()` call inside mutation `onSuccess`/`onError` callbacks
  or event handlers also includes `{ credentials: 'include' }`.
- [ ] No new admin endpoint is fetched via `apiRequest` with `method: 'GET'` —
  prefer `useQuery` with the default fetcher for GET requests.

---

### Quick grep to audit a file

```bash
# Find fetch() calls that are missing credentials in admin pages
grep -n "fetch(" client/src/pages/admin*.tsx | grep -v "credentials"
```

Any line returned by this command is a potential issue and should be reviewed.
