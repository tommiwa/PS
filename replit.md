# BCI Parking Spot Sharing Application

## Overview
This project is a corporate parking spot sharing application for BCI company, designed to efficiently allocate 150 parking spots among 1000 employees across 4 locations. The system supports administrators and renters, with administrators managing unallocated spots. The application aims to streamline parking management, provide a user-friendly experience for BCI employees, and optimize parking spot utilization.

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
- **Storage Architecture**: Database-first with optional in-memory cache for performance (October 2025)
  - **Storage Pattern**: All entities query PostgreSQL as primary source of truth, memory Maps serve only as optional performance cache
  - **Fully Migrated Entities (19 methods verified)**:
    - Users: All CRUD operations persist to database
    - Parking Spots: All read/write operations database-first (including enrichment helpers)
    - Spot Listings: All queries and mutations database-first
    - Bookings: All operations including payment tracking database-first
    - Waiting List: All operations including assignment tracking database-first
    - Vehicles: All CRUD operations database-first
    - Payment Preferences: All CRUD operations database-first (previously memory-only)
    - Notification Preferences: All operations database-first
    - In-App Notifications: All operations database-first
  - **Cache Strategy**: Memory cache updated AFTER successful database operations, never used as primary data source
  - **Data Persistence Guarantee**: All critical data survives server restarts, works across different systems and users
  - **Seed Data**: 195 parking spots initialized into PostgreSQL database on first startup

### Authentication & Authorization
- **User Management**: Multi-role access control (admin, owner, renter) with dynamic role assignment based on spot ownership.
- **Authentication**: Server-side session management, Replit OIDC.
- **Employee Integration**: Designed for company employee login.
- **Permission System**: Route and component-level checking with support for users having multiple roles simultaneously.
- **Login Prevention**: Suspended and deleted users are blocked from logging in at the authentication callback, session is destroyed, and appropriate error message is displayed on login page.
- **Role Assignment Logic**: 
  - First-time login: Users default to "renter" role
  - Automatic promotion: Users with assigned parking spots automatically receive "owner" role
  - Admin users: Hardcoded admin emails/IDs receive "admin" role OR manually assigned by another admin
  - **Email-based user matching**: When admin pre-creates a user with admin role, the system matches by email during OIDC login to preserve manually assigned roles
- **Landing Pages by Role**:
  - Admin → `/admin` (Admin Dashboard)
  - Owner → `/my-spots` (My Parking Spots)
  - Renter → `/search` (Smart Parking Search)
- **"View As" Functionality** (Admin Only):
  - Session-based role impersonation allowing admins to view the application as different roles
  - Backend: POST/GET/DELETE /api/auth/view-as endpoints store impersonation role in session
  - Frontend: RoleSwitcher component in header allows switching between admin/owner/renter views
  - Privilege separation: `getAuthenticatedUserBaseRole()` returns real admin role for access control, `getAuthenticatedUserRole()` returns impersonated role for UI/data filtering
  - Admins maintain full privileges (data access, endpoint permissions) while viewing as other roles
  - View-as role persists across page reloads via server-side session storage
  - Security: Defense-in-depth validation (requireAdmin middleware + explicit base role check) and SameSite=lax cookie protection against CSRF attacks

