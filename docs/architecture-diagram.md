# BCI ParkShare - System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Desktop    │  │   Tablet     │  │   Mobile     │  │   Admin      │         │
│  │   Browser    │  │   Browser    │  │   Browser    │  │   Browser    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │ HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         React + TypeScript (Vite)                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │  TanStack   │  │   Shadcn/   │  │   Wouter    │  │  Tailwind   │       │  │
│  │  │   Query     │  │   Radix UI  │  │   Router    │  │    CSS      │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │                                                                            │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                           PAGES / VIEWS                               │ │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │  │
│  │  │  │Dashboard │ │ Bookings │ │ My       │ │ Admin    │ │ Reports  │   │ │  │
│  │  │  │(Renter)  │ │ Calendar │ │ Bookings │ │ Panel    │ │ Hub      │   │ │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │  │
│  │  └──────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ REST API / WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND LAYER                                       │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                      Node.js + Express.js Server                           │  │
│  │                                                                            │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         API ROUTES                                   │  │  │
│  │  │  /api/auth    /api/users    /api/spots    /api/bookings             │  │  │
│  │  │  /api/listings    /api/notifications    /api/admin    /api/reports  │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │   Session    │  │  WebSocket   │  │    Email     │  │   Audit      │  │  │
│  │  │  Management  │  │   Server     │  │   Service    │  │   Logger     │  │  │
│  │  │  (pg-store)  │  │  (ws)        │  │              │  │              │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                                            │  │
│  │  ┌───────────────────────────────────────────────────────────────────┐    │  │
│  │  │                    Drizzle ORM (Type-safe)                         │    │  │
│  │  └───────────────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────────┐
│    DATABASE      │    │   EXTERNAL       │    │      AUTHENTICATION          │
│                  │    │   SERVICES       │    │                              │
│  ┌────────────┐  │    │  ┌────────────┐  │    │  ┌────────────────────────┐  │
│  │ PostgreSQL │  │    │  │ MS365 API  │  │    │  │    Replit OIDC         │  │
│  │   (Neon)   │  │    │  │  (Email)   │  │    │  │                        │  │
│  └────────────┘  │    │  └────────────┘  │    │  │  • Google Login        │  │
│                  │    │                  │    │  │  • Session Management  │  │
│  Tables:         │    │  ┌────────────┐  │    │  │  • Role Assignment     │  │
│  • users         │    │  │ SendGrid   │  │    │  └────────────────────────┘  │
│  • spots         │    │  │ (Fallback) │  │    │                              │
│  • bookings      │    │  └────────────┘  │    └──────────────────────────────┘
│  • listings      │    │                  │
│  • notifications │    └──────────────────┘
│  • disputes      │
│  • audit_logs    │
│  • app_configs   │
│  • sessions      │
└──────────────────┘
```

## Component Overview

### Frontend Layer
| Component | Technology | Purpose |
|-----------|------------|---------|
| UI Framework | React 18 + TypeScript | Component-based UI development |
| Build Tool | Vite | Fast development and bundling |
| State Management | TanStack Query | Server state caching and synchronization |
| UI Components | Shadcn/ui + Radix UI | Accessible, customizable components |
| Styling | Tailwind CSS | Utility-first CSS framework |
| Routing | Wouter | Lightweight client-side routing |
| Theme | Light/Dark Mode | User preference-based theming |

### Backend Layer
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js | JavaScript runtime |
| Framework | Express.js | Web application framework |
| ORM | Drizzle ORM | Type-safe database operations |
| Validation | Zod | Runtime type validation |
| Sessions | express-session + pg-store | Persistent session management |
| Real-time | WebSocket (ws) | Live updates for bookings/locks |

### Data Layer
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL (Neon) | Serverless PostgreSQL |
| Migrations | Drizzle Kit | Schema migrations |
| Audit Trail | Hash-chained logs | Secure activity tracking |

### External Services
| Service | Provider | Purpose |
|---------|----------|---------|
| Email (Primary) | Microsoft 365 Graph API | Corporate email delivery |
| Email (Fallback) | SendGrid | Alternative email provider |
| Authentication | Replit OIDC | Employee SSO with Google |

## Data Flow

### Booking Flow
```
User → Frontend → REST API → Validation → Database → WebSocket Broadcast → All Clients
```

### Real-time Lock System
```
User Initiates → Lock Acquired (SELECT FOR UPDATE) → WebSocket Notification
                            ↓
                    2-min Timeout Timer
                            ↓
              Auto-release if not completed → WebSocket Notification
```

### Authentication Flow
```
User → Replit OIDC → Google OAuth → Callback → Session Created → Role Assigned
                                                      ↓
                                              First-time: "renter"
                                              Has spot: "owner"
                                              In admin list: "admin"
```

## Security Features

- **Session Management**: PostgreSQL-backed sessions with secure cookies
- **Role-Based Access Control**: Admin, Owner, Renter roles with route-level protection
- **Audit Logging**: Hash-chained audit trail with 1-year retention
- **Pessimistic Locking**: Prevents double-booking with database-level locks
- **Input Validation**: Zod schemas for all API inputs

## Deployment

- **Platform**: Replit
- **Database**: Neon (Serverless PostgreSQL)
- **Frontend Port**: 5000 (Vite dev server proxied through Express)
- **Environment**: Development and Production separation
