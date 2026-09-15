import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  getRequiredRoleForRoute,
  RENTER_ROUTES,
  OWNER_ROUTES,
  SHARED_ROUTES,
} from "./route-map";

// Full list of routes declared in App.tsx's authenticated <Switch>, paired
// with the role that must be able to view them. This is the "route map"
// regression guard: if a route is added, removed, or reassigned to a
// different role without this list being updated, the completeness check
// below will fail loudly instead of silently shipping a role-gating gap.
const EXPECTED_ROUTES: Array<{ path: string; role: "admin" | "owner" | "renter" | null }> = [
  { path: "/", role: null },
  { path: "/dashboard", role: null },
  { path: "/search", role: null },
  { path: "/profile", role: null },
  { path: "/notifications", role: null },
  { path: "/my-bookings", role: "renter" },
  { path: "/my-calendar", role: null },
  { path: "/my-listings", role: "owner" },
  { path: "/my-rentals", role: "owner" },
  { path: "/my-spots", role: "owner" },
  { path: "/admin", role: "admin" },
  { path: "/admin/parking", role: "admin" },
  { path: "/admin/locker-management", role: "admin" },
  { path: "/admin/users", role: "admin" },
  { path: "/admin/bookings", role: "admin" },
  { path: "/admin/analytics", role: "admin" },
  { path: "/admin/audits", role: "admin" },
  { path: "/admin/data-management", role: "admin" },
  { path: "/admin/reports", role: "admin" },
  { path: "/admin/waiting-list", role: "admin" },
  { path: "/admin/issues", role: "admin" },
  { path: "/admin/active-users", role: "admin" },
  { path: "/admin/leaderboard", role: "admin" },
  { path: "/admin/sales", role: "admin" },
  { path: "/map-demo", role: null },
  { path: "/faq", role: null },
];

describe("getRequiredRoleForRoute", () => {
  it("classifies every admin route as requiring the admin role", () => {
    for (const { path: p, role } of EXPECTED_ROUTES) {
      if (role === "admin") {
        expect(getRequiredRoleForRoute(p), `${p} should require admin`).toBe("admin");
      }
    }
  });

  it("classifies every owner route as requiring the owner role", () => {
    for (const { path: p, role } of EXPECTED_ROUTES) {
      if (role === "owner") {
        expect(getRequiredRoleForRoute(p), `${p} should require owner`).toBe("owner");
      }
    }
  });

  it("classifies every renter route as requiring the renter role", () => {
    for (const { path: p, role } of EXPECTED_ROUTES) {
      if (role === "renter") {
        expect(getRequiredRoleForRoute(p), `${p} should require renter`).toBe("renter");
      }
    }
  });

  it("does not force a role switch for shared/unrestricted routes", () => {
    for (const { path: p, role } of EXPECTED_ROUTES) {
      if (role === null) {
        expect(getRequiredRoleForRoute(p), `${p} should not require a specific role`).toBeNull();
      }
    }
  });

  it("treats any nested /admin/* path as admin-only, including future sub-routes", () => {
    expect(getRequiredRoleForRoute("/admin/some-new-page-added-later")).toBe("admin");
  });

  it("does not misclassify a path that merely starts with an owner/renter route as a prefix", () => {
    // Guards against a future refactor accidentally switching from exact-match
    // to prefix-match for non-admin routes.
    expect(getRequiredRoleForRoute("/my-spots-extra")).toBeNull();
    expect(getRequiredRoleForRoute("/my-bookings-history")).toBeNull();
  });

  it("keeps the RENTER_ROUTES/OWNER_ROUTES/SHARED_ROUTES constants in sync with the classifier", () => {
    for (const r of RENTER_ROUTES) expect(getRequiredRoleForRoute(r)).toBe("renter");
    for (const r of OWNER_ROUTES) expect(getRequiredRoleForRoute(r)).toBe("owner");
    for (const r of SHARED_ROUTES) expect(getRequiredRoleForRoute(r)).toBeNull();
  });
});

describe("route map matches the routes actually declared in App.tsx", () => {
  const appTsxSource = fs.readFileSync(
    path.resolve(__dirname, "../App.tsx"),
    "utf-8"
  );

  // Matches <Route path="/foo"> and <Route path="/foo" component={...} />
  // but skips the catch-all wildcard route "(.*)" which has no fixed role.
  const routeMatches = Array.from(
    appTsxSource.matchAll(/<Route\s+path="([^"]+)"/g)
  ).map((m) => m[1]);

  it("finds at least the expected number of declared routes (sanity check on the regex)", () => {
    expect(routeMatches.length).toBeGreaterThanOrEqual(EXPECTED_ROUTES.length);
  });

  it("declares every route this test suite expects to exist", () => {
    for (const { path: p } of EXPECTED_ROUTES) {
      expect(routeMatches, `expected App.tsx to declare a route for ${p}`).toContain(p);
    }
  });

  it("does not declare any route this test suite doesn't know about (update EXPECTED_ROUTES if intentional)", () => {
    const expectedPaths = new Set(EXPECTED_ROUTES.map((r) => r.path));
    const unknownRoutes = routeMatches.filter((p) => p !== "(.*)" && !expectedPaths.has(p));
    expect(unknownRoutes).toEqual([]);
  });

  it("classifies every declared admin-prefixed route as admin-only", () => {
    for (const p of routeMatches) {
      if (p === "/admin" || p.startsWith("/admin/")) {
        expect(getRequiredRoleForRoute(p)).toBe("admin");
      }
    }
  });
});
