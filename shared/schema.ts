import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, date, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles enum
export const userRoles = z.enum(["admin", "owner", "renter"]);
export type UserRole = z.infer<typeof userRoles>;

// Define user status enum
export const userStatuses = z.enum(["active", "suspended", "deleted"]);
export type UserStatus = z.infer<typeof userStatuses>;

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Custom fields for parking app
  phone: text("phone"),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "restrict" }),
  roles: text("roles").array().notNull().default(sql`ARRAY['renter']::text[]`),
  status: text("status").notNull().$type<UserStatus>().default("active"),
  memberSince: text("member_since"),
  lastLogin: timestamp("last_login"),
  acceptedTermsVersion: integer("accepted_terms_version"),
  acceptedTermsAt: timestamp("accepted_terms_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  departmentId: true,
  roles: true,
  memberSince: true,
});

// Replit Auth upsert schema
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserRoles = UserRole[];

// Notification Preferences Table
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References users.id
  emailNotifications: boolean("email_notifications").notNull().default(true),
  bookingConfirmations: boolean("booking_confirmations").notNull().default(true),
  paymentReminders: boolean("payment_reminders").notNull().default(true),
  spotAvailability: boolean("spot_availability").notNull().default(true),
  weeklyReports: boolean("weekly_reports").notNull().default(true),
  systemMaintenance: boolean("system_maintenance").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// In-App Notifications Table
export const notificationTypes = z.enum(["assignment", "welcome", "booking_confirmation", "booking_cancelled", "payment_reminder", "spot_availability", "weekly_report", "system_maintenance", "general"]);
export type NotificationType = z.infer<typeof notificationTypes>;

export const inAppNotifications = pgTable("in_app_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References users.id
  type: text("type").notNull().$type<NotificationType>(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"), // Additional structured data (spot details, booking info, etc.)
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiration time for time-sensitive notifications
}, (table) => [
  index("IDX_notifications_user_id").on(table.userId),
  index("IDX_notifications_read").on(table.read),
  index("IDX_notifications_created_at").on(table.createdAt),
]);

export const insertInAppNotificationSchema = createInsertSchema(inAppNotifications).omit({
  id: true,
  createdAt: true,
});

export type InsertInAppNotification = z.infer<typeof insertInAppNotificationSchema>;
export type InAppNotification = typeof inAppNotifications.$inferSelect;

// Parking Spots Table
export const spotTypes = z.enum(["regular", "electric", "tesla_ev", "accessible", "reserved"]);
export type SpotType = z.infer<typeof spotTypes>;

export const parkingSpots = pgTable("parking_spots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotNumber: text("spot_number").notNull(),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  spotTypeId: integer("spot_type_id").notNull().references(() => spotTypesTable.id, { onDelete: "restrict" }),
  isIndoor: boolean("is_indoor").notNull().default(false),
  ownerId: varchar("owner_id"), // References users.id - nullable for unallocated spots
  description: text("description"),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }), // Owner's default daily rate for listings
  mapLink: text("map_link"), // External link to visual directory (e.g., office space software floor plan)
  seatNumber: text("seat_number"), // Seat ID for dynamic map link generation (e.g., "34478")
  isActive: boolean("is_active").notNull().default(true),
  isBookable: boolean("is_bookable").notNull().default(true), // Whether spot can be booked by renters
  isBciManaged: boolean("is_bci_managed").notNull().default(false), // BCI-managed spots (true) vs personal spots (false)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParkingSpotSchema = createInsertSchema(parkingSpots).omit({
  id: true,
  createdAt: true,
}).extend({
  locationId: z.number().int().positive(),
  spotTypeId: z.number().int().positive(),
});

export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type ParkingSpot = typeof parkingSpots.$inferSelect;

// Enriched parking spot type that includes assigned user information (admin-only)
export interface ParkingSpotWithUser extends ParkingSpot {
  assignedUserName?: string;
  assignedUserEmail?: string;
  assignedUserDepartment?: string;
  locationName?: string;
  spotTypeName?: string;
}

// Safe parking spot type for non-admin endpoints (excludes sensitive user data)
export interface ParkingSpotWithSafeUserData extends ParkingSpot {
  assignedUserName?: string;
  assignedUserDepartment?: string;
  locationName?: string;
  spotTypeName?: string;
  listingId?: string;
  dailyRate?: string;
  availabilityDates?: string[];
  expiredDates?: string[];
  isExpired?: boolean;
  bookedDates?: string[];
  availability?: { date: string };
  activeLock?: any;
}

