# BCI Parking Spot Sharing Application

## Overview
This project is a corporate parking spot sharing application designed for BCI to efficiently manage and optimize the utilization of 150 parking spots among 1000 employees across 4 locations. It streamlines parking management, supports administrators and renters, and aims to provide a user-friendly experience for BCI employees. The system supports multi-role access (admin, owner, renter) with dynamic role assignment and aims to address the challenge of limited parking resources.

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
- **UI/UX Decisions**: Professional blue and neutral gray color palette, Inter font family, Tailwind's 8-point grid system, custom components, standardized location format, and role-specific dashboards with dynamic content and navigation. Sidebar navigation includes a "Configuration" section for system-wide admin settings and a separate "Account" section for personal profiles.

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
- **Storage Architecture**: Database-first, with in-memory caching for performance.

### Authentication & Authorization
- **User Management**: Multi-role access control (admin, owner, renter) with dynamic role assignment.
- **Authentication**: Server-side session management, Replit OIDC for employee login.
- **Persistent Login**: 30-day refresh tokens (httpOnly cookies) for seamless re-authentication.
- **Permission System**: Route and component-level checks.
- **Role Assignment Logic**: Default "renter" on first login, "owner" for users with assigned spots, "admin" via hardcoded emails or manual assignment.
- **"View As" Functionality**: Admin-only session-based role impersonation.
- **Terms & Conditions**: Mandatory one-time acceptance system with versioned legal terms.
- **User Migration**: Automatic data migration for users logging in via OIDC whose email matches an existing admin-created user, transferring all associated data to the new OIDC-based record.

### Key Features
- **Booking System**: Real-time management with status tracking, custom calendar, search & filtering, including support for period listings and concurrent booking prevention using pessimistic locking with configurable reservation lock timeouts.
- **Admin Management**: Comprehensive user, bulk spot, waiting list, and reference data management (Departments, Locations, Spot Types, App Settings) with CRUD operations and safeguards.
- **App Configuration System**: Admin-only system settings management via "App Settings" tab, including configurable lock timeout.
- **Notification System**: Real-time alerts via email and in-app notifications with configurable preferences.
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options, including a "Donate to Charity" option.
- **Dashboards**: Admin dashboard metrics (occupancy, revenue), Renter dashboard statistics (spending trends, booking history), and Owner Statistics Dashboard (V2) with dynamic reporting, KPIs, and charts.
- **Spot Booking Management**: Five-tab interface for detailed booking views, filters, actions, and an audit history timeline.
- **Peer-to-Peer Booking Management**: Admin tools for managing peer-to-peer bookings.
- **Dispute Resolution System**: Full dispute lifecycle management.
- **Pagination System**: Client-side pagination across all admin pages.
- **My Bookings Page**: Redesigned with role-based display, filters, and export functionality.
- **Reports Hub (Admin-only)**: Streamlined analytics and reporting system for Spot Assignments and Utilization, with export capabilities.
- **Spot Assignment History Tracking**: Automated audit trail for BCI-managed spot assignments.
- **Audit Log System**: Database-persisted audit logging with hash chaining and 1-year retention.
- **Timezone Management System**: Full PST/PDT timezone support with configurable system-wide timezone setting and backend/frontend utilities.
- **Issue Tracking System**: Simple issue reporting for all authenticated users, with admin management of reported issues.
- **Department Reserved Spots**: Spots can be configured as "Department Reserved" with validation ensuring only users from the matching department can be assigned.
- **MCP Server (Model Context Protocol)**: Exposes general-purpose tools (search_available_spots, get_locations) via SSE and Streamable HTTP with API key authentication for AI chat clients.
- **MCP Apps (Interactive UIs)**: Interactive HTML interfaces for tools like `search_available_spots`, designed for rendering inside AI chat clients.

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL
- **Email Service**: Dual-provider support with automatic failover
  - **Microsoft 365 Graph API** (Primary): Corporate email delivery via Azure AD.
  - **Mandrill** (Secondary/Fallback): Mailchimp's transactional email service.
  - **Mock Mode**: Console logging for development when neither is configured.

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