### Design System
- **Color Palette**: Professional blue (#2563eb), neutral grays, semantic colors.
- **Typography**: Inter font family.
- **Layout System**: Tailwind's 8-point grid system.
- **Component Library**: Custom components for parking functionality.
- **Location Format**: All parking spot locations follow the standardized format: "Victoria - 750 Pandora Ave, Parking Level 1" or "Victoria - 750 Pandora Ave, Parking Level 2" (Building - Address, then Parking Level X)
- **Admin Card Pattern** (October 2025): Consistent stat card styling across all admin pages
  - Layout: Icon in colored square box (w-10 h-10, rounded-lg, p-2) positioned in top-right corner
  - Content: Number/value on left with title below
  - Structure: CardContent only (no CardHeader), p-4 padding
  - Tooltips: Entire card wrapped in Tooltip component
  - Color Scheme: Blue (primary metrics), Green (positive/growth), Purple (secondary metrics), Orange (pending/waiting), Gray (neutral/all)

### Key Features
- **Multi-role Dashboard**: Dynamic content and navigation per user role, displaying all applicable sections simultaneously for multi-role users.
- **Booking System**: Real-time management with status tracking.
- **Calendar Integration**: Custom parking calendar.
- **Search & Filtering**: Location, spot type, pricing.
- **Admin Management**: User management with comprehensive form validation and duplicate prevention, analytics, bulk spot management (assign, unassign, update status), enhanced filtering for parking spots with dynamic and standardized location options, searchable user lookup for direct spot assignment with real-time database search (min 3 characters, 300ms debounce), waiting list management with direct assignment capability and historical tracking (entries marked as 'assigned' instead of deleted).
  - **User Creation/Editing**: Form validation (name 2-50 chars, letters/spaces/hyphens/apostrophes only; email max 100 chars; phone optional 10 digits with auto-formatting), duplicate email prevention (backend 409 Conflict, frontend double-click protection), department dropdown from database
  - **User Status Management**: Three status types (Active, Suspended, Deleted), soft delete implementation preserving user data for audit trails, status filter dropdown, suspend/activate functionality in edit form
  - **Soft Delete**: Users marked as deleted (status="deleted", deletedAt timestamp) remain in database but are excluded from default queries, can be viewed by filtering for "Deleted" status
  - **User Restoration**: Deleted users can be restored to Active status by admins via PATCH /api/admin/users/:id/restore endpoint, restore button appears only for deleted users in UI, restoration clears deletedAt timestamp and sets status to "active", all user data preserved during soft delete/restore cycle
  - **Phone Formatting**: Display format "(123) 456-7890", storage format "1234567890" (digits only)
  - **Assigned Spots Display**: Full location format "Victoria - 750 Pandora Ave, Parking Level 1 - Spot A-101", spot type badges in sentence case
  - **Data Management** (October 2025): Tabbed interface for managing reference data
    - **Departments Tab**: Manage department names (used in user profiles)
    - **Locations Tab**: Manage parking locations (campus, building, level, address, timezone) - reference data for future integration
    - **Spot Types Tab**: Manage spot type definitions (name, slug, description) - reference data for future integration
    - **Note**: Locations and Spot Types tables created as managed reference data but not yet integrated with parking_spots table (parking spots still use text fields for location and spotType)
    - **API Endpoints**: Full CRUD operations for all three entities with admin-only mutations
    - **UI Features**: React Query integration, form validation, loading states, toast notifications, confirmation dialogs, data persistence across tabs
- **Notification System**: Real-time alerts and confirmations (email/in-app).
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics (occupancy, revenue, registrations).
  - **Analytics Implementation** (October 2025): All analytics data sourced from real-time database queries, no static/mock values
    - **Overview Cards**: Total Revenue, Total Bookings, Active Users (30-day), Utilization Rate (today's bookings/total spots), Average Booking Value, Monthly Growth (month-over-month)
    - **Revenue Analysis**: Monthly revenue trends (configurable date range: 7 days to 12 months), revenue breakdown by category (owner earnings 71%, BCI revenue 29%)
    - **Usage Patterns**: Booking duration distribution (groups bookings into 6 categories: 1 Day, 2-3 Days, 4-7 Days, 1-2 Weeks, 2-4 Weeks, 1+ Months based on listing periods), weekly trends (last 4 weeks, grouped by day of week with bookings and utilization), location performance (utilization and earnings by location)
    - **Top Performers**: Top earning parking spots and owners (based on paid bookings)
    - **Issues & Alerts**: Active system issues derived from booking patterns (payment disputes for unpaid bookings >7 days old, spot conflicts for double bookings)
- **Parking Management Metrics**: Four dynamic metrics - Available Spots (unallocated count), Users Waiting (active waiting list count), Avg Wait Time (days since enrollment), Total Assigned (historical count of assigned entries).

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