// Spot Listings Table
export const listingTypes = z.enum(["single", "period", "recurring"]);
export type ListingType = z.infer<typeof listingTypes>;

export const listingStatuses = z.enum(["available", "booked", "used", "unused", "cancelled"]);
export type ListingStatus = z.infer<typeof listingStatuses>;

export const daysOfWeek = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
export type DayOfWeek = z.infer<typeof daysOfWeek>;

export const spotListings = pgTable("spot_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotId: varchar("spot_id").notNull(), // References parking_spots.id
  ownerId: varchar("owner_id").notNull(), // References users.id
  listingType: text("listing_type").notNull().$type<ListingType>(),
  
  // Single day listing fields
  singleDate: date("single_date"), // For single day listings
  
  // Period listing fields
  periodStartDate: date("period_start_date"), // For period listings
  periodEndDate: date("period_end_date"), // For period listings
  
  // Recurring listing fields
  recurringStartDate: date("recurring_start_date"), // For recurring listings
  recurringEndDate: date("recurring_end_date"), // Optional end date for recurring
  daysOfWeek: text("days_of_week").array(), // Array of day names for recurring
  
  // Common fields
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().$type<ListingStatus>().default("available"),
  notes: text("notes"),
  adminNotes: text("admin_notes"), // Admin-only notes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSpotListingSchema = createInsertSchema(spotListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  ownerId: true,
});

export type InsertSpotListing = z.infer<typeof insertSpotListingSchema>;
export type SpotListing = typeof spotListings.$inferSelect;

// Enriched booking availability type that includes spot and owner information (admin-only)
export interface BookingAvailabilityData extends SpotListing {
  spotNumber: string;
  locationName: string;
  spotTypeName: string;
  ownerName: string;
  availableFrom: string;
  availableTo: string;
}

// Spot Locks Table - Concurrent Booking Prevention System
// This table prevents race conditions when multiple users attempt to book the same spot simultaneously.
// Lock Lifecycle:
// 1. "active" - Lock is held by user during booking process (typically 5-10 minutes)
// 2. "confirmed" - Lock is converted to a confirmed booking (bookingId is set)
// 3. "expired" - Lock expired due to timeout (user took too long to complete booking)
// 4. "released" - Lock manually released by user (e.g., cancelled booking process)
// 
// The system automatically cleans up expired locks and prevents double-booking by checking for active locks
// before allowing new bookings. Only one active lock per spot+date+listing combination is allowed.

export const lockStatuses = z.enum(["active", "confirmed", "expired", "released"]);
export type LockStatus = z.infer<typeof lockStatuses>;

export const spotLocks = pgTable("spot_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotId: varchar("spot_id").notNull().references(() => parkingSpots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: varchar("listing_id").notNull().references(() => spotListings.id, { onDelete: "cascade" }), // FK to spot_listings
  bookingDate: date("booking_date").notNull(),
  status: text("status").notNull().$type<LockStatus>().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  bookingId: varchar("booking_id"), // Set when lock is converted to booking
}, (table) => [
  // NOTE: Uniqueness constraint (one active lock per listing+date) is enforced via transaction-based SELECT FOR UPDATE
  // in the API layer, not at database level. This provides atomic lock acquisition without race conditions.
  index("IDX_spot_locks_listing_date_status").on(table.listingId, table.bookingDate, table.status),
  index("IDX_spot_locks_spot_status").on(table.spotId, table.status),
  index("IDX_spot_locks_user_status").on(table.userId, table.status),
  index("IDX_spot_locks_expires_at").on(table.expiresAt),
]);

export const insertSpotLockSchema = createInsertSchema(spotLocks).omit({
  id: true,
  createdAt: true,
  status: true,
  bookingId: true,
}).extend({
  bookingDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid booking date format",
  }),
  expiresAt: z.date().refine((date) => date > new Date(), {
    message: "Lock expiration time must be in the future",
  }),
});

export type InsertSpotLock = z.infer<typeof insertSpotLockSchema>;
export type SpotLock = typeof spotLocks.$inferSelect;

