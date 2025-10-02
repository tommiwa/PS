# BCI Parking Spot Sharing Application

## Overview
This project is a corporate parking spot sharing application for BCI company, designed to efficiently allocate 150 parking spots among 1000 employees across 4 locations. The system supports administrators and renters, with administrators managing unallocated spots. The application aims to streamline parking management and provide a user-friendly experience for BCI employees.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite)
- **UI Components**: Shadcn/ui with Radix UI
- **Styling**: Tailwind CSS, Material Design principles
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Theme**: Light/dark mode

### Backend
- **Runtime**: Node.js with Express.js
- **Database ORM**: Drizzle ORM
- **API Design**: RESTful API
- **Session Management**: Express sessions with PostgreSQL store
- **Error Handling**: Centralized error middleware

### Data Storage
- **Primary Database**: PostgreSQL (Neon Database)
- **Schema Management**: Drizzle migrations
- **Session Storage**: PostgreSQL
- **Database Pool**: @neondatabase/serverless

### Authentication & Authorization
- **User Management**: Role-based access control (admin, renter)
- **Authentication**: Server-side session management, Replit OIDC
- **Employee Integration**: Designed for company employee login
- **Permission System**: Route and component-level checking

### Design System
- **Color Palette**: Professional blue (#2563eb), neutral grays, semantic colors
- **Typography**: Inter font family
- **Layout System**: Tailwind's 8-point grid system
- **Component Library**: Custom components for parking functionality

### Key Features
- **Multi-role Dashboard**: Dynamic content per user role
- **Booking System**: Real-time management with status tracking
- **Calendar Integration**: Custom parking calendar
- **Search & Filtering**: Location, spot type, pricing
- **Admin Management**: User management, analytics
- **Notification System**: Real-time alerts and confirmations (email/in-app)
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics (occupancy, revenue, registrations).

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL
- **SendGrid**: Email service for notifications

### Key Libraries
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: UI component primitives
- **drizzle-orm**: Type-safe database ORM
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Client-side router
- **date-fns**: Date manipulation
- **zod**: Runtime type validation

### Infrastructure Dependencies
- **Node.js**: Backend runtime
- **PostgreSQL**: Database engine
- **WebSocket**: Real-time communication (via neonConfig)

## Recent Feature Implementations

### Automatic User Role Management (October 2025)
Implemented dynamic role changes based on parking spot ownership, providing seamless user experience:

**Feature Overview**:
- Users automatically transition between "renter" and "owner" roles based on spot assignment
- When a renter is assigned a parking spot → role changes to "owner"
- When an owner loses their last spot → role changes back to "renter"
- Works for both single and bulk spot assignments

**Implementation**:
- **Single Assignment**: POST `/api/admin/assign-spot` checks user role after assignment
- **Bulk Assignment**: POST `/api/admin/bulk-assign-spots` updates role after bulk operations
- **Unassignment**: PUT `/api/admin/spots/:spotId/unassign` counts remaining spots before role change
- All role changes use `storage.updateUser(userId, { role })` with proper null checks
- No audit logging for role changes to keep implementation simple

**Critical Database Fixes**:
- Fixed `getParkingSpot()`: Now queries PostgreSQL instead of in-memory Map
- Fixed `updateParkingSpot()`: Now uses database operations with Drizzle ORM
- Fixed `deleteParkingSpot()`: Now uses database delete operations
- All parking spot operations now properly persist to the database

**User Experience**:
- Automatic role transitions happen seamlessly without user intervention
- Role-based navigation and permissions update immediately
- Admin dashboard reflects current ownership status accurately

### Admin Dashboard Redesign (October 2025)
Streamlined the admin dashboard experience by consolidating analytics and removing redundant sections:

**Dashboard Changes**:
- **Removed Quick Actions Section**: Eliminated Quick Actions card grid from admin dashboard for cleaner interface
- **Removed 4 Admin Metric Cards**: Removed Today's Occupancy, Pending Issues, Revenue Today, and New Registrations cards
- **Integrated Analytics & Reports**: Moved comprehensive analytics directly into admin dashboard (previously separate page)
- **Removed Analytics Navigation**: Analytics & Reports no longer appears as separate sidebar item

**Current Admin Dashboard Layout**:
1. **Top 4 Metric Cards**: Total Spots, Active Users, Today's Bookings, Revenue This Month (from DashboardStats)
2. **Analytics & Reports Section** (admin-only access):
   - 6 Key Metrics Overview Cards (Total Revenue, Total Bookings, Active Users, Utilization Rate, Avg Booking Value, Growth Rate)
   - 4 Analytics Tabs: Revenue Analysis, Usage Patterns, Top Performers, Issues & Alerts
   - Date range selector and data refresh functionality
   - Toggle to show/hide metrics cards

**Technical Implementation**:
- Analytics queries use `enabled: effectiveRole === "admin"` to gate data fetching
- Query hooks: overviewQuery, revenueQuery, topPerformersQuery, issuesQuery, usageQuery
- All analytics endpoints: `/api/admin/analytics-overview`, `-revenue`, `-top-performers`, `-issues`, `-usage`
- Recharts integration for data visualization

### Admin Bulk Spot Selection (October 2025)
Implemented comprehensive bulk selection and bulk action functionality for admin parking management, enabling efficient multi-spot operations:

**Feature Components**:
- **Checkbox Selection Column**: Added as first column in Available Spots table with individual and select-all checkboxes
- **Bulk Action Toolbar**: Contextual toolbar appears when spots are selected, showing selection count and action buttons
- **Make Available Action**: Sets `isActive=true` for all selected spots in bulk
- **Make Bookable Action**: Sets `isBookable=true` for all selected spots in bulk
- **Clear Selection**: Deselects all spots and hides toolbar

**Technical Implementation**:
- **Frontend State**: `selectedSpots` (Set<string>) tracks selected spot IDs, `isSelectAllChecked` manages select-all state
- **Backend Endpoint**: POST `/api/admin/spots/bulk-update` with Zod validation (`bulkUpdateSpotsSchema`)
- **Database Updates**: Uses Drizzle ORM with `db.update()` and `inArray()` for efficient bulk operations
- **Query Invalidation**: Automatically refreshes `/api/admin/all-spots` and `/api/admin/unallocated-spots` after updates
- **Selection Management**: Auto-clears selections after successful bulk actions

**Critical Database Fixes**:
- Fixed `getAllParkingSpotsWithUser()`: Now queries PostgreSQL instead of in-memory storage
- Fixed `getParkingSpotWithUser()`: Now queries database with proper ID filtering
- Fixed `getParkingSpotsByOwnerWithUser()`: Now uses database query with owner filtering
- Fixed `getAllParkingSpots()`: Now returns all spots from database

**User Experience**:
- Select individual spots or use select-all checkbox for bulk operations
- Visual feedback with toolbar showing selection count
- Success/error toast notifications for all actions
- Disabled states during mutations prevent accidental duplicate operations
- Automatic selection clearing prevents stale UI state

This feature dramatically improves admin efficiency when managing parking availability across multiple spots, reducing what previously required individual spot updates to single bulk operations.

### Multi-Role User System (October 2025)
Implemented comprehensive multi-role support allowing users to have multiple roles simultaneously, transforming the application from single-role to multi-role architecture:

**System Overview**:
- Users can have any combination of roles: `["admin"]`, `["owner"]`, `["renter"]`, `["admin", "owner"]`, `["owner", "renter"]`, or `["admin", "owner", "renter"]`
- Navigation shows items for ALL user roles simultaneously (not role-switching)
- Dashboard displays content sections for ALL applicable roles with visual separation
- Automatic role management uses additive approach (adds/removes specific roles without affecting others)

**Database Schema Changes**:
- Migrated from single `role: varchar` field to `roles: text[]` array
- All 12 existing users successfully migrated to roles array format
- Zod schemas updated: `UserRole` enum, `insertUserSchema`, `selectUserSchema`
- Type definitions updated: `User` type now includes `roles: UserRole[]`

**Backend Implementation**:
- **Role Management Helpers** (server/storage.ts):
  - `addUserRole(userId, role)`: Adds role if not present
  - `removeUserRole(userId, role)`: Removes specific role
  - `hasRole(userId, role)`: Checks if user has role
  - `hasAnyRole(userId, roles)`: Checks if user has any of the specified roles
- **Authentication** (server/replitAuth.ts):
  - Fixed race condition in `upsertUser()` with atomic role storage
  - Session handling updated to work with roles array
  - OIDC claims processing preserves existing roles during login
- **Middleware** (server/routes.ts):
  - Updated all role checks from `user.role === "admin"` to `user.roles.includes("admin")`
  - `requireAdmin`, `requireOwner`, `requireAuth` all use roles array
  - 50+ locations updated across routes

**Frontend Implementation**:
- **AuthContext** (client/src/contexts/auth-context.tsx):
  - Exposed `roles` array to all components
  - Added helper functions: `hasRole()`, `hasAnyRole()`
  - `effectiveRole()` provides backward compatibility with priority system (admin > owner > renter)
- **Navigation** (client/src/components/app-sidebar.tsx):
  - Menu filtering uses `user?.roles?.some(role => item.roles.includes(role))`
  - Shows all items matching ANY of user's roles
  - Priority-based tooltip system for role-specific displays
  - 7 null-safety guards added to prevent crashes during auth loading
- **Dashboard** (client/src/pages/dashboard.tsx):
  - Replaced switch statement with conditional rendering for each role
  - Shows admin section if `user?.roles?.includes("admin")`
  - Shows owner section if `user?.roles?.includes("owner")`
  - Shows renter section if `user?.roles?.includes("renter")`
  - Visual separators between sections for multi-role users
  - 5 null-safety guards added

**Automatic Role Transitions**:
- **Spot Assignment** → Adds "owner" role:
  - POST `/api/admin/assign-spot`: Checks if user lacks "owner" role, adds it via `addUserRole()`
  - POST `/api/admin/bulk-assign-spots`: Same logic for bulk operations
  - Preserves existing roles (e.g., renter stays renter, also becomes owner)
- **Spot Unassignment** → Removes "owner" role:
  - PUT `/api/admin/spots/:spotId/unassign`: Counts remaining spots for user
  - If user has 0 remaining spots and has "owner" role, removes it via `removeUserRole()`
  - Preserves other roles (e.g., keeps "renter" or "admin" if present)

**Critical Fixes**:
- Fixed race condition in upsertUser causing incomplete role states
- Added null-safety guards (12 locations) preventing crashes during auth loading
- Database operations now use PostgreSQL for all parking spot queries
- All role checks consistently use `roles.includes()` pattern throughout codebase

**Testing & Validation**:
- E2E test passed for admin+owner scenario using Playwright
- Verified navigation shows all applicable items for multi-role users
- Verified dashboard renders all applicable sections with separators
- Verified automatic role transitions (renter → owner, owner → renter)
- Verified null-safety prevents crashes during auth loading state

**User Experience**:
- Users with multiple roles see all their permissions and features simultaneously
- No role switcher needed - all applicable UI sections visible at once
- Seamless automatic role transitions based on spot ownership
- Clear visual separation between role sections in dashboard
- Navigation adapts dynamically to show all relevant menu items

**Example Scenarios**:
1. **Admin + Owner**: Sees admin pages (User Management, Parking Management, Booking Management, Audit Logs) + owner pages (My Spots) + common pages (Find Parking, My Bookings, Dashboard)
2. **Owner + Renter**: Sees owner pages (My Spots) + renter pages (Find Parking, My Bookings) + Dashboard with both owner and renter sections
3. **Renter Only**: Sees only renter pages (Find Parking, My Bookings) + Dashboard with renter section
4. **Automatic Transition**: Renter assigned a spot → becomes Owner + Renter (additive, not replacement)