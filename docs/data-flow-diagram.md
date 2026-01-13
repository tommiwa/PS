# BCI ParkShare - Data Flow Diagrams

## Level 0: Context Diagram

```
                                    ┌─────────────────────────────────────┐
                                    │                                     │
    ┌──────────┐                    │                                     │                    ┌──────────┐
    │          │  Login Request     │                                     │  Email Delivery    │          │
    │  User    │ ──────────────────>│                                     │ ──────────────────>│  MS365 / │
    │ (Renter/ │                    │                                     │                    │ SendGrid │
    │  Owner)  │<───────────────────│                                     │<───────────────────│          │
    │          │  Booking Data      │        BCI PARKSHARE                │  Delivery Status   └──────────┘
    └──────────┘                    │           SYSTEM                    │
                                    │                                     │
    ┌──────────┐                    │                                     │                    ┌──────────┐
    │          │  Admin Actions     │                                     │  Auth Request      │          │
    │  Admin   │ ──────────────────>│                                     │ ──────────────────>│  Replit  │
    │          │                    │                                     │                    │   OIDC   │
    │          │<───────────────────│                                     │<───────────────────│          │
    │          │  Reports/Analytics │                                     │  User Identity     └──────────┘
    └──────────┘                    │                                     │
                                    └─────────────────────────────────────┘
```

## Level 1: System Data Flows

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     BCI PARKSHARE SYSTEM                                         │
│                                                                                                  │
│  ┌─────────────┐                                                           ┌─────────────────┐  │
│  │             │                                                           │                 │  │
│  │   1.0       │◄──────────── User Credentials ────────────────────────────│                 │  │
│  │   AUTH      │                                                           │    EXTERNAL     │  │
│  │   PROCESS   │─────────────── Session Token ────────────────────────────►│    IDENTITY     │  │
│  │             │                                                           │    (OIDC)       │  │
│  └──────┬──────┘                                                           │                 │  │
│         │                                                                  └─────────────────┘  │
│         │ User Session                                                                          │
│         ▼                                                                                       │
│  ┌─────────────┐         Spot Details          ┌─────────────┐                                 │
│  │             │ ─────────────────────────────>│             │                                 │
│  │   2.0       │                               │   3.0       │         ┌─────────────────┐     │
│  │   SPOT      │<───────────────────────────── │   BOOKING   │────────>│                 │     │
│  │   MGMT      │      Available Spots          │   ENGINE    │         │   D1: SPOTS     │     │
│  │             │                               │             │<────────│   DATABASE      │     │
│  └──────┬──────┘                               └──────┬──────┘         │                 │     │
│         │                                             │                └─────────────────┘     │
│         │ Listing Data                                │ Booking Data                           │
│         ▼                                             ▼                                        │
│  ┌─────────────┐                               ┌─────────────┐         ┌─────────────────┐     │
│  │             │      Notification Request     │             │────────>│                 │     │
│  │   4.0       │ ─────────────────────────────>│   5.0       │         │   D2: BOOKINGS  │     │
│  │   LISTING   │                               │   NOTIFY    │<────────│   DATABASE      │     │
│  │   PROCESS   │                               │   SERVICE   │         │                 │     │
│  │             │                               │             │         └─────────────────┘     │
│  └─────────────┘                               └──────┬──────┘                                 │
│                                                       │                                        │
│                                                       │ Email Request                          │
│                                                       ▼                                        │
│                                                ┌─────────────────┐                             │
│                                                │                 │                             │
│                                                │    EXTERNAL     │                             │
│                                                │    EMAIL        │                             │
│                                                │    SERVICE      │                             │
│                                                │                 │                             │
│                                                └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Matrix

### Sources and Destinations

| Flow ID | Data Element | Source | Destination | Description |
|---------|-------------|--------|-------------|-------------|
| F1 | Login Credentials | User Browser | Auth Process | Email/OAuth tokens for authentication |
| F2 | Session Token | Auth Process | User Browser | JWT/Session cookie for authorization |
| F3 | User Identity | Replit OIDC | Auth Process | Verified user claims (sub, email, name) |
| F4 | Spot Details | Owner | Spot Mgmt | Location, type, availability info |
| F5 | Available Spots | Spots DB | Booking Engine | Queryable spot inventory |
| F6 | Booking Request | Renter | Booking Engine | Date, spot, payment info |
| F7 | Booking Confirmation | Booking Engine | Renter | Confirmation details, receipt |
| F8 | Listing Data | Owner | Listing Process | Availability periods, pricing |
| F9 | Notification Request | Any Process | Notify Service | Trigger for user alerts |
| F10 | Email Content | Notify Service | Email Provider | Formatted email for delivery |
| F11 | Delivery Status | Email Provider | Notify Service | Success/failure confirmation |
| F12 | Audit Log | All Processes | Audit DB | Action records with hash chain |
| F13 | Admin Query | Admin | Report Engine | Filter criteria for reports |
| F14 | Report Data | Report Engine | Admin | Analytics, exports (PDF/Excel) |
| F15 | Lock Acquisition | Booking Engine | Lock Store | Pessimistic lock for spot+date |
| F16 | Lock Notification | Lock Store | All Clients | WebSocket broadcast of lock state |

## Entity Data Flows

### User Entity Flows