// Bookings Table
export const bookingStatuses = z.enum(["confirmed", "pending", "cancelled", "completed"]);
export type BookingStatus = z.infer<typeof bookingStatuses>;

export const paymentStatuses = z.enum(["pending", "paid", "received"]);
export type PaymentStatus = z.infer<typeof paymentStatuses>;

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listingId: varchar("listing_id").notNull(), // References spot_listings.id
  spotId: varchar("spot_id").notNull(), // References parking_spots.id
  renterId: varchar("renter_id").notNull(), // References users.id
  ownerId: varchar("owner_id").notNull(), // References users.id
  bookingDate: date("booking_date").notNull(), // The specific date being booked
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().$type<BookingStatus>().default("confirmed"),
  paymentReceived: boolean("payment_received").notNull().default(false), // Legacy field - use paymentStatus instead
  paymentStatus: text("payment_status").notNull().$type<PaymentStatus>().default("pending"), // Two-step payment: pending → paid (renter) → received (owner/admin)
  notes: text("notes"),
  adminNotes: text("admin_notes"), // Admin-only notes
  cancellationReason: text("cancellation_reason"), // Reason for cancellation
  paymentRefundedAt: timestamp("payment_refunded_at"), // When payment was refunded
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }), // Amount refunded
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  renterId: true,
  ownerId: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Disputes Table
export const disputeStatuses = z.enum(["open", "investigating", "resolved", "closed"]);
export type DisputeStatus = z.infer<typeof disputeStatuses>;

export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(), // References bookings.id
  reporterId: varchar("reporter_id").notNull(), // User who reported the dispute (renter or owner)
  targetUserId: varchar("target_user_id").notNull(), // User the dispute is against
  reason: text("reason").notNull(), // Dispute reason/description
  status: text("status").notNull().$type<DisputeStatus>().default("open"),
  resolutionNotes: text("resolution_notes"), // Admin resolution notes
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }), // Refund amount if applicable
  resolvedAt: timestamp("resolved_at"), // When dispute was resolved
  resolvedBy: varchar("resolved_by"), // Admin who resolved it
  auditTrail: text("audit_trail"), // JSON string of audit snapshots
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputes.$inferSelect;

// Waiting List Schema
export const waitingList = pgTable("waiting_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References users.id
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  preferredSpotTypeId: integer("preferred_spot_type_id").references(() => spotTypesTable.id, { onDelete: "set null" }),
  preferredLocationId: integer("preferred_location_id").references(() => locations.id, { onDelete: "set null" }),
  priority: integer("priority").notNull().default(1), // 1 = highest priority
  status: text("status").notNull().default("active"), // active, assigned, cancelled
  reason: text("reason"), // Why they need parking
  enrolledDate: timestamp("enrolled_date").notNull().defaultNow(),
  assignedDate: timestamp("assigned_date"),
  assignedSpotId: varchar("assigned_spot_id"), // References parking_spots.id when assigned
  enrolledBy: text("enrolled_by").notNull().default("user"), // user, admin
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWaitingListSchema = createInsertSchema(waitingList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  enrolledDate: true,
});

export type InsertWaitingList = z.infer<typeof insertWaitingListSchema>;
export type WaitingList = typeof waitingList.$inferSelect;

// Vehicles Table
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References users.id
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  color: text("color"),
  isElectric: boolean("is_electric").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false), // If this is the user's primary vehicle
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Payment Preferences Table
export const paymentTypes = z.enum(["interac_transfer", "cash"]);
export type PaymentType = z.infer<typeof paymentTypes>;

