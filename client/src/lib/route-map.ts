// Central definition of which role is required to view a given route.
//
// This is intentionally a plain data/logic module (no React, no DOM) so it
// can be unit tested directly and imported by both the router (App.tsx) and
// the auto role-sync hook without pulling in any page components.
//
// If you add, remove, or move a route in App.tsx's <Switch>, update the
// relevant list below too — route-map.test.ts checks these stay in sync
// with the routes actually declared in App.tsx.

export type AppRole = "admin" | "owner" | "renter";

// Renter-only routes (outside of /admin/*).
export const RENTER_ROUTES = ["/my-bookings"] as const;

// Owner-only routes (outside of /admin/*).
export const OWNER_ROUTES = ["/my-spots", "/my-listings", "/my-rentals"] as const;

// Routes available to any authenticated role (no forced role switch).
export const SHARED_ROUTES = ["/search"] as const;

/**
 * Returns the role a user must be viewing as in order for the given path to
 * make sense, or null if the route is available regardless of role (shared
 * pages like /search, /profile, /dashboard, /notifications, /faq, etc).
 */
export function getRequiredRoleForRoute(path: string): AppRole | null {
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if ((OWNER_ROUTES as readonly string[]).some((r) => path === r)) return "owner";
  if ((RENTER_ROUTES as readonly string[]).some((r) => path === r)) return "renter";
  if ((SHARED_ROUTES as readonly string[]).some((r) => path === r)) return null;
  return null;
}