```
                              ┌───────────────────────────────────────┐
                              │              USER ENTITY              │
                              └───────────────────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────────┐
              │                                │                                │
              ▼                                ▼                                ▼
    ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
    │     RENTER      │              │      OWNER      │              │      ADMIN      │
    └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
             │                                │                                │
    ┌────────┴────────┐              ┌────────┴────────┐              ┌────────┴────────┐
    │ INPUTS:         │              │ INPUTS:         │              │ INPUTS:         │
    │ • Search spots  │              │ • Create listing│              │ • User queries  │
    │ • Book spot     │              │ • Set pricing   │              │ • Config updates│
    │ • Cancel booking│              │ • Manage avail. │              │ • Report params │
    │ • Mark paid     │              │ • Confirm pay   │              │ • Dispute data  │
    └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
             │                                │                                │
    ┌────────┴────────┐              ┌────────┴────────┐              ┌────────┴────────┐
    │ OUTPUTS:        │              │ OUTPUTS:        │              │ OUTPUTS:        │
    │ • Booking conf. │              │ • Booking notif.│              │ • User lists    │
    │ • Receipt PDF   │              │ • Payment alerts│              │ • Reports (PDF) │
    │ • Dashboard data│              │ • Usage stats   │              │ • Audit logs    │
    │ • Notifications │              │ • Notifications │              │ • Analytics     │
    └─────────────────┘              └─────────────────┘              └─────────────────┘
```

### Booking Process Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  RENTER  │     │ FRONTEND │     │ BACKEND  │     │ DATABASE │     │ WEBSOCKET│
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │  Select Spot   │                │                │                │
     │───────────────>│                │                │                │
     │                │  Lock Request  │                │                │
     │                │───────────────>│                │                │
     │                │                │  SELECT FOR    │                │
     │                │                │  UPDATE        │                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │  Lock Acquired │                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │  Broadcast Lock│                │
     │                │                │───────────────────────────────>│
     │                │                │                │                │
     │                │  Lock Success  │                │                │
     │                │<───────────────│                │                │
     │  Show Locked   │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │  Submit Booking│                │                │                │
     │───────────────>│                │                │                │
     │                │  Create Booking│                │                │
     │                │───────────────>│                │                │
     │                │                │  INSERT booking│                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │  Booking ID    │                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │  Broadcast New │                │
     │                │                │───────────────────────────────>│
     │                │                │                │                │
     │                │  Confirmation  │                │                │
     │                │<───────────────│                │                │
     │  Show Receipt  │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
```

## Database Entity Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     USERS       │       │     SPOTS       │       │   SPOT_TYPES    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │──┐    │ id (PK)         │
│ email           │  │    │ location_id (FK)│  │    │ name            │
│ name            │  │    │ type_id (FK)    │──┼───>│ description     │
│ role            │  │    │ owner_id (FK)   │  │    └─────────────────┘
│ department_id   │  │    │ spot_number     │  │
└─────────────────┘  │    │ status          │  │    ┌─────────────────┐
         │           │    └─────────────────┘  │    │   LOCATIONS     │
         │           │             │           │    ├─────────────────┤
         │           │             │           └───>│ id (PK)         │
         │           │             │                │ name            │
         ▼           │             ▼                │ address         │
┌─────────────────┐  │    ┌─────────────────┐       └─────────────────┘
│   SPOT_LISTINGS │  │    │    BOOKINGS     │
├─────────────────┤  │    ├─────────────────┤       ┌─────────────────┐
│ id (PK)         │  │    │ id (PK)         │       │   DEPARTMENTS   │
│ spot_id (FK)    │──┘    │ listing_id (FK) │       ├─────────────────┤
│ owner_id (FK)   │◄──────│ renter_id (FK)  │──────>│ id (PK)         │
│ start_date      │       │ booking_date    │       │ name            │
│ end_date        │       │ status          │       │ code            │
│ price           │       │ payment_status  │       └─────────────────┘
│ status          │       │ created_at      │
└─────────────────┘       └─────────────────┘       ┌─────────────────┐
                                   │                │  NOTIFICATIONS  │
                                   │                ├─────────────────┤
                                   ▼                │ id (PK)         │
                          ┌─────────────────┐       │ user_id (FK)    │
                          │    DISPUTES     │       │ type            │
                          ├─────────────────┤       │ message         │
                          │ id (PK)         │       │ read            │
                          │ booking_id (FK) │       └─────────────────┘
                          │ reporter_id     │
                          │ status          │       ┌─────────────────┐
                          │ resolution      │       │   AUDIT_LOGS    │
                          └─────────────────┘       ├─────────────────┤
                                                    │ id (PK)         │
                                                    │ actor_id (FK)   │
                                                    │ action          │
                                                    │ entity_type     │
                                                    │ entity_id       │
                                                    │ prev_hash       │
                                                    │ hash            │
                                                    └─────────────────┘
```

## Real-time Data Synchronization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEBSOCKET EVENT FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  EVENT SOURCE                    EVENT TYPE                    RECIPIENTS
  ─────────────                   ──────────                    ──────────

  ┌──────────────┐
  │ Lock Service │ ──────────────► lock:acquired ──────────────► All Clients
  │              │ ──────────────► lock:released ──────────────► All Clients
  │              │ ──────────────► lock:expired  ──────────────► All Clients
  └──────────────┘

  ┌──────────────┐
  │ Booking      │ ──────────────► booking:created ────────────► Owner + Renter
  │ Engine       │ ──────────────► booking:cancelled ──────────► Owner + Renter
  │              │ ──────────────► booking:updated ────────────► Owner + Renter
  └──────────────┘

  ┌──────────────┐
  │ Listing      │ ──────────────► listing:created ────────────► All Clients
  │ Process      │ ──────────────► listing:updated ────────────► All Clients
  │              │ ──────────────► listing:deleted ────────────► All Clients
  └──────────────┘

  ┌──────────────┐
  │ Notification │ ──────────────► notification:new ───────────► Target User
  │ Service      │ ──────────────► notification:read ──────────► Target User
  └──────────────┘
```
