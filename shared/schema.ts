import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define user roles enum
export const userRoles = z.enum(["admin", "owner", "renter"]);
export type UserRole = z.infer<typeof userRoles>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  phone: text("phone"),
  department: text("department"),
  role: text("role").notNull().$type<UserRole>(),
  memberSince: text("member_since"),
  lastLogin: timestamp("last_login"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true, 
  password: true,
  phone: true,
  department: true,
  role: true,
  memberSince: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Auth types for frontend
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  department?: string;
  role: UserRole;
  memberSince?: string;
  lastLogin?: Date | null;
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
    email: "michael.rodriguez@bci.com",
    name: "Michael Rodriguez",
    phone: "(555) 123-4567",
    department: "Marketing",
    role: "renter",
    memberSince: "March 2023",
    lastLogin: new Date("2024-01-15T08:30:00Z")
  },
  owner: {
    id: "user-owner-001", 
    email: "sarah.chen@bci.com",
    name: "Sarah Chen",
    phone: "(555) 234-5678",
    department: "Engineering", 
    role: "owner",
    memberSince: "January 2023",
    lastLogin: new Date("2024-01-15T07:45:00Z")
  },
  admin: {
    id: "user-admin-001",
    email: "david.thompson@bci.com", 
    name: "David Thompson",
    phone: "(555) 456-7890",
    department: "IT",
    role: "admin",
    memberSince: "January 2022",
    lastLogin: new Date("2024-01-15T09:15:00Z")
  }
};