export const paymentPreferences = pgTable("payment_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // References users.id - one preference per user
  paymentType: text("payment_type").notNull().$type<PaymentType>().default("interac_transfer"),
  paymentInstructions: text("payment_instructions"), // Custom instructions from user
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentPreferencesSchema = createInsertSchema(paymentPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePaymentPreferencesSchema = createInsertSchema(paymentPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertPaymentPreferences = z.infer<typeof insertPaymentPreferencesSchema>;
export type UpdatePaymentPreferences = z.infer<typeof updatePaymentPreferencesSchema>;
export type PaymentPreferences = typeof paymentPreferences.$inferSelect;

// Auth types for frontend
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  phone?: string;
  department?: string;
  role: UserRole;
  memberSince?: string;
  lastLogin?: Date | null;
  vehicleInfo?: {
    make?: string;
    model?: string;
    color?: string;
  };
  // Helper computed property for display name
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  userType: UserRole;
}

// Sample users for demo
export const sampleUsers: Record<UserRole, AuthUser> = {
  renter: {
    id: "user-renter-001",
    email: "michael.rodriguez@bci.ca",
    name: "Michael Rodriguez",
    phone: "(555) 123-4567",
    department: "Marketing",
    role: "renter",
    memberSince: "March 2023",
    lastLogin: new Date("2024-01-15T08:30:00Z"),
    vehicleInfo: {
      make: "Toyota",
      model: "Camry",
      color: "Silver"
    }
  },
  owner: {
    id: "user-owner-001", 
    email: "sarah.chen@bci.ca",
    name: "Sarah Chen",
    phone: "(555) 234-5678",
    department: "Engineering", 
    role: "owner",
    memberSince: "January 2023",
    lastLogin: new Date("2024-01-15T07:45:00Z"),
    vehicleInfo: {
      make: "Honda",
      model: "Civic",
      color: "Blue"
    }
  },
  admin: {
    id: "user-admin-001",
    email: "david.thompson@bci.ca", 
    name: "David Thompson",
    phone: "(555) 456-7890",
    department: "IT",
    role: "admin",
    memberSince: "January 2022",
    lastLogin: new Date("2024-01-15T09:15:00Z"),
    vehicleInfo: {
      make: "BMW",
      model: "X3",
      color: "Black"
    }
  }
};

// Audit Logs System
export const auditActions = z.enum([
  "CREATE",
  "UPDATE", 
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "ASSIGN",
  "UNASSIGN",
  "APPROVE", 
  "REJECT",
  "ACTIVATE",
  "DEACTIVATE",
  "SEARCH",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "TOGGLE_BOOKABILITY",
  "BULK_UPDATE",
  "CANCEL",
  "COMPLETE"
]);

export type AuditAction = z.infer<typeof auditActions>;

export const entityTypes = z.enum([
  "user",
  "parking_spot", 
  "spot_listing",
  "spot_lock",
  "booking",
  "waiting_list",
  "notification",
  "locker",
  "locker_waitlist",
  "locker_assignment",
  "system"
]);

export type EntityType = z.infer<typeof entityTypes>;

// Comprehensive audit logs table for enterprise compliance
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  correlationId: varchar("correlation_id").notNull(), // For tracing related operations
  
  // Actor information (who performed the action)
  actorId: varchar("actor_id"), // May be null for system actions
  actorEmail: varchar("actor_email"),
  actorRole: text("actor_role").$type<UserRole>(),
  
  // Action details
  action: text("action").notNull().$type<AuditAction>(),
  entityType: text("entity_type").notNull().$type<EntityType>(),
  entityId: varchar("entity_id"), // May be null for system-wide actions
  success: boolean("success").notNull().default(true),
  message: text("message"), // Human readable description
  
  // Request metadata for forensics
  requestMeta: jsonb("request_meta"), // { ip, method, path, userAgent, etc. }
  
  // Entity state tracking (for CRUD operations)
  before: jsonb("before"), // State before operation
  after: jsonb("after"), // State after operation
  
  // Optional hash chaining for tamper evidence
  prevHash: varchar("prev_hash"), // Hash of previous audit log
  hash: varchar("hash"), // Hash of this audit log
}, (table) => [
  index("IDX_audit_occurred_at").on(table.occurredAt),
  index("IDX_audit_actor_id").on(table.actorId),
  index("IDX_audit_entity").on(table.entityType, table.entityId),
  index("IDX_audit_correlation_id").on(table.correlationId),
  index("IDX_audit_action").on(table.action),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  occurredAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Request metadata type for audit logging
export interface RequestMetadata {
  ip?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  contentType?: string;
  contentLength?: number;
}

// Dashboard Stats API Response Types
export interface DashboardStatsResponse {
  totalSpots: number;
  activeUsers: number;
  todaysBookings: number;
  revenueThisMonth: number;
  availableSpots: number;
  occupiedSpots: number;
  occupancyPercentage: number;
  availabilityPercentage: number;
  allocatedSpots: number;
  generatedAt: string;
  dateContext: {
    today: string;
    currentMonth: string;
  };
}

// Renter Dashboard Stats API Response Types
export interface RenterDashboardStatsResponse {
  activeBookings: number;
  thisMonthSpent: number;
  thisMonthBookings: number;
  pastYearSpent: number;
  pastYearBookings: number;
  generatedAt: string;
}

export interface RenterMonthlySpending {
  month: string;
  spent: number;
  bookings: number;
  year: number;
}

export interface RenterLocationStats {
  locationId: number;
  locationName: string;
  bookingsCount: number;
  totalSpent: number;
  lastBookedDate: string;
}

export interface RenterBookingTrend {
  period: string; // e.g., "Week 1", "Week 2", etc.
  bookings: number;
  spent: number;
}

export interface RenterStatisticsResponse {
  stats: RenterDashboardStatsResponse;
  monthlySpending: RenterMonthlySpending[];
  topLocations: RenterLocationStats[];
  recentActivity: {
    upcomingBookings: number;
    completedThisWeek: number;
    cancelledThisMonth: number;
  };
}

// Owner Statistics Response Type
export interface OwnerStatisticsResponse {
  earnings: {
    total: number;
    thisMonth: number;
    pastYear: number;
    totalBookings: number;
    thisMonthBookings: number;
    upcomingBookings: number;
  };
  spending: {
    total: number;
    thisMonth: number;
    pastYear: number;
    activeBookings: number;
  };
  ownedSpotsCount: number;
  netBalance: number;
  thisMonthNet: number;
  generatedAt: string;
}

// Analytics API Response Types
export interface AnalyticsOverviewResponse {
  totalRevenue: number;
  totalBookings: number;
  activeUsers: number;
  utilizationRate: number;
  averageBookingValue: number;
  monthlyGrowth: number;
  generatedAt: string;
  dateContext: {
    today: string;
    currentMonth: string;
  };
}

export interface MonthlyRevenueData {
  month: string;
  revenue: number;
  bookings: number;
  year: number;
}

export interface AnalyticsRevenueResponse {
  monthlyData: MonthlyRevenueData[];
  revenueBreakdown: {
    ownerEarnings: number;
    bciRevenue: number;
    ownerEarningsPercentage: number;
    bciRevenuePercentage: number;
  };
  generatedAt: string;
}

export interface TopPerformingSpot {
  id: string;
  spotNumber: string;
  location: string;
  earnings: number;
  utilization: number;
  bookingsCount: number;
  ownerName: string;
}

export interface TopEarningOwner {
  id: string;
  name: string;
  earnings: number;
  spotsCount: number;
  bookingsCount: number;
  averageRating: number;
  email: string;
}

export interface AnalyticsTopPerformersResponse {
  topSpots: TopPerformingSpot[];
  topOwners: TopEarningOwner[];
  generatedAt: string;
}

export interface AnalyticsIssue {
  id: string;
  type: "Payment Dispute" | "Spot Conflict" | "Technical Issue" | "User Complaint" | "System Alert";
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  created: string;
  assignee: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  entityId?: string; // Related booking, spot, or user ID
  entityType?: string; // "booking", "spot", "user"
}

export interface AnalyticsIssuesResponse {
  activeIssues: AnalyticsIssue[];
  issuesSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  generatedAt: string;
}

export interface BookingDurationData {
  duration: string;
  count: number;
  percentage: number;
}

export interface LocationPerformanceData {
  location: string;
  spotsCount: number;
  utilization: number;
  earnings: number;
  averageRate: number;
}

export interface AnalyticsUsageResponse {
  bookingDuration: BookingDurationData[];
  locationPerformance: LocationPerformanceData[];
  weeklyTrends: {
    dayOfWeek: string;
    bookings: number;
    utilization: number;
  }[];
  generatedAt: string;
}

// Activity API Response Types for Admin Pages
export interface UserActivityItem {
  id: string;
  type: 'user_created' | 'user_updated' | 'role_changed' | 'login' | 'logout' | 'account_activated' | 'account_deactivated';
  user: string;
  userEmail: string;
  action: string;
  timestamp: string;
  details: string;
  success: boolean;
}

export interface UserActivityResponse {
  items: UserActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BookingActivityItem {
  id: string;
  type: 'booking_created' | 'booking_cancelled' | 'booking_completed' | 'payment_received' | 'payment_updated' | 'spot_assigned' | 'listing_created' | 'listing_updated';
  user: string;
  userEmail: string;
  action: string;
  timestamp: string;
  details: string;
  success: boolean;
  relatedEntity?: {
    type: 'booking' | 'spot_listing' | 'parking_spot';
    id: string;
    description: string;
  };
}

export interface BookingActivityResponse {
  items: BookingActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminDashboardMetrics {
  todaysOccupancy: {
    occupiedSpots: number;
    totalBookableSpots: number;
    utilizationPercent: number;
  };
  pendingIssues: number;
  revenueToday: number;
  newRegistrations: number;
}

// Terms and Conditions Versions Table
export const termsVersions = pgTable("terms_versions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  version: integer("version").notNull().unique(),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTermsVersionSchema = createInsertSchema(termsVersions).pick({
  version: true,
  content: true,
  isActive: true,
  publishedAt: true,
});

export type InsertTermsVersion = z.infer<typeof insertTermsVersionSchema>;
export type TermsVersion = typeof termsVersions.$inferSelect;

// Departments Table
export const departments = pgTable("departments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departments).pick({
  name: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

// Locations Table
export const locations = pgTable("locations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  office: text("office").notNull(),
  building: text("building").notNull(),
  level: text("level").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("America/Vancouver"),
  isActive: boolean("is_active").notNull().default(true),
  // Geocoding fields for address validation
  placeId: text("place_id").unique(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  formattedAddress: text("formatted_address"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locations).pick({
  office: true,
  building: true,
  level: true,
  address: true,
  timezone: true,
  isActive: true,
  placeId: true,
  latitude: true,
  longitude: true,
  formattedAddress: true,
  isVerified: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Spot Types Table
export const spotTypesTable = pgTable("spot_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSpotTypeSchema = createInsertSchema(spotTypesTable).pick({
  name: true,
  slug: true,
  description: true,
  isActive: true,
});

export type InsertSpotType = z.infer<typeof insertSpotTypeSchema>;
export type SpotTypeTable = typeof spotTypesTable.$inferSelect;

// Admin-specific flattened booking data interface
export interface AdminBookingData {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  renterDepartment: string;
  ownerName: string;
  ownerEmail: string;
  ownerDepartment: string;
  bookingDate: string;
  dailyRate: number;
  totalAmount: number;
  status: BookingStatus;
  paymentReceived: boolean;
  startTime: string;
  endTime: string;
  notes: string;
  createdAt: string;
  lastActivity: string;
}

// Admin-specific flattened pending payment data interface
export interface PendingPaymentData {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  ownerName: string;
  ownerEmail: string;
  bookingDate: string;
  totalAmount: number;
  daysOverdue: number;
  status: BookingStatus;
}

// Reports Hub API Response Types
export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportOverviewResponse {
  summary: {
    totalSpots: number;
    activeBookings: number;
    totalRevenue: number;
    activeUsers: number;
    waitlistCount: number;
    utilizationRate: number;
  };
  quickStats: {
    todayBookings: number;
    thisWeekRevenue: number;
    pendingPayments: number;
    activeDisputes: number;
  };
  generatedAt: string;
  dateRange: ReportDateRange;
  scope: 'all' | 'bci';
}

export interface ReportUtilizationResponse {
  spotUsage: {
    totalSpots: number;
    allocatedSpots: number;
    unallocatedSpots: number;
    bookableSpots: number;
    utilizationRate: number;
  };
  locationBreakdown: {
    location: string;
    totalSpots: number;
    occupiedSpots: number;
    occupancyRate: number;
    revenue: number;
  }[];
  spotTypeBreakdown: {
    type: string;
    count: number;
    bookedCount: number;
    utilizationRate: number;
  }[];
  dailyOccupancy: {
    date: string;
    totalSpots: number;
    occupiedSpots: number;
    availableForSharing: number;
    bookedSpots: number;
  }[];
  generatedAt: string;
  dateRange: ReportDateRange;
  scope: 'all' | 'bci';
}

export interface ReportRevenueResponse {
  summary: {
    totalRevenue: number;
    ownerEarnings: number;
    bciRevenue: number;
    averageBookingValue: number;
    totalBookings: number;
  };
  monthlyTrends: {
    month: string;
    revenue: number;
    bookings: number;
    averageValue: number;
  }[];
  revenueByLocation: {
    location: string;
    revenue: number;
    bookings: number;
    averageRate: number;
  }[];
  revenueBySpotType: {
    type: string;
    revenue: number;
    bookings: number;
  }[];
  topEarners: {
    ownerId: string;
    ownerName: string;
    totalEarnings: number;
    bookingsCount: number;
  }[];
  generatedAt: string;
  dateRange: ReportDateRange;
  scope: 'all' | 'bci';
}

export interface ReportUserComplianceResponse {
  userActivity: {
    totalUsers: number;
    activeUsers: number;
    newRegistrations: number;
    suspendedUsers: number;
    deletedUsers: number;
  };
  roleDistribution: {
    role: string;
    count: number;
    percentage: number;
  }[];
  departmentBreakdown: {
    department: string;
    userCount: number;
    activeUsers: number;
    spotsOwned: number;
    bookingsMade: number;
  }[];
  userEngagement: {
    date: string;
    activeUsers: number;
    newSignups: number;
    bookingsMade: number;
  }[];
  termsCompliance: {
    acceptedLatestTerms: number;
    pendingAcceptance: number;
    complianceRate: number;
  };
  generatedAt: string;
  dateRange: ReportDateRange;
  scope: 'all' | 'bci';
}

export interface ReportWaitlistPerformanceResponse {
  summary: {
    totalRequests: number;
    activeRequests: number;
    assignedRequests: number;
    cancelledRequests: number;
    averageWaitTime: number;
    fulfillmentRate: number;
  };
  priorityBreakdown: {
    priority: number;
    priorityLabel: string;
    count: number;
    averageWaitDays: number;
    fulfillmentRate: number;
  }[];
  spotTypePreferences: {
    spotType: string;
    requestCount: number;
    fulfilledCount: number;
    fulfillmentRate: number;
  }[];
  departmentRequests: {
    department: string;
    activeRequests: number;
    assignedRequests: number;
    averageWaitDays: number;
  }[];
  waitTimeTrends: {
    date: string;
    newRequests: number;
    fulfilled: number;
    averageWaitDays: number;
  }[];
  generatedAt: string;
  dateRange: ReportDateRange;
  scope: 'all' | 'bci';
}

// Spot Assignment History Table
export const spotAssignmentActions = z.enum(["assigned", "unassigned"]);
export type SpotAssignmentAction = z.infer<typeof spotAssignmentActions>;

export const spotAssignmentHistory = pgTable("spot_assignment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotId: varchar("spot_id").notNull().references(() => parkingSpots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull().$type<SpotAssignmentAction>(),
  effectiveAt: timestamp("effective_at").notNull().defaultNow(),
  actorId: varchar("actor_id"), // Admin who performed the action - nullable for system actions
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("IDX_spot_assignment_history_spot_id").on(table.spotId),
  index("IDX_spot_assignment_history_user_id").on(table.userId),
  index("IDX_spot_assignment_history_effective_at").on(table.effectiveAt),
  index("IDX_spot_assignment_history_action").on(table.action),
]);

// Locker Types Table
export const lockerTypesTable = pgTable("locker_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLockerTypeSchema = createInsertSchema(lockerTypesTable).pick({
  name: true,
  slug: true,
  description: true,
  isActive: true,
});

export type InsertLockerType = z.infer<typeof insertLockerTypeSchema>;
export type LockerType = typeof lockerTypesTable.$inferSelect;

// Locker statuses enum
export const lockerStatuses = z.enum(["available", "assigned"]);
export type LockerStatus = z.infer<typeof lockerStatuses>;

// Lockers Table
export const lockers = pgTable("lockers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lockerNumber: varchar("locker_number").notNull().unique(),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  lockerTypeId: integer("locker_type_id").notNull().references(() => lockerTypesTable.id, { onDelete: "restrict" }),
  status: text("status").notNull().$type<LockerStatus>().default("available"),
  isBciManaged: boolean("is_bci_managed").notNull().default(true),
  userId: varchar("user_id"), // References users.id - nullable for unassigned lockers
  assignedAt: timestamp("assigned_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLockerSchema = createInsertSchema(lockers).omit({
  id: true,
  createdAt: true,
}).extend({
  locationId: z.number().int().positive(),
  lockerTypeId: z.number().int().positive(),
});

export type InsertLocker = z.infer<typeof insertLockerSchema>;
export type Locker = typeof lockers.$inferSelect;

// Locker waitlist statuses enum
export const lockerWaitlistStatuses = z.enum(["pending", "fulfilled", "cancelled"]);
export type LockerWaitlistStatus = z.infer<typeof lockerWaitlistStatuses>;

// Locker Waitlist Table
export const lockerWaitlist = pgTable("locker_waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  requestedLockerTypeId: integer("requested_locker_type_id").references(() => lockerTypesTable.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  status: text("status").notNull().$type<LockerWaitlistStatus>().default("pending"),
  fulfilledAt: timestamp("fulfilled_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("IDX_locker_waitlist_user_id").on(table.userId),
  index("IDX_locker_waitlist_status").on(table.status),
  index("IDX_locker_waitlist_requested_at").on(table.requestedAt),
]);

export const insertLockerWaitlistSchema = createInsertSchema(lockerWaitlist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
});

export type InsertLockerWaitlist = z.infer<typeof insertLockerWaitlistSchema>;
export type LockerWaitlist = typeof lockerWaitlist.$inferSelect;

// Locker assignment actions enum
export const lockerAssignmentActions = z.enum(["assigned", "unassigned"]);
export type LockerAssignmentAction = z.infer<typeof lockerAssignmentActions>;

// Locker Assignment History Table
export const lockerAssignmentHistory = pgTable("locker_assignment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lockerId: varchar("locker_id").notNull().references(() => lockers.id, { onDelete: "cascade" }),
  userId: varchar("user_id"), // Nullable to support unassignment history
  action: text("action").notNull().$type<LockerAssignmentAction>(),
  actorId: varchar("actor_id"), // Admin who performed the action
  effectiveDate: date("effective_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("IDX_locker_assignment_history_locker_id").on(table.lockerId),
  index("IDX_locker_assignment_history_user_id").on(table.userId),
  index("IDX_locker_assignment_history_effective_date").on(table.effectiveDate),
  index("IDX_locker_assignment_history_action").on(table.action),
]);

export const insertLockerAssignmentHistorySchema = createInsertSchema(lockerAssignmentHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertLockerAssignmentHistory = z.infer<typeof insertLockerAssignmentHistorySchema>;
export type LockerAssignmentHistory = typeof lockerAssignmentHistory.$inferSelect;

export const insertSpotAssignmentHistorySchema = createInsertSchema(spotAssignmentHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertSpotAssignmentHistory = z.infer<typeof insertSpotAssignmentHistorySchema>;
export type SpotAssignmentHistory = typeof spotAssignmentHistory.$inferSelect;

// Enriched spot assignment history type with user and spot details
export interface SpotAssignmentHistoryWithDetails extends SpotAssignmentHistory {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string;
  };
  spot: {
    spotNumber: string;
    location: string;
    spotType: string;
  };
  actor: {
    firstName: string;
    lastName: string;
  } | null;
}

// Spot Assignment Report Response
export interface SpotAssignmentReportResponse {
  assignments: Array<{
    id: string;
    action: 'assigned' | 'unassigned';
    effectiveAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      department: string;
    };
    spot: {
      spotNumber: string;
      location: string;
      spotType: string;
    };
    actor: {
      firstName: string;
      lastName: string;
    } | null;
  }>;
  dateRange: { from: string; to: string };
  totalCount: number;
  scope: 'all' | 'bci';
}

// App Configurations Table - System-wide settings
export const appConfigs = pgTable("app_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // Configuration key (e.g., 'lock_timeout_minutes')
  value: text("value").notNull(), // Configuration value as string
  dataType: text("data_type").notNull().default("string"), // Data type: 'string', 'number', 'boolean', 'json'
  category: text("category").notNull().default("general"), // Category for grouping (e.g., 'booking', 'system', 'notifications')
  label: text("label").notNull(), // Human-readable label
  description: text("description"), // Description of what this config does
  updatedBy: varchar("updated_by"), // User ID who last updated this config
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppConfigSchema = createInsertSchema(appConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAppConfigSchema = createInsertSchema(appConfigs).omit({
  id: true,
  key: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof updateAppConfigSchema>;
export type AppConfig = typeof appConfigs.$inferSelect;
