# BCI Parking Spot Sharing Application

## Overview
This project is a corporate parking spot sharing application for BCI company. Its main purpose is to efficiently allocate 150 parking spots among 1000 employees across 4 locations, streamlining parking management and optimizing spot utilization. The system supports administrators and renters, with administrators managing unallocated spots. The application aims to provide a user-friendly experience for BCI employees.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite)
- **UI Components**: Shadcn/ui with Radix UI, Material Design principles
- **Styling**: Tailwind CSS
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Theme**: Light/dark mode
- **UI/UX Decisions**: Professional blue and neutral gray color palette, Inter font family, Tailwind's 8-point grid system, custom components, standardized location format, and role-specific dashboards with dynamic content and navigation. Sidebar navigation includes dedicated "Configuration" section with "System Settings" page for system-wide admin settings (Departments, Locations, Spot Types, App Settings) separated from personal "Account" section (Profile) for clear UX separation.

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
- **Storage Architecture**: Database-first, with in-memory caching for performance. All critical data persists to the database.

### Authentication & Authorization
- **User Management**: Multi-role access control (admin, owner, renter) with dynamic role assignment.
- **Authentication**: Server-side session management, Replit OIDC for employee login.
- **Permission System**: Route and component-level checks.
- **Role Assignment Logic**: Default "renter" on first login, "owner" for users with assigned spots, "admin" via hardcoded emails or manual assignment.
- **"View As" Functionality**: Admin-only session-based role impersonation.
- **Terms & Conditions**: Mandatory one-time acceptance system with versioned legal terms, simplified with emojis.
- **User Migration**: When a user logs in with OIDC and their email matches an existing admin-created user but with different ID, the system automatically migrates all data by transferring foreign key references (parking spots, bookings, spot listings, spot assignment history, notifications, vehicles, etc.) from the old user record to the new OIDC-based record before deleting the old user.

