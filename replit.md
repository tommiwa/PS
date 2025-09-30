# BCI Parking Spot Sharing Application

## Overview

This is a corporate parking spot sharing application for BCI company, serving 1000 employees across 4 locations with 150 total parking spots. The system facilitates efficient parking allocation and administrative controls. For the first version, the application supports two user roles (administrators and renters), with administrators managing unallocated spots instead of individual spot owners.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system following Material Design principles
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Theme System**: Light/dark mode support with CSS custom properties

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful API architecture with /api prefix routing
- **Session Management**: Express sessions with PostgreSQL session store
- **Error Handling**: Centralized error middleware with structured error responses

### Data Storage
- **Primary Database**: PostgreSQL via Neon Database (serverless)
- **Schema Management**: Drizzle migrations with schema definitions in TypeScript
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple
- **Database Pool**: Connection pooling with @neondatabase/serverless

### Authentication & Authorization
- **User Management**: Role-based access control (admin, renter) - spot owner role disabled for V1
- **Session-based Authentication**: Server-side session management
- **Employee Integration**: Designed for company employee login system integration
- **Permission System**: Route-level and component-level role checking

### Design System
- **Color Palette**: Professional blue primary (#2563eb), neutral grays, semantic colors for status indicators
- **Typography**: Inter font family for clean, corporate appearance
- **Layout System**: Consistent spacing using Tailwind's 8-point grid system
- **Component Library**: Custom components for parking-specific functionality (spot cards, booking forms, calendar views)

### Key Features Architecture
- **Multi-role Dashboard**: Dynamic dashboard content based on user role
- **Real-time Booking System**: Booking management with status tracking
- **Calendar Integration**: Custom parking calendar for availability visualization
- **Search & Filtering**: Advanced filtering for location, spot type, pricing
- **Admin Management**: User management, analytics, and system administration
- **Notification System**: Real-time alerts and booking confirmations

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL hosting for primary data storage
- **SendGrid**: Email service integration for notifications (configured but not implemented)

### Key Libraries
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Accessible UI component primitives
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Minimal client-side router
- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation for API schemas

### Development Tools
- **TypeScript**: Static type checking across frontend, backend, and shared code
- **Vite**: Fast development server and build tool
- **ESBuild**: Fast JavaScript bundler for production builds
- **Tailwind CSS**: Utility-first styling with custom design tokens

### Infrastructure Dependencies
- **Node.js**: Runtime environment for the Express server
- **PostgreSQL**: Database engine (via Neon serverless)
- **WebSocket**: Real-time communication support (neonConfig with ws library)

## Recent Feature Implementation

### Profile Page PWA Redesign (September 2024)
Successfully redesigned the profile page from a tabs-based layout to a mobile-first PWA-compatible interface:
- **Mobile-First Design**: Sticky header with backdrop blur, touch-friendly interface optimized for PWA usage
- **Accordion Layout**: Converted all profile sections (Waiting List, Payment Preferences, Vehicles, Notifications, App Settings) from tabs to expandable accordion items
- **Bottom Drawer Forms**: All forms moved to mobile-optimized bottom drawer components with proper headers, footers, and touch interaction patterns
- **Complete CRUD Operations**: Vehicle management, waiting list lifecycle (join/leave), payment preferences, and notification settings
- **Enhanced UX**: Loading states, error handling, disabled states during mutations, and comprehensive feedback via toast notifications
- **PWA Optimization**: Large touch targets (h-12 buttons), responsive design, and mobile-first interaction patterns

This transformation delivers a superior mobile experience suitable for progressive web app deployment while maintaining all existing functionality.

### My Bookings Enhancement for Spot Owners (December 2024)
Enhanced the My Bookings page with comprehensive spot owner functionality:
- **Unused Spots Tracking**: Shows past listings that received no bookings with orange warning indicators
- **Used Spots History**: Displays successful past rentals with complete renter details and payment confirmations
- **Owner Dashboard Metrics**: Active Listings, Spots Used, Spots Unused, and Total Earned statistics
- **Performance Analytics**: Visual indicators for spot performance and booking success rates
- **Revenue Tracking**: Automatic calculation of earnings from successful bookings vs. potential lost revenue from unused spots

This provides spot owners complete visibility into their listing performance, enabling them to optimize pricing and availability based on historical booking patterns.

### Waiting List Authentication Bug Fix (September 2024)
Fixed critical authentication issues in the waiting list functionality:
- **Session Cookie Configuration**: Fixed secure cookie setting to work properly in development (`secure: process.env.NODE_ENV === "production"`)
- **Backend Route Handling**: Updated GET `/api/waiting-list/user/:userId` to return proper 404 when no entry exists
- **Frontend Query Optimization**: Replaced manual fetch with shared `apiRequest` for consistent auth header handling
- **Security Hardening**: 
  - Gated demo authentication to development environments only
  - Added `sameSite: 'lax'` to session cookies for enhanced security
  - Ensured consistent authentication flow between POST and GET requests

The waiting list now properly supports join/leave operations with correct UI state updates and secure authentication handling.

### Spot Owner Login Functionality Disabled (September 2024)
For the first version, spot owner login functionality has been disabled to simplify the user experience:
- **Architectural Change**: Removed spot owner role from login interface while preserving backend schema for future use
- **Admin-Managed Spots**: Administrators will manage unallocated parking spots instead of individual spot owners
- **Simplified Login**: Login interface now shows only two options: "Spot Renter" and "System Administrator"
- **Type Safety**: Updated TypeScript definitions to use `AvailableUserRoles` type excluding the owner role
- **Future Compatibility**: Owner role schema preserved in database for potential future implementation

This change reduces complexity for the initial release while maintaining the foundation for spot owner functionality in future versions.

### Persistent In-App Notifications System (September 2025)
Migrated the notification system from in-memory storage to persistent database storage with comprehensive email notification support:
- **Database-Backed Storage**: Created `in_app_notifications` table with proper indexing for efficient queries
- **Complete CRUD Operations**: Full notification lifecycle management (create, read, update, delete, mark as read, unread count)
- **Email Preference Compliance**: All email notifications respect user preferences (`emailNotifications` + specific notification type preferences)
- **Always-On In-App Notifications**: In-app notifications are always created in the bell icon regardless of email preferences
- **Notification Types**: Support for booking confirmations, booking cancellations, spot availability, payment received, and system updates
- **Professional Email Templates**: HTML/text dual-format emails with consistent branding and clear calls-to-action
- **Automatic Triggers**: 
  - Spot availability notifications sent to waiting list users when new listings are created
  - Booking cancellation notifications ready for implementation when cancellation endpoints are added
- **Asynchronous Processing**: Notifications processed via `setImmediate()` to prevent blocking API responses
- **Mock Email Support**: Development mode uses mock SendGrid for testing without live email service

The notification system provides reliable, preference-aware communication with users while maintaining a persistent record of all notifications in the database for future reference and audit trails.

### Production-Ready Replit OIDC Authentication with Role-Based Redirects (September 2025)
Implemented comprehensive production-ready Replit OIDC authentication with automatic role-based redirects:

**Authentication Flow**:
- **Login Interface**: Simple "Sign In with Replit" button redirects to /api/login for OIDC authentication
- **User Persistence**: Users automatically created/updated in PostgreSQL database during OIDC callback
- **Dual Storage**: User data persisted in both PostgreSQL (source of truth) and in-memory storage (backward compatibility)
- **Role Preservation**: Existing user roles in database are preserved unless user is in hardcoded admin list

**Role-Based Redirect System**:
- **Admin Users** → Redirected to `/admin` (admin dashboard with user management)
- **Renter Users** → Redirected to `/dashboard` (parking spot search and booking)
- **Owner Users** → Redirected to `/my-spots` (parking spot listing management)
- **Role Determination**: Database queried first for user role, falls back to in-memory storage if needed

**Security & Admin Management**:
- **Session-Based Auth**: Express sessions with PostgreSQL session store
- **Auto-Admin Promotion**: Hardcoded emails (lijin.joseji@bci.ca, d.thompson@bci.ca, david.thomps@replit.com) automatically promoted to admin
- **Demo Auth Disabled**: Demo authentication gated behind development-only check
- **Audit Logging**: All authentication events logged with role information and redirect destination

**Technical Implementation**:
- **Database-First**: PostgreSQL serves as authoritative source for user roles
- **Concurrent Updates**: Both database and memory storage updated during authentication
- **Type Safety**: Full TypeScript support with role-based type checking
- **Error Handling**: Graceful fallbacks and comprehensive error logging

The authentication system provides secure, production-ready OIDC authentication with automatic role-based navigation, ensuring users land on the appropriate dashboard based on their assigned role.