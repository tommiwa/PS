# BCI Parking Spot Sharing Application

## Overview

This is a corporate parking spot sharing application for BCI company, serving 1000 employees across 4 locations with 150 total parking spots. The system facilitates efficient parking allocation through peer-to-peer spot sharing and administrative controls. The application supports three user roles (administrators, spot owners, and renters) with role-specific functionality for booking management, spot sharing, and system administration.

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
- **User Management**: Role-based access control (admin, owner, renter)
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