### Key Features
- **Booking System**: Real-time management with status tracking, custom calendar, search & filtering. Includes business rules for reserved spots (non-bookable), intelligent display of booked spots, support for period listings, and data consistency across views. Tiles and calendar views are synchronized - booked spots (shown as grey/disabled in calendar) are automatically filtered from tiles view to prevent duplicate bookings. Booking form intelligently auto-populates user data (phone, vehicle license) from session and database using hydration pattern to handle async auth loading without race conditions.
- **Concurrent Booking Prevention**: Production-ready pessimistic locking system with configurable reservation lock timeout (default 2 minutes) and date-specific composite keys prevents race conditions when multiple users attempt to book the same spot. Architecture includes: composite key locking (listingId + bookingDate) ensuring only specific dates show PENDING status, atomic lock acquisition using SELECT FOR UPDATE transactions, GET /api/active-locks endpoint for initial lock state hydration, real-time WebSocket updates across all clients with bookingDate in events, yellow "PENDING" visual states in both tiles and calendar views managed via LockContext composite key Map, countdown timer in booking dialog, automatic 30-second cleanup job for expired locks, backend validation requiring valid locks before booking creation, admin override capability to release any lock, and configurable lock timeout via admin App Settings panel with validation to ensure positive timeout values.
- **Admin Management**: Comprehensive user, bulk spot, waiting list, and reference data management (Departments, Locations, Spot Types, App Settings) with full CRUD operations and safeguards for reserved spots. Streamlined "Create Availability" feature.
- **App Configuration System**: Admin-only system settings management via "App Settings" tab in System Settings page. Includes configurable lock timeout with robust validation (enforces positive values, falls back to default on invalid data), secure API endpoints with type-aware validation, and user-friendly UI that converts milliseconds to seconds for timeout settings.
- **Notification System**: Real-time alerts via email and in-app notifications.
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics for occupancy, revenue, registrations, and usage patterns, with scope filtering for "All Spots" vs. "BCI Managed Spots".
- **Renter Dashboard Statistics**: Comprehensive real-time statistics dashboard for renters featuring stat cards (active bookings, monthly spending, favorite locations, booking history), monthly spending trends visualization using Recharts, top 5 locations by booking frequency with spending details, recent activity metrics (upcoming/completed/cancelled bookings), and quick action links. All data fetched from dedicated API endpoints (/api/renter/dashboard-stats, /api/renter/statistics) with proper timezone handling and real-time calculations.
- **Spot Booking Management**: Five-tab interface for detailed booking views, filters, actions, and an audit history timeline. Includes scope filtering.
- **Peer-to-Peer Booking Management**: Admin tools for managing peer-to-peer bookings, including actions, listing controls, payment management, and an audit trail.
- **Dispute Resolution System**: Full dispute lifecycle management with creation, tracking, refund processing, and audit snapshots.
- **Enhanced Database Schema**: Includes admin metadata fields on bookings and spot listings, and a dedicated disputes table.
- **Pagination System**: Client-side pagination across all admin pages.
- **My Bookings Page (Renter/Owner)**: Redesigned with role-based display, colorful tab icons, stat cards, enhanced filters, professional action buttons (Cancel, Mark Paid, Download Receipt), and comprehensive export functionality.
- **Reports Hub (Admin-only)**: Streamlined analytics and reporting system with two essential reports: Spot Assignments and Utilization. Features shared filter controls (date range and scope), professional Excel export, and email delivery via SendGrid, with data visualization using Recharts.
- **Spot Assignment History Tracking**: Automated audit trail system that records all BCI-managed spot assignments and unassignments with complete user details, effective dates, and actor tracking. Includes dedicated reporting tab showing newly assigned/unassigned users with department information, email links, and Excel/PDF export capabilities.
- **Audit Log System**: Database-persisted audit logging with hash chaining for security and integrity. All audit logs stored in PostgreSQL with automated 1-year retention policy (daily cleanup job deletes logs older than 365 days). System tracks all user actions, entity changes, and administrative activities with complete actor details and request metadata.
- **Timezone Management System**: Full PST/PDT timezone support with configurable system-wide timezone setting. Backend utilities handle all date operations (available spots, booking validation, analytics, reports, audit exports) in configured timezone. Admin can select from common US timezones via System Settings > App Settings. Timezone config stored in app_configs table with default "America/Los_Angeles". Frontend utilities available for client-side date handling with automatic timezone detection and caching.
- **Issue Tracking System**: Simple issue reporting system allowing all authenticated users to report problems via "Report an Issue" dialog in sidebar footer. Issues include title, description, and priority level (low/medium/high/urgent). Admin-only "Reported Issues" page under Operations section provides table view with status filtering (backlog/todo/in_progress/completed) and priority filtering. Admins can update issue status with real-time cache invalidation.
- **Department Reserved Spots**: Spots can be configured as "Department Reserved" with a specific department restriction. When assigning users to these spots, both frontend and backend validation ensures only users from the matching department can be assigned. The assignment dialog shows a red warning and disables the assign button when a department mismatch is detected. Backend API returns descriptive error messages for department restriction violations.

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL
- **Email Service**: Dual-provider support with automatic failover
  - **Microsoft 365 Graph API** (Primary): Uses Azure AD app registration for corporate email delivery from @bci.ca domain
  - **Mailgun** (Secondary/Fallback): Alternative email provider with API key authentication
  - **Provider Priority**: MS365 is used first if configured; Mailgun is used as fallback or if MS365 is not configured
  - **Mock Mode**: When neither provider is configured, emails are logged to console for development

### Email Configuration (Environment Variables)
**Microsoft 365 (Recommended for corporate use):**
- `MS365_TENANT_ID`: Azure AD tenant ID
- `MS365_CLIENT_ID`: Application (client) ID from Azure app registration
- `MS365_CLIENT_SECRET`: Client secret from Azure app registration
- `MS365_SENDER_EMAIL`: The M365 mailbox to send from (e.g., noreply@bci.ca)

**Mailgun (Alternative):**
- `MAILGUN_API_KEY`: Mailgun API key (found in Mailgun dashboard under API Keys)
- `MAILGUN_DOMAIN`: Your Mailgun sending domain (e.g., mg.bci.ca or sandbox domain)
- `MAILGUN_FROM_EMAIL`: Sender email address (optional, defaults to noreply@MAILGUN_DOMAIN)
- `MAILGUN_API_REGION`: API region - set to "EU" for European region, omit for US (optional)

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
- **WebSocket**: Real-time communication