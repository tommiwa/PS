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
}

// Spot Listings Table
export const listingTypes = z.enum(["single", "period", "recurring"]);
export type ListingType = z.infer<typeof listingTypes>;

export const listingStatuses = z.enum(["active", "paused", "expired", "cancelled"]);
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
  status: text("status").notNull().$type<ListingStatus>().default("active"),
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

// Bookings Table
export const bookingStatuses = z.enum(["confirmed", "pending", "cancelled", "completed"]);
export type BookingStatus = z.infer<typeof bookingStatuses>;

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
  paymentReceived: boolean("payment_received").notNull().default(false), // Track payment status
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
  licensePlate: text("license_plate").notNull(),
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
    licensePlate?: string;
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
      licensePlate: "ABC-123"
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
      licensePlate: "XYZ-789"
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
      licensePlate: "DEF-456"
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
  "booking",
  "waiting_list",
  "notification",
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
