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
- **UI/UX Decisions**: Professional blue and neutral gray color palette, Inter font family, Tailwind's 8-point grid system, custom components, standardized location format, and role-specific dashboards with dynamic content and navigation.

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

### Key Features
- **Booking System**: Real-time management with status tracking, custom calendar, search & filtering. Includes business rules for reserved spots (non-bookable), intelligent display of booked spots, support for period listings, and data consistency across views.
- **Admin Management**: Comprehensive user, bulk spot, waiting list, and reference data management (Departments, Locations, Spot Types) with full CRUD operations and safeguards for reserved spots. Streamlined "Create Availability" feature.
- **Notification System**: Real-time alerts via email and in-app notifications.
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics for occupancy, revenue, registrations, and usage patterns, with scope filtering for "All Spots" vs. "BCI Managed Spots".
- **Spot Booking Management**: Five-tab interface for detailed booking views, filters, actions, and an audit history timeline. Includes scope filtering.
- **Peer-to-Peer Booking Management**: Admin tools for managing peer-to-peer bookings, including actions, listing controls, payment management, and an audit trail.
- **Dispute Resolution System**: Full dispute lifecycle management with creation, tracking, refund processing, and audit snapshots.
- **Enhanced Database Schema**: Includes admin metadata fields on bookings and spot listings, and a dedicated disputes table.
- **Pagination System**: Client-side pagination across all admin pages.
- **My Bookings Page (Renter/Owner)**: Redesigned with role-based display, colorful tab icons, stat cards, enhanced filters, professional action buttons (Cancel, Mark Paid, Download Receipt), and comprehensive export functionality.
- **Reports Hub (Admin-only)**: Comprehensive analytics and reporting system with five specialized report categories (Overview, Parking Utilization, Booking & Revenue, User & Compliance, Waitlist Performance). Features shared filter controls, professional Excel export, and email delivery via SendGrid, with data visualization using Recharts.

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL
- **SendGrid**: Email service

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