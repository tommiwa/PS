import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, date, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles enum
export const userRoles = z.enum(["admin", "owner", "renter"]);
export type UserRole = z.infer<typeof userRoles>;

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
  department: text("department"),
  role: text("role").$type<UserRole>().default("renter"),
  memberSince: text("member_since"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  department: true,
  role: true,
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

// Parking Spots Table
export const spotTypes = z.enum(["regular", "electric", "accessible"]);
export type SpotType = z.infer<typeof spotTypes>;

export const parkingSpots = pgTable("parking_spots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spotNumber: text("spot_number").notNull(),
  location: text("location").notNull(), // Building/Floor/Section
  spotType: text("spot_type").notNull().$type<SpotType>(),
  isIndoor: boolean("is_indoor").notNull().default(false),
  ownerId: varchar("owner_id").notNull(), // References users.id
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertParkingSpotSchema = createInsertSchema(parkingSpots).omit({
  id: true,
  createdAt: true,
});

export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type ParkingSpot = typeof parkingSpots.$inferSelect;

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSpotListingSchema = createInsertSchema(spotListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSpotListing = z.infer<typeof insertSpotListingSchema>;
export type SpotListing = typeof spotListings.$inferSelect;

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

// Waiting List Schema
export const waitingList = pgTable("waiting_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References users.id
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  userDepartment: text("user_department").notNull(),
  preferredSpotType: text("preferred_spot_type").$type<SpotType>(),
  preferredBuilding: text("preferred_building"),
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
