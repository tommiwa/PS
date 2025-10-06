# BCI Parking Spot Sharing Application

## Overview
This project is a corporate parking spot sharing application for BCI company, designed to efficiently allocate 150 parking spots among 1000 employees across 4 locations. The system supports administrators and renters, with administrators managing unallocated spots. The application aims to streamline parking management, provide a user-friendly experience for BCI employees, and optimize parking spot utilization.

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
- **Storage Architecture**: Database-first, with in-memory caching for performance. All entities (Users, Parking Spots, Spot Listings, Bookings, Waiting List, Vehicles, Payment Preferences, Notification Preferences, In-App Notifications) persist to the database as the primary source of truth.
- **Data Persistence**: All critical data survives server restarts and is accessible across systems.

### Authentication & Authorization
- **User Management**: Multi-role access control (admin, owner, renter) with dynamic role assignment based on spot ownership.
- **Authentication**: Server-side session management, Replit OIDC for employee login.
- **Permission System**: Route and component-level checks.
- **Role Assignment Logic**: Default "renter" on first login, "owner" for users with assigned spots, "admin" via hardcoded emails or manual assignment. Email-based matching preserves manually assigned roles during OIDC login.
- **Landing Pages**: Role-specific dashboards (Admin → `/admin`, Owner → `/my-spots`, Renter → `/search`).
- **"View As" Functionality**: Admin-only session-based role impersonation for testing and support.

### Design System
- **Color Palette**: Professional blue (#2563eb), neutral grays, semantic colors.
- **Typography**: Inter font family.
- **Layout System**: Tailwind's 8-point grid system.
- **Component Library**: Custom components for parking functionality.
- **Location Format**: Standardized as "Building - Address, Parking Level X".
- **Admin Card Pattern**: Two distinct stat card styles for management pages and the admin dashboard, incorporating professional color schemes and tooltips.

### Key Features
- **Multi-role Dashboard**: Dynamic content and navigation based on user roles.
- **Booking System**: Real-time management with status tracking, custom calendar, search & filtering by location, spot type, and pricing.
- **Admin Management**:
    - **User Management**: Comprehensive user creation/editing with form validation, duplicate prevention, status management (Active, Suspended, Deleted with soft delete and restoration), phone formatting, and assigned spot display.
    - **Bulk Spot Management**: Assign, unassign, update status, enhanced filtering.
    - **Waiting List Management**: Direct assignment and historical tracking.
    - **Data Management**: Tabbed interface for managing reference data including Departments, Locations, and Spot Types with full CRUD operations, pagination, and UI features.
- **Notification System**: Real-time alerts via email and in-app notifications.
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics for occupancy, revenue, registrations, monthly trends, usage patterns, top performers, and issue alerts.
- **Parking Management Metrics**: Dynamic metrics for available spots, users waiting, average wait time, and total assigned.
- **Spot Booking Management**: Five-tab interface (Booking Availability, Active Bookings, Pending Payments, Past Bookings, Recent Activity) with detailed views, filters, and actions. Tabs feature colorful icons for visual clarity (green calendar, blue checkmark, orange dollar, slate calendar, purple activity).
- **Pagination System**: Comprehensive client-side pagination across all admin pages using a reusable component with configurable page sizes and independent state.
- **Tab Icons**: Colorful icons across all admin pages (Parking Management, Spot Booking Management, Data Management) and Profile page for improved visual navigation and user experience.

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