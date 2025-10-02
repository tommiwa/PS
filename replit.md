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

### Authentication & Authorization
- **User Management**: Multi-role access control (admin, owner, renter) with dynamic role assignment based on spot ownership.
- **Authentication**: Server-side session management, Replit OIDC.
- **Employee Integration**: Designed for company employee login.
- **Permission System**: Route and component-level checking with support for users having multiple roles simultaneously.
- **Role Assignment Logic**: 
  - First-time login: Users default to "renter" role
  - Automatic promotion: Users with assigned parking spots automatically receive "owner" role
  - Admin users: Hardcoded admin emails/IDs receive "admin" role
- **Landing Pages by Role**:
  - Admin → `/admin` (Admin Dashboard)
  - Owner → `/my-spots` (My Parking Spots)
  - Renter → `/search` (Smart Parking Search)

### Design System
- **Color Palette**: Professional blue (#2563eb), neutral grays, semantic colors.
- **Typography**: Inter font family.
- **Layout System**: Tailwind's 8-point grid system.
- **Component Library**: Custom components for parking functionality.

### Key Features
- **Multi-role Dashboard**: Dynamic content and navigation per user role, displaying all applicable sections simultaneously for multi-role users.
- **Booking System**: Real-time management with status tracking.
- **Calendar Integration**: Custom parking calendar.
- **Search & Filtering**: Location, spot type, pricing.
- **Admin Management**: User management, analytics, bulk spot management (assign, unassign, update status), enhanced filtering for parking spots with dynamic and standardized location options, searchable user lookup for direct spot assignment with real-time database search (min 3 characters, 300ms debounce), waiting list management with direct assignment capability and historical tracking (entries marked as 'assigned' instead of deleted).
- **Notification System**: Real-time alerts and confirmations (email/in-app).
- **Spot Listing Creation**: Owners can list spots with single day, period, or recurring options.
- **Admin Dashboard Metrics**: Real-time, server-side calculated metrics (occupancy, revenue, registrations).
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