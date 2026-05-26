import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { getListingDates, maybeNotifyFullOccupancy } from "./occupancy";
import { broadcastLockEvent } from "./websocket";
import { setupAuth, isAuthenticated, requireAdmin, getAuthenticatedUserId, getAuthenticatedUserRole, getAuthenticatedUserBaseRole } from "./replitAuth";
import { z } from "zod";
import { db, pool } from "./db";
import { parkingSpots, spotLocks, spotListings, bookings, issues, insertIssueSchema, updateIssueSchema, issueStatuses, termsVersions, users, locations } from "@shared/schema";
import type { Booking, ParkingSpot, OwnerStatisticsV2Response } from "@shared/schema";
import { inArray, and, eq, lt, gt, not, or, sql, isNull } from "drizzle-orm";
import { 
  sendAssignmentNotification, 
  sendWelcomeNotification,
  sendBookingConfirmationNotification,
  sendBookingCancellationNotification,
  sendPaymentReminderNotification,
  sendPaymentMarkedPaidNotification,
  sendPaymentConfirmedNotification,
  sendSpotAvailabilityNotification,
  sendWeeklySummaryNotification,
  sendSystemMaintenanceNotification,
  sendEmailNotification,
  sendSpotAlertEmail,
  createPromotionBroadcastNotification,
  sendFullOccupancyNotification,
  wrapEmailTemplate,
  type InAppNotification,
  type EmailNotification
} from "./notification-service";
import { 
  insertParkingSpotSchema,
  insertSpotListingSchema,
  insertBookingSchema,
  insertWaitingListSchema,
  insertVehicleSchema,
  insertUserSchema,
  insertPaymentPreferencesSchema,
  updatePaymentPreferencesSchema,
  updateBookingSubscriptionSchema,
  insertTermsVersionSchema,
  insertLockerSchema,
  insertLockerWaitlistSchema,
  type User,
  type WaitingList,
  type Vehicle,
  type PaymentPreferences,
  type PaymentStatus,
  type SpotType,
  type AuditAction,
  type EntityType,
  type UserRole,
  type TermsVersion,
  type Locker,
  type LockerWaitlist,
  type LockerAssignmentHistory,
  auditActions,
  entityTypes,
  userRoles
} from "@shared/schema";
import { dbAuditStorage as auditStorage, type AuditQueryFilters, type AuditPagination } from "./audit-storage";
import { auditService } from "./audit-service";
import { 
  auditContextMiddleware, 
  auditResponseMiddleware, 
  auditErrorMiddleware 
} from "./audit-middleware";
import {
  getReportOverview,
  getReportUtilization,
  getReportRevenue,
  getReportUserCompliance,
  getReportWaitlistPerformance,
  getSpotAssignmentReport,
  getSharedPoolUsageReport,
  getActiveUsersReport,
  getRenterRankings,
  getOwnerRankings
} from "./reports-controller";
import { sendReportEmail, isEmailServiceAvailable } from "./report-service";
import { getTodayInTimezone, formatDateInTimezone, isDateInPast, isDateTodayOrFuture } from "./timezone";

// Workplace Services email - uses env var set per environment (dev vs prod)
const WORKPLACE_SERVICES_EMAIL = process.env.WORKPLACE_SERVICES_EMAIL || 'workplaceservices@bci.ca';

// Lock duration configuration
const LOCK_DURATION_MS = 120000; // 2 minutes (120 seconds)

// Listing date validation constants
const MAX_FUTURE_MONTHS = 6;

// Helper function to check if two listings have overlapping dates
function checkListingOverlap(
  newListing: {
    listingType: string;
    singleDate?: string | null;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    recurringStartDate?: string | null;
    recurringEndDate?: string | null;
    daysOfWeek?: number[] | null;
  },
  existingListing: {
    listingType: string;
    singleDate?: string | null;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    recurringStartDate?: string | null;
    recurringEndDate?: string | null;
    daysOfWeek?: number[] | null;
  }
): string[] {
  const newDates = new Set(getListingDates(newListing));
  const existingDates = getListingDates(existingListing);
  
  // Find overlapping dates
  return existingDates.filter(date => newDates.has(date));
}

// Helper to calculate max allowed future date (6 months from today)
function getMaxFutureDate(): Date {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + MAX_FUTURE_MONTHS);
  maxDate.setHours(23, 59, 59, 999);
  return maxDate;
}

// Helper to validate date is not beyond 6 months
function isDateBeyondMaxFuture(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date > getMaxFutureDate();
}

/**
 * Atomically claims the right to send the full-occupancy email for `date` by
 * inserting a sentinel row into app_configs.  Uses PostgreSQL's ON CONFLICT DO
 * NOTHING so that exactly one concurrent caller wins the race.
 *
 * Key format: _internal_full_occupancy_notified_YYYY-MM-DD
 *
 * Returns true  → this caller is first; the email SHOULD be sent.
 * Returns false → another process already claimed it OR a DB error occurred;
 *                 the email MUST NOT be sent (fail-closed).
 */
async function claimFullOccupancyNotification(date: string): Promise<boolean> {
  const key = `_internal_full_occupancy_notified_${date}`;
  try {
    const result = await pool.query(
      `INSERT INTO app_configs (id, key, value, label, category, data_type, description, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'sent', 'Full Occupancy Notified', 'system', 'string', $2, NOW(), NOW())
       ON CONFLICT (key) DO NOTHING
       RETURNING id`,
      [key, `Internal: full-occupancy email sent for ${date}`]
    );
    return (result.rowCount ?? 0) === 1;
  } catch (err: unknown) {
    console.error('[Full Occupancy] Failed to claim notified date in DB:', err);
    return false;
  }
}


// Zod schemas for admin endpoints
const toggleBookabilitySchema = z.object({
  spotId: z.string().min(1, "spotId is required"),
  isBookable: z.boolean()
});

const bulkToggleBookabilitySchema = z.object({
  spotIds: z.array(z.string().min(1, "spotId is required")).min(1, "At least one spotId is required"),
  isBookable: z.boolean()
});

const bulkUpdateSpotsSchema = z.object({
  spotIds: z.array(z.string().min(1, "spotId is required")).min(1, "At least one spotId is required"),
  updates: z.object({
    isActive: z.boolean().optional(),
    isBookable: z.boolean().optional()
  }).refine(data => data.isActive !== undefined || data.isBookable !== undefined, {
    message: "At least one update field (isActive or isBookable) must be provided"
  })
});

const bulkCreateListingsSchema = z.object({
  spotIds: z.array(z.string().min(1, "spotId is required")).min(1, "At least one spotId is required"),
  listingType: z.enum(["single", "period"]),
  singleDate: z.string().optional(),
  periodStartDate: z.string().optional(),
  periodEndDate: z.string().optional(),
  dailyRate: z.number().positive("Daily rate must be positive"),
  donateToCharity: z.boolean().optional().default(false)
}).refine(
  data => {
    if (data.listingType === "single") {
      return !!data.singleDate;
    } else {
      return !!data.periodStartDate && !!data.periodEndDate;
    }
  },
  {
    message: "Single listings require singleDate; period listings require periodStartDate and periodEndDate"
  }
).refine(
  (data) => {
    if (data.listingType === 'period' && data.periodStartDate && data.periodEndDate) {
      return new Date(data.periodStartDate) <= new Date(data.periodEndDate);
    }
    return true;
  },
  {
    message: "End date must be on or after start date",
    path: ["periodEndDate"]
  }
);

// Zod schemas for audit endpoints
const auditQuerySchema = z.object({
  from: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid from date"),
  to: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid to date"),
  actorId: z.string().optional(),
  action: z.enum(auditActions.options).optional(),
  entityType: z.enum(entityTypes.options).optional(),
  entityId: z.string().optional(),
  success: z.string().optional().refine(val => !val || val === "true" || val === "false", "Success must be true or false"),
  q: z.string().optional(), // Search term
  page: z.string().optional().refine(val => !val || !isNaN(Number(val)) && Number(val) > 0, "Page must be positive number"),
  pageSize: z.string().optional().refine(val => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 100), "Page size must be 1-100"),
});

const DEFAULT_TERMS_CONTENT = `# BCI ParkShare — Terms and Conditions

**Version 1.0 — Effective January 1, 2025**

## 1. Acceptance of Terms

By accessing or using the BCI ParkShare application ("the Application"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use the Application.

## 2. Description of Service

BCI ParkShare is an internal workplace parking management system operated by BCI Workplace Services. The Application facilitates the booking, sharing, and management of parking spaces within BCI facilities.

## 3. User Responsibilities

**3.1 Account Use**
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify the system administrator immediately of any unauthorized use of your account.

**3.2 Accurate Information**
You agree to provide accurate, current, and complete information when registering and using the Application, including vehicle registration details and contact information.

**3.3 Acceptable Use**
You agree to use the Application only for its intended purposes. You must not:
- Attempt to circumvent the booking system or reserve spaces you do not intend to use
- Share your account credentials with other users
- Use the Application for any unlawful purpose
- Interfere with or disrupt the Application or its servers

## 4. Parking Space Bookings

**4.1 Booking Obligations**
When you book a parking space, you are committing to use that space during the reserved period. Repeated no-shows or late cancellations may result in restrictions on future bookings.

**4.2 Cancellation Policy**
Bookings should be cancelled as soon as you know you will not need the space, to allow other users to book it. The system may impose penalties for habitual late cancellations.

**4.3 Space Usage**
You must only park in the specific space assigned to your booking. Unauthorized use of spaces belonging to other bookings may result in your vehicle being ticketed or towed at your expense.

## 5. Spot Owners

**5.1 Listing Accuracy**
If you list a parking space, you must ensure the information provided is accurate, including availability, location, and any restrictions.

**5.2 Availability**
Spot owners must honour confirmed bookings. Repeatedly cancelling confirmed bookings may result in suspension of listing privileges.

## 6. Privacy and Data

**6.1 Data Collection**
The Application collects personal information including your name, email address, employee ID, and vehicle registration details. This information is used solely for the purpose of operating the parking management system.

**6.2 Data Use**
Your information will not be shared outside of BCI Workplace Services except as required by law. Usage data may be used in aggregate, anonymised form for reporting and system improvement.

**6.3 Data Retention**
Your data will be retained for as long as your account is active and for a reasonable period thereafter in accordance with BCI data retention policies.

## 7. Limitation of Liability

BCI Workplace Services provides this Application on an "as is" basis. To the fullest extent permitted by law, BCI Workplace Services shall not be liable for:
- Any damage to your vehicle while using BCI parking facilities
- Loss of use of the Application due to technical issues
- Any indirect, incidental, or consequential damages arising from use of the Application

## 8. Modifications to Terms

BCI Workplace Services reserves the right to modify these Terms and Conditions at any time. You will be notified of material changes and will be required to accept the updated terms before continuing to use the Application.

## 9. Termination

BCI Workplace Services may suspend or terminate your access to the Application at any time for violation of these terms or for any other reason at its sole discretion.

## 10. Governing Law

These Terms and Conditions are governed by the laws applicable to BCI Workplace Services operations. Any disputes arising from use of this Application shall be resolved in accordance with BCI internal dispute resolution procedures.

## 11. Contact

If you have questions about these Terms and Conditions, please contact the BCI Workplace Services support team through your manager or the IT helpdesk.`;

async function seedTermsIfMissing(): Promise<void> {
  try {
    const activeTerms = await storage.getActiveTermsVersion();
    if (!activeTerms) {
      console.log("[Startup] No active terms version found. Checking for any existing versions...");
      const allVersions = await storage.getAllTermsVersions();
      if (allVersions.length > 0) {
        // Activate the most recent existing version
        const latest = allVersions[0];
        console.log(`[Startup] Activating existing terms version ${latest.version}...`);
        await db
          .update(termsVersions)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(termsVersions.id, latest.id));
        console.log(`[Startup] Terms version ${latest.version} activated.`);
      } else {
        // No terms at all — insert the default
        console.log("[Startup] No terms versions found. Seeding default terms...");
        await storage.createTermsVersion({
          version: 1,
          content: DEFAULT_TERMS_CONTENT,
          isActive: true,
          publishedAt: new Date(),
        });
        console.log("[Startup] Default terms version seeded successfully.");
      }
    }
  } catch (error) {
    console.error("[Startup] Failed to seed default terms:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed default terms and conditions if none exist
  await seedTermsIfMissing();

  // Setup authentication middleware
  await setupAuth(app);

  // CRITICAL: Install audit middleware AFTER authentication setup but BEFORE route registration
  // This ensures req.user is available for proper actor attribution and middleware executes in correct order
  // Order: Response interceptor → Context middleware → Error middleware
  app.use(auditResponseMiddleware);
  app.use(auditContextMiddleware);
  app.use(auditErrorMiddleware);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Format memberSince from createdAt
      const memberSince = user.createdAt 
        ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Recently';
      
      // Enrich with department name if departmentId exists
      let departmentName = null;
      if (user.departmentId) {
        const department = await storage.getDepartment(user.departmentId);
        departmentName = department?.name || null;
      }
      
      // Fetch user's primary vehicle info
      let vehicleInfo = null;
      const userVehicles = await storage.getVehiclesByUser(userId);
      if (userVehicles && userVehicles.length > 0) {
        // Find the primary/default vehicle or use the first one
        const primaryVehicle = userVehicles.find(v => v.isDefault) || userVehicles[0];
        vehicleInfo = {
          year: primaryVehicle.year,
          make: primaryVehicle.make,
          model: primaryVehicle.model,
          color: primaryVehicle.color
        };
      }
      
      // Add computed fields for compatibility
      const userWithName = {
        ...user,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
        memberSince,
        department: departmentName,
        vehicleInfo
      };
      
      res.json(userWithName);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Quick fix endpoint to promote current user to admin
  app.post('/api/auth/promote-to-admin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const beforeRoles = [...user.roles];
      await storage.addUserRole(userId, "admin");
      const updatedUser = await storage.getUser(userId);
      
      // Audit the role change
      await auditService.logAction("UPDATE", "user", {
        entityId: userId,
        message: `User promoted to admin role: ${updatedUser?.firstName} ${updatedUser?.lastName} (${updatedUser?.email})`,
        before: { roles: beforeRoles },
        after: { roles: updatedUser?.roles }
      });
      
      res.json({ message: "User promoted to admin successfully", user: updatedUser });
    } catch (error) {
      console.error("Error promoting user to admin:", error);
      res.status(500).json({ message: "Failed to promote user to admin" });
    }
  });

  // Geoapify API Key endpoint
  app.get('/api/config/geoapify-key', isAuthenticated, (req, res) => {
    res.json({ apiKey: process.env.GEOAPIFY_API_KEY || '' });
  });

  // View-as endpoints for admin role impersonation
  // POST /api/auth/view-as - Set view-as role (Admin only)
  app.post('/api/auth/view-as', requireAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      
      // Double-check user is admin (defense-in-depth)
      const baseRole = await getAuthenticatedUserBaseRole(req);
      if (baseRole !== 'admin') {
        return res.status(403).json({ error: "Only admins can use view-as functionality" });
      }
      
      // Validate role
      if (!role || !['admin', 'owner', 'renter'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin', 'owner', or 'renter'" });
      }
      
      // Store in session
      req.session.viewAsRole = role;
      
      // Save session and return response
      req.session.save((err: any) => {
        if (err) {
          console.error("Failed to save session:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        
        const userId = getAuthenticatedUserId(req);
        console.log(`Admin ${userId} is now viewing as ${role}`);
        res.json({ success: true, viewAsRole: role });
      });
    } catch (error) {
      console.error("Error setting view-as role:", error);
      res.status(500).json({ error: "Failed to set view-as role" });
    }
  });

  // GET /api/auth/view-as - Get current view-as role
  app.get('/api/auth/view-as', isAuthenticated, async (req: any, res) => {
    try {
      const viewAsRole = req.session?.viewAsRole || null;
      res.json({ viewAsRole });
    } catch (error) {
      console.error("Error getting view-as role:", error);
      res.status(500).json({ error: "Failed to get view-as role" });
    }
  });

  // DELETE /api/auth/view-as - Clear view-as role
  app.delete('/api/auth/view-as', isAuthenticated, async (req: any, res) => {
    try {
      // Clear the view-as role from session
      if (req.session?.viewAsRole) {
        delete req.session.viewAsRole;
      }
      
      // Save session and return response
      req.session.save((err: any) => {
        if (err) {
          console.error("Failed to save session:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        
        const userId = getAuthenticatedUserId(req);
        console.log(`Admin ${userId} cleared view-as role`);
        res.json({ success: true, message: "View-as role cleared" });
      });
    } catch (error) {
      console.error("Error clearing view-as role:", error);
      res.status(500).json({ error: "Failed to clear view-as role" });
    }
  });

  // Legal/Terms and Conditions routes
  // GET /api/legal/terms - Get active terms version or all versions
  app.get("/api/legal/terms", async (req, res) => {
    try {
      const includeHistory = req.query.includeHistory === 'true';
      
      if (includeHistory) {
        const allVersions = await storage.getAllTermsVersions();
        res.json({ versions: allVersions });
      } else {
        const activeVersion = await storage.getActiveTermsVersion();
        if (!activeVersion) {
          return res.status(404).json({ error: "No active terms version found" });
        }
        res.json(activeVersion);
      }
    } catch (error) {
      console.error("Error fetching terms:", error);
      res.status(500).json({ error: "Failed to fetch terms" });
    }
  });

  // POST /api/legal/terms/accept - Accept the current active terms (Authenticated users only)
  app.post("/api/legal/terms/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const activeTerms = await storage.getActiveTermsVersion();
      if (!activeTerms) {
        return res.status(404).json({ error: "No active terms version found" });
      }

      const updatedUser = await storage.acceptTerms(userId, activeTerms.version);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await auditService.logAction("UPDATE", "user", {
        entityId: userId,
        message: `User accepted terms and conditions version ${activeTerms.version}`,
        after: {
          acceptedTermsVersion: activeTerms.version,
          acceptedTermsAt: updatedUser.acceptedTermsAt
        }
      });

      res.json({ 
        success: true, 
        acceptedVersion: activeTerms.version,
        acceptedAt: updatedUser.acceptedTermsAt
      });
    } catch (error) {
      console.error("Error accepting terms:", error);
      res.status(500).json({ error: "Failed to accept terms" });
    }
  });

  // POST /api/admin/legal/terms - Create new terms version (Admin only)
  app.post("/api/admin/legal/terms", requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertTermsVersionSchema.parse(req.body);
      
      const newTermsVersion = await storage.createTermsVersion(validatedData);
      
      await auditService.logAction("CREATE", "system", {
        entityId: newTermsVersion.id.toString(),
        message: `Created terms and conditions version ${newTermsVersion.version}`,
        after: newTermsVersion
      });
      
      res.json(newTermsVersion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating terms version:", error);
      res.status(500).json({ error: "Failed to create terms version" });
    }
  });

  // Create new user (Admin only)
  app.post("/api/users", requireAdmin, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user with email already exists
      if (validatedData.email) {
        const existingUsers = await storage.getAllUsers();
        const existingUser = existingUsers.find(
          (u: User) => u.email?.toLowerCase() === validatedData.email?.toLowerCase()
        );
        
        if (existingUser) {
          return res.status(409).json({ 
            error: "User with this email already exists",
            message: `A user with email ${validatedData.email} already exists in the system.`
          });
        }
      }
      
      const newUser = await storage.createUser(validatedData);
      
      // Audit the user creation
      await auditService.logAction("CREATE", "user", {
        entityId: newUser.id,
        message: `Created user ${newUser.firstName} ${newUser.lastName} (${newUser.email}) with roles ${JSON.stringify(newUser.roles)}`,
        after: newUser
      });
      
      res.json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update user (Admin only)
  app.put("/api/users/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get existing user for audit trail
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate request body - allow partial updates
      const parseResult = insertUserSchema.partial().parse(req.body);
      
      // Create update data with proper type handling
      const updateData: Partial<User> = {
        firstName: parseResult.firstName,
        lastName: parseResult.lastName,
        email: parseResult.email,
        phone: parseResult.phone,
        departmentId: parseResult.departmentId,
        memberSince: parseResult.memberSince,
        ...(parseResult.roles && Array.isArray(parseResult.roles) && { 
          roles: parseResult.roles as UserRole[] 
        })
      };
      
      // Allow admin to update status if provided
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Audit the user update
      await auditService.logAction("UPDATE", "user", {
        entityId: updatedUser.id,
        message: `Updated user ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})`,
        before: existingUser,
        after: updatedUser
      });
      
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Update own profile (Authenticated users)
  app.patch("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      // Users can only edit their own profile (unless admin)
      const currentUser = await storage.getUser(currentUserId || '');
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (currentUserId !== id && !isAdmin) {
        return res.status(403).json({ error: "You can only edit your own profile" });
      }
      
      // Get existing user
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Create a schema for profile fields that users can edit
      const profileUpdateSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(1).optional().nullable(),
        departmentId: z.number().int().positive().optional()
      });

      // Validate request body
      const parseResult = profileUpdateSchema.parse(req.body);
      
      // Create update data
      const updateData: Partial<User> = {};
      if (parseResult.firstName !== undefined) updateData.firstName = parseResult.firstName;
      if (parseResult.lastName !== undefined) updateData.lastName = parseResult.lastName;
      if (parseResult.email !== undefined) updateData.email = parseResult.email;
      if (parseResult.phone !== undefined) updateData.phone = parseResult.phone;
      if (parseResult.departmentId !== undefined) updateData.departmentId = parseResult.departmentId;
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Delete user (Admin only)
  app.delete("/api/users/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get existing user for audit trail
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has any active bookings or owns spots
      const userSpots = await storage.getParkingSpotsByOwner?.(id) || [];
      const userBookings = await storage.getBookingsByUser?.(id) || [];
      
      if (userSpots.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete user with active parking spots",
          details: `User owns ${userSpots.length} parking spot(s)` 
        });
      }

      const activeBookings = userBookings.filter(booking => 
        ['confirmed', 'active'].includes(booking.status)
      );
      
      if (activeBookings.length > 0) {
        return res.status(400).json({ 
          error: "Cannot delete user with active bookings",
          details: `User has ${activeBookings.length} active booking(s)` 
        });
      }

      // Delete the user
      const deleted = await storage.deleteUser?.(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      // Audit the user deletion
      await auditService.logAction("DELETE", "user", {
        entityId: id,
        message: `Deleted user ${existingUser.firstName} ${existingUser.lastName} (${existingUser.email})`,
        before: existingUser
      });
      
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // TEMPORARY ADMIN CLEANUP: Cancel all available listings for a specific user by email or name
  // Usage: POST /api/admin/cleanup-user-listings { "email": "jeff.morris@bci.ca" }
  //    or: POST /api/admin/cleanup-user-listings { "name": "Jeff Morris" }
  // Add ?dryRun=true to preview without making changes
  app.post("/api/admin/cleanup-user-listings", requireAdmin, async (req: any, res) => {
    try {
      const { email, name } = req.body;
      const dryRun = req.query.dryRun === 'true';

      if (!email && !name) {
        return res.status(400).json({ error: "Provide either 'email' or 'name' in the request body" });
      }

      // Find the user
      let targetUser: any = null;
      if (email) {
        targetUser = await storage.getUserByEmail(email);
      } else {
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
        const allUsers = await storage.getAllUsers?.() || [];
        targetUser = allUsers.find((u: any) =>
          u.firstName?.toLowerCase() === firstName.toLowerCase() &&
          u.lastName?.toLowerCase() === lastName.toLowerCase()
        );
      }

      if (!targetUser) {
        return res.status(404).json({ error: `No user found matching: ${email || name}` });
      }

      // Get all their listings
      const allListings = await db
        .select()
        .from(spotListings)
        .where(eq(spotListings.ownerId, targetUser.id));

      const availableListings = allListings.filter((l: any) => l.status === 'available');
      const availableIds = availableListings.map((l: any) => l.id);

      // Get active bookings on those listings
      let affectedBookings: any[] = [];
      if (availableIds.length > 0) {
        affectedBookings = await db
          .select()
          .from(bookings)
          .where(
            and(
              inArray(bookings.listingId, availableIds),
              inArray(bookings.status, ['pending', 'confirmed', 'upcoming', 'active'])
            )
          );
      }

      if (dryRun) {
        return res.json({
          dryRun: true,
          user: { id: targetUser.id, name: `${targetUser.firstName} ${targetUser.lastName}`, email: targetUser.email },
          totalListings: allListings.length,
          availableListingsToCancel: availableListings.length,
          activeBookingsToCancel: affectedBookings.length,
          listingIds: availableIds,
        });
      }

      // Cancel bookings first
      if (affectedBookings.length > 0) {
        await db
          .update(bookings)
          .set({
            status: 'cancelled',
            cancellationReason: 'Listing cancelled by admin (bulk cleanup)',
            updatedAt: new Date()
          })
          .where(inArray(bookings.id, affectedBookings.map((b: any) => b.id)));
      }

      // Cancel the listings
      if (availableIds.length > 0) {
        await db
          .update(spotListings)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(inArray(spotListings.id, availableIds));
      }

      await auditService.logAction("UPDATE", "spot_listing", {
        message: `Admin bulk cleanup: cancelled ${availableIds.length} listings and ${affectedBookings.length} bookings for user ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`,
        entityId: targetUser.id
      });

      res.json({
        success: true,
        user: { id: targetUser.id, name: `${targetUser.firstName} ${targetUser.lastName}`, email: targetUser.email },
        listingsCancelled: availableIds.length,
        bookingsCancelled: affectedBookings.length,
        message: `Successfully cancelled ${availableIds.length} listings and ${affectedBookings.length} bookings for ${targetUser.firstName} ${targetUser.lastName}`
      });
    } catch (error) {
      console.error("Error in cleanup-user-listings:", error);
      res.status(500).json({ error: "Cleanup failed", details: String(error) });
    }
  });

  // Restore deleted user (Admin only)
  app.patch("/api/admin/users/:id/restore", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get existing user to check if they're deleted
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user is actually deleted
      if (existingUser.status !== "deleted") {
        return res.status(400).json({ 
          error: "User is not deleted",
          details: `User status is '${existingUser.status}'`
        });
      }
      
      // Reactivate the user
      const restoredUser = await storage.reactivateUser(id);
      if (!restoredUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Audit the restoration
      await auditService.logAction("UPDATE", "user", {
        entityId: id,
        message: `Restored user ${restoredUser.firstName} ${restoredUser.lastName} (${restoredUser.email})`,
        before: existingUser,
        after: restoredUser
      });
      
      res.json(restoredUser);
    } catch (error) {
      console.error("Error restoring user:", error);
      res.status(500).json({ error: "Failed to restore user" });
    }
  });

  // Suspend/Unsuspend user (Admin only)
  app.patch("/api/users/:id/suspend", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { suspend } = req.body;
      
      // Get existing user for audit trail
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Determine new status
      const newStatus = suspend ? "suspended" : "active";
      
      // Update user status
      const updatedUser = await storage.updateUser(id, { status: newStatus });
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Audit the status change
      await auditService.logAction("UPDATE", "user", {
        entityId: id,
        message: `${suspend ? 'Suspended' : 'Activated'} user ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})`,
        before: { status: existingUser.status },
        after: { status: updatedUser.status }
      });
      
      res.json({ 
        success: true, 
        message: `User ${suspend ? 'suspended' : 'activated'} successfully`,
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // Get assigned spots for a user (accessible by the user themselves or admin)
  app.get("/api/users/:userId/assigned-spots", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to access their own assigned spots or admin to access any user's spots
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignedSpots = await storage.getParkingSpotsByOwnerEnriched(userId);
      res.json(assignedSpots);
    } catch (error) {
      console.error("Error fetching assigned spots:", error);
      res.status(500).json({ error: "Failed to fetch assigned spots" });
    }
  });

  // Get user's notification preferences
  app.get("/api/users/:userId/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to access their own preferences or admin to access any user's preferences
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const preferences = await storage.getNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  // Update user's notification preferences
  app.patch("/api/users/:userId/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to update their own preferences or admin to update any user's preferences
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate request body using the update schema
      const { updateNotificationPreferencesSchema } = await import("@shared/schema");
      const validatedUpdates = updateNotificationPreferencesSchema.parse(req.body);
      
      const updatedPreferences = await storage.updateNotificationPreferences(userId, validatedUpdates);
      res.json(updatedPreferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  // Payment Preferences Routes
  // Get user's payment preferences
  app.get("/api/users/:userId/payment-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to access their own preferences or admin to access any user's preferences
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const preferences = await storage.getPaymentPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching payment preferences:", error);
      res.status(500).json({ error: "Failed to fetch payment preferences" });
    }
  });

  // Update user's payment preferences
  app.patch("/api/users/:userId/payment-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to update their own preferences or admin to update any user's preferences
      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate request body using the update schema
      const validatedUpdates = updatePaymentPreferencesSchema.parse(req.body);
      
      const updatedPreferences = await storage.updatePaymentPreferences(userId, validatedUpdates);
      res.json(updatedPreferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating payment preferences:", error);
      res.status(500).json({ error: "Failed to update payment preferences" });
    }
  });

  // Booking Subscription Routes
  // GET /api/profile/subscription - Get current user's booking subscription
  app.get("/api/profile/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = getAuthenticatedUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const subscription = await storage.getBookingSubscription(currentUserId);
      res.json(subscription || null);
    } catch (error) {
      console.error("Error fetching booking subscription:", error);
      res.status(500).json({ error: "Failed to fetch booking subscription" });
    }
  });

  // PUT /api/profile/subscription - Create or update current user's booking subscription
  app.put("/api/profile/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = getAuthenticatedUserId(req);
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const validatedUpdates = updateBookingSubscriptionSchema.parse(req.body);
      
      const subscription = await storage.upsertBookingSubscription(currentUserId, validatedUpdates);
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating booking subscription:", error);
      res.status(500).json({ error: "Failed to update booking subscription" });
    }
  });

  // Spot Alert Subscription Routes
  // GET /api/users/:userId/spot-alert-subscription - Get user's spot alert subscription
  app.get("/api/users/:userId/spot-alert-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      if (!currentUserId) return res.status(401).json({ error: "User not authenticated" });

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      if (!isAdmin && currentUserId !== userId) return res.status(403).json({ error: "Access denied" });

      const subscription = await storage.getSpotAlertSubscription(userId);
      res.json(subscription || null);
    } catch (error) {
      console.error("Error fetching spot alert subscription:", error);
      res.status(500).json({ error: "Failed to fetch spot alert subscription" });
    }
  });

  // PATCH /api/users/:userId/spot-alert-subscription - Update user's spot alert subscription
  app.patch("/api/users/:userId/spot-alert-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      if (!currentUserId) return res.status(401).json({ error: "User not authenticated" });

      const currentUser = await storage.getUser(currentUserId);
      const isAdmin = currentUser?.roles?.includes('admin');
      if (!isAdmin && currentUserId !== userId) return res.status(403).json({ error: "Access denied" });

      const { updateSpotAlertSubscriptionSchema } = await import("@shared/schema");
      const validatedData = updateSpotAlertSubscriptionSchema.parse(req.body);

      const subscription = await storage.upsertSpotAlertSubscription(userId, validatedData);
      res.json(subscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating spot alert subscription:", error);
      res.status(500).json({ error: "Failed to update spot alert subscription" });
    }
  });

  // Vehicle Routes
  // Get user's vehicles
  app.get("/api/users/:userId/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to access their own vehicles or admin to access any user's vehicles
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!currentUser.roles.includes("admin") && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const vehicles = await storage.getVehiclesByUser(userId);
      res.json(vehicles);
    } catch (error) {
      console.error('❌ Failed to fetch vehicles:', error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  // Create a new vehicle for user
  app.post("/api/users/:userId/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to create vehicles for themselves or admin to create for any user
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!currentUser.roles.includes("admin") && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate input
      const vehicleData = insertVehicleSchema.parse(req.body);
      
      const newVehicle = await storage.createVehicle(userId, vehicleData);
      
      // Audit the vehicle creation (logged as user entity since vehicle is not a separate entity type)
      await auditService.logAction("CREATE", "user", {
        entityId: userId,
        message: `Created vehicle ${newVehicle.year} ${newVehicle.make} ${newVehicle.model} for user ${userId}`,
        after: newVehicle
      });
      
      res.status(201).json(newVehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error('❌ Failed to create vehicle:', error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  // Update a vehicle
  app.put("/api/users/:userId/vehicles/:vehicleId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, vehicleId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to update their own vehicles or admin to update any vehicle
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!currentUser.roles.includes("admin") && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if vehicle exists and belongs to the user
      const existingVehicle = await storage.getVehicle(vehicleId);
      if (!existingVehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      if (existingVehicle.userId !== userId) {
        return res.status(403).json({ error: "Vehicle does not belong to this user" });
      }

      // Validate input (partial update)
      const updates = insertVehicleSchema.partial().parse(req.body);
      
      const updatedVehicle = await storage.updateVehicle(vehicleId, updates);
      if (!updatedVehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      // Audit the vehicle update (logged as user entity since vehicle is not a separate entity type)
      await auditService.logAction("UPDATE", "user", {
        entityId: userId,
        message: `Updated vehicle ${updatedVehicle.year} ${updatedVehicle.make} ${updatedVehicle.model}`,
        before: existingVehicle,
        after: updatedVehicle
      });
      
      res.json(updatedVehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error('❌ Failed to update vehicle:', error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  // Delete a vehicle
  app.delete("/api/users/:userId/vehicles/:vehicleId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, vehicleId } = req.params;
      const currentUserId = getAuthenticatedUserId(req);
      
      if (!currentUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Only allow users to delete their own vehicles or admin to delete any vehicle
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!currentUser.roles.includes("admin") && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if vehicle exists and belongs to the user
      const existingVehicle = await storage.getVehicle(vehicleId);
      if (!existingVehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      if (existingVehicle.userId !== userId) {
        return res.status(403).json({ error: "Vehicle does not belong to this user" });
      }

      const deleted = await storage.deleteVehicle(vehicleId);
      if (!deleted) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      // Audit the vehicle deletion (logged as user entity since vehicle is not a separate entity type)
      await auditService.logAction("DELETE", "user", {
        entityId: userId,
        message: `Deleted vehicle ${existingVehicle.year} ${existingVehicle.make} ${existingVehicle.model}`,
        before: existingVehicle
      });
      
      res.json({ success: true, message: "Vehicle deleted successfully" });
    } catch (error) {
      console.error('❌ Failed to delete vehicle:', error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Add explicit handler for /api to stop excessive HEAD requests
  app.all("/api", (req, res) => {
    if (req.method === "HEAD") {
      console.log("HEAD request to /api blocked");
      return res.status(200).end();
    }
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Get user's parking spots
  app.get("/api/my-spots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const spots = await storage.getParkingSpotsByOwner(userId);
      res.json(spots);
    } catch (error) {
      console.error("Error fetching parking spots:", error);
      res.status(500).json({ error: "Failed to fetch parking spots" });
    }
  });

  // Create new parking spot
  app.post("/api/my-spots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Validate request body
      const validatedData = insertParkingSpotSchema.parse({
        ...req.body,
        ownerId: userId
      });
      
      const newSpot = await storage.createParkingSpot(validatedData);
      
      // Audit the parking spot creation
      await auditService.logAction("CREATE", "parking_spot", {
        entityId: newSpot.id,
        message: `Created parking spot ${newSpot.spotNumber}`,
        after: newSpot
      });
      
      res.json(newSpot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating parking spot:", error);
      res.status(500).json({ error: "Failed to create parking spot" });
    }
  });

  // Update parking spot
  app.put("/api/my-spots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if spot belongs to the user
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Auto-sync owner_id if user legitimately owns spot via email but has mismatched ID
      if (existingSpot.ownerId !== userId) {
        const currentUser = await storage.getUser(userId);
        if (existingSpot.ownerId && currentUser?.email) {
          const spotOwner = await storage.getUser(existingSpot.ownerId);
          if (spotOwner?.email === currentUser.email) {
            console.log(`[my-spots] Auto-syncing owner_id for spot ${id}: ${existingSpot.ownerId} → ${userId}`);
            await storage.updateParkingSpot(id, { ownerId: userId });
          } else {
            return res.status(403).json({ error: "Not authorized to update this parking spot" });
          }
        } else {
          return res.status(403).json({ error: "Not authorized to update this parking spot" });
        }
      }
      
      // Validate request body
      const validatedData = insertParkingSpotSchema.partial().parse(req.body);
      
      const updatedSpot = await storage.updateParkingSpot(id, validatedData);
      
      if (!updatedSpot) {
        return res.status(404).json({ error: "Failed to update parking spot" });
      }
      
      // Audit the parking spot update
      await auditService.logAction("UPDATE", "parking_spot", {
        entityId: updatedSpot.id,
        message: `Updated parking spot ${updatedSpot.spotNumber}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      res.json(updatedSpot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating parking spot:", error);
      res.status(500).json({ error: "Failed to update parking spot" });
    }
  });

  // Delete parking spot
  app.delete("/api/my-spots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if spot belongs to the user
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Auto-sync owner_id if user legitimately owns spot via email but has mismatched ID
      if (existingSpot.ownerId !== userId) {
        const currentUser = await storage.getUser(userId);
        if (existingSpot.ownerId && currentUser?.email) {
          const spotOwner = await storage.getUser(existingSpot.ownerId);
          if (spotOwner?.email === currentUser.email) {
            console.log(`[my-spots] Auto-syncing owner_id for spot ${id}: ${existingSpot.ownerId} → ${userId}`);
            await storage.updateParkingSpot(id, { ownerId: userId });
          } else {
            return res.status(403).json({ error: "Not authorized to delete this parking spot" });
          }
        } else {
          return res.status(403).json({ error: "Not authorized to delete this parking spot" });
        }
      }
      
      const deleted = await storage.deleteParkingSpot(id);
      if (!deleted) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the parking spot deletion
      await auditService.logAction("DELETE", "parking_spot", {
        entityId: id,
        message: `Deleted parking spot ${existingSpot.spotNumber}`,
        before: existingSpot
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting parking spot:", error);
      res.status(500).json({ error: "Failed to delete parking spot" });
    }
  });

  // Update parking spot default price
  app.patch("/api/my-spots/:id/default-price", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        console.log(`[default-price] Auth failed for spot ${id} - no userId from session`);
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { defaultPrice } = req.body;
      if (typeof defaultPrice !== 'number' || defaultPrice < 0) {
        return res.status(400).json({ error: "Invalid default price" });
      }
      
      // PRICE LIMIT CHECK: Validate default price against max_daily_rate config
      const maxDailyRateConfig = await storage.getAppConfigValue('max_daily_rate');
      const maxDailyRate = maxDailyRateConfig ? parseFloat(maxDailyRateConfig) : null;
      if (maxDailyRate && defaultPrice > maxDailyRate) {
        return res.status(400).json({ 
          error: `Daily rate cannot exceed $${maxDailyRate}. Please enter a rate of $${maxDailyRate} or less.`
        });
      }
      
      // Check if spot belongs to the user
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Log for debugging production authorization issues
      console.log(`[default-price] Spot ${id}: ownerId=${existingSpot.ownerId}, userId=${userId}, match=${existingSpot.ownerId === userId}`);
      
      // Auto-sync owner_id if user legitimately owns spot via email but has mismatched ID
      if (existingSpot.ownerId !== userId) {
        // Check if user's email matches the current owner's email (legacy data fix)
        const currentUser = await storage.getUser(userId);
        if (existingSpot.ownerId && currentUser?.email) {
          const spotOwner = await storage.getUser(existingSpot.ownerId);
          if (spotOwner?.email === currentUser.email) {
            // Same email, different ID - auto-correct the owner_id
            console.log(`[default-price] Auto-syncing owner_id for spot ${id}: ${existingSpot.ownerId} → ${userId} (same email: ${currentUser.email})`);
            await storage.updateParkingSpot(id, { ownerId: userId });
          } else {
            return res.status(403).json({ error: "Not authorized to update this parking spot" });
          }
        } else {
          return res.status(403).json({ error: "Not authorized to update this parking spot" });
        }
      }
      
      const updatedSpot = await storage.updateParkingSpot(id, { defaultPrice: String(defaultPrice) });
      
      if (!updatedSpot) {
        return res.status(404).json({ error: "Failed to update parking spot" });
      }
      
      // Audit the default price update
      await auditService.logAction("UPDATE", "parking_spot", {
        entityId: updatedSpot.id,
        message: `Updated default price for spot ${updatedSpot.spotNumber} to $${defaultPrice}`,
        before: { defaultPrice: existingSpot.defaultPrice },
        after: { defaultPrice: updatedSpot.defaultPrice }
      });
      
      res.json(updatedSpot);
    } catch (error) {
      console.error("Error updating default price:", error);
      res.status(500).json({ error: "Failed to update default price" });
    }
  });

  // Create spot listing
  app.post("/api/spot-listings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Validate request body
      const validatedData = insertSpotListingSchema.parse({
        ...req.body,
        ownerId: userId
      });
      
      // DATE VALIDATION: Ensure all dates are today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const isPastDate = (dateStr: string | null | undefined): boolean => {
        if (!dateStr) return false;
        return dateStr < todayStr;
      };
      
      // Validate based on listing type
      if (validatedData.listingType === 'single') {
        if (isPastDate(validatedData.singleDate)) {
          return res.status(400).json({ 
            error: "Cannot create listing for past dates. Please select today or a future date."
          });
        }
      } else if (validatedData.listingType === 'period') {
        if (isPastDate(validatedData.periodStartDate)) {
          return res.status(400).json({ 
            error: "Period start date cannot be in the past. Please select today or a future date."
          });
        }
        if (isPastDate(validatedData.periodEndDate)) {
          return res.status(400).json({ 
            error: "Period end date cannot be in the past."
          });
        }
      } else if (validatedData.listingType === 'recurring') {
        if (isPastDate(validatedData.recurringStartDate)) {
          return res.status(400).json({ 
            error: "Recurring start date cannot be in the past. Please select today or a future date."
          });
        }
      }
      
      // MAX FUTURE DATE VALIDATION: Ensure dates are within 6 months from today
      const maxFutureDateStr = getMaxFutureDate().toISOString().split('T')[0];
      if (validatedData.listingType === 'single') {
        if (validatedData.singleDate && isDateBeyondMaxFuture(validatedData.singleDate)) {
          return res.status(400).json({ 
            error: `Cannot create listings more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      } else if (validatedData.listingType === 'period') {
        if (validatedData.periodStartDate && isDateBeyondMaxFuture(validatedData.periodStartDate)) {
          return res.status(400).json({ 
            error: `Period start date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
        if (validatedData.periodEndDate && isDateBeyondMaxFuture(validatedData.periodEndDate)) {
          return res.status(400).json({ 
            error: `Period end date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      } else if (validatedData.listingType === 'recurring') {
        if (validatedData.recurringStartDate && isDateBeyondMaxFuture(validatedData.recurringStartDate)) {
          return res.status(400).json({ 
            error: `Recurring start date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
        if (validatedData.recurringEndDate && isDateBeyondMaxFuture(validatedData.recurringEndDate)) {
          return res.status(400).json({ 
            error: `Recurring end date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
        // For recurring without end date, we auto-bound to 6 months for overlap checking.
        // Require end date for recurring listings to ensure clear boundaries
        if (!validatedData.recurringEndDate) {
          // Auto-set the end date to 6 months from now for recurring listings
          validatedData.recurringEndDate = maxFutureDateStr;
        }
      }
      
      // OVERLAP CHECK: Ensure no duplicate or overlapping listings for the same spot
      const existingListings = await storage.getSpotListingsBySpot(validatedData.spotId);
      const activeListings = existingListings.filter(l => l.status === 'available' || l.status === 'booked');
      
      for (const existingListing of activeListings) {
        const overlappingDates = checkListingOverlap(
          {
            listingType: validatedData.listingType,
            singleDate: validatedData.singleDate,
            periodStartDate: validatedData.periodStartDate,
            periodEndDate: validatedData.periodEndDate,
            recurringStartDate: validatedData.recurringStartDate,
            recurringEndDate: validatedData.recurringEndDate,
            daysOfWeek: validatedData.daysOfWeek
          },
          existingListing
        );
        
        if (overlappingDates.length > 0) {
          const spot = await storage.getParkingSpot(validatedData.spotId);
          const overlapCount = overlappingDates.length;
          const sampleDates = overlappingDates.slice(0, 3).join(', ');
          const moreText = overlapCount > 3 ? ` and ${overlapCount - 3} more date(s)` : '';
          
          return res.status(409).json({ 
            error: `This spot already has a listing that overlaps with the dates you selected. Conflicting dates: ${sampleDates}${moreText}. Please remove the existing listing first or choose different dates.`
          });
        }
      }
      
      // PRICE LIMIT CHECK: Validate daily rate against max_daily_rate config
      const maxDailyRateConfig = await storage.getAppConfigValue('max_daily_rate');
      const maxDailyRate = maxDailyRateConfig ? parseFloat(maxDailyRateConfig) : null;
      if (maxDailyRate && validatedData.dailyRate > maxDailyRate) {
        return res.status(400).json({ 
          error: `Daily rate cannot exceed $${maxDailyRate}. Please enter a rate of $${maxDailyRate} or less.`
        });
      }

      // PERMISSION CHECK: Verify spot ownership
      const spot = await storage.getParkingSpot(validatedData.spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Verify that the user owns the spot (both BCI-managed and personal spots can be listed by owners)
      // Log for debugging production authorization issues
      console.log(`[spot-listings] Creating listing for spot ${validatedData.spotId}: ownerId=${spot.ownerId}, userId=${userId}, match=${spot.ownerId === userId}`);
      
      // Auto-sync owner_id if user legitimately owns spot via email but has mismatched ID
      if (spot.ownerId !== userId) {
        // Check if user's email matches the current owner's email (legacy data fix)
        const currentUser = await storage.getUser(userId);
        if (spot.ownerId && currentUser?.email) {
          const spotOwner = await storage.getUser(spot.ownerId);
          if (spotOwner?.email === currentUser.email) {
            // Same email, different ID - auto-correct the owner_id
            console.log(`[spot-listings] Auto-syncing owner_id for spot ${validatedData.spotId}: ${spot.ownerId} → ${userId} (same email: ${currentUser.email})`);
            await storage.updateParkingSpot(validatedData.spotId, { ownerId: userId });
          } else {
            return res.status(403).json({ 
              error: "You can only create listings for spots you own" 
            });
          }
        } else {
          return res.status(403).json({ 
            error: "You can only create listings for spots you own" 
          });
        }
      }
      
      const newListing = await storage.createSpotListing(validatedData);
      
      // Generate date description based on listing type
      const getDateDescription = (listing: any) => {
        if (listing.listingType === 'single' && listing.singleDate) {
          return `on ${listing.singleDate}`;
        } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
          return `from ${listing.periodStartDate} to ${listing.periodEndDate}`;
        } else if (listing.listingType === 'recurring') {
          const startDate = listing.recurringStartDate || 'ongoing';
          const endDate = listing.recurringEndDate || 'ongoing';
          return `recurring from ${startDate} to ${endDate}`;
        }
        return 'for specified dates';
      };
      
      // Audit the spot listing creation
      await auditService.logAction("CREATE", "spot_listing", {
        entityId: newListing.id,
        message: `Created spot listing for ${newListing.spotId} ${getDateDescription(newListing)}`,
        after: newListing
      });

      // Trigger spot alert emails to matching subscribers (async, fire-and-forget)
      (async () => {
        try {
          const subscribers = await storage.getActiveSpotAlertSubscribers();
          if (subscribers.length === 0) return;

          // Get dates covered by this listing
          const listingDates = getListingDates(newListing as any);
          if (listingDates.length === 0) return;

          const listingRate = parseFloat(newListing.dailyRate);
          const spot = await storage.getParkingSpot(newListing.spotId);
          if (!spot) return;

          // Get location name for the spot
          let locationName = 'BCI Parkade';
          if (spot.locationId) {
            const loc = await storage.getLocation(spot.locationId);
            if (loc) locationName = `${loc.office} - ${loc.building}`;
          }

          for (const subscriber of subscribers) {
            // Skip if subscriber is the listing owner
            if (subscriber.userId === newListing.ownerId) continue;

            // Check max price filter
            if (subscriber.maxDailyPrice && listingRate > parseFloat(subscriber.maxDailyPrice)) continue;

            // Check days-of-week filter: find first listing date matching subscriber's preferred days
            const matchingDate = subscriber.daysOfWeek && subscriber.daysOfWeek.length > 0
              ? listingDates.find(d => {
                  const dow = new Date(d + 'T12:00:00').getDay();
                  return subscriber.daysOfWeek.map(Number).includes(dow);
                })
              : listingDates[0]; // No day preference — any date matches

            if (!matchingDate) continue;

            // Get subscriber user info
            const user = await storage.getUser(subscriber.userId);
            if (!user?.email) continue;
            const userName = user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || user.email;

            // Send spot alert email (fire-and-forget per subscriber)
            sendSpotAlertEmail(
              { name: userName, email: user.email },
              {
                id: newListing.id,
                spotNumber: spot.spotNumber,
                location: locationName,
                date: matchingDate,
                dailyRate: listingRate,
                listingType: newListing.listingType as 'single' | 'period' | 'recurring',
                periodStartDate: newListing.periodStartDate ?? null,
                periodEndDate: newListing.periodEndDate ?? null,
                recurringStartDate: newListing.recurringStartDate ?? null,
                recurringEndDate: newListing.recurringEndDate ?? null,
              }
            ).catch(err => console.error(`[SpotAlerts] Failed to send alert to ${user.email}:`, err));
          }
        } catch (err) {
          console.error('[SpotAlerts] Error processing spot alert subscribers:', err);
        }
      })();
      
      res.json(newListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating spot listing:", error);
      res.status(500).json({ error: "Failed to create spot listing" });
    }
  });

  // PUT /api/spot-listings/:id - Update spot listing (Owner)
  app.put("/api/spot-listings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if listing exists and belongs to the user
      const existingListing = await storage.getSpotListing(id);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (existingListing.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this listing" });
      }
      
      const { dailyRate, singleDate, notes, donateToCharity } = req.body;
      
      // DATE VALIDATION: Ensure date is today or in the future (same as create)
      if (singleDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        if (singleDate < todayStr) {
          return res.status(400).json({ 
            error: "Cannot update listing to a past date. Please select today or a future date."
          });
        }
        
        // MAX FUTURE DATE VALIDATION: Ensure date is within 6 months from today
        const maxFutureDateStr = getMaxFutureDate().toISOString().split('T')[0];
        if (isDateBeyondMaxFuture(singleDate)) {
          return res.status(400).json({ 
            error: `Cannot update listing to more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      }
      
      // PRICE LIMIT CHECK: Validate daily rate against max_daily_rate config (same as create)
      if (dailyRate !== undefined) {
        const maxDailyRateConfig = await storage.getAppConfigValue('max_daily_rate');
        const maxDailyRate = maxDailyRateConfig ? parseFloat(maxDailyRateConfig) : null;
        if (maxDailyRate && parseFloat(dailyRate) > maxDailyRate) {
          return res.status(400).json({ 
            error: `Daily rate cannot exceed $${maxDailyRate}. Please enter a rate of $${maxDailyRate} or less.`
          });
        }
      }
      
      // Check for duplicate listing if date is being changed
      if (singleDate && singleDate !== existingListing.singleDate) {
        // Get all listings for this spot and check for date conflict
        const spotListings = await storage.getSpotListingsBySpot(existingListing.spotId);
        const duplicateListing = spotListings.find(listing => 
          listing.id !== id && // Exclude current listing
          listing.singleDate === singleDate &&
          listing.status !== 'cancelled' // Ignore cancelled listings
        );
        
        if (duplicateListing) {
          return res.status(400).json({ 
            error: `A listing already exists for this spot on ${singleDate}. Please choose a different date.` 
          });
        }
      }
      
      // Update the listing
      const updateData: any = {};
      if (dailyRate !== undefined) updateData.dailyRate = dailyRate;
      if (singleDate !== undefined) updateData.singleDate = singleDate;
      if (notes !== undefined) updateData.notes = notes;
      if (donateToCharity !== undefined) updateData.donateToCharity = donateToCharity;
      
      const updatedListing = await storage.updateListing(id, updateData);
      
      if (!updatedListing) {
        return res.status(404).json({ error: "Failed to update listing" });
      }
      
      // Audit the update
      await auditService.logAction("UPDATE", "spot_listing", {
        entityId: updatedListing.id,
        message: `Updated spot listing for ${updatedListing.spotId} on ${updatedListing.singleDate}`,
        before: existingListing,
        after: updatedListing
      });
      
      res.json(updatedListing);
    } catch (error) {
      console.error("Error updating spot listing:", error);
      res.status(500).json({ error: "Failed to update spot listing" });
    }
  });

  // Update listing (Edit)
  app.patch("/api/listings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if listing belongs to the user
      const existingListing = await storage.getSpotListing(id);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (existingListing.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this listing" });
      }
      
      // Validate request body
      const validatedData = insertSpotListingSchema.partial().parse(req.body);
      
      // DATE VALIDATION: Ensure date is today or in the future (same as create/PUT)
      const newDate = validatedData.singleDate;
      if (newDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        if (newDate < todayStr) {
          return res.status(400).json({ 
            error: "Cannot update listing to a past date. Please select today or a future date."
          });
        }
        
        // MAX FUTURE DATE VALIDATION: Ensure date is within 6 months from today
        const maxFutureDateStr = getMaxFutureDate().toISOString().split('T')[0];
        if (isDateBeyondMaxFuture(newDate)) {
          return res.status(400).json({ 
            error: `Cannot update listing to more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      }
      
      // PRICE LIMIT CHECK: Validate daily rate against max_daily_rate config (same as create/PUT)
      if (validatedData.dailyRate !== undefined) {
        const maxDailyRateConfig = await storage.getAppConfigValue('max_daily_rate');
        const maxDailyRate = maxDailyRateConfig ? parseFloat(maxDailyRateConfig) : null;
        const rateValue = typeof validatedData.dailyRate === 'string' 
          ? parseFloat(validatedData.dailyRate) 
          : validatedData.dailyRate;
        if (maxDailyRate && rateValue > maxDailyRate) {
          return res.status(400).json({ 
            error: `Daily rate cannot exceed $${maxDailyRate}. Please enter a rate of $${maxDailyRate} or less.`
          });
        }
      }
      
      // Check for duplicate listing if date is being changed
      const currentDate = existingListing.singleDate;
      
      if (newDate && newDate !== currentDate) {
        // Get all listings for this spot and check for date conflict
        const spotListings = await storage.getSpotListingsBySpot(existingListing.spotId);
        const duplicateListing = spotListings.find(listing => 
          listing.id !== id && // Exclude current listing
          listing.singleDate === newDate &&
          listing.status !== 'cancelled' // Ignore cancelled listings
        );
        
        if (duplicateListing) {
          return res.status(400).json({ 
            error: `A listing already exists for this spot on ${newDate}. Please choose a different date.` 
          });
        }
      }
      
      const updatedListing = await storage.updateListing(id, validatedData);
      
      if (!updatedListing) {
        return res.status(404).json({ error: "Failed to update listing" });
      }
      
      // Generate date description based on listing type
      const getDateDescription = (listing: any) => {
        if (listing.listingType === 'single' && listing.singleDate) {
          return `on ${listing.singleDate}`;
        } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
          return `from ${listing.periodStartDate} to ${listing.periodEndDate}`;
        } else if (listing.listingType === 'recurring') {
          const startDate = listing.recurringStartDate || 'ongoing';
          const endDate = listing.recurringEndDate || 'ongoing';
          return `recurring from ${startDate} to ${endDate}`;
        }
        return 'for specified dates';
      };
      
      // Audit the spot listing update
      await auditService.logAction("UPDATE", "spot_listing", {
        entityId: updatedListing.id,
        message: `Updated spot listing for ${updatedListing.spotId} ${getDateDescription(updatedListing)}`,
        before: existingListing,
        after: updatedListing
      });
      
      // If listing was cancelled by owner, cancel active bookings and notify renters
      if (validatedData.status === 'cancelled' && existingListing.status !== 'cancelled') {
        try {
          const listingBookings = await storage.getBookingsByListing(id);
          const activeBookings = listingBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
          
          if (activeBookings.length > 0) {
            const spot = await storage.getParkingSpot(existingListing.spotId);
            const location = spot?.locationId ? await storage.getLocation(spot.locationId) : null;
            const locationName = location ? `${location.office} - ${location.level}` : 'Unknown';
            const buildingName = location?.building || 'Unknown';
            const isWsListing = existingListing.createdByAdmin === true;
            const ownerUser = await storage.getUser(userId);
            const ownerName = isWsListing
              ? 'Workplace Services'
              : (ownerUser?.firstName && ownerUser?.lastName
                ? `${ownerUser.firstName} ${ownerUser.lastName}`
                : ownerUser?.email || 'Owner');
            
            let ownerInfo: { name: string; email: string; id: string } | null = null;
            if (isWsListing) {
              ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (ownerUser && ownerUser.email) {
              ownerInfo = { name: ownerName, email: ownerUser.email, id: ownerUser.id };
            }
            
            for (const booking of activeBookings) {
              await storage.cancelBookingWithReason(booking.id, `Listing cancelled by ${isWsListing ? 'Workplace Services' : `spot owner (${ownerName})`}`);
              
              setImmediate(async () => {
                try {
                  const renter = await storage.getUser(booking.renterId);
                  if (renter && renter.email) {
                    const renterName = renter.firstName && renter.lastName
                      ? `${renter.firstName} ${renter.lastName}`
                      : renter.firstName || renter.lastName || renter.email || 'User';
                    
                    const renterPrefs = await storage.getNotificationPreferences(renter.id);
                    await sendBookingCancellationNotification(
                      { name: renterName, email: renter.email, id: renter.id },
                      {
                        id: booking.id,
                        spotNumber: spot?.spotNumber || 'Unknown',
                        location: locationName,
                        building: buildingName,
                        bookingDate: booking.bookingDate,
                        cancelledBy: ownerName,
                        cancelledByRole: 'owner' as const,
                        isWorkplaceServicesListing: isWsListing,
                        reason: `Listing cancelled by ${isWsListing ? 'Workplace Services' : `spot owner (${ownerName})`}`
                      },
                      renterPrefs || {},
                      ownerInfo
                    );
                  }
                } catch (notifyError) {
                  console.error(`Failed to send cancellation notification for booking ${booking.id}:`, notifyError);
                }
              });
            }
            console.log(`[Owner Cancel Listing] Cancelled ${activeBookings.length} bookings for listing ${id}`);
          }
        } catch (bookingCancelError) {
          console.error('[Owner Cancel Listing] Error cancelling associated bookings:', bookingCancelError);
        }
      }
      
      res.json(updatedListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating listing:", error);
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  // Delete listing (soft delete - only for unused listings)
  app.delete("/api/listings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Check if listing belongs to the user
      const existingListing = await storage.getSpotListing(id);
      if (!existingListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      if (existingListing.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this listing" });
      }
      
      // Only allow deleting unused listings
      if (existingListing.status !== 'unused') {
        return res.status(400).json({ error: "Only unused listings can be deleted" });
      }
      
      const deleted = await storage.deleteListing(id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Generate date description based on listing type
      const getDateDescription = (listing: any) => {
        if (listing.listingType === 'single' && listing.singleDate) {
          return `on ${listing.singleDate}`;
        } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
          return `from ${listing.periodStartDate} to ${listing.periodEndDate}`;
        } else if (listing.listingType === 'recurring') {
          const startDate = listing.recurringStartDate || 'ongoing';
          const endDate = listing.recurringEndDate || 'ongoing';
          return `recurring from ${startDate} to ${endDate}`;
        }
        return 'for specified dates';
      };
      
      // Audit the spot listing deletion
      await auditService.logAction("DELETE", "spot_listing", {
        entityId: id,
        message: `Deleted spot listing for ${existingListing.spotId} ${getDateDescription(existingListing)}`,
        before: existingListing
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting listing:", error);
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // Two-step payment status update
  app.patch("/api/bookings/:id/payment", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Validate paymentStatus value
      if (!paymentStatus || !['pending', 'paid', 'received'].includes(paymentStatus)) {
        return res.status(400).json({ error: "paymentStatus must be one of: pending, paid, received" });
      }
      
      // Check if booking belongs to the user (as owner OR renter)
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      if (booking.ownerId !== userId && booking.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to update payment status for this booking" });
      }

      // Get current payment status (default to 'pending' if not set)
      const currentStatus = booking.paymentStatus || 'pending';
      
      // Enforce two-step payment flow:
      // - Renters can only mark: pending → paid
      // - Owners can mark: paid → received  
      if (booking.renterId === userId) {
        // Renter can only mark as "paid" when current status is "pending"
        if (paymentStatus === 'paid' && currentStatus === 'pending') {
          // Valid: renter marking payment as sent
        } else {
          return res.status(403).json({ 
            error: "Renters can only mark pending payments as paid" 
          });
        }
      } else if (booking.ownerId === userId) {
        // Owner can only mark as "received" when current status is "paid"
        if (paymentStatus === 'received' && currentStatus === 'paid') {
          // Valid: owner confirming payment received
        } else {
          return res.status(403).json({ 
            error: "Owners can only confirm payment received when status is paid" 
          });
        }
      }
      
      const updatedBooking = await storage.updatePaymentStatus(id, paymentStatus as PaymentStatus);
      
      if (!updatedBooking) {
        return res.status(404).json({ error: "Failed to update payment status" });
      }
      
      // Audit the payment status update
      const actionMessages = {
        paid: 'Renter marked payment as paid',
        received: 'Owner confirmed payment received'
      };
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: updatedBooking.id,
        message: actionMessages[paymentStatus as 'paid' | 'received'] || `Payment status updated to ${paymentStatus}`,
        before: { ...booking, paymentStatus: currentStatus },
        after: { ...updatedBooking, paymentStatus: updatedBooking.paymentStatus }
      });

      const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
      const isWsListing = listing?.createdByAdmin === true;

      const ownerUser = !isWsListing ? await storage.getUser(booking.ownerId) : null;
      const renterUser = await storage.getUser(booking.renterId);
      const spot = await storage.getParkingSpot(booking.spotId);
      const spotLocation = spot?.locationId ? await storage.getLocation(spot.locationId) : null;

      if ((ownerUser || isWsListing) && renterUser && spot) {
        const notificationBooking = {
          id: booking.id,
          spotNumber: spot.spotNumber,
          location: spotLocation ? spotLocation.office : '',
          building: spotLocation ? `${spotLocation.building}, ${spotLocation.level}` : '',
          bookingDate: new Date(booking.bookingDate),
          amount: Number(booking.totalAmount),
        };
        const ownerInfo = isWsListing
          ? { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL }
          : { name: `${ownerUser!.firstName} ${ownerUser!.lastName}`, email: ownerUser!.email || '' };
        const renterInfo = { name: `${renterUser.firstName} ${renterUser.lastName}`, email: renterUser.email || '' };

        if (paymentStatus === 'paid') {
          const ownerPrefs = isWsListing ? {} : await storage.getNotificationPreferences(ownerUser!.id);
          sendPaymentMarkedPaidNotification(ownerInfo, renterInfo, notificationBooking, ownerPrefs || {})
            .catch(err => console.error('Error sending payment marked paid notification:', err));
        } else if (paymentStatus === 'received') {
          const renterPrefs = await storage.getNotificationPreferences(renterUser.id);
          sendPaymentConfirmedNotification(renterInfo, ownerInfo, notificationBooking, renterPrefs || {})
            .catch(err => console.error('Error sending payment confirmed notification:', err));
        }
      }
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });

  // Check if the authenticated user has conflicting bookings on given dates
  // IMPORTANT: Must be registered BEFORE /api/bookings/:id to avoid route shadowing
  app.get("/api/bookings/check-conflict", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const datesParam = req.query.dates as string;
      if (!datesParam) {
        return res.status(400).json({ error: "dates query parameter is required (comma-separated YYYY-MM-DD values)" });
      }

      const requestedDates = datesParam.split(",").map(d => d.trim()).filter(Boolean);
      if (requestedDates.length === 0) {
        return res.status(400).json({ error: "At least one date is required" });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (requestedDates.some(d => !dateRegex.test(d))) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const userBookings = await storage.getBookingsByRenter(userId);
      
      const activeStatuses = ["confirmed", "pending"];
      const conflictingDates = requestedDates.filter(date =>
        userBookings.some(b => b.bookingDate === date && activeStatuses.includes(b.status))
      );

      res.json({ conflictingDates });
    } catch (error) {
      console.error("Error checking booking conflict:", error);
      res.status(500).json({ error: "Failed to check booking conflict" });
    }
  });

  // Get single booking by ID
  app.get("/api/bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Get user's listings (for owners in MyBookings)
  app.get("/api/my-listings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const listings = await storage.getSpotListingsByOwner(userId);
      
      // Enrich listings with spot and booking details
      const enrichedListings = await Promise.all(listings.map(async (listing) => {
        const spot = await storage.getParkingSpot(listing.spotId);
        
        // Get location and spot type names
        let locationName = 'Unknown';
        let spotTypeName = 'regular';
        
        if (spot) {
          if (spot.locationId) {
            const location = await storage.getLocation(spot.locationId);
            locationName = location ? `${location.office} - ${location.building}, ${location.level}` : 'Unknown';
          }
          if (spot.spotTypeId) {
            const spotType = await storage.getSpotType(spot.spotTypeId);
            spotTypeName = spotType?.name || 'regular';
          }
        }
        
        // Get booking information for this listing
        const listingBookings = await storage.getBookingsByListing(listing.id);
        
        // Find active booking for this listing (not cancelled)
        let booking = null;
        
        if (listingBookings.length > 0) {
          // Get any non-cancelled booking for this listing
          // Sort by booking date descending to get the most recent one
          const activeBookings = listingBookings
            .filter(b => b.status !== 'cancelled')
            .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
          
          booking = activeBookings[0] || null;
        }
        
        let renterName = null;
        let renterEmail = null;
        
        if (booking) {
          const renter = await storage.getUser(booking.renterId);
          if (renter) {
            renterName = `${renter.firstName} ${renter.lastName}`;
            renterEmail = renter.email;
          }
        }
        
        // Determine the display date based on listing type
        let displayDate = 'N/A';
        if (listing.listingType === 'single' && listing.singleDate) {
          displayDate = listing.singleDate;
        } else if (listing.listingType === 'period' && listing.periodStartDate) {
          displayDate = listing.periodStartDate;
        } else if (listing.listingType === 'recurring' && listing.recurringStartDate) {
          displayDate = listing.recurringStartDate;
        }
        
        // Determine if this listing is effectively booked
        const isBooked = booking !== null;
        
        // Defensive fallback: if the DB says 'booked' but no active booking record is linked,
        // the listing is an orphan (e.g. from a failed period/recurring split). Treat as available
        // in the API response so the frontend never shows "Unknown Renter".
        const effectiveStatus = (listing.status === 'booked' && !isBooked) ? 'available' : listing.status;
        
        return {
          ...listing,
          status: effectiveStatus,
          spot: {
            spotNumber: spot?.spotNumber || 'Unknown',
            location: locationName,
            spotType: spotTypeName
          },
          date: displayDate,
          price: listing.dailyRate,
          renterName,
          renterEmail,
          isBooked,
          bookingId: booking?.id || null,
          bookingStatus: booking?.status || null,
          totalAmount: booking?.totalAmount || listing.dailyRate,
          renterVehicle: booking ? `${booking.notes || 'N/A'}` : null,
          paymentReceived: booking?.paymentReceived || false,
          paymentStatus: booking?.paymentStatus || null
        };
      }));
      
      res.json(enrichedListings);
    } catch (error) {
      console.error("Error fetching spot listings:", error);
      res.status(500).json({ error: "Failed to fetch spot listings" });
    }
  });

  // Get user's bookings (for renters in MyBookings)
  app.get("/api/my-bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const bookings = await storage.getBookingsByRenter(userId);
      
      const renterVehicles = await storage.getVehiclesByUser(userId);
      const renterPrimaryVehicle = renterVehicles?.find(v => v.isDefault) || renterVehicles?.[0];
      const renterVehicleDisplay = renterPrimaryVehicle 
        ? `${renterPrimaryVehicle.color || ''} ${renterPrimaryVehicle.make || ''} ${renterPrimaryVehicle.model || ''} (${renterPrimaryVehicle.licensePlate || ''})`.trim()
        : null;
      
      // Enrich bookings with spot and owner details
      const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
        const spot = await storage.getParkingSpot(booking.spotId);
        const owner = await storage.getUser(booking.ownerId);
        const ownerPaymentPrefs = await storage.getPaymentPreferences(booking.ownerId);
        const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
        
        // Get location and spot type names
        let locationName = 'Unknown';
        let spotTypeName = 'regular';
        
        if (spot) {
          if (spot.locationId) {
            const location = await storage.getLocation(spot.locationId);
            locationName = location ? `${location.office} - ${location.building}, ${location.level}` : 'Unknown';
          }
          if (spot.spotTypeId) {
            const spotType = await storage.getSpotType(spot.spotTypeId);
            spotTypeName = spotType?.name || 'regular';
          }
        }
        
        // Get floor plan URL for map link
        let floorPlanBaseUrl: string | null = null;
        if (spot?.locationId) {
          const location = await storage.getLocation(spot.locationId);
          floorPlanBaseUrl = location?.floorPlanBaseUrl || null;
        }
        
        return {
          ...booking,
          spotNumber: spot?.spotNumber || 'Unknown',
          location: locationName,
          spotType: spotTypeName,
          ownerName: listing?.createdByAdmin ? 'BCI Workplace Services' : (owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown'),
          paymentStatus: booking.paymentStatus || 'pending',
          isBciManaged: spot?.isBciManaged || false,
          mapLink: spot?.mapLink || null,
          seatNumber: spot?.seatNumber || null,
          floorPlanBaseUrl: floorPlanBaseUrl,
          listingType: listing?.listingType || 'single',
          originalListingType: listing?.originalListingType || null,
          periodStartDate: listing?.periodStartDate || null,
          periodEndDate: listing?.periodEndDate || null,
          recurringStartDate: listing?.recurringStartDate || null,
          recurringEndDate: listing?.recurringEndDate || null,
          ownerPaymentInstructions: ownerPaymentPrefs?.paymentInstructions || null,
          renterVehicle: renterVehicleDisplay,
          donateToCharity: listing?.donateToCharity || false,
          createdByAdmin: listing?.createdByAdmin || false
        };
      }));
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get available parking spots for search (Authenticated users)
  app.get("/api/available-spots", isAuthenticated, async (req: any, res) => {
    try {
      // Get all active spot listings (available for booking)
      const activeListings = await storage.getActiveSpotListings();
      
      // Get all parking spots
      const allSpots = await storage.getAllParkingSpotsWithSafeUserData();
      
      // Get all bookings to check which dates are already booked
      const allBookings = await storage.getAllBookings();
      
      // Get today's date in configured timezone for filtering
      const todayStr = await getTodayInTimezone();
      
      // Filter bookings to only confirmed/pending/completed and today/future dates
      const relevantBookings = await Promise.all(allBookings.map(async (booking) => {
        const isConfirmedOrCompleted = booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'pending';
        const bookingDateStr = await formatDateInTimezone(booking.bookingDate);
        const isTodayOrFuture = bookingDateStr >= todayStr;
        
        return isConfirmedOrCompleted && isTodayOrFuture ? booking : null;
      })).then(results => results.filter(b => b !== null)) as typeof allBookings;
      
      // Create a map of spotId -> Set of booked dates for quick lookup
      const bookedDatesBySpotId = new Map<string, Set<string>>();
      for (const booking of relevantBookings) {
        if (!bookedDatesBySpotId.has(booking.spotId)) {
          bookedDatesBySpotId.set(booking.spotId, new Set());
        }
        const bookingDate = await formatDateInTimezone(booking.bookingDate);
        bookedDatesBySpotId.get(booking.spotId)!.add(bookingDate);
      }
      
      // Helper to generate all dates in a range
      const generateDateRange = async (startDate: string, endDate: string): Promise<string[]> => {
        const dates: string[] = [];
        
        // Parse dates as midnight in the configured timezone
        const parseDate = (dateStr: string): Date => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dates.push(dateStr);
        }
        
        return dates;
      };
      
      // Create a map of spotId -> array of listings for that spot
      const listingsBySpotId = new Map<string, any[]>();
      activeListings.forEach(listing => {
        if (!listingsBySpotId.has(listing.spotId)) {
          listingsBySpotId.set(listing.spotId, []);
        }
        listingsBySpotId.get(listing.spotId)!.push(listing);
      });
      
      // Filter to show spots that:
      // 1. Are active (not deactivated)
      // 2. Are bookable
      // 3. Have an active listing (listings are required for the lock system to work)
      const availableSpots = await Promise.all(allSpots
        .filter(spot => {
          return spot.isActive && 
                 spot.isBookable && 
                 listingsBySpotId.has(spot.id);
        })
        .map(async (spot) => {
          const listings = listingsBySpotId.get(spot.id) || [];
          
          // Safety check: should not happen due to filter above, but handle gracefully
          if (listings.length === 0) {
            return null;
          }
          
          // Build date-to-listing mapping for proper price display
          // Key: date string, Value: {listingId, dailyRate}
          const dateToListing = new Map<string, {listingId: string, dailyRate: number}>();
          // Key: date string, Value: sale calendar label (if any sale is active for this listing)
          const dateToSaleLabel = new Map<string, string>();
          const dateToSaleColor = new Map<string, string>();
          const allDates: string[] = [];
          const listingIdToType = new Map<string, 'single' | 'period' | 'recurring'>();
          
          // Helper: compute effective daily rate for a specific date, respecting sale window
          const effectiveRateForDate = (listing: typeof listings[0], dateStr: string): number => {
            if (listing.saleEventId && listing.saleStartDate && listing.saleEndDate && listing.originalDailyRate) {
              if (dateStr < listing.saleStartDate || dateStr > listing.saleEndDate) {
                return Number(listing.originalDailyRate);
              }
            }
            return Number(listing.dailyRate);
          };

          // Helper: check if dateStr is within the listing's sale window
          const isDateInSaleWindow = (listing: typeof listings[0], dateStr: string): boolean => {
            if (!listing.saleCalendarLabel) return false;
            if (listing.saleStartDate && listing.saleEndDate) {
              return dateStr >= listing.saleStartDate && dateStr <= listing.saleEndDate;
            }
            return true; // No window bounds stored: assume entire listing is in window
          };

          for (const listing of listings) {
            listingIdToType.set(listing.id, listing.listingType);
            
            if (listing.listingType === 'single' && listing.singleDate) {
              // Single day listing - format Date object to YYYY-MM-DD string
              const dateStr = await formatDateInTimezone(listing.singleDate);
              allDates.push(dateStr);
              dateToListing.set(dateStr, {
                listingId: listing.id,
                dailyRate: effectiveRateForDate(listing, dateStr)
              });
              if (isDateInSaleWindow(listing, dateStr) && !dateToSaleLabel.has(dateStr)) {
                dateToSaleLabel.set(dateStr, listing.saleCalendarLabel!);
                dateToSaleColor.set(dateStr, listing.saleCalendarColor || 'fuchsia');
              }
            } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
              // Period listing - expand to all dates in range (format Date objects first)
              const startStr = await formatDateInTimezone(listing.periodStartDate);
              const endStr = await formatDateInTimezone(listing.periodEndDate);
              const dates = await generateDateRange(startStr, endStr);
              for (const dateStr of dates) {
                allDates.push(dateStr);
                // Only set if not already set (single day listings take precedence)
                if (!dateToListing.has(dateStr)) {
                  dateToListing.set(dateStr, {
                    listingId: listing.id,
                    dailyRate: effectiveRateForDate(listing, dateStr)
                  });
                }
                if (isDateInSaleWindow(listing, dateStr) && !dateToSaleLabel.has(dateStr)) {
                  dateToSaleLabel.set(dateStr, listing.saleCalendarLabel!);
                  dateToSaleColor.set(dateStr, listing.saleCalendarColor || 'fuchsia');
                }
              }
            } else if (listing.listingType === 'recurring' && listing.recurringStartDate && listing.recurringEndDate && listing.daysOfWeek) {
              // Recurring listing - expand to all dates that fall on specified days of week
              const startStr = await formatDateInTimezone(listing.recurringStartDate);
              const endStr = await formatDateInTimezone(listing.recurringEndDate);
              const allDatesInRange = await generateDateRange(startStr, endStr);
              
              // Map day names to JS day numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
              const dayNameToNumber: Record<string, number> = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
              };
              
              // Convert listing's daysOfWeek array to a Set of day numbers for quick lookup
              const allowedDays = new Set(
                (listing.daysOfWeek as string[]).map(day => dayNameToNumber[day.toLowerCase()])
              );
              
              // Filter dates to only those that fall on the specified days
              for (const dateStr of allDatesInRange) {
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                const dayOfWeek = date.getDay();
                
                if (allowedDays.has(dayOfWeek)) {
                  allDates.push(dateStr);
                  // Only set if not already set (single day listings take precedence)
                  if (!dateToListing.has(dateStr)) {
                    dateToListing.set(dateStr, {
                      listingId: listing.id,
                      dailyRate: effectiveRateForDate(listing, dateStr)
                    });
                  }
                  if (isDateInSaleWindow(listing, dateStr) && !dateToSaleLabel.has(dateStr)) {
                    dateToSaleLabel.set(dateStr, listing.saleCalendarLabel!);
                    dateToSaleColor.set(dateStr, listing.saleCalendarColor || 'fuchsia');
                  }
                }
              }
            }
          }
          
          // Remove duplicate dates and sort
          const uniqueDates = Array.from(new Set(allDates)).sort();
          
          // Check which availability dates are already booked
          const bookedDatesSet = bookedDatesBySpotId.get(spot.id) || new Set();
          const bookedDates = uniqueDates.filter(date => bookedDatesSet.has(date));
          
          // Separate dates into expired (past unbooked) and available (today/future).
          // The expired date window is configurable via App Settings:
          //   expired_date_window_enabled: if 'true', cap expired dates to the configured window
          //   expired_date_window_days: how many past days to include (default 7)
          const [windowEnabledRaw, windowDaysRaw] = await Promise.all([
            storage.getAppConfigValue('expired_date_window_enabled'),
            storage.getAppConfigValue('expired_date_window_days'),
          ]);
          // 'true'     → limit to window (cutoff applies)
          // 'false'    → show all expired dates (no cutoff)
          // 'hide_all' → show no expired dates at all
          const windowSetting = windowEnabledRaw ?? 'true'; // default: enabled
          const windowDays = Math.max(1, parseInt(windowDaysRaw || '7', 10) || 7);

          let cutoffStr: string | null = null;
          const hideAllExpired = windowSetting === 'hide_all';
          if (windowSetting === 'true') {
            const _cutoffDate = new Date(todayStr + 'T00:00:00');
            _cutoffDate.setDate(_cutoffDate.getDate() - windowDays);
            cutoffStr = [
              _cutoffDate.getFullYear(),
              String(_cutoffDate.getMonth() + 1).padStart(2, '0'),
              String(_cutoffDate.getDate()).padStart(2, '0')
            ].join('-');
          }

          const expiredDates: string[] = [];
          const availabilityDates: string[] = [];
          // Track whether ANY past unbooked date exists (unbounded) for status-transition logic.
          // This must not use the trimmed expiredDates array so listings expired beyond the
          // window are still correctly transitioned to "unused".
          let hasAnyExpiredDate = false;
          
          for (const dateStr of uniqueDates) {
            const isPast = dateStr < todayStr;
            const isBooked = bookedDatesSet.has(dateStr);
            
            if (isPast && !isBooked) {
              hasAnyExpiredDate = true;
              if (!hideAllExpired && (!cutoffStr || dateStr >= cutoffStr)) {
                // Include if not hiding all, and either no cutoff or within the window
                expiredDates.push(dateStr);
              }
            } else if (!isPast && !isBooked) {
              // Today or future date that is not booked = truly available
              availabilityDates.push(dateStr);
            }
            // Note: Past booked dates and future booked dates are excluded from both arrays
          }
          
          // Determine if listing is fully expired (all dates are past and unbooked).
          // Uses hasAnyExpiredDate (unbounded) so listings expired >7 days ago are still
          // correctly transitioned — not the trimmed expiredDates payload array.
          const isExpired = availabilityDates.length === 0 && hasAnyExpiredDate;
          
          // Mark single/period listings as "unused" if fully expired
          // Recurring listings keep "available" status but track expired dates
          if (isExpired) {
            for (const listing of listings) {
              const listingType = listing.listingType;
              
              if (listingType === 'single' && listing.singleDate) {
                // Single listing: mark as unused if date is past and not booked
                const dateStr = listing.singleDate;
                if (dateStr < todayStr && !bookedDatesSet.has(dateStr) && listing.status === 'available') {
                  await storage.updateSpotListingStatus(listing.id, 'unused');
                }
              } else if (listingType === 'period' && listing.periodEndDate) {
                // Period listing: mark as unused if end date is past and no dates were booked
                const endDateStr = listing.periodEndDate;
                const listingDates = await generateDateRange(listing.periodStartDate!, listing.periodEndDate!);
                const anyBooked = listingDates.some(d => bookedDatesSet.has(d));
                
                if (endDateStr < todayStr && !anyBooked && listing.status === 'available') {
                  await storage.updateSpotListingStatus(listing.id, 'unused');
                }
              }
              // Recurring listings: keep status as "available" (handled separately)
            }
          }
          
          // Use first available date's listing as "primary" for backward compatibility
          const firstDate = availabilityDates.sort()[0] || uniqueDates[0];
          const primaryListing = firstDate ? dateToListing.get(firstDate) : null;
          const primaryListingId = primaryListing?.listingId || listings[0].id;
          const primaryDailyRate = primaryListing?.dailyRate || listings[0].dailyRate;
          
          // Check if any listing has donateToCharity flag
          // Create a map of date -> donateToCharity for accurate display
          const dateToCharity: Record<string, boolean> = {};
          for (const listing of listings) {
            if (listing.listingType === 'single' && listing.singleDate) {
              const dateStr = await formatDateInTimezone(listing.singleDate);
              dateToCharity[dateStr] = listing.donateToCharity || false;
            } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
              const startStr = await formatDateInTimezone(listing.periodStartDate);
              const endStr = await formatDateInTimezone(listing.periodEndDate);
              const dates = await generateDateRange(startStr, endStr);
              for (const dateStr of dates) {
                if (!dateToCharity.hasOwnProperty(dateStr)) {
                  dateToCharity[dateStr] = listing.donateToCharity || false;
                }
              }
            } else if (listing.listingType === 'recurring' && listing.recurringStartDate && listing.recurringEndDate) {
              const startStr = await formatDateInTimezone(listing.recurringStartDate);
              const endStr = await formatDateInTimezone(listing.recurringEndDate);
              const allDatesInRange = await generateDateRange(startStr, endStr);
              for (const dateStr of allDatesInRange) {
                if (!dateToCharity.hasOwnProperty(dateStr)) {
                  dateToCharity[dateStr] = listing.donateToCharity || false;
                }
              }
            }
          }
          // Primary charity status for first available date
          const primaryDonateToCharity = firstDate ? (dateToCharity[firstDate] || false) : false;
          
          // Convert dateToListing map to object for JSON serialization
          const dateToPrice: Record<string, {listingId: string, dailyRate: number}> = {};
          dateToListing.forEach((value, key) => {
            dateToPrice[key] = value;
          });
          // Convert dateToSaleLabel map to object for JSON serialization
          const dateToSaleLabelObj: Record<string, string> = {};
          dateToSaleLabel.forEach((value, key) => { dateToSaleLabelObj[key] = value; });
          const dateToSaleColorObj: Record<string, string> = {};
          dateToSaleColor.forEach((value, key) => { dateToSaleColorObj[key] = value; });
          
          // Get owner payment preferences for display
          let ownerPaymentInstructions: string | null = null;
          let ownerPaymentType: string | null = null;
          if (spot.ownerId) {
            const ownerPayPrefs = await storage.getPaymentPreferences(spot.ownerId);
            ownerPaymentInstructions = ownerPayPrefs?.paymentInstructions || null;
            ownerPaymentType = ownerPayPrefs?.paymentType || null;
          }

          // Determine owner display name based on listing context:
          // - If listing was created by admin from admin page (createdByAdmin=true) → "BCI Workplace Services"
          // - If listing was created by the owner from My Spots page (createdByAdmin=false) → show owner's name
          // - If no listing context, fall back to spot ownership
          const primaryListingObj = listings.find(l => l.id === primaryListingId);
          const isAdminCreatedListing = primaryListingObj?.createdByAdmin === true;
          const displayOwnerName = isAdminCreatedListing 
            ? 'BCI Workplace Services' 
            : ((spot as any).assignedUserName || null);

          // Enrich spot with listing data and booking information
          const primarySaleCalendarLabel = firstDate ? (dateToSaleLabelObj[firstDate] || null) : null;
          return {
            ...spot,
            assignedUserName: displayOwnerName,
            listingId: primaryListingId,
            dailyRate: primaryDailyRate,
            availabilityDates: availabilityDates, // Array of today/future dates only
            expiredDates: expiredDates, // Array of past unbooked dates
            isExpired: isExpired, // True if all dates are expired
            bookedDates: bookedDates, // Array of dates that are already booked
            dateToPrice: dateToPrice, // Map of date -> {listingId, dailyRate} for accurate pricing
            dateToCharity: dateToCharity, // Map of date -> boolean for charity status
            dateToSaleLabel: dateToSaleLabelObj, // Map of date -> sale calendar label (if on sale)
            dateToSaleColor: dateToSaleColorObj, // Map of date -> sale badge color
            saleCalendarLabel: primarySaleCalendarLabel, // Primary sale label for first available date
            saleCalendarColor: firstDate ? (dateToSaleColorObj[firstDate] || null) : null, // Primary color for first available date
            donateToCharity: primaryDonateToCharity, // Primary charity status for first available date
            createdByAdmin: primaryListingObj?.createdByAdmin || false,
            isAvailable: availabilityDates.length > 0, // True if spot has future availability
            ownerPaymentInstructions: ownerPaymentInstructions,
            ownerPaymentType: ownerPaymentType,
            // Keep backward compatibility with single date
            availability: availabilityDates.length > 0 ? {
              date: availabilityDates[0]
            } : undefined
          };
        }))
        .then(spots => spots.filter(spot => spot !== null)) // Remove any null entries from safety check
        .then(spots => spots.filter(spot => spot.isAvailable)); // Hide spots with no future availability (past unused listings)
      
      // Fetch active locks to show pending/locked state
      const activeLocks = await db
        .select()
        .from(spotLocks)
        .where(and(
          eq(spotLocks.status, 'active'),
          gt(spotLocks.expiresAt, new Date()) // Only non-expired locks
        ));
      
      // Get current user info to determine if admin
      const currentUserId = getAuthenticatedUserId(req);
      const currentUser = currentUserId ? await storage.getUser(currentUserId) : null;
      const isAdmin = currentUser?.roles?.includes('admin') || false;
      
      // NOTE: Lock display is now handled entirely by LockContext using composite keys (listingId|bookingDate)
      // via GET /api/active-locks endpoint and real-time WebSocket updates.
      // The old activeLock field on spots has been removed since it couldn't properly represent
      // date-specific locks (one spot can be available on multiple dates with different lock states).
      
      res.json(availableSpots);
    } catch (error) {
      console.error("Error fetching available spots:", error);
      res.status(500).json({ error: "Failed to fetch available spots" });
    }
  });

  // Lock acquisition endpoint for concurrent booking prevention
  app.post("/api/spots/:spotId/locks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { spotId } = req.params;
      const { listingId, bookingDate } = req.body;

      // Validate input
      if (!spotId) {
        return res.status(400).json({ error: "spotId is required" });
      }
      if (!listingId) {
        return res.status(400).json({ error: "listingId is required" });
      }
      if (!bookingDate) {
        return res.status(400).json({ error: "bookingDate is required" });
      }
      if (isNaN(Date.parse(bookingDate))) {
        return res.status(400).json({ error: "Invalid bookingDate format" });
      }

      // Verify spot exists
      const spot = await storage.getParkingSpot(spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }

      // Verify listing exists and belongs to this spot
      const listing = await storage.getSpotListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (listing.spotId !== spotId) {
        return res.status(400).json({ error: "Listing does not belong to this spot" });
      }

      // Get lock timeout from app config (with fallback to default 2 minutes)
      const lockTimeoutConfig = await storage.getAppConfigValue('lock_timeout_ms');
      let lockDurationMs = LOCK_DURATION_MS; // default
      
      if (lockTimeoutConfig) {
        const parsed = Number.parseInt(lockTimeoutConfig, 10);
        // Validate: must be a positive integer (at least 1000ms = 1 second)
        if (Number.isFinite(parsed) && parsed > 0) {
          lockDurationMs = parsed;
        } else {
          console.warn(`Invalid lock_timeout_ms config value: ${lockTimeoutConfig}. Using default: ${LOCK_DURATION_MS}ms`);
        }
      }

      // Execute lock acquisition in atomic transaction
      const result = await db.transaction(async (tx) => {
        // Step 1: Check for existing active non-expired locks on this listing+date combination (with row-level lock)
        const existingLock = await tx
          .select()
          .from(spotLocks)
          .where(and(
            eq(spotLocks.listingId, listingId),
            eq(spotLocks.bookingDate, bookingDate),
            eq(spotLocks.status, 'active'),
            gt(spotLocks.expiresAt, new Date()) // Only consider non-expired locks
          ))
          .for('update');
        
        if (existingLock.length > 0) {
          throw new Error('SPOT_ALREADY_LOCKED');
        }
        
        // Step 2: Check if user already has an active lock that hasn't expired (enforce one lock per user)
        const userActiveLock = await tx
          .select()
          .from(spotLocks)
          .where(and(
            eq(spotLocks.userId, userId),
            eq(spotLocks.status, 'active'),
            gt(spotLocks.expiresAt, new Date()) // Only consider non-expired locks
          ));
        
        if (userActiveLock.length > 0) {
          throw new Error('USER_HAS_ACTIVE_LOCK');
        }
        
        // Step 3: Create the new lock with configurable timeout
        const expiresAt = new Date(Date.now() + lockDurationMs);
        const [newLock] = await tx
          .insert(spotLocks)
          .values({
            spotId,
            userId,
            listingId,
            bookingDate,
            expiresAt,
            status: 'active'
          })
          .returning();
        
        return newLock;
      });

      // Calculate remaining seconds
      const remainingSeconds = Math.floor((result.expiresAt.getTime() - Date.now()) / 1000);

      // Broadcast lock.created event (fire and forget - non-blocking)
      setImmediate(() => {
        try {
          broadcastLockEvent('lock.created', {
            lockId: result.id,
            spotId: result.spotId,
            listingId: result.listingId,
            bookingDate: result.bookingDate,
            userId: result.userId,
            expiresAt: result.expiresAt.toISOString()
          });
        } catch (error) {
          console.error('[Lock Broadcast] Failed to broadcast lock.created:', error);
        }
      });

      // Return success response
      res.json({
        lockId: result.id,
        spotId: result.spotId,
        listingId: result.listingId,
        bookingDate: result.bookingDate,
        expiresAt: result.expiresAt.toISOString(),
        remainingSeconds
      });
    } catch (error: any) {
      // Handle specific lock errors
      if (error.message === 'SPOT_ALREADY_LOCKED') {
        return res.status(409).json({ 
          error: "Spot is already locked by another user",
          code: "SPOT_ALREADY_LOCKED"
        });
      }
      if (error.message === 'USER_HAS_ACTIVE_LOCK') {
        return res.status(409).json({ 
          error: "You already have an active lock on another spot",
          code: "USER_HAS_ACTIVE_LOCK"
        });
      }
      
      // Handle generic errors
      console.error("Error acquiring lock:", error);
      res.status(500).json({ error: "Failed to acquire lock" });
    }
  });

  // GET /api/active-locks - Fetch all active locks (for initial load)
  app.get("/api/active-locks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = userId ? await storage.getUser(userId) : null;
      const isAdmin = user?.roles?.includes('admin') || false;
      
      // Fetch all active locks
      const locks = await db
        .select()
        .from(spotLocks)
        .where(and(
          eq(spotLocks.status, 'active'),
          gt(spotLocks.expiresAt, new Date())
        ));
      
      // Map to response format with conditional userId inclusion
      const lockData = locks.map(lock => ({
        id: lock.id,
        spotId: lock.spotId,
        listingId: lock.listingId,
        bookingDate: lock.bookingDate,
        expiresAt: lock.expiresAt.toISOString(),
        ...(isAdmin || lock.userId === userId ? { userId: lock.userId } : {})
      }));
      
      res.json(lockData);
    } catch (error) {
      console.error("Error fetching active locks:", error);
      res.status(500).json({ error: "Failed to fetch active locks" });
    }
  });

  // Helper function to confirm a lock when booking is created
  async function confirmLock(lockId: string, bookingId: string) {
    // Get the lock details before updating
    const [lock] = await db
      .select()
      .from(spotLocks)
      .where(eq(spotLocks.id, lockId))
      .limit(1);

    if (!lock) {
      console.warn(`[confirmLock] Lock ${lockId} not found`);
      return;
    }

    // Update the lock status to confirmed
    await db
      .update(spotLocks)
      .set({ 
        status: 'confirmed',
        bookingId 
      })
      .where(eq(spotLocks.id, lockId));

    // Broadcast lock.confirmed event (fire and forget - non-blocking)
    setImmediate(() => {
      try {
        broadcastLockEvent('lock.confirmed', {
          lockId: lock.id,
          spotId: lock.spotId,
          listingId: lock.listingId,
          bookingDate: lock.bookingDate,
          bookingId
        });
      } catch (error) {
        console.error('[Lock Broadcast] Failed to broadcast lock.confirmed:', error);
      }
    });
  }

  // DELETE /api/spot-locks/:lockId - Release a lock
  app.delete("/api/spot-locks/:lockId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { lockId } = req.params;

      // Find the lock
      const [lock] = await db
        .select()
        .from(spotLocks)
        .where(eq(spotLocks.id, lockId))
        .limit(1);

      if (!lock) {
        return res.status(404).json({ error: "Lock not found" });
      }

      // Check if lock is already confirmed/expired/released
      if (lock.status !== 'active') {
        return res.status(409).json({ 
          error: `Lock is already ${lock.status}`,
          status: lock.status
        });
      }

      // Check authorization: user must own the lock OR be an admin
      const userRole = await getAuthenticatedUserRole(req);
      const isAdmin = userRole === 'admin';
      const isOwner = lock.userId === userId;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ 
          error: "Not authorized to release this lock",
          reason: "You can only release your own locks"
        });
      }

      // Update lock status to 'released'
      await db
        .update(spotLocks)
        .set({ status: 'released' })
        .where(eq(spotLocks.id, lockId));

      // Broadcast lock.released event (fire and forget - non-blocking)
      setImmediate(() => {
        try {
          broadcastLockEvent('lock.released', {
            lockId: lock.id,
            spotId: lock.spotId,
            listingId: lock.listingId,
            bookingDate: lock.bookingDate
          });
        } catch (error) {
          console.error('[Lock Broadcast] Failed to broadcast lock.released:', error);
        }
      });

      // Audit the lock release
      await auditService.logAction("UPDATE", "spot_lock", {
        entityId: lockId,
        message: `Lock released for spot ${lock.spotId} ${isAdmin && !isOwner ? '(by admin)' : ''}`,
        before: { status: 'active' },
        after: { status: 'released' }
      });

      // Return 204 No Content on success
      res.status(204).send();
    } catch (error) {
      console.error("Error releasing lock:", error);
      res.status(500).json({ error: "Failed to release lock" });
    }
  });

  // CRITICAL: Create booking with security validation (Authenticated users only)
  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Validate request body
      const validatedData = insertBookingSchema.parse(req.body);
      
      // SECURITY: Get the parking spot to validate bookability
      const spot = await storage.getParkingSpot(validatedData.spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }

      // CRITICAL SECURITY CHECKS: Prevent booking non-bookable stalls
      if (!spot.isBookable) {
        return res.status(403).json({ 
          error: "This parking spot is not available for booking", 
          reason: "Spot is marked as non-bookable" 
        });
      }

      // Note: Removed taxable_benefit check as it's not in the SpotType enum

      // NOTE: Temporarily disabled for testing - allow booking own spots
      // Additional validation: Ensure user is not booking their own spot
      // if (spot.ownerId === userId) {
      //   return res.status(400).json({ 
      //     error: "You cannot book your own parking spot" 
      //   });
      // }

      // CRITICAL: Check for active lock BEFORE creating booking
      let [activeLock] = await db
        .select()
        .from(spotLocks)
        .where(and(
          eq(spotLocks.userId, userId),
          eq(spotLocks.spotId, validatedData.spotId),
          eq(spotLocks.listingId, validatedData.listingId),
          eq(spotLocks.status, 'active')
        ))
        .limit(1);

      // Check if lock is missing or expired
      const lockExpired = activeLock && new Date(activeLock.expiresAt) < new Date();
      const needsNewLock = !activeLock || lockExpired;

      if (needsNewLock) {
        // Graceful handling: Try to re-acquire lock if spot is still available
        console.log(`[Booking] Lock ${lockExpired ? 'expired' : 'missing'} for user ${userId}, checking spot availability...`);
        
        // Check if spot is still available on this date
        const existingBooking = await db
          .select()
          .from(bookings)
          .where(and(
            eq(bookings.spotId, validatedData.spotId),
            eq(bookings.bookingDate, validatedData.bookingDate),
            not(eq(bookings.status, 'cancelled'))
          ))
          .limit(1);

        if (existingBooking.length > 0) {
          return res.status(409).json({ 
            error: "Spot no longer available", 
            message: "This spot has already been booked by another user." 
          });
        }

        // Check if someone else has locked this spot
        const conflictingLock = await db
          .select()
          .from(spotLocks)
          .where(and(
            eq(spotLocks.listingId, validatedData.listingId),
            eq(spotLocks.bookingDate, validatedData.bookingDate),
            eq(spotLocks.status, 'active'),
            gt(spotLocks.expiresAt, new Date())
          ))
          .limit(1);

        if (conflictingLock.length > 0 && conflictingLock[0].userId !== userId) {
          return res.status(409).json({ 
            error: "Spot is currently locked", 
            message: "Another user is currently booking this spot. Please try again in a moment." 
          });
        }

        // Spot is available! Auto-acquire a new lock
        console.log(`[Booking] Spot available, auto-acquiring new lock for user ${userId}...`);
        
        // Release any old expired lock
        if (activeLock && lockExpired) {
          await db
            .update(spotLocks)
            .set({ status: 'released' })
            .where(eq(spotLocks.id, activeLock.id));
        }

        // Create a new lock (2 minutes)
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        const [newLock] = await db
          .insert(spotLocks)
          .values({
            userId,
            spotId: validatedData.spotId,
            listingId: validatedData.listingId,
            bookingDate: validatedData.bookingDate,
            expiresAt,
            status: 'active'
          })
          .returning();

        activeLock = newLock;
        console.log(`[Booking] New lock acquired (ID: ${newLock.id}), proceeding with booking...`);

        // Broadcast the new lock to all clients
        broadcastLockEvent('lock.acquired', {
          lockId: newLock.id,
          userId: newLock.userId,
          spotId: newLock.spotId,
          listingId: newLock.listingId,
          bookingDate: newLock.bookingDate,
          expiresAt: newLock.expiresAt.toISOString()
        });
      }

      // SECURITY: Find the CORRECT listing that covers this booking date
      // Don't trust the frontend listingId - validate it matches the date
      const bookingDate = validatedData.bookingDate;
      
      // First, try to find a single-day listing (most specific)
      let correctListing = await db
        .select()
        .from(spotListings)
        .where(and(
          eq(spotListings.spotId, validatedData.spotId),
          eq(spotListings.status, 'available'),
          eq(spotListings.listingType, 'single'),
          eq(spotListings.singleDate, bookingDate)
        ))
        .limit(1);

      // If no single-day listing, try period listing
      if (!correctListing || correctListing.length === 0) {
        correctListing = await db
          .select()
          .from(spotListings)
          .where(and(
            eq(spotListings.spotId, validatedData.spotId),
            eq(spotListings.status, 'available'),
            eq(spotListings.listingType, 'period'),
            sql`${spotListings.periodStartDate} <= ${bookingDate}`,
            sql`${spotListings.periodEndDate} >= ${bookingDate}`
          ))
          .limit(1);
      }

      // If no period listing, try recurring listing
      if (!correctListing || correctListing.length === 0) {
        // Get day of week for the booking date (lowercase to match database format)
        const bookingDateObj = new Date(bookingDate + 'T12:00:00');
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const bookingDayOfWeek = dayNames[bookingDateObj.getDay()];
        
        // Find recurring listings that cover this date
        const recurringListings = await db
          .select()
          .from(spotListings)
          .where(and(
            eq(spotListings.spotId, validatedData.spotId),
            eq(spotListings.status, 'available'),
            eq(spotListings.listingType, 'recurring'),
            sql`${spotListings.recurringStartDate} <= ${bookingDate}`,
            sql`(${spotListings.recurringEndDate} IS NULL OR ${spotListings.recurringEndDate} >= ${bookingDate})`
          ));
        
        // Check if any recurring listing includes this day of week
        for (const listing of recurringListings) {
          if (listing.daysOfWeek && listing.daysOfWeek.includes(bookingDayOfWeek)) {
            correctListing = [listing];
            break;
          }
        }
      }

      if (!correctListing || correctListing.length === 0) {
        console.log(`[Booking] No listing found for spot ${validatedData.spotId} on date ${bookingDate}`);
        return res.status(404).json({ 
          error: "No active listing found for this date",
          message: "This spot is not available for booking on the selected date."
        });
      }

      const listing = correctListing[0];

      // SECURITY: Validate that frontend sent the correct listingId
      if (listing.id !== validatedData.listingId) {
        console.warn(`[Booking Security] Frontend sent wrong listingId! Expected ${listing.id}, got ${validatedData.listingId}`);
      }

      // SECURITY: Calculate price from database listing, NOT from frontend
      // If the listing is on sale but the booking date falls outside the sale window, use original rate
      let effectiveDailyRate = Number(listing.dailyRate);
      if (listing.saleEventId && listing.saleStartDate && listing.saleEndDate && listing.originalDailyRate) {
        const bookingDateStr = String(bookingDate).slice(0, 10);
        if (bookingDateStr < listing.saleStartDate || bookingDateStr > listing.saleEndDate) {
          effectiveDailyRate = Number(listing.originalDailyRate);
          console.log(`[Booking] Date ${bookingDateStr} is outside sale window [${listing.saleStartDate}, ${listing.saleEndDate}], using original rate ${effectiveDailyRate}`);
        }
      }
      const actualDailyRate = effectiveDailyRate;
      const actualTotalAmount = actualDailyRate; // Single day booking

      console.log(`[Booking] Using CORRECT listing ${listing.id} with price: dailyRate=${actualDailyRate}, totalAmount=${actualTotalAmount}`);

      // RACE CONDITION PREVENTION: Wrap the duplicate check + booking insert in a
      // transaction with SELECT FOR UPDATE on the listing row.
      // This ensures that two concurrent requests cannot both pass the availability
      // check and both succeed — only one will acquire the row lock; the other will
      // block until the first commits, then see the listing is no longer 'available'.
      let newBooking: any;
      try {
        newBooking = await db.transaction(async (tx) => {
          // Lock the listing row for this transaction to prevent concurrent inserts
          const lockedListings = await tx
            .select({ id: spotListings.id, status: spotListings.status })
            .from(spotListings)
            .where(eq(spotListings.id, listing.id))
            .for('update');

          const lockedListing = lockedListings[0];

          // Re-check listing status inside the transaction (may have changed)
          if (!lockedListing || lockedListing.status !== 'available') {
            throw Object.assign(new Error("Spot no longer available"), { statusCode: 409, userMessage: "This spot has just been booked by another user. Please choose a different date." });
          }

          // Re-check for any existing non-cancelled booking on this spot+date inside the transaction
          const dupBookings = await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(and(
              eq(bookings.spotId, validatedData.spotId),
              eq(bookings.bookingDate, validatedData.bookingDate),
              not(eq(bookings.status, 'cancelled'))
            ))
            .limit(1);

          if (dupBookings.length > 0) {
            throw Object.assign(new Error("Duplicate booking"), { statusCode: 409, userMessage: "This spot has already been booked for that date." });
          }

          // Insert the booking inside the transaction
          const [created] = await tx
            .insert(bookings)
            .values({
              ...validatedData,
              renterId: userId,
              ownerId: spot.ownerId || "unassigned",
              dailyRate: actualDailyRate.toString(),
              totalAmount: actualTotalAmount.toString(),
            } as any)
            .returning();

          return created;
        });
      } catch (txErr: any) {
        if (txErr.statusCode === 409) {
          console.warn(`[Booking] Duplicate booking prevented for spot ${validatedData.spotId} on ${bookingDate}: ${txErr.message}`);
          return res.status(409).json({ 
            error: "Spot no longer available", 
            message: txErr.userMessage || "This spot has already been booked. Please try a different date." 
          });
        }
        // Re-throw unexpected errors to be caught by outer try/catch
        throw txErr;
      }

      // Handle period listings: split into individual day listings
      // This ensures each day remains independently bookable in the share pool
      if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
        console.log(`[Booking] Period listing detected (${listing.periodStartDate} to ${listing.periodEndDate}), splitting into individual days...`);
        
        // Generate all dates in the period using simple string-based date math
        // This avoids timezone issues by keeping everything as YYYY-MM-DD strings
        const allDates: string[] = [];
        const [startYear, startMonth, startDay] = listing.periodStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = listing.periodEndDate.split('-').map(Number);
        
        // Use UTC dates to avoid timezone shifts
        const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        
        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          const year = d.getUTCFullYear();
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          allDates.push(`${year}-${month}-${day}`);
        }
        
        // Get existing single-day listings for this spot to avoid duplicates
        // Only check 'available' and 'booked' statuses - completed/cancelled listings should not block new listings
        const existingListings = await storage.getSpotListingsBySpot(listing.spotId);
        const existingSingleDates = new Set(
          existingListings
            .filter(l => l.listingType === 'single' && !l.deletedAt && (l.status === 'available' || l.status === 'booked'))
            .map(l => l.singleDate)
            .filter(Boolean)
        );
        
        // Also check for existing active bookings on this spot to avoid creating listings for already-booked dates
        // Only 'confirmed' and 'pending' bookings should block new listings - completed/cancelled bookings should not
        const existingBookings = await storage.getBookingsBySpot(listing.spotId);
        const bookedDates = new Set(
          existingBookings
            .filter(b => b.status === 'confirmed' || b.status === 'pending')
            .map(b => b.bookingDate)
        );
        
        // Filter out the booked date, dates with existing listings, and dates with existing bookings
        const remainingDates = allDates.filter(date => 
          date !== bookingDate && 
          !existingSingleDates.has(date) && 
          !bookedDates.has(date)
        );
        
        console.log(`[Booking] Creating ${remainingDates.length} individual single-day listings for remaining dates`);
        
        // Create a single-day listing for the BOOKED date (status: 'booked')
        // This properly represents the booking without using the period listing
        const bookedListing = await storage.createSpotListing({
          spotId: listing.spotId,
          ownerId: listing.ownerId,
          listingType: 'single',
          singleDate: bookingDate,
          periodStartDate: listing.periodStartDate,
          periodEndDate: listing.periodEndDate,
          recurringStartDate: null,
          recurringEndDate: null,
          daysOfWeek: null,
          dailyRate: listing.dailyRate,
          notes: listing.notes,
          status: 'booked',
          createdByAdmin: listing.createdByAdmin,
          donateToCharity: listing.donateToCharity,
          originalListingType: 'period'
        });
        console.log(`[Booking] Created booked single-day listing for ${bookingDate}: ${bookedListing.id}`);
        
        // Update the booking to reference the new single-day listing instead of the period listing
        await storage.updateBooking(newBooking.id, { listingId: bookedListing.id });
        console.log(`[Booking] Updated booking ${newBooking.id} to reference listing ${bookedListing.id}`);
        
        // Create individual single-day listings for each remaining date (status: 'available')
        for (const date of remainingDates) {
          try {
            await storage.createSpotListing({
              spotId: listing.spotId,
              ownerId: listing.ownerId,
              listingType: 'single',
              singleDate: date,
              periodStartDate: listing.periodStartDate,
              periodEndDate: listing.periodEndDate,
              recurringStartDate: null,
              recurringEndDate: null,
              daysOfWeek: null,
              dailyRate: listing.dailyRate,
              notes: listing.notes,
              status: 'available',
              createdByAdmin: listing.createdByAdmin,
              donateToCharity: listing.donateToCharity,
              originalListingType: 'period'
            });
            console.log(`[Booking] Created single-day listing for ${date}`);
          } catch (err) {
            console.error(`[Booking] Failed to create listing for ${date}:`, err);
          }
        }
        
        // Archive the original period listing since it's been split into individual days.
        // cancelSpotListing sets status + audit note; deleteSpotListing sets deletedAt so it
        // is excluded from all normal queries (which filter by isNull(deletedAt)).
        await storage.cancelSpotListing(listing.id, 'Split into individual day listings due to partial booking');
        await storage.deleteSpotListing(listing.id);
        console.log(`[Booking] Archived original period listing ${listing.id}`);
      } else if (listing.listingType === 'recurring' && listing.recurringStartDate && listing.daysOfWeek?.length) {
        // Handle recurring listings: split into individual day listings (same approach as period)
        // This ensures each day remains independently bookable
        const recurringEndDate = listing.recurringEndDate || getMaxFutureDate().toISOString().split('T')[0];
        console.log(`[Booking] Recurring listing detected (${listing.recurringStartDate} to ${recurringEndDate}, days: ${listing.daysOfWeek}), splitting into individual days...`);
        
        // Generate all matching dates from the recurring pattern
        const allDates: string[] = [];
        const [startYear, startMonth, startDay] = listing.recurringStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = recurringEndDate.split('-').map(Number);
        
        const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
        const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));
        
        // Map day names to JS day numbers (0=Sunday, 1=Monday, etc.)
        const dayNameToNumber: Record<string, number> = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };
        const activeDays = new Set(
          (listing.daysOfWeek as string[]).map((d: string) => dayNameToNumber[d.toLowerCase()]).filter((n: number | undefined) => n !== undefined)
        );
        
        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          if (activeDays.has(d.getUTCDay())) {
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            allDates.push(`${year}-${month}-${day}`);
          }
        }
        
        // Get existing single-day listings for this spot to avoid duplicates
        const existingListings = await storage.getSpotListingsBySpot(listing.spotId);
        const existingSingleDates = new Set(
          existingListings
            .filter(l => l.listingType === 'single' && !l.deletedAt && (l.status === 'available' || l.status === 'booked'))
            .map(l => l.singleDate)
            .filter(Boolean)
        );
        
        // Check for existing active bookings to avoid creating listings for already-booked dates
        const existingBookings = await storage.getBookingsBySpot(listing.spotId);
        const bookedDates = new Set(
          existingBookings
            .filter(b => b.status === 'confirmed' || b.status === 'pending')
            .map(b => b.bookingDate)
        );
        
        // Filter out the booked date, dates with existing listings, and dates with existing bookings
        const remainingDates = allDates.filter(date => 
          date !== bookingDate && 
          !existingSingleDates.has(date) && 
          !bookedDates.has(date)
        );
        
        console.log(`[Booking] Creating ${remainingDates.length} individual single-day listings for remaining recurring dates (out of ${allDates.length} total)`);
        
        // Create a single-day listing for the BOOKED date (status: 'booked')
        const bookedListing = await storage.createSpotListing({
          spotId: listing.spotId,
          ownerId: listing.ownerId,
          listingType: 'single',
          singleDate: bookingDate,
          periodStartDate: null,
          periodEndDate: null,
          recurringStartDate: listing.recurringStartDate,
          recurringEndDate: listing.recurringEndDate,
          daysOfWeek: null,
          dailyRate: listing.dailyRate,
          notes: listing.notes,
          status: 'booked',
          createdByAdmin: listing.createdByAdmin,
          donateToCharity: listing.donateToCharity,
          originalListingType: 'recurring'
        });
        console.log(`[Booking] Created booked single-day listing for ${bookingDate}: ${bookedListing.id}`);
        
        // Update the booking to reference the new single-day listing
        await storage.updateBooking(newBooking.id, { listingId: bookedListing.id });
        console.log(`[Booking] Updated booking ${newBooking.id} to reference listing ${bookedListing.id}`);
        
        // Create individual single-day listings for each remaining date (status: 'available')
        for (const date of remainingDates) {
          try {
            await storage.createSpotListing({
              spotId: listing.spotId,
              ownerId: listing.ownerId,
              listingType: 'single',
              singleDate: date,
              periodStartDate: null,
              periodEndDate: null,
              recurringStartDate: listing.recurringStartDate,
              recurringEndDate: listing.recurringEndDate,
              daysOfWeek: null,
              dailyRate: listing.dailyRate,
              notes: listing.notes,
              status: 'available',
              createdByAdmin: listing.createdByAdmin,
              donateToCharity: listing.donateToCharity,
              originalListingType: 'recurring'
            });
            console.log(`[Booking] Created single-day listing for ${date}`);
          } catch (err) {
            console.error(`[Booking] Failed to create listing for ${date}:`, err);
          }
        }
        
        // Archive the original recurring listing since it's been split into individual days.
        // cancelSpotListing sets status + audit note; deleteSpotListing sets deletedAt so it
        // is excluded from all normal queries (which filter by isNull(deletedAt)).
        await storage.cancelSpotListing(listing.id, 'Split into individual day listings due to partial booking');
        await storage.deleteSpotListing(listing.id);
        console.log(`[Booking] Archived original recurring listing ${listing.id}`);
      } else {
        // For single-day listings, just mark as booked
        await storage.updateSpotListingStatus(listing.id, 'booked');
        console.log(`[Booking] Updated listing ${listing.id} status to 'booked'`);
      }

      // Confirm the lock with the new booking
      await confirmLock(activeLock.id, newBooking.id);

      // Audit the booking creation
      await auditService.logAction("CREATE", "booking", {
        entityId: newBooking.id,
        message: `Created booking for spot ${spot.spotNumber} on ${newBooking.bookingDate}`,
        after: newBooking
      });

      // Send booking confirmation email (fire-and-forget to avoid blocking response)
      setImmediate(async () => {
        try {
          // Get user information for email notification
          const user = await storage.getUser(userId);
          if (user) {
            // Get user's notification preferences
            const notificationPreferences = await storage.getNotificationPreferences(userId);
            
            // Construct display name from firstName/lastName
            const displayName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || user.lastName || user.email || 'User';
            
            // Fetch the spot's location from database for accurate email details
            const spotLocation = await storage.getLocation(spot.locationId);
            const locationName = spotLocation?.office || 'BCI Campus';
            const buildingName = spotLocation?.building || locationName;

            // Build visual directory link if floor plan URL and seat number are available
            const floorPlanBaseUrl = spotLocation?.floorPlanBaseUrl || null;
            const seatNumber = spot.seatNumber || null;
            const visualDirectoryUrl = (floorPlanBaseUrl && seatNumber) ? `${floorPlanBaseUrl}${seatNumber}` : null;

            // Prepare booking details for email with correct field mapping
            const bookingDetails = {
              id: newBooking.id,
              spotNumber: spot.spotNumber,
              location: locationName,
              building: buildingName,
              startDate: new Date(newBooking.bookingDate),
              endDate: new Date(newBooking.bookingDate),
              rate: Number(newBooking.dailyRate),
              totalAmount: Number(newBooking.totalAmount),
              visualDirectoryUrl
            };

            const isWorkplaceServicesListing = listing.createdByAdmin === true;
            let ownerInfo: { name: string; email: string; id: string } | null = null;
            if (isWorkplaceServicesListing) {
              ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (listing.ownerId) {
              const owner = await storage.getUser(listing.ownerId);
              if (owner && owner.email) {
                const ownerDisplayName = owner.firstName && owner.lastName 
                  ? `${owner.firstName} ${owner.lastName}`
                  : owner.firstName || owner.lastName || owner.email || 'Owner';
                ownerInfo = { name: ownerDisplayName, email: owner.email, id: owner.id };
              }
            }

            // Send the notification asynchronously (to renter and optionally to owner)
            await sendBookingConfirmationNotification(
              { name: displayName, email: user.email || '', id: user.id },
              bookingDetails,
              notificationPreferences || {},
              ownerInfo,
              isWorkplaceServicesListing
            );
          }
        } catch (emailError) {
          // Log error but don't impact the user experience
          console.error('Failed to send booking confirmation email:', emailError);
        }
      });

      // Full-occupancy check — fire-and-forget after the response is sent
      setImmediate(async () => {
        try {
          const occupancyDate = newBooking.bookingDate as string;
          await maybeNotifyFullOccupancy(
            occupancyDate,
            () => storage.getAllUsers(),
            WORKPLACE_SERVICES_EMAIL,
            claimFullOccupancyNotification,
          );
        } catch (occupancyError) {
          console.error('[Full Occupancy] Failed to send full-occupancy notification:', occupancyError);
        }
      });

      res.json(newBooking);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid booking data", details: error.errors });
      }
      // Handle PostgreSQL unique constraint violation (last line of defence against race conditions)
      if (error?.code === '23505' && error?.constraint?.includes('UDX_bookings_active_spot_date')) {
        console.warn("[Booking] Unique constraint violation prevented duplicate booking:", error.detail);
        return res.status(409).json({ 
          error: "Spot no longer available", 
          message: "This spot has already been booked for that date. Please try a different date." 
        });
      }
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // Get all unallocated parking spots (Admin only)
  app.get("/api/admin/unallocated-spots", requireAdmin, async (req, res) => {
    try {
      const allSpots = await storage.getAllParkingSpotsWithUser();
      const unallocatedSpots = allSpots.filter(spot => !spot.ownerId);
      // Disable caching for admin data to prevent stale UI
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(unallocatedSpots);
    } catch (error) {
      console.error("Error fetching unallocated spots:", error);
      res.status(500).json({ error: "Failed to fetch unallocated spots" });
    }
  });

  // Get admin dashboard metrics (Admin only)
  app.get("/api/admin/dashboard-metrics", requireAdmin, async (req, res) => {
    try {
      const metrics = await storage.getAdminDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Get comprehensive dashboard statistics (Admin only)
  app.get("/api/admin/dashboard-stats", requireAdmin, async (req, res) => {
    try {
      // Helper function to get current date strings using local timezone
      const now = new Date();
      
      // Use local timezone instead of UTC to handle date boundaries correctly
      const localYear = now.getFullYear();
      const localMonth = now.getMonth() + 1; // getMonth() returns 0-11
      const localDay = now.getDate();
      
      const today = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`; // YYYY-MM-DD format
      const currentMonth = `${localYear}-${String(localMonth).padStart(2, '0')}`; // YYYY-MM format
      
      // Fetch all data in parallel for efficiency
      const [allSpots, allUsers, allBookings, todaysBookings] = await Promise.all([
        storage.getAllParkingSpots(),
        storage.getAllUsers(),
        storage.getAllBookings(),
        storage.getBookingsForDate(today)
      ]);

      // Calculate Total Spots
      const totalSpots = allSpots.length;

      // Calculate Active Users
      const activeUsers = allUsers.length;

      // Calculate Today's Bookings
      const todaysBookingsCount = todaysBookings.length;

      // Calculate Available Spots (spots without owners)
      const availableSpots = allSpots.filter(spot => !spot.ownerId).length;

      // Calculate Occupied Spots (spots with active bookings today)
      const occupiedSpotsSet = new Set(todaysBookings.map(booking => booking.spotId));
      const occupiedSpots = occupiedSpotsSet.size;

      // Calculate Revenue This Month (sum of paid bookings in current month)
      const currentMonthBookings = allBookings.filter(booking => {
        const bookingDate = booking.bookingDate.toString(); // Convert to string if needed
        return bookingDate.startsWith(currentMonth) && booking.paymentReceived;
      });
      
      const revenueThisMonth = currentMonthBookings.reduce((total, booking) => {
        return total + parseFloat(booking.totalAmount.toString());
      }, 0);

      // Calculate derived metrics
      const occupancyPercentage = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0;
      const availabilityPercentage = totalSpots > 0 ? Math.round((availableSpots / totalSpots) * 100) : 0;

      // Return comprehensive dashboard statistics
      res.json({
        totalSpots,
        activeUsers,
        todaysBookings: todaysBookingsCount,
        revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
        availableSpots,
        occupiedSpots,
        // Additional derived metrics
        occupancyPercentage,
        availabilityPercentage,
        allocatedSpots: totalSpots - availableSpots,
        // Metadata for context
        generatedAt: now.toISOString(),
        dateContext: {
          today,
          currentMonth
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard statistics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Get renter dashboard statistics (Authenticated renters)
  // Helper: compute period date ranges for renter statistics
  function getRenterPeriodRanges(period: string, now: Date): {
    currentStart: string; currentEnd: string;
    prevStart: string; prevEnd: string;
    label: string;
  } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Clamp day to last valid day of month to prevent JS date rollover (e.g. Mar 31 → Feb 28)
    const clampDay = (year: number, month: number, day: number): Date => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(day, lastDay));
    };

    // Each window: current = start → today; previous = equivalent window ending same relative day
    if (period === 'week') {
      const daysFromMon = (now.getDay() + 6) % 7;
      const monStart = new Date(now); monStart.setDate(now.getDate() - daysFromMon); monStart.setHours(0,0,0,0);
      const prevStart = new Date(monStart); prevStart.setDate(monStart.getDate() - 7);
      const prevEnd = new Date(now); prevEnd.setDate(now.getDate() - 7);
      return { currentStart: fmt(monStart), currentEnd: fmt(now), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), label: 'This Week' };
    } else if (period === '3months') {
      const curStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const prevEnd = clampDay(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { currentStart: fmt(curStart), currentEnd: fmt(now), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), label: 'Last 3 Months' };
    } else if (period === '6months') {
      const curStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const prevEnd = clampDay(now.getFullYear(), now.getMonth() - 6, now.getDate());
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return { currentStart: fmt(curStart), currentEnd: fmt(now), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), label: 'Last 6 Months' };
    } else if (period === 'year') {
      const curStart = new Date(now.getFullYear(), 0, 1);
      const prevStart = new Date(now.getFullYear() - 1, 0, 1);
      const prevEnd = clampDay(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { currentStart: fmt(curStart), currentEnd: fmt(now), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), label: 'This Year' };
    } else {
      // Default: month
      const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = clampDay(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { currentStart: fmt(curStart), currentEnd: fmt(now), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), label: 'This Month' };
    }
  }

  // Helper: filter bookings by period range and status
  function filterRenterBookings(
    allBookings: Booking[],
    start: string,
    end: string,
    status: string
  ): Booking[] {
    return allBookings.filter(b => {
      const d = b.bookingDate.toString();
      if (d < start || d > end) return false;
      if (status === 'all') return true;
      return b.status === status;
    });
  }

  // Helper: compute % change (returns null if prev is 0)
  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  app.get("/api/renter/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const VALID_PERIODS = ['week', 'month', '3months', '6months', 'year'];
      const VALID_STATUSES = ['all', 'confirmed', 'completed', 'cancelled'];
      const rawPeriod = (req.query.period as string) || 'month';
      const rawStatus = (req.query.status as string) || 'all';
      const period = VALID_PERIODS.includes(rawPeriod) ? rawPeriod : 'month';
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'all';

      const today = await getTodayInTimezone();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const allBookings = await storage.getBookingsByRenter(userId);

      // Active bookings: future bookings matching status filter (status='all' → confirmed only)
      const activeBookings = allBookings.filter(b => {
        if (b.bookingDate < today) return false;
        if (status === 'all') return b.status === 'confirmed';
        return b.status === status;
      }).length;

      // Period ranges
      const { currentStart, currentEnd, prevStart, prevEnd, label } = getRenterPeriodRanges(period, now);

      const currentBookings = filterRenterBookings(allBookings, currentStart, currentEnd, status);
      const prevBookings = filterRenterBookings(allBookings, prevStart, prevEnd, status);

      // Spending: gate on payment status (paid/received only — excludes pending/refunded)
      const isPaid = (b: Booking) => b.paymentStatus === 'paid' || b.paymentStatus === 'received';
      const currentPaid = currentBookings.filter(isPaid);
      const prevPaid = prevBookings.filter(isPaid);
      const currentSpent = currentPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);
      const prevSpent = prevPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);
      const currentAvg = currentPaid.length > 0 ? currentSpent / currentPaid.length : 0;
      const prevAvg = prevPaid.length > 0 ? prevSpent / prevPaid.length : 0;

      // Legacy fields (always month/all)
      const thisMonthBkgs = allBookings.filter(b => {
        const d = b.bookingDate.toString();
        return d.startsWith(currentMonth) && (b.paymentStatus === 'paid' || b.paymentStatus === 'received');
      });
      const thisMonthSpent = thisMonthBkgs.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);

      const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      const pastYearBkgs = allBookings.filter(b => {
        const d = b.bookingDate.toString();
        const inRange = d >= oneYearAgoStr && (b.paymentStatus === 'paid' || b.paymentStatus === 'received');
        if (!inRange) return false;
        if (status === 'all') return true;
        return b.status === status;
      });
      const pastYearSpent = pastYearBkgs.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);

      // Confirmed and completed counts derived from the status-filtered currentBookings dataset
      // (consistent with all other summary card metrics — same filter applied)
      const periodConfirmedCount = currentBookings.filter(b => b.status === 'confirmed').length;
      const periodCompletedCount = currentBookings.filter(b => b.status === 'completed').length;
      const prevPeriodConfirmedCount = prevBookings.filter(b => b.status === 'confirmed').length;
      const prevPeriodCompletedCount = prevBookings.filter(b => b.status === 'completed').length;

      res.json({
        period,
        status,
        periodLabel: label,
        bookings: currentBookings.length,
        spent: Number(currentSpent.toFixed(2)),
        averageCostPerBooking: Number(currentAvg.toFixed(2)),
        bookingsChange: pctChange(currentBookings.length, prevBookings.length),
        spentChange: pctChange(currentSpent, prevSpent),
        averageCostChange: pctChange(currentAvg, prevAvg),
        periodConfirmedCount,
        periodCompletedCount,
        periodConfirmedChange: pctChange(periodConfirmedCount, prevPeriodConfirmedCount),
        periodCompletedChange: pctChange(periodCompletedCount, prevPeriodCompletedCount),
        // Legacy fields
        activeBookings,
        thisMonthSpent: Number(thisMonthSpent.toFixed(2)),
        thisMonthBookings: thisMonthBkgs.length,
        pastYearSpent: Number(pastYearSpent.toFixed(2)),
        pastYearBookings: pastYearBkgs.length,
        generatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Error fetching renter dashboard statistics:", error);
      res.status(500).json({ error: "Failed to fetch renter dashboard statistics" });
    }
  });

  // Get detailed renter statistics (Authenticated renters)
  app.get("/api/renter/statistics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const VALID_PERIODS = ['week', 'month', '3months', '6months', 'year'];
      const VALID_STATUSES = ['all', 'confirmed', 'completed', 'cancelled'];
      const rawPeriod = (req.query.period as string) || 'month';
      const rawStatus = (req.query.status as string) || 'all';
      const period = VALID_PERIODS.includes(rawPeriod) ? rawPeriod : 'month';
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'all';

      const today = await getTodayInTimezone();
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const allBookings = await storage.getBookingsByRenter(userId);

      // Active bookings: future bookings matching status filter (status='all' → confirmed only)
      const activeBookings = allBookings.filter(b => {
        if (b.bookingDate < today) return false;
        if (status === 'all') return b.status === 'confirmed';
        return b.status === status;
      }).length;

      // Period ranges
      const { currentStart, currentEnd, prevStart, prevEnd, label } = getRenterPeriodRanges(period, now);

      const currentBookings = filterRenterBookings(allBookings, currentStart, currentEnd, status);
      const prevBookings = filterRenterBookings(allBookings, prevStart, prevEnd, status);

      // Spending: gate on payment status (paid/received only — excludes pending/refunded)
      const isPaid = (b: Booking) => b.paymentStatus === 'paid' || b.paymentStatus === 'received';
      const currentPaid = currentBookings.filter(isPaid);
      const prevPaid = prevBookings.filter(isPaid);
      const currentSpent = currentPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);
      const prevSpent = prevPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);
      const currentAvg = currentPaid.length > 0 ? currentSpent / currentPaid.length : 0;
      const prevAvg = prevPaid.length > 0 ? prevSpent / prevPaid.length : 0;

      // Legacy fields
      const thisMonthBkgs = allBookings.filter(b => {
        const d = b.bookingDate.toString();
        return d.startsWith(currentMonth) && (b.paymentStatus === 'paid' || b.paymentStatus === 'received');
      });
      const thisMonthSpent = thisMonthBkgs.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);

      const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      const pastYearBkgs = allBookings.filter(b => {
        const d = b.bookingDate.toString();
        const inRange = d >= oneYearAgoStr && (b.paymentStatus === 'paid' || b.paymentStatus === 'received');
        if (!inRange) return false;
        if (status === 'all') return true;
        return b.status === status;
      });
      const pastYearSpent = pastYearBkgs.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0);

      // Fetch city parking daily rate config
      const cityParkingRateRaw = await storage.getAppConfigValue('city_parking_daily_rate');
      const cityParkingDailyRate = (() => {
        const parsed = Number(cityParkingRateRaw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
      })();

      // Non-cancelled bookings count as "booked days" for city parking comparison
      const isNotCancelled = (b: Booking) => b.status !== 'cancelled';

      // Build spending chart data based on period
      const spendingData: { label: string; spent: number; bookings: number; bookedDays: number }[] = [];

      if (period === 'week') {
        // Show Mon-Sun of current week, capped at today (no future days)
        const dayOfWeek = now.getDay();
        const daysFromMon = (dayOfWeek + 6) % 7;
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - daysFromMon); weekStart.setHours(0,0,0,0);
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
          const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (dStr > today) break; // stop at today; don't show future days
          const dayBkgs = currentBookings.filter(b => b.bookingDate.toString() === dStr);
          const dayPaid = dayBkgs.filter(isPaid);
          spendingData.push({
            label: dayNames[i],
            spent: Number(dayPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0).toFixed(2)),
            bookings: dayBkgs.length,
            bookedDays: dayBkgs.filter(isNotCancelled).length
          });
        }
      } else if (period === 'month') {
        // Show each day of current month, capped at today (no future days)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          if (dStr > today) break; // stop at today; don't show future days
          const dayBkgs = currentBookings.filter(b => b.bookingDate.toString() === dStr);
          const dayPaid = dayBkgs.filter(isPaid);
          spendingData.push({
            label: String(day),
            spent: Number(dayPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0).toFixed(2)),
            bookings: dayBkgs.length,
            bookedDays: dayBkgs.filter(isNotCancelled).length
          });
        }
      } else {
        // Show months aligned to the period range
        // year: Jan 1 → current month; 3months: (now-2months) → now; 6months: (now-5months) → now
        let binStart: Date;
        let binCount: number;
        if (period === 'year') {
          binStart = new Date(now.getFullYear(), 0, 1); // Jan 1
          binCount = now.getMonth() + 1; // Jan through current month
        } else if (period === '3months') {
          binStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          binCount = 3;
        } else { // 6months
          binStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
          binCount = 6;
        }
        const showYear = period === 'year' || binStart.getFullYear() !== now.getFullYear();
        for (let i = 0; i < binCount; i++) {
          const d = new Date(binStart.getFullYear(), binStart.getMonth() + i, 1);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          const monthBkgs = currentBookings.filter(b => b.bookingDate.toString().startsWith(monthKey));
          const monthPaid = monthBkgs.filter(isPaid);
          spendingData.push({
            label: d.toLocaleDateString('en-US', { month: 'short', year: showYear ? '2-digit' : undefined }),
            spent: Number(monthPaid.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0).toFixed(2)),
            bookings: monthBkgs.length,
            bookedDays: monthBkgs.filter(isNotCancelled).length
          });
        }
      }

      // Legacy monthlySpending (6 months, all statuses, paid/received)
      const monthlySpendingArr: { month: string; spent: number; bookings: number; year: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const mb = allBookings.filter(b => b.bookingDate.toString().startsWith(mk) && (b.paymentStatus === 'paid' || b.paymentStatus === 'received'));
        monthlySpendingArr.push({
          month: d.toLocaleDateString('en-US', { month: 'short' }),
          spent: Number(mb.reduce((t, b) => t + parseFloat(b.totalAmount.toString()), 0).toFixed(2)),
          bookings: mb.length,
          year: d.getFullYear()
        });
      }

      // Top spots: use paid bookings only, group by spotId, look up spotNumber
      const uniqueSpotIds = [...new Set(currentPaid.map(b => b.spotId))];
      const fetchedSpots = await Promise.all(uniqueSpotIds.map(id => storage.getParkingSpot(id)));
      const spotById = new Map(
        fetchedSpots.filter((s): s is NonNullable<typeof s> => s != null).map(s => [s.id, s])
      );

      const spotStatsMap = new Map<string, { spotNumber: string; bookingsCount: number; totalSpent: number }>();

      for (const booking of currentPaid) {
        const spot = spotById.get(booking.spotId);
        if (spot) {
          const existing = spotStatsMap.get(booking.spotId) || {
            spotNumber: spot.spotNumber, bookingsCount: 0, totalSpent: 0
          };
          existing.bookingsCount += 1;
          existing.totalSpent += parseFloat(booking.totalAmount.toString());
          spotStatsMap.set(booking.spotId, existing);
        }
      }

      const topSpots = Array.from(spotStatsMap.entries())
        .map(([spotId, stats]) => {
          const spot = spotById.get(spotId);
          return {
            spotId,
            ...stats,
            totalSpent: Number(stats.totalSpent.toFixed(2)),
            isIndoor: spot?.isIndoor ?? false,
            isBciManaged: spot?.isBciManaged ?? false,
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      const spotsUsed = [...spotById.values()];
      const convenienceStats = {
        indoorSpotsCount: spotsUsed.filter(s => s.isIndoor).length,
        bciManagedCount: spotsUsed.filter(s => s.isBciManaged).length,
        totalUniqueSpotsUsed: spotsUsed.length,
      };

      // Status distribution: uses period+status filtered bookings so donut reflects selected filters
      const statusMap = new Map<string, { count: number; amount: number }>();
      for (const s of ['confirmed', 'completed', 'cancelled']) {
        statusMap.set(s, { count: 0, amount: 0 });
      }
      for (const b of currentBookings) {
        if (!statusMap.has(b.status)) continue;
        const entry = statusMap.get(b.status)!;
        entry.count += 1;
        entry.amount += isPaid(b) ? parseFloat(b.totalAmount.toString()) : 0;
      }
      const statusDistribution = Array.from(statusMap.entries())
        .map(([s, v]) => ({ status: s, count: v.count, amount: Number(v.amount.toFixed(2)) }));

      // Recent activity
      const upcomingBookings = activeBookings;
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = await formatDateInTimezone(weekAgo, 'yyyy-MM-dd');
      const completedThisWeek = allBookings.filter(b =>
        b.status === 'completed' && b.bookingDate >= weekAgoStr && b.bookingDate < today
      ).length;
      const cancelledThisMonth = allBookings.filter(b => {
        const d = b.bookingDate.toString();
        return b.status === 'cancelled' && d.startsWith(currentMonth);
      }).length;

      res.json({
        stats: {
          period,
          status,
          periodLabel: label,
          bookings: currentBookings.length,
          spent: Number(currentSpent.toFixed(2)),
          averageCostPerBooking: Number(currentAvg.toFixed(2)),
          bookingsChange: pctChange(currentBookings.length, prevBookings.length),
          spentChange: pctChange(currentSpent, prevSpent),
          averageCostChange: pctChange(currentAvg, prevAvg),
          // Period-dynamic confirmed/completed counts — derived from same status-filtered dataset
          periodConfirmedCount: currentBookings.filter(b => b.status === 'confirmed').length,
          periodCompletedCount: currentBookings.filter(b => b.status === 'completed').length,
          periodConfirmedChange: pctChange(
            currentBookings.filter(b => b.status === 'confirmed').length,
            prevBookings.filter(b => b.status === 'confirmed').length
          ),
          periodCompletedChange: pctChange(
            currentBookings.filter(b => b.status === 'completed').length,
            prevBookings.filter(b => b.status === 'completed').length
          ),
          // Legacy fields
          activeBookings,
          pastYearSpent: Number(pastYearSpent.toFixed(2)),
          thisMonthSpent: Number(thisMonthSpent.toFixed(2)),
          thisMonthBookings: thisMonthBkgs.length,
          pastYearBookings: pastYearBkgs.length,
          generatedAt: now.toISOString()
        },
        spendingData,
        monthlySpending: monthlySpendingArr,
        topSpots,
        statusDistribution,
        recentActivity: {
          upcomingBookings,
          completedThisWeek,
          cancelledThisMonth
        },
        cityParkingDailyRate,
        convenienceStats
      });
    } catch (error) {
      console.error("Error fetching detailed renter statistics:", error);
      res.status(500).json({ error: "Failed to fetch renter statistics" });
    }
  });

  // Get owner dashboard statistics (earnings and spending) - simplified to match renter stats
  app.get("/api/owner/statistics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculate date range for past year
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

      // Get user's owned spots (spots assigned to this user - either as owner or assignedUser)
      const allSpots = await storage.getAllParkingSpots();
      const ownedSpots = allSpots.filter(spot => 
        spot.assignedUserId === userId || spot.ownerId === userId
      );

      // Initialize monthly data structure for past 6 months
      const monthlyData: Map<string, { earned: number; spent: number }> = new Map();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData.set(monthKey, { earned: 0, spent: 0 });
      }

      // Track stats
      let thisMonthIncome = 0;
      let thisMonthIncomeBookings = 0;
      let pastYearIncome = 0;
      let pastYearIncomeBookings = 0;

      // Get all bookings for spots owned by this user (earnings)
      for (const spot of ownedSpots) {
        const spotBookings = await storage.getBookingsBySpot(spot.id);
        
        for (const booking of spotBookings) {
          const bookingDate = booking.bookingDate.toString();
          const amount = parseFloat(booking.totalAmount?.toString() || '0');
          const bookingMonth = bookingDate.substring(0, 7); // YYYY-MM
          
          // Count paid/received bookings for earnings
          if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'received') {
            // This month income
            if (bookingDate.startsWith(currentMonth)) {
              thisMonthIncome += amount;
              thisMonthIncomeBookings++;
            }
            
            // Past year income
            if (bookingDate >= oneYearAgoStr) {
              pastYearIncome += amount;
              pastYearIncomeBookings++;
            }
            
            // Monthly data for chart
            if (monthlyData.has(bookingMonth)) {
              const monthData = monthlyData.get(bookingMonth)!;
              monthData.earned += amount;
            }
          }
        }
      }

      // Get user's spending (as a renter)
      const renterBookings = await storage.getBookingsByRenter(userId);
      
      let thisMonthSpent = 0;
      let thisMonthSpentBookings = 0;
      let pastYearSpent = 0;
      let pastYearSpentBookings = 0;
      
      for (const booking of renterBookings) {
        const bookingDate = booking.bookingDate.toString();
        const amount = parseFloat(booking.totalAmount?.toString() || '0');
        const bookingMonth = bookingDate.substring(0, 7); // YYYY-MM
        
        // Spending (paid bookings)
        if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'received') {
          if (bookingDate.startsWith(currentMonth)) {
            thisMonthSpent += amount;
            thisMonthSpentBookings++;
          }
          
          if (bookingDate >= oneYearAgoStr) {
            pastYearSpent += amount;
            pastYearSpentBookings++;
          }
          
          // Monthly data for chart
          if (monthlyData.has(bookingMonth)) {
            const monthData = monthlyData.get(bookingMonth)!;
            monthData.spent += amount;
          }
        }
      }

      // Convert monthly data to array for chart
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyEarnings = Array.from(monthlyData.entries()).map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        return {
          month: monthNames[parseInt(month) - 1],
          earned: Number(data.earned.toFixed(2)),
          spent: Number(data.spent.toFixed(2)),
          net: Number((data.earned - data.spent).toFixed(2))
        };
      });

      res.json({
        // This month stats
        thisMonthIncome: Number(thisMonthIncome.toFixed(2)),
        thisMonthIncomeBookings,
        thisMonthSpent: Number(thisMonthSpent.toFixed(2)),
        thisMonthSpentBookings,
        // Past year stats
        pastYearIncome: Number(pastYearIncome.toFixed(2)),
        pastYearIncomeBookings,
        pastYearSpent: Number(pastYearSpent.toFixed(2)),
        pastYearSpentBookings,
        // Monthly trends for chart
        monthlyEarnings,
        // Summary
        ownedSpotsCount: ownedSpots.length,
        generatedAt: now.toISOString()
      });
    } catch (error) {
      console.error("Error fetching owner statistics:", error);
      res.status(500).json({ error: "Failed to fetch owner statistics" });
    }
  });

  // Owner Statistics V2 — rich reporting dashboard
  app.get("/api/owner/statistics/v2", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) return res.status(401).json({ error: "User not authenticated" });

      // Require owner or admin role
      const callerUser = await storage.getUser(userId);
      const callerRoles: string[] = (callerUser?.roles ?? []);
      if (!callerRoles.includes('owner') && !callerRoles.includes('admin')) {
        return res.status(403).json({ error: "Owner role required" });
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // ---------- Parse and validate query params ----------
      const VALID_PERIODS = ['week', 'month', '3months', '6months', 'year', 'lastyear', 'custom'];
      const VALID_STATUSES = ['all', 'confirmed', 'paid', 'received', 'pending', 'cancelled'];
      const periodParam = (req.query.period as string) || 'month';
      const statusParam = (req.query.status as string) || 'all';
      const spotIdParam = (req.query.spotId as string) || 'all';
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;

      if (!VALID_PERIODS.includes(periodParam)) {
        return res.status(400).json({ message: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}` });
      }
      const statusValues = statusParam.split(',').map(s => s.trim()).filter(Boolean);
      if (statusParam !== 'all' && !statusValues.every(s => VALID_STATUSES.includes(s))) {
        return res.status(400).json({ message: `Invalid status value(s). Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      if (periodParam === 'custom') {
        if (!startDateParam || !endDateParam) {
          return res.status(400).json({ message: 'Custom period requires startDate and endDate query params (YYYY-MM-DD)' });
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDateParam) || !dateRegex.test(endDateParam)) {
          return res.status(400).json({ message: 'startDate and endDate must be in YYYY-MM-DD format' });
        }
        if (startDateParam > endDateParam) {
          return res.status(400).json({ message: 'startDate must be on or before endDate' });
        }
      }

      // ---------- Resolve date range ----------
      let rangeStart: Date;
      let rangeEnd: Date = new Date(now);
      rangeEnd.setHours(23, 59, 59, 999);
      let periodLabel = 'This Month';

      if (periodParam === 'custom' && startDateParam && endDateParam) {
        rangeStart = new Date(startDateParam + 'T00:00:00');
        rangeEnd = new Date(endDateParam + 'T23:59:59');
        periodLabel = `${startDateParam} – ${endDateParam}`;
      } else if (periodParam === 'week') {
        const dow = now.getDay();
        const daysFromMon = (dow + 6) % 7;
        rangeStart = new Date(now); rangeStart.setDate(now.getDate() - daysFromMon); rangeStart.setHours(0,0,0,0);
        // End at Sunday (6 days after Monday start)
        rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 6); rangeEnd.setHours(23,59,59,999);
        periodLabel = 'This Week';
      } else if (periodParam === '3months') {
        rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        periodLabel = 'Last 3 Months';
      } else if (periodParam === '6months') {
        rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        periodLabel = 'Last 6 Months';
      } else if (periodParam === 'year') {
        rangeStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = 'This Year';
      } else if (periodParam === 'lastyear') {
        rangeStart = new Date(now.getFullYear() - 1, 0, 1);
        rangeEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        periodLabel = `${now.getFullYear() - 1}`;
      } else {
        // month (default)
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // End at last day of current month
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        periodLabel = 'This Month';
      }

      // Compute totalDaysInPeriod dynamically from actual range (handles leap years, variable month lengths)
      const totalDaysInPeriod = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1);

      const rangeStartStr = rangeStart.toISOString().split('T')[0];
      const rangeEndStr = rangeEnd.toISOString().split('T')[0];

      // ---------- Previous period (for period-over-period) ----------
      // prevRangeEnd is 1ms before rangeStart; prevRangeStart mirrors the same duration
      const periodMs = rangeEnd.getTime() - rangeStart.getTime();
      const prevRangeEnd = new Date(rangeStart.getTime() - 1);
      const prevRangeStart = new Date(rangeStart.getTime() - periodMs);
      const prevStartStr = prevRangeStart.toISOString().split('T')[0];
      const prevEndStr = prevRangeEnd.toISOString().split('T')[0];

      // ---------- Get owned spots ----------
      const allSpots = await storage.getAllParkingSpots();
      let ownedSpots = allSpots.filter(s => s.assignedUserId === userId || s.ownerId === userId);
      if (spotIdParam !== 'all') {
        ownedSpots = ownedSpots.filter(s => s.id === spotIdParam);
      }

      // Fetch all locations for name lookup
      const allLocations = await storage.getLocations();
      const locationById = new Map(allLocations.map(l => [l.id, l]));

      const getSpotLocationName = (spot: ParkingSpot): string => {
        if (spot.locationId) {
          const loc = locationById.get(spot.locationId);
          if (loc) return `${loc.office} – ${loc.building}`;
        }
        return spot.spotNumber || 'Unknown Location';
      };

      // Build ownedSpots meta for dropdown
      const ownedSpotsMeta = allSpots
        .filter(s => s.assignedUserId === userId || s.ownerId === userId)
        .map(s => ({ id: s.id, spotNumber: s.spotNumber, locationName: getSpotLocationName(s) }));

      // ---------- Status filter helper (supports comma-separated multi-select) ----------
      const selectedStatuses = statusParam === 'all' ? null : statusParam.split(',').map(s => s.trim()).filter(Boolean);
      const statusMatchesFilter = (booking: Booking): boolean => {
        if (!selectedStatuses || selectedStatuses.length === 0) return true;
        return selectedStatuses.some(s => {
          if (s === 'paid') return booking.paymentStatus === 'paid';
          if (s === 'received') return booking.paymentStatus === 'received';
          return booking.status === s;
        });
      };

      const isEarned = (booking: Booking) =>
        booking.paymentStatus === 'paid' || booking.paymentStatus === 'received';

      // ---------- Collect all bookings for owned spots (single fetch per spot) ----------
      // Load ALL bookings per spot once; derive period/upcoming/prevPeriod subsets in memory
      const allSpotBookingsMap: Map<string, Booking[]> = new Map();
      await Promise.all(ownedSpots.map(async spot => {
        const bkgs = await storage.getBookingsBySpot(spot.id);
        allSpotBookingsMap.set(spot.id, bkgs);
      }));

      const spotBookingsMap: Map<string, Booking[]> = new Map();
      for (const spot of ownedSpots) {
        const allBkgs = allSpotBookingsMap.get(spot.id) || [];
        const inPeriod = allBkgs.filter(b => {
          const d = b.bookingDate.toString();
          return d >= rangeStartStr && d <= rangeEndStr;
        });
        spotBookingsMap.set(spot.id, inPeriod);
      }

      const allPeriodBookings = Array.from(spotBookingsMap.values()).flat();
      const filteredBookings = allPeriodBookings.filter(statusMatchesFilter);

      // ---------- KPI calculations ----------
      const earnedBookings = filteredBookings.filter(isEarned);
      const totalIncome = earnedBookings.reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0);
      const totalBookings = filteredBookings.length;
      const cancelledCount = allPeriodBookings.filter(b => b.status === 'cancelled').length;
      const pendingCount = allPeriodBookings.filter(b => b.status === 'pending').length;

      // Occupancy: (confirmed + paid + received bookings) / (numSpots × totalDaysInPeriod) * 100
      const occupiedBookings = filteredBookings.filter(b =>
        b.status === 'confirmed' || b.paymentStatus === 'paid' || b.paymentStatus === 'received'
      );
      const occupancyRate = ownedSpots.length > 0
        ? Math.min(100, Math.round((occupiedBookings.length / (ownedSpots.length * totalDaysInPeriod)) * 10000) / 100)
        : 0;

      const avgBookingValue = earnedBookings.length > 0 ? totalIncome / earnedBookings.length : 0;

      // Upcoming revenue: confirmed bookings not yet paid/received, on future dates
      // Uses allSpotBookingsMap (already loaded above) — no additional DB calls needed
      let upcomingRevenue = 0;
      for (const spot of ownedSpots) {
        const bkgs = allSpotBookingsMap.get(spot.id) || [];
        upcomingRevenue += bkgs
          .filter(b => b.status === 'confirmed' && b.paymentStatus === 'pending' && b.bookingDate.toString() >= todayStr)
          .reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0);
      }

      // Lost revenue: sum of cancelled bookings in period
      const lostRevenue = allPeriodBookings
        .filter(b => b.status === 'cancelled')
        .reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0);

      // ---------- Income trend (with granularity logic) ----------
      type TrendBin = { label: string; earned: number; cancelled: number };
      const buildTrendBins = (bookings: Booking[], start: Date, end: Date): TrendBin[] => {
        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        const bins: TrendBin[] = [];

        if (diffDays <= 14) {
          // Daily
          for (let i = 0; i < diffDays; i++) {
            const d = new Date(start); d.setDate(start.getDate() + i);
            const dStr = d.toISOString().split('T')[0];
            const isFuture = dStr > todayStr;
            const dayBkgs = isFuture ? [] : bookings.filter(b => b.bookingDate.toString() === dStr);
            bins.push({
              label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              earned: isFuture ? 0 : Number(dayBkgs.filter(isEarned).reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2)),
              cancelled: isFuture ? 0 : Number(dayBkgs.filter(b => b.status === 'cancelled').reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2))
            });
          }
        } else if (diffDays <= 92) {
          // Weekly
          const weekStart = new Date(start);
          while (weekStart <= end) {
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            const wsStr = weekStart.toISOString().split('T')[0];
            const weStr = weekEnd.toISOString().split('T')[0];
            if (wsStr > todayStr) break;
            const weekBkgs = bookings.filter(b => { const d = b.bookingDate.toString(); return d >= wsStr && d <= weStr; });
            bins.push({
              label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              earned: Number(weekBkgs.filter(isEarned).reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2)),
              cancelled: Number(weekBkgs.filter(b => b.status === 'cancelled').reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2))
            });
            weekStart.setDate(weekStart.getDate() + 7);
          }
        } else {
          // Monthly
          const cur = new Date(start.getFullYear(), start.getMonth(), 1);
          while (cur <= end) {
            const mk = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
            if (mk > todayStr.substring(0,7)) break;
            const monthBkgs = bookings.filter(b => b.bookingDate.toString().startsWith(mk));
            bins.push({
              label: cur.toLocaleDateString('en-US', { month: 'short', year: diffDays > 365 ? '2-digit' : undefined }),
              earned: Number(monthBkgs.filter(isEarned).reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2)),
              cancelled: Number(monthBkgs.filter(b => b.status === 'cancelled').reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0).toFixed(2))
            });
            cur.setMonth(cur.getMonth() + 1);
          }
        }
        return bins;
      };

      // Use filteredBookings for all owner-side chart/table sections
      const incomeTrend = buildTrendBins(filteredBookings, rangeStart, rangeEnd);

      // Previous period bookings for trend comparison (also filtered by status)
      let prevPeriodTrend: TrendBin[] = [];
      {
        // Re-use allSpotBookingsMap — no additional DB calls
        const prevBookings: Booking[] = [];
        for (const spot of ownedSpots) {
          const bkgs = allSpotBookingsMap.get(spot.id) || [];
          const prevInPeriod = bkgs.filter(b => {
            const d = b.bookingDate.toString(); return d >= prevStartStr && d <= prevEndStr;
          });
          prevBookings.push(...prevInPeriod.filter(statusMatchesFilter));
        }
        prevPeriodTrend = buildTrendBins(prevBookings, prevRangeStart, prevRangeEnd);
      }

      // ---------- Status breakdown (uses filteredBookings for consistency) ----------
      const statusBreakdownMap = new Map<string, { count: number; amount: number }>();
      for (const s of ['paid', 'received', 'confirmed', 'pending', 'cancelled']) {
        statusBreakdownMap.set(s, { count: 0, amount: 0 });
      }
      for (const b of filteredBookings) {
        const rawKey = isEarned(b) ? b.paymentStatus : b.status;
        // Normalize 'completed' → 'confirmed' to keep breakdown aligned with UI filter taxonomy
        const key = rawKey === 'completed' ? 'confirmed' : (rawKey ?? 'pending');
        const entry = statusBreakdownMap.get(key) || { count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += parseFloat(b.totalAmount?.toString() || '0');
        statusBreakdownMap.set(key, entry);
      }
      const statusBreakdown = Array.from(statusBreakdownMap.entries())
        .filter(([, v]) => v.count > 0)
        .map(([s, v]) => ({ status: s, count: v.count, amount: Number(v.amount.toFixed(2)) }));

      // ---------- Day-of-week popularity (uses filteredBookings) ----------
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dowCounts = new Array(7).fill(0);
      for (const b of filteredBookings) {
        const d = new Date(b.bookingDate.toString() + 'T12:00:00');
        dowCounts[d.getDay()]++;
      }
      const dayOfWeekData = dayNames.map((day, i) => ({ day, shortDay: shortDayNames[i], bookings: dowCounts[i] }));

      // ---------- Per-spot performance (applies status filter per spot) ----------
      const spotPerformance = await Promise.all(ownedSpots.map(async spot => {
        const allSpotBkgs = spotBookingsMap.get(spot.id) || [];
        const bkgs = allSpotBkgs.filter(statusMatchesFilter);
        const allCancelled = allSpotBkgs.filter(b => b.status === 'cancelled');
        const earned = bkgs.filter(isEarned);
        // Occupancy includes confirmed + paid + received (consistent with overall occupancy)
        const spotOccupied = bkgs.filter(b =>
          b.status === 'confirmed' || b.paymentStatus === 'paid' || b.paymentStatus === 'received'
        );
        const income = earned.reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0);
        const occ = totalDaysInPeriod > 0 ? Math.min(100, Math.round((spotOccupied.length / totalDaysInPeriod) * 10000) / 100) : 0;
        return {
          spotId: spot.id,
          spotNumber: spot.spotNumber,
          locationName: getSpotLocationName(spot),
          totalBookings: bkgs.length,
          totalIncome: Number(income.toFixed(2)),
          occupancyRate: occ,
          avgBookingValue: earned.length > 0 ? Number((income / earned.length).toFixed(2)) : 0,
          cancellationRate: allSpotBkgs.length > 0 ? Math.round((allCancelled.length / allSpotBkgs.length) * 10000) / 100 : 0,
        };
      }));

      // ---------- Top renters (uses filteredBookings) ----------
      const renterStatsMap = new Map<string, { bookingCount: number; totalPaid: number }>();
      for (const b of filteredBookings) {
        if (!b.renterId) continue;
        const entry = renterStatsMap.get(b.renterId) || { bookingCount: 0, totalPaid: 0 };
        entry.bookingCount += 1;
        if (isEarned(b)) entry.totalPaid += parseFloat(b.totalAmount?.toString() || '0');
        renterStatsMap.set(b.renterId, entry);
      }
      const topRenterIds = Array.from(renterStatsMap.entries())
        .sort((a, b) => b[1].bookingCount - a[1].bookingCount)
        .slice(0, 5)
        .map(([id]) => id);
      const topRenters = await Promise.all(topRenterIds.map(async uid => {
        const u = await storage.getUser(uid);
        const stats = renterStatsMap.get(uid)!;
        return {
          userId: uid,
          name: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : uid,
          email: u?.email || '',
          bookingCount: stats.bookingCount,
          totalPaid: Number(stats.totalPaid.toFixed(2)),
        };
      }));

      // ---------- Filtered bookings list for CSV export ----------
      // Fetch renter names for CSV in batch
      const csvUserIds = [...new Set(filteredBookings.map(b => b.renterId).filter(Boolean))];
      const csvUsers = await Promise.all(csvUserIds.map(uid => storage.getUser(uid)));
      const csvUserMap = new Map(csvUsers.filter(Boolean).map(u => [u!.id, u!]));
      const spotMeta = new Map(ownedSpots.map(s => [s.id, s]));
      const filteredBookingsCSV = filteredBookings.map(b => {
        const u = csvUserMap.get(b.renterId);
        const s = spotMeta.get(b.spotId);
        return {
          bookingId: b.id,
          bookingDate: b.bookingDate.toString(),
          spotNumber: s?.spotNumber || b.spotId,
          locationName: s ? getSpotLocationName(s) : '',
          renterName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : (b.renterId || ''),
          renterEmail: u?.email || '',
          status: b.status,
          paymentStatus: b.paymentStatus,
          amount: Number(parseFloat(b.totalAmount?.toString() || '0').toFixed(2)),
        };
      });

      // ---------- Renter summary (same period, current user as renter) ----------
      const renterBkgs = await storage.getBookingsByRenter(userId);
      const renterPeriodBkgs = renterBkgs.filter(b => {
        const d = b.bookingDate.toString(); return d >= rangeStartStr && d <= rangeEndStr;
      });
      const renterEarned = renterPeriodBkgs.filter(b => b.paymentStatus === 'paid' || b.paymentStatus === 'received');
      const renterTotalSpent = renterEarned.reduce((t, b) => t + parseFloat(b.totalAmount?.toString() || '0'), 0);
      const renterSpendingTrend = buildTrendBins(renterPeriodBkgs, rangeStart, rangeEnd)
        .map(bin => ({ label: bin.label, spent: bin.earned }));

      const renterSummary = {
        totalSpent: Number(renterTotalSpent.toFixed(2)),
        bookingCount: renterPeriodBkgs.length,
        spendingTrend: renterSpendingTrend,
      };

      res.json({
        totalIncome: Number(totalIncome.toFixed(2)),
        totalBookings,
        cancelledCount,
        pendingCount,
        occupancyRate,
        avgBookingValue: Number(avgBookingValue.toFixed(2)),
        upcomingRevenue: Number(upcomingRevenue.toFixed(2)),
        lostRevenue: Number(lostRevenue.toFixed(2)),
        incomeTrend,
        prevPeriodTrend,
        statusBreakdown,
        dayOfWeekData,
        spotPerformance,
        topRenters,
        ownedSpots: ownedSpotsMeta,
        renterSummary,
        filteredBookingsCSV,
        periodLabel,
        totalDaysInPeriod,
        generatedAt: now.toISOString(),
      } as OwnerStatisticsV2Response);
    } catch (error) {
      console.error("Error fetching owner statistics v2:", error);
      res.status(500).json({ error: "Failed to fetch owner statistics" });
    }
  });

  // Owner sharing rank endpoint
  app.get("/api/owner/sharing-rank", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) return res.status(401).json({ error: "User not authenticated" });

      const callerUser = await storage.getUser(userId);
      const callerRoles: string[] = (callerUser?.roles ?? []);
      if (!callerRoles.includes('owner') && !callerRoles.includes('admin')) {
        return res.status(403).json({ error: "Owner role required" });
      }

      // Fetch all non-deleted listings, excluding listings owned by admins
      const allListings = await db
        .select({
          ownerId: spotListings.ownerId,
          listingType: spotListings.listingType,
          singleDate: spotListings.singleDate,
          periodStartDate: spotListings.periodStartDate,
          periodEndDate: spotListings.periodEndDate,
          recurringStartDate: spotListings.recurringStartDate,
          recurringEndDate: spotListings.recurringEndDate,
          daysOfWeek: spotListings.daysOfWeek,
          ownerRoles: users.roles,
        })
        .from(spotListings)
        .innerJoin(users, eq(spotListings.ownerId, users.id))
        .where(isNull(spotListings.deletedAt));

      // Compute total listed days per owner (skip admin-owned listings)
      const daysByOwner = new Map<string, number>();
      for (const listing of allListings) {
        const ownerRoles: string[] = (listing.ownerRoles as string[]) ?? [];
        if (ownerRoles.includes('admin')) continue;
        let days = 0;
        if (listing.listingType === 'single') {
          days = listing.singleDate ? 1 : 0;
        } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
          const start = new Date(listing.periodStartDate);
          const end = new Date(listing.periodEndDate);
          days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        } else if (listing.listingType === 'recurring') {
          const dayNameToNum: Record<string, number> = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
            'thursday': 4, 'friday': 5, 'saturday': 6
          };
          const numericDays = listing.daysOfWeek
            ? (listing.daysOfWeek as string[]).map(d => {
                const lower = String(d).toLowerCase();
                return lower in dayNameToNum ? dayNameToNum[lower] : parseInt(d, 10);
              }).filter(n => !isNaN(n))
            : null;
          days = getListingDates({
            listingType: listing.listingType,
            recurringStartDate: listing.recurringStartDate,
            recurringEndDate: listing.recurringEndDate,
            daysOfWeek: numericDays,
          }).length;
        }
        daysByOwner.set(listing.ownerId, (daysByOwner.get(listing.ownerId) ?? 0) + days);
      }

      // Sort owners by total days descending
      const ranked = Array.from(daysByOwner.entries())
        .filter(([, days]) => days > 0)
        .sort(([, a], [, b]) => b - a);

      const totalOwners = ranked.length;
      const userIndex = ranked.findIndex(([ownerId]) => ownerId === userId);
      const rank = userIndex >= 0 ? userIndex + 1 : null;
      const totalListedDays = daysByOwner.get(userId) ?? 0;

      res.json({ rank, totalOwners, totalListedDays } as import('@shared/schema').OwnerSharingRank);
    } catch (error) {
      console.error("Error fetching owner sharing rank:", error);
      res.status(500).json({ error: "Failed to fetch sharing rank" });
    }
  });

  // Renter booking rank endpoint
  app.get("/api/renter/booking-rank", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) return res.status(401).json({ error: "User not authenticated" });

      // Count non-cancelled bookings per renter across all time
      const result = await db.execute(sql`
        SELECT renter_id, COUNT(*)::int AS booking_count
        FROM bookings
        WHERE status IN ('confirmed', 'completed', 'paid', 'received')
        GROUP BY renter_id
        ORDER BY booking_count DESC
      `);

      const rows = result.rows as { renter_id: string; booking_count: number }[];

      const userIndex = rows.findIndex(r => r.renter_id === userId);
      const rank = userIndex >= 0 ? userIndex + 1 : null;
      const totalBookings = userIndex >= 0 ? Number(rows[userIndex].booking_count) : 0;

      res.json({ rank, totalBookings } as import('@shared/schema').RenterBookingRank);
    } catch (error) {
      console.error("Error fetching renter booking rank:", error);
      res.status(500).json({ error: "Failed to fetch booking rank" });
    }
  });

  // Analytics API endpoints (Admin only)
  app.get("/api/admin/analytics-overview", requireAdmin, async (req, res) => {
    try {
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      // Extract date range parameters
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;
      
      const overview = await storage.getAnalyticsOverview(scope, fromDate, toDate);
      const now = new Date();
      const todayStr = await getTodayInTimezone();
      
      res.json({
        ...overview,
        generatedAt: now.toISOString(),
        dateContext: {
          today: todayStr,
          currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
      });
    } catch (error) {
      console.error("Error fetching analytics overview:", error);
      res.status(500).json({ error: "Failed to fetch analytics overview" });
    }
  });

  app.get("/api/admin/analytics-revenue", requireAdmin, async (req, res) => {
    try {
      const monthsBack = req.query.monthsBack ? parseInt(req.query.monthsBack as string) : 12;
      
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      const [monthlyData, revenueBreakdown] = await Promise.all([
        storage.getMonthlyRevenueData(monthsBack, scope),
        storage.getRevenueBreakdown(scope)
      ]);
      
      res.json({
        monthlyData,
        revenueBreakdown,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching analytics revenue:", error);
      res.status(500).json({ error: "Failed to fetch analytics revenue" });
    }
  });

  app.get("/api/admin/analytics-top-performers", requireAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      const [topSpots, topOwners] = await Promise.all([
        storage.getTopPerformingSpots(limit, scope),
        storage.getTopEarningOwners(limit, scope)
      ]);
      
      res.json({
        topSpots,
        topOwners,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching analytics top performers:", error);
      res.status(500).json({ error: "Failed to fetch analytics top performers" });
    }
  });

  app.get("/api/admin/analytics-issues", requireAdmin, async (req, res) => {
    try {
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      const activeIssues = await storage.getActiveIssues(scope);
      
      // Calculate issues summary
      const issuesSummary = {
        critical: activeIssues.filter(issue => issue.priority === 'critical').length,
        high: activeIssues.filter(issue => issue.priority === 'high').length,
        medium: activeIssues.filter(issue => issue.priority === 'medium').length,
        low: activeIssues.filter(issue => issue.priority === 'low').length,
        total: activeIssues.length
      };
      
      res.json({
        activeIssues,
        issuesSummary,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching analytics issues:", error);
      res.status(500).json({ error: "Failed to fetch analytics issues" });
    }
  });

  app.get("/api/admin/analytics-usage", requireAdmin, async (req, res) => {
    try {
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      const [bookingDuration, locationPerformance, weeklyTrends] = await Promise.all([
        storage.getBookingDurationData(scope),
        storage.getLocationPerformanceData(scope),
        storage.getWeeklyTrendsData(scope)
      ]);
      
      res.json({
        bookingDuration,
        locationPerformance,
        weeklyTrends,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching analytics usage:", error);
      res.status(500).json({ error: "Failed to fetch analytics usage" });
    }
  });

  app.get("/api/admin/user-analytics", requireAdmin, async (req, res) => {
    try {
      const userAnalytics = await storage.getUserAnalytics();
      
      res.json({
        ...userAnalytics,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      res.status(500).json({ error: "Failed to fetch user analytics" });
    }
  });

  // Get all parking spots (allocated + unallocated) for admin overview (Admin only)
  app.get("/api/admin/all-spots", requireAdmin, async (req, res) => {
    try {
      const allSpots = await storage.getAllParkingSpotsWithUser();
      
      // Disable caching for admin data to prevent stale UI
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(allSpots);
    } catch (error) {
      console.error("Error fetching all spots:", error);
      res.status(500).json({ error: "Failed to fetch all spots" });
    }
  });

  // Get recent bookings (last 7 days) for admin dashboard (Admin only)
  app.get("/api/admin/recent-bookings", requireAdmin, async (req, res) => {
    try {
      // Get all bookings
      const allBookings = await storage.getAllBookings();
      
      // Filter for recent bookings (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentBookings = allBookings.filter(booking => {
        const bookingCreated = booking.createdAt ? new Date(booking.createdAt) : new Date(booking.bookingDate);
        return bookingCreated >= sevenDaysAgo;
      });
      
      res.json(recentBookings);
    } catch (error) {
      console.error("Error fetching recent bookings:", error);
      res.status(500).json({ error: "Failed to fetch recent bookings" });
    }
  });

  // Get available spot listings for booking management (Admin only)
  app.get("/api/admin/booking-availability", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const availability = await storage.getBookingAvailability(isBciOnly);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching booking availability:", error);
      res.status(500).json({ error: "Failed to fetch booking availability" });
    }
  });

  // Get bookings with pending payments (Admin only)
  app.get("/api/admin/pending-payments", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const pendingPayments = await storage.getPendingPaymentBookings(isBciOnly);
      res.json(pendingPayments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  });

  // Get active bookings (confirmed/pending, future dates) with server-side pagination (Admin only)
  app.get("/api/admin/active-bookings", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const validPage = Math.max(1, page);
      const validLimit = Math.min(100, Math.max(1, limit));

      const filters = {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        location: req.query.location as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        role: req.query.role as string | undefined,
      };

      const result = await storage.getActiveBookings(isBciOnly, validPage, validLimit, filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching active bookings:", error);
      res.status(500).json({ error: "Failed to fetch active bookings" });
    }
  });

  // Get past bookings (completed/cancelled or past dates) with server-side pagination (Admin only)
  app.get("/api/admin/past-bookings", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const payrollPeriod = req.query.payrollPeriod as string | undefined;
      
      // Validate pagination params
      const validPage = Math.max(1, page);
      const validLimit = Math.min(100, Math.max(1, limit)); // Max 100 per page
      
      const result = await storage.getPastBookings(isBciOnly, validPage, validLimit, payrollPeriod);
      res.json(result);
    } catch (error) {
      console.error("Error fetching past bookings:", error);
      res.status(500).json({ error: "Failed to fetch past bookings" });
    }
  });

  // Get BCI payroll summary for admin - shows bookings grouped by calendar month
  app.get("/api/admin/payroll-summary", requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentPeriod = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      // Get BCI bookings for current calendar month only (1st to last day of month)
      const periodStartStr = `${currentPeriod}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const periodEndStr = `${currentPeriod}-${String(lastDay).padStart(2, '0')}`;
      
      // Get all spots, listings to identify true Workplace Services spots
      // Workplace Services spots = BCI-managed AND no owner (ownerId is null)
      const allSpots = await storage.getAllParkingSpots();
      const allListings = await storage.getAllSpotListings();
      
      // True Workplace Services spots: BCI-managed AND no owner
      const workplaceServicesSpotIds = new Set(
        allSpots.filter(s => s.isBciManaged === true && s.ownerId === null).map(s => s.id)
      );
      
      // Get listing IDs for Workplace Services spots only
      const workplaceServicesListingIds = new Set(
        allListings.filter(l => workplaceServicesSpotIds.has(l.spotId)).map(l => l.id)
      );
      
      // Get all bookings for Workplace Services spots only
      // Include excluded bookings so they can be shown with "Removed" status
      const allBookings = await storage.getAllBookings();
      const bciBookings = allBookings.filter(b => {
        // Only include bookings for Workplace Services spots (BCI-managed with no owner)
        if (!workplaceServicesListingIds.has(b.listingId)) return false;
        if (b.status !== 'confirmed' && b.status !== 'completed') return false;
        // No longer skip excluded bookings - we want to show them as "Removed"
        
        // Check if booking falls into current calendar month
        return b.bookingDate >= periodStartStr && b.bookingDate <= periodEndStr;
      });
      
      // Calculate deduction month for each booking
      const bookingsWithDeduction = await Promise.all(bciBookings.map(async (booking) => {
        const spot = await storage.getParkingSpot(booking.spotId);
        const spotType = spot?.spotTypeId ? await storage.getSpotType(spot.spotTypeId) : null;
        const location = spot?.locationId ? await storage.getLocation(spot.locationId) : null;
        const renter = await storage.getUser(booking.renterId);
        const listing = await storage.getSpotListing(booking.listingId);
        
        // Build location name from office, building, level
        const locationName = location 
          ? `${location.office} - ${location.building} ${location.level}`.trim() 
          : "Unknown";
        
        // Deduction period = calendar month of the booking date
        const bookingDate = new Date(booking.bookingDate + "T12:00:00");
        const deductionMonth = bookingDate.getMonth();
        const deductionYear = bookingDate.getFullYear();
        
        return {
          id: booking.id,
          spotNumber: spot?.spotNumber || "Unknown",
          spotLocation: locationName,
          spotType: spotType?.name || "Unknown",
          renterName: renter ? `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || renter.email : "Unknown",
          renterEmail: renter?.email || "",
          renterDepartment: renter?.departmentId 
            ? (await storage.getDepartment(renter.departmentId))?.name || "" 
            : "",
          bookingDate: booking.bookingDate,
          dailyRate: parseFloat(booking.dailyRate),
          totalAmount: parseFloat(booking.totalAmount),
          status: booking.status,
          deductionMonth,
          deductionYear,
          deductionPeriod: `${deductionYear}-${String(deductionMonth + 1).padStart(2, '0')}`,
          createdAt: booking.createdAt,
          excludedFromPayroll: booking.excludedFromPayroll || false,
          donateToCharity: listing?.donateToCharity || false
        };
      }));
      
      // Group by deduction period
      const groupedByPeriod: Record<string, typeof bookingsWithDeduction> = {};
      bookingsWithDeduction.forEach(booking => {
        if (!groupedByPeriod[booking.deductionPeriod]) {
          groupedByPeriod[booking.deductionPeriod] = [];
        }
        groupedByPeriod[booking.deductionPeriod].push(booking);
      });
      
      // Sort each group by booking date
      Object.values(groupedByPeriod).forEach(group => {
        group.sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
      });
      
      // Calculate totals for each period
      const periodSummaries = Object.entries(groupedByPeriod)
        .map(([period, bookings]) => ({
          period,
          periodLabel: new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalBookings: bookings.length,
          totalAmount: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
          confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
          completedBookings: bookings.filter(b => b.status === 'completed').length,
          bookings
        }))
        .sort((a, b) => b.period.localeCompare(a.period)); // Most recent first
      
      res.json({
        currentPeriod,
        periods: periodSummaries
      });
    } catch (error) {
      console.error("Error fetching payroll summary:", error);
      res.status(500).json({ error: "Failed to fetch payroll summary" });
    }
  });

  // Get available payroll periods for History tab filter (Admin only)
  app.get("/api/admin/payroll-periods", requireAdmin, async (req, res) => {
    try {
      // Get all spots, listings to identify true Workplace Services spots
      // Workplace Services spots = BCI-managed AND no owner (ownerId is null)
      const allSpots = await storage.getAllParkingSpots();
      const allListings = await storage.getAllSpotListings();
      
      // True Workplace Services spots: BCI-managed AND no owner
      const workplaceServicesSpotIds = new Set(
        allSpots.filter(s => s.isBciManaged === true && s.ownerId === null).map(s => s.id)
      );
      
      // Get listing IDs for Workplace Services spots only
      const workplaceServicesListingIds = new Set(
        allListings.filter(l => workplaceServicesSpotIds.has(l.spotId)).map(l => l.id)
      );
      
      // Get all completed bookings for Workplace Services spots only
      const allBookings = await storage.getAllBookings();
      const bciBookings = allBookings.filter(b => 
        workplaceServicesListingIds.has(b.listingId) && 
        (b.status === 'completed' || b.status === 'confirmed' || b.status === 'cancelled')
      );
      
      // Deduction period = calendar month of the booking date
      const periodsSet = new Set<string>();
      bciBookings.forEach(booking => {
        const bookingDate = new Date(booking.bookingDate + "T12:00:00");
        periodsSet.add(`${bookingDate.getFullYear()}-${String(bookingDate.getMonth() + 1).padStart(2, '0')}`);
      });
      
      // Convert to sorted array with labels
      const periods = Array.from(periodsSet)
        .sort((a, b) => b.localeCompare(a)) // Most recent first
        .map(period => ({
          value: period,
          label: new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]) - 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }));
      
      res.json({ periods });
    } catch (error) {
      console.error("Error fetching payroll periods:", error);
      res.status(500).json({ error: "Failed to fetch payroll periods" });
    }
  });

  // Toggle payroll exclusion for a booking (Admin only)
  app.patch("/api/admin/bookings/:bookingId/payroll-exclusion", requireAdmin, async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { excluded } = req.body;
      
      if (typeof excluded !== 'boolean') {
        return res.status(400).json({ error: "excluded must be a boolean" });
      }
      
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Update the booking's excludedFromPayroll flag
      const updated = await storage.updateBooking(bookingId, { 
        excludedFromPayroll: excluded 
      });
      
      // Log audit trail
      const adminUser = (req as any).user;
      await storage.createAuditLog({
        correlationId: randomUUID(),
        action: 'UPDATE',
        entityType: 'booking',
        entityId: bookingId,
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.roles?.[0] || 'admin',
        success: true,
        message: excluded 
          ? `Booking ${bookingId} removed from payroll by ${adminUser.email}` 
          : `Booking ${bookingId} restored to payroll by ${adminUser.email}`,
        requestMeta: {
          ip: req.ip || 'unknown',
          method: req.method,
          path: req.path,
          userAgent: req.headers['user-agent'] || 'unknown'
        },
        before: { excludedFromPayroll: !excluded },
        after: { excludedFromPayroll: excluded }
      });
      
      res.json({ 
        success: true, 
        excluded,
        message: excluded 
          ? "Booking removed from payroll summary" 
          : "Booking restored to payroll summary"
      });
    } catch (error) {
      console.error("Error toggling payroll exclusion:", error);
      res.status(500).json({ error: "Failed to update payroll exclusion" });
    }
  });

  // Get booking analytics (Admin only)
  app.get("/api/admin/booking-analytics", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      
      // Fetch data with scope filtering
      const activeBookingsResult = await storage.getActiveBookings(isBciOnly);
      const activeBookings = activeBookingsResult.data;
      const pendingPayments = await storage.getPendingPaymentBookings(isBciOnly);
      const allBookings = await storage.getAllBookings();
      
      // Filter all bookings by BCI if needed
      const filteredBookings = isBciOnly 
        ? await Promise.all(
            allBookings.map(async (booking) => {
              const spot = await storage.getParkingSpot(booking.spotId);
              return spot?.isBciManaged ? booking : null;
            })
          ).then(results => results.filter(b => b !== null))
        : allBookings;
      
      // Get today's date for filtering
      const todayStr = await getTodayInTimezone();
      
      // Calculate this week's start date (Monday)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const thisWeekStartStr = await formatDateInTimezone(thisWeekStart);
      
      // Calculate analytics
      const totalActiveBookings = activeBookings.length;
      const pendingRequests = pendingPayments.length;
      
      // Today's bookings
      const todayBookings = filteredBookings.filter(b => b.bookingDate === todayStr).length;
      
      // This week's bookings
      const thisWeekBookings = filteredBookings.filter(b => b.bookingDate >= thisWeekStartStr).length;
      
      // Total daily revenue (from today's bookings)
      const totalDailyRevenue = filteredBookings
        .filter(b => b.bookingDate === todayStr)
        .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
      
      // Average booking value
      const averageBookingValue = filteredBookings.length > 0
        ? filteredBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0) / filteredBookings.length
        : 0;
      
      // Occupancy rate - calculate based on BCI spots if filtered
      const allSpots = await storage.getAllParkingSpots();
      const totalBookableSpots = isBciOnly
        ? allSpots.filter(s => s.isBookable && s.isBciManaged).length
        : allSpots.filter(s => s.isBookable).length;
      
      const occupancyRate = totalBookableSpots > 0
        ? (activeBookings.length / totalBookableSpots) * 100
        : 0;
      
      // Get pending disputes (open or investigating)
      const allDisputes = await storage.getDisputes({});
      const pendingDisputes = allDisputes.filter(d => d.status === 'open' || d.status === 'investigating').length;
      
      // Popular spots - top 5 by booking count
      const spotBookingCounts = new Map<string, { count: number; spotNumber: string }>();
      for (const booking of filteredBookings) {
        const spot = await storage.getParkingSpot(booking.spotId);
        if (spot) {
          const current = spotBookingCounts.get(booking.spotId) || { count: 0, spotNumber: spot.spotNumber };
          spotBookingCounts.set(booking.spotId, { count: current.count + 1, spotNumber: spot.spotNumber });
        }
      }
      
      const popularSpots = Array.from(spotBookingCounts.entries())
        .map(([id, data]) => ({ id, spotNumber: data.spotNumber, bookings: data.count }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5);
      
      // User activity - count active renters and owners from enriched bookings
      const activeRenterIds = new Set(activeBookings.map(b => b.renterEmail).filter(Boolean));
      const activeOwnerIds = new Set(activeBookings.map(b => b.ownerEmail).filter(Boolean));
      
      // New signups in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const allUsers = await storage.getAllUsers();
      const newSignups = allUsers.filter(u => {
        const createdAt = u.createdAt ? new Date(u.createdAt) : null;
        return createdAt && createdAt >= sevenDaysAgo;
      }).length;
      
      const analytics = {
        totalActiveBookings,
        totalDailyRevenue,
        pendingRequests,
        pendingDisputes,
        averageBookingValue,
        occupancyRate,
        todayBookings,
        thisWeekBookings,
        popularSpots,
        userActivity: {
          activeRenters: activeRenterIds.size,
          activeOwners: activeOwnerIds.size,
          newSignups
        }
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching booking analytics:", error);
      res.status(500).json({ error: "Failed to fetch booking analytics" });
    }
  });

  // Update booking payment status (Admin only)
  app.patch("/api/admin/bookings/:id/payment", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentStatus } = req.body;
      
      // Verify booking exists
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Validate paymentStatus value
      if (!paymentStatus || !['pending', 'paid', 'received'].includes(paymentStatus)) {
        return res.status(400).json({ error: "paymentStatus must be one of: pending, paid, received" });
      }

      // Get current payment status (default to 'pending' if not set)
      const currentStatus = booking.paymentStatus || 'pending';

      // Admin can update to any status, but typically marks paid → received
      const updatedBooking = await storage.updatePaymentStatus(id, paymentStatus as PaymentStatus);
      
      if (!updatedBooking) {
        return res.status(500).json({ error: "Failed to update payment status" });
      }

      // Audit the payment status update
      await auditService.logAction("UPDATE", "booking", {
        entityId: updatedBooking.id,
        message: `Admin updated payment status from ${currentStatus} to ${paymentStatus}`,
        before: { ...booking, paymentStatus: currentStatus },
        after: { ...updatedBooking, paymentStatus: updatedBooking.paymentStatus }
      });

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });

  // POST /api/admin/bookings/:id/contact - Send email to booking participants (Admin only)
  app.post("/api/admin/bookings/:id/contact", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { message, recipients } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "At least one recipient is required" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const spot = await storage.getParkingSpot(booking.spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }

      const adminUserId = req.user.claims.sub;
      const adminUser = await storage.getUser(adminUserId);
      const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

      const renter = await storage.getUser(booking.renterId);
      const owner = spot.ownerId ? await storage.getUser(spot.ownerId) : null;

      const bookingDate = booking.bookingDate || 'N/A';
      const spotNumber = spot.spotNumber || 'N/A';

      const subject = 'BCI ParkShare - Message from Admin regarding Booking';

      const textBody = (recipientName: string) => `Dear ${recipientName},

You have received a message from ${adminName} regarding your parking booking.

MESSAGE:
${message.trim()}

BOOKING DETAILS:
- Booking ID: ${id}
- Spot Number: ${spotNumber}
- Booking Date: ${bookingDate}

If you have any questions, please contact Workplace Services.

Warm regards,
The BCI ParkShare Team`;

      const htmlBody = (recipientName: string) => {
        const content = `
          <p>Dear ${recipientName},</p>
          <p>You have received a message from <strong>${adminName}</strong> regarding your parking booking.</p>
          
          <div class="info-card" style="background-color: #f8fafc; border-radius: 8px; padding: 20px 24px; margin: 24px 0; border-left: 4px solid #1e9df1;">
            <h3 style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 12px 0;">Message</h3>
            <p style="font-size: 15px; color: #374151; white-space: pre-wrap; margin: 0;">${message.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</p>
          </div>
          
          <div class="info-card" style="background-color: #f8fafc; border-radius: 8px; padding: 20px 24px; margin: 24px 0; border-left: 4px solid #1e9df1;">
            <h3 style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 12px 0;">Booking Details</h3>
            <ul style="margin: 0; padding: 0; list-style: none;">
              <li style="padding: 6px 0; font-size: 15px; color: #475569;"><strong style="color: #1e293b;">Booking ID:</strong> ${id}</li>
              <li style="padding: 6px 0; font-size: 15px; color: #475569;"><strong style="color: #1e293b;">Spot Number:</strong> ${spotNumber}</li>
              <li style="padding: 6px 0; font-size: 15px; color: #475569;"><strong style="color: #1e293b;">Booking Date:</strong> ${bookingDate}</li>
            </ul>
          </div>
          
          <p>If you have any questions, please contact Workplace Services.</p>
        `;
        return wrapEmailTemplate({
          title: 'Message from Admin',
          content,
          theme: 'primary'
        });
      };

      let emailsSent = 0;

      if (recipients.includes('renter') && renter?.email) {
        const renterName = `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || 'User';
        const notification: EmailNotification = {
          to: renter.email,
          cc: [WORKPLACE_SERVICES_EMAIL],
          subject,
          text: textBody(renterName),
          html: htmlBody(renterName),
          type: 'general'
        };
        const result = await sendEmailNotification(notification);
        if (result.success) emailsSent++;
      }

      if (recipients.includes('owner') && owner?.email) {
        const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'User';
        const notification: EmailNotification = {
          to: owner.email,
          cc: [WORKPLACE_SERVICES_EMAIL],
          subject,
          text: textBody(ownerName),
          html: htmlBody(ownerName),
          type: 'general'
        };
        const result = await sendEmailNotification(notification);
        if (result.success) emailsSent++;
      }

      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Admin sent contact email to ${recipients.join(', ')} regarding booking ${id}`,
        after: { recipients, emailsSent }
      });

      res.json({ success: true, emailsSent });
    } catch (error) {
      console.error("Error sending contact email:", error);
      res.status(500).json({ error: "Failed to send contact email" });
    }
  });

  // GET /api/admin/spot-listings - List all spot listings with filters (Admin only)
  app.get("/api/admin/spot-listings", requireAdmin, async (req, res) => {
    try {
      const listings = await storage.getAllSpotListings();
      res.json(listings);
    } catch (error) {
      console.error("Error fetching spot listings:", error);
      res.status(500).json({ error: "Failed to fetch spot listings" });
    }
  });

  // PATCH /api/admin/spot-listings/:id - Update listing (Admin only)
  app.patch("/api/admin/spot-listings/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const listing = await storage.getSpotListing(id);
      if (!listing) {
        return res.status(404).json({ error: "Spot listing not found" });
      }

      const updatedListing = await storage.updateSpotListing(id, updates);
      
      await auditService.logAction("UPDATE", "spot_listing", {
        entityId: id,
        message: `Spot listing ${id} updated by admin`,
        before: listing,
        after: updatedListing
      });

      res.json(updatedListing);
    } catch (error) {
      console.error("Error updating spot listing:", error);
      res.status(500).json({ error: "Failed to update spot listing" });
    }
  });

  // POST /api/admin/spot-listings/:id/cancel - Cancel listing (Admin only)
  app.post("/api/admin/spot-listings/:id/cancel", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: "Cancellation reason is required" });
      }

      const listing = await storage.getSpotListing(id);
      if (!listing) {
        return res.status(404).json({ error: "Spot listing not found" });
      }

      const cancelledListing = await storage.cancelSpotListing(id, reason);
      
      await auditService.logAction("CANCEL", "spot_listing", {
        entityId: id,
        message: `Spot listing ${id} cancelled by admin: ${reason}`,
        before: listing,
        after: cancelledListing
      });

      // Cancel associated bookings and notify renters
      try {
        const listingBookings = await storage.getBookingsByListing(id);
        const activeBookings = listingBookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
        
        if (activeBookings.length > 0) {
          const spot = await storage.getParkingSpot(listing.spotId);
          const location = spot ? await storage.getLocation(spot.locationId) : null;
          const locationName = location ? `${location.office} - ${location.level}` : 'Unknown';
          const buildingName = location?.building || 'Unknown';
          
          for (const booking of activeBookings) {
            await storage.cancelBookingWithReason(booking.id, `Listing cancelled: ${reason}`);
            
            // Send cancellation notification to renter
            setImmediate(async () => {
              try {
                const renter = await storage.getUser(booking.renterId);
                if (renter && renter.email) {
                  const renterName = renter.firstName && renter.lastName
                    ? `${renter.firstName} ${renter.lastName}`
                    : renter.firstName || renter.lastName || renter.email || 'User';
                  
                  const isWsListing = listing.createdByAdmin === true;
                  let ownerInfo: { name: string; email: string; id: string } | null = null;
                  if (isWsListing) {
                    ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
                  } else if (listing.ownerId) {
                    const owner = await storage.getUser(listing.ownerId);
                    if (owner && owner.email) {
                      const ownerName = owner.firstName && owner.lastName
                        ? `${owner.firstName} ${owner.lastName}`
                        : owner.firstName || owner.lastName || owner.email || 'Owner';
                      ownerInfo = { name: ownerName, email: owner.email, id: owner.id };
                    }
                  }
                  
                  const renterPrefs = await storage.getNotificationPreferences(renter.id);
                  await sendBookingCancellationNotification(
                    { name: renterName, email: renter.email, id: renter.id },
                    {
                      id: booking.id,
                      spotNumber: spot?.spotNumber || 'Unknown',
                      location: locationName,
                      building: buildingName,
                      bookingDate: booking.bookingDate,
                      cancelledBy: 'Admin',
                      isWorkplaceServicesListing: isWsListing,
                      reason: reason
                    },
                    renterPrefs || {},
                    ownerInfo
                  );
                }
              } catch (notifyError) {
                console.error(`Failed to send cancellation notification for booking ${booking.id}:`, notifyError);
              }
            });
          }
          console.log(`[Cancel Listing] Cancelled ${activeBookings.length} bookings for listing ${id}`);
        }
      } catch (bookingCancelError) {
        console.error('[Cancel Listing] Error cancelling associated bookings:', bookingCancelError);
      }

      res.json(cancelledListing);
    } catch (error) {
      console.error("Error cancelling spot listing:", error);
      res.status(500).json({ error: "Failed to cancel spot listing" });
    }
  });

  // GET /api/admin/bookings/by-date - Get all bookings for a specific date with joined details (Admin only)
  app.get("/api/admin/bookings/by-date", requireAdmin, async (req, res) => {
    try {
      const { date, scope } = req.query;
      if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "date parameter is required in YYYY-MM-DD format" });
      }

      // Build where conditions — match the same statuses the occupancy chart counts
      const conditions: any[] = [
        eq(bookings.bookingDate, date),
        inArray(bookings.status, ["confirmed", "pending", "completed"]),
      ];
      // When scope=bci, restrict to BCI-managed spots only (mirrors getReportUtilization scope logic)
      if (scope === 'bci') {
        conditions.push(eq(parkingSpots.isBciManaged, true));
      }

      const rows = await db
        .select({
          id: bookings.id,
          renterFirstName: users.firstName,
          renterLastName: users.lastName,
          renterEmail: users.email,
          spotNumber: parkingSpots.spotNumber,
          locationOffice: locations.office,
          locationBuilding: locations.building,
          locationLevel: locations.level,
          status: bookings.status,
        })
        .from(bookings)
        .leftJoin(users, eq(bookings.renterId, users.id))
        .leftJoin(parkingSpots, eq(bookings.spotId, parkingSpots.id))
        .leftJoin(locations, eq(parkingSpots.locationId, locations.id))
        .where(and(...conditions));

      const result = rows.map((row) => ({
        id: row.id,
        renterName:
          row.renterFirstName && row.renterLastName
            ? `${row.renterFirstName} ${row.renterLastName}`
            : row.renterFirstName || row.renterLastName || row.renterEmail || 'Unknown',
        spotNumber: row.spotNumber || 'N/A',
        locationName:
          [row.locationOffice, row.locationBuilding, row.locationLevel]
            .filter(Boolean)
            .join(' — ') || 'N/A',
        status: row.status,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching bookings by date:", error);
      res.status(500).json({ error: "Failed to fetch bookings for date" });
    }
  });

  // GET /api/admin/bookings/all - Enhanced booking list with all filters (Admin only)
  app.get("/api/admin/bookings/all", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching all bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // PATCH /api/admin/bookings/:id - Update booking (Admin only)
  app.patch("/api/admin/bookings/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const updatedBooking = await storage.updateBooking(id, updates);
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Booking ${id} updated by admin`,
        before: booking,
        after: updatedBooking
      });

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  // POST /api/bookings/:id/cancel - Cancel booking (Renter only)
  app.post("/api/bookings/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking belongs to the user (as renter)
      if (booking.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to cancel this booking" });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }

      const cancellationWindowConfig = await storage.getAppConfigValue('cancellation_window_hours');
      const cancellationWindowHours = cancellationWindowConfig ? Number(cancellationWindowConfig) : 24;

      const bookingDate = new Date(booking.bookingDate + 'T00:00:00');
      const now = new Date();
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilBooking < cancellationWindowHours) {
        return res.status(400).json({ 
          error: `Cancellations must be made at least ${cancellationWindowHours} hours before the booking date. Please contact support if you need assistance.` 
        });
      }

      const cancelledBooking = await storage.cancelBookingWithReason(id, "Cancelled by renter");
      
      if (booking.listingId) {
        const listingToRelease = await storage.getSpotListing(booking.listingId);
        // If this is a split listing (originalListingType is set), the parent period/recurring
        // listing is already gone, so soft-delete this orphaned split listing to prevent ghost entries.
        if (listingToRelease?.originalListingType) {
          await storage.cancelSpotListing(booking.listingId, "Cancelled by renter");
          await storage.deleteSpotListing(booking.listingId);
          console.log(`[Cancel Booking] Soft-deleted orphaned split listing ${booking.listingId} (originalListingType=${listingToRelease.originalListingType})`);
        } else {
          await storage.updateSpotListingStatus(booking.listingId, 'available');
          console.log(`[Cancel Booking] Updated listing ${booking.listingId} status back to 'available'`);
        }
      }
      
      await auditService.logAction("CANCEL", "booking", {
        entityId: id,
        message: `Booking ${id} cancelled by renter`,
        before: booking,
        after: cancelledBooking
      });

      // Send cancellation notification (fire-and-forget)
      setImmediate(async () => {
        try {
          const renter = await storage.getUser(booking.renterId);
          const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
          const spot = await storage.getParkingSpot(booking.spotId);
          
          if (renter && spot) {
            const renterName = renter.firstName && renter.lastName 
              ? `${renter.firstName} ${renter.lastName}`
              : renter.firstName || renter.lastName || renter.email || 'User';
            
            const spotLocation = spot.locationId ? await storage.getLocation(spot.locationId) : null;
            const renterDisplayName = renterName;
            const isWorkplaceServicesListing = listing?.createdByAdmin === true;
            const bookingDetails = {
              id: booking.id,
              spotNumber: spot.spotNumber,
              location: spotLocation?.office || 'BCI Campus',
              building: spotLocation?.building || 'BCI Campus',
              bookingDate: booking.bookingDate,
              cancelledBy: renterDisplayName,
              cancelledByRole: 'renter' as const,
              isWorkplaceServicesListing,
              reason: 'Cancelled by renter'
            };
            
            // Get owner info - route to WPS for admin-created listings
            let ownerInfo: { name: string; email: string; id: string } | null = null;
            if (isWorkplaceServicesListing) {
              ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (listing?.ownerId) {
              const owner = await storage.getUser(listing.ownerId);
              if (owner && owner.email) {
                const ownerName = owner.firstName && owner.lastName 
                  ? `${owner.firstName} ${owner.lastName}`
                  : owner.firstName || owner.lastName || owner.email || 'Owner';
                ownerInfo = { name: ownerName, email: owner.email, id: owner.id };
              }
            }
            
            const renterPrefs = await storage.getNotificationPreferences(renter.id);
            await sendBookingCancellationNotification(
              { name: renterName, email: renter.email || '', id: renter.id },
              bookingDetails,
              renterPrefs || {},
              ownerInfo
            );
          }
        } catch (notifyError) {
          console.error('Failed to send cancellation notification:', notifyError);
        }
      });

      res.json(cancelledBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // POST /api/bookings/:id/owner-cancel - Cancel booking (Owner only)
  app.post("/api/bookings/:id/owner-cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if user is the owner of this booking's spot
      if (booking.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to cancel this booking. Only the spot owner can use this action." });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }

      const bookingDate = new Date(booking.bookingDate + 'T00:00:00');
      const now = new Date();
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilBooking < 0) {
        return res.status(400).json({ 
          error: "Cannot cancel a booking for a past date." 
        });
      }

      const ownerUser = await storage.getUser(userId);
      const ownerName = ownerUser?.firstName && ownerUser?.lastName
        ? `${ownerUser.firstName} ${ownerUser.lastName}`
        : ownerUser?.email || 'Owner';

      const cancelledBooking = await storage.cancelBookingWithReason(id, `Cancelled by spot owner (${ownerName})`);
      
      if (booking.listingId) {
        const listingToCancel = await storage.getSpotListing(booking.listingId);
        await storage.cancelSpotListing(booking.listingId, `Booking cancelled by spot owner (${ownerName})`);
        // If this is a split listing (originalListingType is set), the parent period/recurring
        // listing is already gone, so soft-delete this orphaned split listing too.
        if (listingToCancel?.originalListingType) {
          await storage.deleteSpotListing(booking.listingId);
          console.log(`[Owner Cancel] Soft-deleted orphaned split listing ${booking.listingId} (originalListingType=${listingToCancel.originalListingType})`);
        } else {
          console.log(`[Owner Cancel] Cancelled listing ${booking.listingId} along with booking`);
        }
      }
      
      await auditService.logAction("CANCEL", "booking", {
        entityId: id,
        message: `Booking ${id} cancelled by spot owner ${ownerName}`,
        before: booking,
        after: cancelledBooking
      });

      // Send cancellation notifications to both renter and owner
      setImmediate(async () => {
        try {
          const renter = await storage.getUser(booking.renterId);
          const spot = await storage.getParkingSpot(booking.spotId);
          
          if (renter && spot) {
            const renterName = renter.firstName && renter.lastName 
              ? `${renter.firstName} ${renter.lastName}`
              : renter.firstName || renter.lastName || renter.email || 'User';
            
            const spotLocation = spot.locationId ? await storage.getLocation(spot.locationId) : null;
            const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
            const isWorkplaceServicesListing = listing?.createdByAdmin === true;
            const bookingDetails = {
              id: booking.id,
              spotNumber: spot.spotNumber,
              location: spotLocation?.office || 'BCI Campus',
              building: spotLocation?.building || 'BCI Campus',
              bookingDate: booking.bookingDate,
              cancelledBy: ownerName,
              cancelledByRole: 'owner' as const,
              isWorkplaceServicesListing,
              reason: `Cancelled by spot owner (${ownerName})`
            };
            
            // Send notification to both renter and owner - route to WPS for admin-created listings
            let ownerInfoForNotification: { name: string; email: string; id: string } | null = null;
            if (isWorkplaceServicesListing) {
              ownerInfoForNotification = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (ownerUser && ownerUser.email) {
              ownerInfoForNotification = { name: ownerName, email: ownerUser.email, id: ownerUser.id };
            }
            
            const renterPrefs = await storage.getNotificationPreferences(renter.id);
            await sendBookingCancellationNotification(
              { name: renterName, email: renter.email || '', id: renter.id },
              bookingDetails,
              renterPrefs || {},
              ownerInfoForNotification
            );
          }
        } catch (notifyError) {
          console.error('Failed to send owner cancellation notification:', notifyError);
        }
      });

      res.json(cancelledBooking);
    } catch (error) {
      console.error("Error cancelling booking by owner:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // POST /api/admin/bookings/:id/cancel - Cancel with reason (Admin only)
  app.post("/api/admin/bookings/:id/cancel", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: "Cancellation reason is required" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const cancelledBooking = await storage.cancelBookingWithReason(id, reason);
      
      // Update the listing status back to 'available' so it can be booked again
      if (booking.listingId) {
        await storage.updateSpotListingStatus(booking.listingId, 'available');
        console.log(`[Admin Cancel] Updated listing ${booking.listingId} status back to 'available'`);
      }
      
      await auditService.logAction("CANCEL", "booking", {
        entityId: id,
        message: `Booking ${id} cancelled by admin: ${reason}`,
        before: booking,
        after: cancelledBooking
      });

      // Send cancellation notification (fire-and-forget)
      setImmediate(async () => {
        try {
          const renter = await storage.getUser(booking.renterId);
          const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
          const spot = await storage.getParkingSpot(booking.spotId);
          
          if (renter && spot) {
            const renterName = renter.firstName && renter.lastName 
              ? `${renter.firstName} ${renter.lastName}`
              : renter.firstName || renter.lastName || renter.email || 'User';
            
            const spotLocation = spot.locationId ? await storage.getLocation(spot.locationId) : null;
            const isWorkplaceServicesListing = listing?.createdByAdmin === true;
            const bookingDetails = {
              id: booking.id,
              spotNumber: spot.spotNumber,
              location: spotLocation?.office || 'BCI Campus',
              building: spotLocation?.building || 'BCI Campus',
              bookingDate: booking.bookingDate,
              cancelledBy: 'Admin',
              cancelledByRole: 'admin' as const,
              isWorkplaceServicesListing,
              reason: reason
            };
            
            // Get owner info - route to WPS for admin-created listings
            let ownerInfo: { name: string; email: string; id: string } | null = null;
            if (isWorkplaceServicesListing) {
              ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (listing?.ownerId) {
              const owner = await storage.getUser(listing.ownerId);
              if (owner && owner.email) {
                const ownerName = owner.firstName && owner.lastName 
                  ? `${owner.firstName} ${owner.lastName}`
                  : owner.firstName || owner.lastName || owner.email || 'Owner';
                ownerInfo = { name: ownerName, email: owner.email, id: owner.id };
              }
            }
            
            const renterPrefs = await storage.getNotificationPreferences(renter.id);
            await sendBookingCancellationNotification(
              { name: renterName, email: renter.email || '', id: renter.id },
              bookingDetails,
              renterPrefs || {},
              ownerInfo
            );
          }
        } catch (notifyError) {
          console.error('Failed to send admin cancellation notification:', notifyError);
        }
      });

      res.json(cancelledBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // POST /api/admin/cancel-booking - Legacy alias (body: { bookingId, reason })
  app.post("/api/admin/cancel-booking", requireAdmin, async (req: any, res) => {
    try {
      const { bookingId, reason } = req.body;
      if (!bookingId) return res.status(400).json({ error: "bookingId is required" });
      if (!reason) return res.status(400).json({ error: "Cancellation reason is required" });

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const cancelledBooking = await storage.cancelBookingWithReason(bookingId, reason);

      if (booking.listingId) {
        await storage.updateSpotListingStatus(booking.listingId, 'available');
      }

      await auditService.logAction("CANCEL", "booking", {
        entityId: bookingId,
        message: `Booking ${bookingId} cancelled by admin: ${reason}`,
        before: booking,
        after: cancelledBooking
      });

      setImmediate(async () => {
        try {
          const renter = await storage.getUser(booking.renterId);
          const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
          const spot = await storage.getParkingSpot(booking.spotId);
          if (renter && spot) {
            const renterName = renter.firstName && renter.lastName
              ? `${renter.firstName} ${renter.lastName}`
              : renter.firstName || renter.lastName || renter.email || 'User';
            const spotLocation = spot.locationId ? await storage.getLocation(spot.locationId) : null;
            const isWorkplaceServicesListing = listing?.createdByAdmin === true;
            const bookingDetails = {
              id: booking.id,
              spotNumber: spot.spotNumber,
              location: spotLocation?.office || 'BCI Campus',
              building: spotLocation?.building || 'BCI Campus',
              bookingDate: booking.bookingDate,
              cancelledBy: 'Admin',
              cancelledByRole: 'admin' as const,
              isWorkplaceServicesListing,
              reason
            };
            let ownerInfo: { name: string; email: string; id: string } | null = null;
            if (isWorkplaceServicesListing) {
              ownerInfo = { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL, id: 'workplace-services' };
            } else if (listing?.ownerId) {
              const owner = await storage.getUser(listing.ownerId);
              if (owner && owner.email) {
                const ownerName = owner.firstName && owner.lastName
                  ? `${owner.firstName} ${owner.lastName}`
                  : owner.firstName || owner.lastName || owner.email || 'Owner';
                ownerInfo = { name: ownerName, email: owner.email, id: owner.id };
              }
            }
            const renterPrefs = await storage.getNotificationPreferences(renter.id);
            await sendBookingCancellationNotification(
              { name: renterName, email: renter.email || '', id: renter.id },
              bookingDetails,
              renterPrefs || {},
              ownerInfo
            );
          }
        } catch (e) {
          console.error('[Admin Cancel] Notification error:', e);
        }
      });

      res.json({ success: true, booking: cancelledBooking });
    } catch (error) {
      console.error("Failed to cancel booking (legacy route):", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // POST /api/admin/bookings/:id/refund - Mark payment refunded (Admin only)
  app.post("/api/admin/bookings/:id/refund", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { refundAmount } = req.body;
      
      if (!refundAmount) {
        return res.status(400).json({ error: "Refund amount is required" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const refundedBooking = await storage.markPaymentRefunded(id, refundAmount);
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Payment refunded for booking ${id}: ${refundAmount}`,
        before: booking,
        after: refundedBooking
      });

      res.json(refundedBooking);
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({ error: "Failed to process refund" });
    }
  });

  // ============ BOOKING WORKFLOW ENDPOINTS ============

  // POST /api/bookings/:id/mark-paid - Renter marks payment as sent
  app.post("/api/bookings/:id/mark-paid", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking belongs to the user (as renter)
      if (booking.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this booking" });
      }

      // Validate current state - can only mark paid if status is confirmed and payment is pending
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ error: `Cannot mark payment for ${booking.status} booking` });
      }

      if (booking.paymentStatus !== 'pending') {
        return res.status(400).json({ error: `Payment already marked as ${booking.paymentStatus}` });
      }

      // Update payment status to "paid"
      const updatedBooking = await storage.updateBooking(id, { 
        paymentStatus: 'paid' as any
      });
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Booking ${id} - Renter marked payment as sent`,
        before: { paymentStatus: booking.paymentStatus },
        after: { paymentStatus: 'paid' }
      });

      // Send email notification to owner that renter marked payment as sent
      try {
        const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
        const isWsListing = listing?.createdByAdmin === true;
        const spot = await storage.getParkingSpot(booking.spotId);

        const ownerUser = !isWsListing ? await storage.getUser(booking.ownerId) : null;
        const renterUser = await storage.getUser(booking.renterId);
        const spotLocation = spot?.locationId ? await storage.getLocation(spot.locationId) : null;

        if ((ownerUser || isWsListing) && renterUser && spot) {
          const notificationBooking = {
            id: booking.id,
            spotNumber: spot.spotNumber,
            location: spotLocation ? spotLocation.office : '',
            building: spotLocation ? `${spotLocation.building}, ${spotLocation.level}` : '',
            bookingDate: new Date(booking.bookingDate),
            amount: Number(booking.totalAmount),
          };
          const ownerInfo = isWsListing
            ? { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL }
            : { name: `${ownerUser!.firstName} ${ownerUser!.lastName}`, email: ownerUser!.email || '' };
          const renterInfo = { name: `${renterUser.firstName} ${renterUser.lastName}`, email: renterUser.email || '' };

          const ownerPrefs = isWsListing ? {} : await storage.getNotificationPreferences(ownerUser!.id);
          sendPaymentMarkedPaidNotification(ownerInfo, renterInfo, notificationBooking, ownerPrefs || {})
            .catch(err => console.error('Error sending payment marked paid notification:', err));
        }
      } catch (notifError) {
        console.error('Error preparing payment notification:', notifError);
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error marking payment:", error);
      res.status(500).json({ error: "Failed to mark payment" });
    }
  });

  // POST /api/bookings/:id/confirm-payment - Owner confirms payment received (moves to completed)
  app.post("/api/bookings/:id/confirm-payment", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking belongs to the user (as owner) or user is admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.roles?.includes('admin') ?? false;
      
      if (booking.ownerId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to confirm payment for this booking" });
      }

      // Validate current state - can only confirm if payment status is "paid"
      if (booking.paymentStatus !== 'paid') {
        return res.status(400).json({ 
          error: booking.paymentStatus === 'pending' 
            ? "Renter must mark payment as sent first" 
            : `Payment already ${booking.paymentStatus}`
        });
      }

      // Update payment status to "received" and booking status to "completed"
      const updatedBooking = await storage.updateBooking(id, { 
        paymentStatus: 'received' as any,
        status: 'completed' as any,
        paymentReceived: true
      });

      // Update the related listing status to "used" if this was a single-date booking
      if (booking.listingId) {
        try {
          await storage.updateSpotListing(booking.listingId, { status: 'used' as any });
        } catch (listingError) {
          console.error("Error updating listing status:", listingError);
          // Don't fail the whole operation if listing update fails
        }
      }
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Booking ${id} - Owner confirmed payment received, booking completed`,
        before: { paymentStatus: booking.paymentStatus, status: booking.status },
        after: { paymentStatus: 'received', status: 'completed' }
      });

      // Send email notification to renter that owner confirmed payment
      try {
        const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
        const isWsListing = listing?.createdByAdmin === true;
        const spot = await storage.getParkingSpot(booking.spotId);

        const ownerUser = !isWsListing ? await storage.getUser(booking.ownerId) : null;
        const renterUser = await storage.getUser(booking.renterId);
        const spotLocation = spot?.locationId ? await storage.getLocation(spot.locationId) : null;

        if ((ownerUser || isWsListing) && renterUser && spot) {
          const notificationBooking = {
            id: booking.id,
            spotNumber: spot.spotNumber,
            location: spotLocation ? spotLocation.office : '',
            building: spotLocation ? `${spotLocation.building}, ${spotLocation.level}` : '',
            bookingDate: new Date(booking.bookingDate),
            amount: Number(booking.totalAmount),
          };
          const ownerInfo = isWsListing
            ? { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL }
            : { name: `${ownerUser!.firstName} ${ownerUser!.lastName}`, email: ownerUser!.email || '' };
          const renterInfo = { name: `${renterUser.firstName} ${renterUser.lastName}`, email: renterUser.email || '' };

          const renterPrefs = await storage.getNotificationPreferences(renterUser.id);
          sendPaymentConfirmedNotification(renterInfo, ownerInfo, notificationBooking, renterPrefs || {})
            .catch(err => console.error('Error sending payment confirmed notification:', err));
        }
      } catch (notifError) {
        console.error('Error preparing payment confirmed notification:', notifError);
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // POST /api/bookings/:id/payment-reminder - Owner sends payment reminder to renter
  app.post("/api/bookings/:id/payment-reminder", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking belongs to the user (as owner) or user is admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.roles?.includes('admin') ?? false;
      
      if (booking.ownerId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to send reminder for this booking" });
      }

      // Validate current state - can only send reminder if payment is pending
      if (booking.paymentStatus !== 'pending') {
        return res.status(400).json({ 
          error: booking.paymentStatus === 'paid' 
            ? "Renter has already marked payment as sent" 
            : `Payment already ${booking.paymentStatus}`
        });
      }

      // Get renter info for notification
      const renter = await storage.getUser(booking.renterId!);
      if (!renter) {
        return res.status(404).json({ error: "Renter not found" });
      }

      // Get spot info
      const spot = await storage.getParkingSpot(booking.spotId);

      // Get listing to check if it's a Workplace Services (admin-created) listing
      const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
      const isWsListing = listing?.createdByAdmin === true;

      // Get spot owner info for the reminder (skip for Workplace Services listings)
      const owner = (!isWsListing && booking.ownerId) ? await storage.getUser(booking.ownerId) : null;
      const ownerName = isWsListing
        ? 'Workplace Services'
        : owner && (owner.firstName || owner.lastName)
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
          : undefined;

      // Send payment reminder notification to renter using the notification service
      const { sendPaymentReminderNotification: sendReminder } = await import('./notification-service');
      const renterName = renter.firstName && renter.lastName 
        ? `${renter.firstName} ${renter.lastName}`
        : renter.email || 'Renter';
      await sendReminder(
        { name: renterName, email: renter.email || '', id: renter.id },
        {
          bookingId: id,
          spotNumber: spot?.spotNumber || 'Unknown',
          amount: parseFloat(booking.totalAmount?.toString() || booking.dailyRate?.toString() || '0'),
          dueDate: new Date(new Date(booking.bookingDate).getTime() + 7 * 24 * 60 * 60 * 1000),
          ownerName,
          ownerEmail: isWsListing ? undefined : (owner?.email || undefined),
          isWorkplaceServicesListing: isWsListing
        }
      );
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Payment reminder sent for booking ${id} to renter ${renter.email}`,
        after: { action: 'payment_reminder_sent', renterId: booking.renterId }
      });

      res.json({ success: true, message: "Payment reminder sent successfully" });
    } catch (error) {
      console.error("Error sending payment reminder:", error);
      res.status(500).json({ error: "Failed to send payment reminder" });
    }
  });

  // POST /api/bookings/:id/notify-owner - Renter sends reminder to owner to confirm payment
  app.post("/api/bookings/:id/notify-owner", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking belongs to the user (as renter)
      if (booking.renterId !== userId) {
        return res.status(403).json({ error: "Not authorized to send reminder for this booking" });
      }

      // Validate current state - can only send reminder if payment is 'paid' (waiting for owner confirmation)
      if (booking.paymentStatus !== 'paid') {
        return res.status(400).json({ 
          error: booking.paymentStatus === 'pending' 
            ? "Please mark your payment as sent first" 
            : booking.paymentStatus === 'received'
            ? "Payment has already been confirmed"
            : `Invalid payment status: ${booking.paymentStatus}`
        });
      }

      // Rate-limit: allow one reminder per 24 hours per booking
      const REMINDER_COOLDOWN_HOURS = 24;
      if (booking.lastOwnerReminderSentAt) {
        const lastSent = new Date(booking.lastOwnerReminderSentAt).getTime();
        const cooldownMs = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
        const nextAllowedAt = new Date(lastSent + cooldownMs);
        if (Date.now() < nextAllowedAt.getTime()) {
          return res.status(429).json({
            error: `You already sent a reminder recently. You can send another one after ${nextAllowedAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`,
            nextAllowedAt: nextAllowedAt.toISOString(),
          });
        }
      }

      // Check if this is a Workplace Services (admin-created) listing
      const listing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
      const isWsListing = listing?.createdByAdmin === true;

      // Get owner info for notification
      const owner = !isWsListing ? await storage.getUser(booking.ownerId!) : null;
      if (!owner && !isWsListing) {
        return res.status(404).json({ error: "Owner not found" });
      }

      // Get renter info for the notification message
      const renter = await storage.getUser(booking.renterId!);
      const renterName = renter?.firstName && renter?.lastName 
        ? `${renter.firstName} ${renter.lastName}`
        : renter?.email || 'A renter';

      // Get spot info
      const spot = await storage.getParkingSpot(booking.spotId);

      // Create in-app notification for owner (skip for WPS - no user account)
      if (!isWsListing) {
        await storage.createInAppNotification({
          userId: booking.ownerId!,
          title: "Payment Confirmation Reminder",
          message: `${renterName} is waiting for you to confirm payment receipt for Spot ${spot?.spotNumber || 'Unknown'} on ${booking.bookingDate}. Amount: $${booking.totalAmount || booking.dailyRate}`,
          type: "payment" as any,
          read: false
        });
      }

      // Send email notification to owner (or WPS email for admin-created listings)
      const spotLocation = spot?.locationId ? await storage.getLocation(spot.locationId) : null;
      const notificationBooking = {
        id,
        spotNumber: spot?.spotNumber || 'Unknown',
        location: spotLocation ? spotLocation.office : '',
        building: spotLocation ? `${spotLocation.building}, ${spotLocation.level}` : '',
        bookingDate: new Date(booking.bookingDate),
        amount: parseFloat(booking.totalAmount?.toString() || booking.dailyRate?.toString() || '0'),
      };
      const renterInfo = {
        name: renterName,
        email: renter?.email || '',
      };

      if (isWsListing) {
        await sendPaymentMarkedPaidNotification(
          { name: 'BCI Workplace Services', email: WORKPLACE_SERVICES_EMAIL },
          renterInfo,
          notificationBooking,
          {}
        );
      } else {
        const ownerNotificationPrefs = await storage.getNotificationPreferences(booking.ownerId!);
        const ownerName = owner!.firstName && owner!.lastName
          ? `${owner!.firstName} ${owner!.lastName}`
          : owner!.email || 'Owner';
        await sendPaymentMarkedPaidNotification(
          { name: ownerName, email: owner!.email || '' },
          renterInfo,
          notificationBooking,
          ownerNotificationPrefs || {}
        );
      }
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Confirmation reminder sent for booking ${id} to ${isWsListing ? WORKPLACE_SERVICES_EMAIL : owner?.email}`,
        after: { action: 'confirmation_reminder_sent', ownerId: booking.ownerId }
      });

      // Stamp the reminder time so the rate-limit can be enforced
      await storage.updateBooking(id, { lastOwnerReminderSentAt: new Date() });

      res.json({ success: true, message: "Confirmation reminder sent to owner" });
    } catch (error) {
      console.error("Error sending confirmation reminder:", error);
      res.status(500).json({ error: "Failed to send confirmation reminder" });
    }
  });

  // GET /api/admin/disputes - List disputes with filters (Admin only)
  app.get("/api/admin/disputes", requireAdmin, async (req, res) => {
    try {
      const { status, bookingId } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status;
      if (bookingId) filters.bookingId = bookingId;
      
      const disputes = await storage.getDisputes(filters);
      res.json(disputes);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  // POST /api/admin/disputes - Create dispute (Admin only)
  app.post("/api/admin/disputes", requireAdmin, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const disputeData = {
        ...req.body,
        reporterId: userId
      };
      
      const dispute = await storage.createDispute(disputeData);
      
      await auditService.logAction("CREATE", "booking", {
        entityId: dispute.id,
        message: `Dispute created for booking ${dispute.bookingId}`,
        after: dispute
      });

      res.status(201).json(dispute);
    } catch (error) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ error: "Failed to create dispute" });
    }
  });

  // PATCH /api/admin/disputes/:id - Update dispute status (Admin only)
  app.patch("/api/admin/disputes/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      const updatedDispute = await storage.updateDispute(id, updates);
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Dispute ${id} updated`,
        before: dispute,
        after: updatedDispute
      });

      res.json(updatedDispute);
    } catch (error) {
      console.error("Error updating dispute:", error);
      res.status(500).json({ error: "Failed to update dispute" });
    }
  });

  // POST /api/admin/disputes/:id/resolve - Resolve dispute with notes (Admin only)
  app.post("/api/admin/disputes/:id/resolve", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { resolutionNotes, refundAmount } = req.body;
      const userId = getAuthenticatedUserId(req);
      
      if (!resolutionNotes) {
        return res.status(400).json({ error: "Resolution notes are required" });
      }

      const dispute = await storage.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const resolvedDispute = await storage.resolveDispute(id, userId, resolutionNotes, refundAmount);
      
      await auditService.logAction("UPDATE", "booking", {
        entityId: id,
        message: `Dispute ${id} resolved by admin`,
        before: dispute,
        after: resolvedDispute
      });

      res.json(resolvedDispute);
    } catch (error) {
      console.error("Error resolving dispute:", error);
      res.status(500).json({ error: "Failed to resolve dispute" });
    }
  });

  // Department endpoints
  // GET /api/departments - Get all departments (authenticated users)
  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  // POST /api/admin/departments - Create department (admin only)
  app.post("/api/admin/departments", requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Department name is required" });
      }
      
      const department = await storage.createDepartment(name.trim());
      res.status(201).json(department);
    } catch (error: any) {
      console.error("Error creating department:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Department with this name already exists" });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  // PATCH /api/admin/departments/:id - Update department (admin only)
  app.patch("/api/admin/departments/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid department ID" });
      }
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Department name is required" });
      }
      
      const department = await storage.updateDepartment(id, name.trim());
      
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      
      res.json(department);
    } catch (error: any) {
      console.error("Error updating department:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Department with this name already exists" });
      }
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  // DELETE /api/admin/departments/:id - Delete department (admin only)
  app.delete("/api/admin/departments/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid department ID" });
      }
      
      const deleted = await storage.deleteDepartment(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Department not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting department:", error);
      if (error.message?.includes('in use')) {
        return res.status(409).json({ error: "Cannot delete department that is in use by users" });
      }
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // Location endpoints
  // GET /api/locations - Get all locations (authenticated users)
  app.get("/api/locations", isAuthenticated, async (req, res) => {
    try {
      const locations = await storage.getLocations();
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  // POST /api/locations - Create location for Personal Spots (authenticated users)
  app.post("/api/locations", isAuthenticated, async (req: any, res) => {
    try {
      const { office, building, level, address } = req.body;
      
      if (!office || !building || !level) {
        return res.status(400).json({ error: "Office, building, and level are required" });
      }
      
      // Regular users can create locations for Personal spots
      const location = await storage.createLocation({
        office: office.trim(),
        building: building.trim(),
        level: level.trim(),
        address: address?.trim(),
        timezone: "America/Vancouver", // Default timezone
        isActive: true // Always active for user-created locations
      });
      res.status(201).json(location);
    } catch (error: any) {
      console.error("Error creating location:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Location with this configuration already exists" });
      }
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  // POST /api/admin/locations - Create location (admin only)
  app.post("/api/admin/locations", requireAdmin, async (req, res) => {
    try {
      const { office, building, level, address, timezone, isActive } = req.body;
      
      if (!office || !building || !level) {
        return res.status(400).json({ error: "Office, building, and level are required" });
      }
      
      const location = await storage.createLocation({
        office: office.trim(),
        building: building.trim(),
        level: level.trim(),
        address: address?.trim(),
        timezone: timezone || "America/Vancouver",
        isActive: isActive ?? true
      });
      res.status(201).json(location);
    } catch (error: any) {
      console.error("Error creating location:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Location with this configuration already exists" });
      }
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  // PATCH /api/admin/locations/:id - Update location (admin only)
  app.patch("/api/admin/locations/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { office, building, level, address, timezone, isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid location ID" });
      }
      
      const updates: any = {};
      if (office !== undefined) updates.office = office.trim();
      if (building !== undefined) updates.building = building.trim();
      if (level !== undefined) updates.level = level.trim();
      if (address !== undefined) updates.address = address?.trim();
      if (timezone !== undefined) updates.timezone = timezone;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const location = await storage.updateLocation(id, updates);
      
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      res.json(location);
    } catch (error: any) {
      console.error("Error updating location:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Location with this configuration already exists" });
      }
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  // DELETE /api/admin/locations/:id - Delete location (admin only)
  app.delete("/api/admin/locations/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid location ID" });
      }
      
      const deleted = await storage.deleteLocation(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting location:", error);
      if (error.code === '23503') {
        return res.status(409).json({ error: "Cannot delete location that is in use by parking spots" });
      }
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Spot Type endpoints
  // GET /api/spot-types - Get all spot types (authenticated users)
  app.get("/api/spot-types", isAuthenticated, async (req, res) => {
    try {
      const spotTypes = await storage.getSpotTypes();
      res.json(spotTypes);
    } catch (error) {
      console.error("Error fetching spot types:", error);
      res.status(500).json({ error: "Failed to fetch spot types" });
    }
  });

  // POST /api/admin/spot-types - Create spot type (admin only)
  app.post("/api/admin/spot-types", requireAdmin, async (req, res) => {
    try {
      const { name, slug, description, bciChargingAmount, isActive } = req.body;
      
      if (!name || !slug) {
        return res.status(400).json({ error: "Name and slug are required" });
      }
      
      const spotType = await storage.createSpotType({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim(),
        bciChargingAmount: bciChargingAmount || "0",
        isActive: isActive ?? true
      });
      res.status(201).json(spotType);
    } catch (error: any) {
      console.error("Error creating spot type:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Spot type with this name or slug already exists" });
      }
      res.status(500).json({ error: "Failed to create spot type" });
    }
  });

  // PATCH /api/admin/spot-types/:id - Update spot type (admin only)
  app.patch("/api/admin/spot-types/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, slug, description, bciChargingAmount, isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid spot type ID" });
      }
      
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) updates.slug = slug.trim().toLowerCase();
      if (description !== undefined) updates.description = description?.trim();
      if (bciChargingAmount !== undefined) updates.bciChargingAmount = bciChargingAmount;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const spotType = await storage.updateSpotType(id, updates);
      
      if (!spotType) {
        return res.status(404).json({ error: "Spot type not found" });
      }
      
      res.json(spotType);
    } catch (error: any) {
      console.error("Error updating spot type:", error);
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: "Spot type with this name or slug already exists" });
      }
      res.status(500).json({ error: "Failed to update spot type" });
    }
  });

  // DELETE /api/admin/spot-types/:id - Delete spot type (admin only)
  app.delete("/api/admin/spot-types/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid spot type ID" });
      }
      
      const deleted = await storage.deleteSpotType(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Spot type not found" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting spot type:", error);
      if (error.code === '23503') {
        return res.status(409).json({ error: "Cannot delete spot type that is in use by parking spots" });
      }
      res.status(500).json({ error: "Failed to delete spot type" });
    }
  });

  // Assign a parking spot to a user (Admin only)
  app.post("/api/admin/assign-spot", requireAdmin, async (req, res) => {
    try {
      const assignSpotSchema = z.object({
        spotId: z.string().min(1, "spotId is required"),
        userId: z.string().min(1, "userId is required"),
        isBciManaged: z.boolean().optional(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledDate must be in YYYY-MM-DD format").optional(),
        cancelFutureBookings: z.boolean().optional()
      });
      
      const { spotId, userId, isBciManaged, scheduledDate, cancelFutureBookings } = assignSpotSchema.parse(req.body);

      // Validate scheduledDate is a real calendar date if provided
      if (scheduledDate) {
        const parsed = new Date(scheduledDate + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Invalid scheduledDate: not a valid calendar date" });
        }
      }

      // Get spot info before assignment for audit logging
      const existingSpot = await storage.getParkingSpot(spotId);
      const user = await storage.getUser(userId);
      
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate department restriction for Department Reserved spots (applies to both immediate and scheduled)
      if (existingSpot.spotTypeId && existingSpot.reservedForDepartmentId) {
        const spotType = await storage.getSpotType(existingSpot.spotTypeId);
        const isDepartmentReserved = spotType?.name === 'Department Reserved' || 
                                      spotType?.slug === 'department-reserved';
        
        if (isDepartmentReserved && user.departmentId !== existingSpot.reservedForDepartmentId) {
          const department = await storage.getDepartment(existingSpot.reservedForDepartmentId);
          const deptName = department?.name || 'the restricted department';
          return res.status(400).json({ 
            error: `This spot is reserved for ${deptName} department only. The selected user is not a member of this department.`
          });
        }
      }

      // Handle scheduled future assignment
      if (scheduledDate) {
        const scheduledDateObj = new Date(scheduledDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (scheduledDateObj > today) {
          // Cancel any existing pending scheduled assignments for this spot
          const cancelledCount = await storage.cancelSpotPendingScheduledAssignments(spotId);
          if (cancelledCount > 0) {
            console.log(`[Scheduled Assignment] Cancelled ${cancelledCount} existing pending assignment(s) for spot ${spotId}`);
          }

          const actorId = getAuthenticatedUserId(req);

          // Create the scheduled assignment record
          const scheduledAssignment = await storage.createScheduledAssignment({
            spotId,
            userId,
            scheduledDate,
            cancelFutureBookings: cancelFutureBookings || false,
            status: 'pending',
            actorId: actorId || undefined,
            notes: `Scheduled assignment for ${scheduledDate}`
          });

          // If cancelFutureBookings is true, cancel bookings from scheduledDate onwards immediately
          if (cancelFutureBookings) {
            try {
              const allBookings = await storage.getBookingsBySpot(spotId);
              const cutoffDate = new Date(scheduledDate + 'T00:00:00');
              cutoffDate.setHours(0, 0, 0, 0);

              const futureBookings = allBookings.filter(booking => {
                const bookingDate = new Date(booking.bookingDate);
                bookingDate.setHours(0, 0, 0, 0);
                return bookingDate >= cutoffDate && booking.status !== 'cancelled';
              });

              if (futureBookings.length > 0) {
                const location = await storage.getLocation(existingSpot.locationId);
                const locationName = location ? `${location.office} - ${location.level}` : 'Unknown Location';
                const buildingName = location?.building || 'Unknown Building';

                const bookingsByRenter = new Map<string, typeof futureBookings>();

                for (const booking of futureBookings) {
                  await storage.updateBooking(booking.id, {
                    status: 'cancelled',
                    adminNotes: `Automatically cancelled due to scheduled spot assignment effective ${scheduledDate}`
                  });

                  const renterBookings = bookingsByRenter.get(booking.renterId) || [];
                  renterBookings.push(booking);
                  bookingsByRenter.set(booking.renterId, renterBookings);
                }

                const { sendBookingsCancelledDueToUnassignmentNotification } = await import('./notification-service');

                for (const [renterId, renterBookings] of Array.from(bookingsByRenter.entries())) {
                  const renter = await storage.getUser(renterId);
                  if (renter) {
                    const renterName = `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || 'User';
                    const cancelledBookingDetails = renterBookings.map((b: typeof renterBookings[0]) => ({
                      bookingDate: b.bookingDate,
                      spotNumber: existingSpot.spotNumber,
                      location: locationName,
                      building: buildingName
                    }));

                    const renterPrefs = await storage.getNotificationPreferences(renter.id);
                    await sendBookingsCancelledDueToUnassignmentNotification(
                      { name: renterName, email: renter.email || null, id: renter.id },
                      cancelledBookingDetails,
                      'Spot has been scheduled for reassignment',
                      renterPrefs || {}
                    );
                  }
                }

                console.log(`[Scheduled Assignment] Cancelled ${futureBookings.length} bookings from ${scheduledDate} onwards for spot ${spotId}`);
              }
            } catch (cancelError) {
              console.error('[Scheduled Assignment] Error cancelling future bookings:', cancelError);
            }
          }

          // Audit the scheduled assignment
          await auditService.logAction("SCHEDULE_ASSIGN", "parking_spot", {
            entityId: spotId,
            message: `Scheduled parking spot ${existingSpot.spotNumber} assignment to ${user?.firstName} ${user?.lastName} (${user?.email}) for ${scheduledDate}`,
            before: existingSpot,
            after: { scheduledAssignment }
          });

          return res.json({
            scheduled: true,
            scheduledAssignment,
            message: `Assignment scheduled for ${scheduledDate}`
          });
        }
        // If scheduledDate is today or past, fall through to immediate assignment
      }

      // Check if user has an active waiting list entry and mark it as assigned
      const waitingListEntry = await storage.getWaitingListByUser(userId);
      if (waitingListEntry) {
        const updatedWaitingListEntry = await storage.updateWaitingListEntry(waitingListEntry.id, {
          status: 'assigned',
          assignedDate: new Date(),
          assignedSpotId: spotId
        });
        
        if (!updatedWaitingListEntry) {
          console.error(`Failed to update waiting list entry ${waitingListEntry.id} for user ${userId}`);
          return res.status(500).json({ error: "Failed to update waiting list entry" });
        }
        
        // Audit the waiting list assignment
        await auditService.logAction("UPDATE", "waiting_list", {
          entityId: waitingListEntry.id,
          message: `Marked ${user?.firstName} ${user?.lastName} (${user?.email}) as assigned in waiting list (spot: ${spotId})`,
          before: waitingListEntry,
          after: updatedWaitingListEntry
        });
      }
      
      // Cancel any future bookings on this spot before assignment
      // This handles the case where available spots have bookings from Workplace Services listings
      let cancelledBookingsCount = 0;
      const notifiedRenters: string[] = [];
      
      try {
        // Get all bookings for this spot
        const allBookings = await storage.getBookingsBySpot(spotId);
        
        // Filter for future bookings (today and onwards) that are not already cancelled
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const futureBookings = allBookings.filter(booking => {
          const bookingDate = new Date(booking.bookingDate);
          bookingDate.setHours(0, 0, 0, 0);
          return bookingDate >= today && booking.status !== 'cancelled';
        });
        
        if (futureBookings.length > 0) {
          console.log(`[Spot Assignment] Found ${futureBookings.length} future bookings to cancel for spot ${spotId}`);
          
          // Get location details for notifications
          const location = await storage.getLocation(existingSpot.locationId);
          const locationName = location ? `${location.office} - ${location.level}` : 'Unknown Location';
          const buildingName = location?.building || 'Unknown Building';
          
          // Group bookings by renter for batch notifications
          const bookingsByRenter = new Map<string, typeof futureBookings>();
          
          for (const booking of futureBookings) {
            // Cancel the booking
            await storage.updateBooking(booking.id, { 
              status: 'cancelled',
              adminNotes: `Automatically cancelled due to spot assignment on ${new Date().toISOString().split('T')[0]}`
            });
            cancelledBookingsCount++;
            
            // Group for notification
            const renterBookings = bookingsByRenter.get(booking.renterId) || [];
            renterBookings.push(booking);
            bookingsByRenter.set(booking.renterId, renterBookings);
          }
          
          // Import notification functions
          const { sendBookingsCancelledDueToUnassignmentNotification } = await import('./notification-service');
          
          // Notify each affected renter
          for (const [renterId, renterBookings] of Array.from(bookingsByRenter.entries())) {
            const renter = await storage.getUser(renterId);
            if (renter) {
              const renterName = `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || 'User';
              const cancelledBookingDetails = renterBookings.map((b: typeof renterBookings[0]) => ({
                bookingDate: b.bookingDate,
                spotNumber: existingSpot.spotNumber,
                location: locationName,
                building: buildingName
              }));
              
              const renterPrefs = await storage.getNotificationPreferences(renter.id);
              await sendBookingsCancelledDueToUnassignmentNotification(
                {
                  name: renterName,
                  email: renter.email || null,
                  id: renter.id
                },
                cancelledBookingDetails,
                'Spot has been assigned to a new owner',
                renterPrefs || {}
              );
              notifiedRenters.push(renter.email || renter.id);
            }
          }
          
          console.log(`[Spot Assignment] Cancelled ${cancelledBookingsCount} bookings, notified ${notifiedRenters.length} renters`);
        }
      } catch (cancelError) {
        console.error('[Spot Assignment] Error cancelling future bookings:', cancelError);
        // Continue with assignment even if cancellation fails
      }
      
      // Build update data with proper isBciManaged logic
      // Since isBciManaged has .notNull().default(false), it ALWAYS has a value
      // 1. If isBciManaged is explicitly provided → use that value
      // 2. Otherwise → preserve the existing spot's isBciManaged value
      const updateData = {
        ownerId: userId,
        isBookable: false,
        ...(isBciManaged !== undefined 
          ? { isBciManaged } 
          : existingSpot?.isBciManaged !== undefined 
            ? { isBciManaged: existingSpot.isBciManaged }
            : {})
      };
      
      const updatedSpot = await storage.updateParkingSpot(spotId, updateData);
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Record spot assignment history
      const actorId = getAuthenticatedUserId(req);
      await storage.recordSpotAssignment({
        spotId,
        userId,
        action: 'assigned',
        effectiveAt: new Date(),
        actorId: actorId || undefined,
        notes: waitingListEntry ? 'Assigned from waiting list' : undefined
      });
      
      // Audit the spot assignment
      await auditService.logAction("ASSIGN", "parking_spot", {
        entityId: spotId,
        message: `Assigned parking spot ${updatedSpot.spotNumber} to ${user?.firstName} ${user?.lastName} (${user?.email})${waitingListEntry ? ' (removed from waiting list)' : ''}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      // Automatic role change: if user doesn't have owner role, add it
      if (user && !user.roles.includes("owner")) {
        await storage.addUserRole(userId, "owner");
      }
      
      // Send spot assignment email to the user
      try {
        if (user?.email) {
          const { createSpotAssignmentNotification, sendEmailNotification } = await import('./notification-service');
          const location = await storage.getLocation(updatedSpot.locationId);
          const locationName = location ? `${location.office} - ${location.level}` : 'Unknown';
          const buildingName = location?.building || 'Unknown';
          
          const notification = createSpotAssignmentNotification(
            { name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, email: user.email },
            { spotNumber: updatedSpot.spotNumber, location: locationName, building: buildingName }
          );
          await sendEmailNotification(notification);
          console.log(`✓ Spot assignment email sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error('Failed to send spot assignment email:', emailError);
      }
      
      res.json(updatedSpot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error assigning parking spot:", error);
      res.status(500).json({ error: "Failed to assign parking spot" });
    }
  });

  // Get all pending scheduled assignments (Admin only)
  app.get("/api/admin/scheduled-assignments", requireAdmin, async (req, res) => {
    try {
      const spotId = req.query.spotId as string | undefined;
      const assignments = await storage.getScheduledAssignments(spotId);

      const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
        const spot = await storage.getParkingSpot(assignment.spotId);
        const user = await storage.getUser(assignment.userId);
        const location = spot ? await storage.getLocation(spot.locationId) : null;
        return {
          ...assignment,
          spotNumber: spot?.spotNumber || 'Unknown',
          locationName: location ? `${location.office} - ${location.level}` : 'Unknown',
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
          userEmail: user?.email || 'Unknown',
          spot: spot ? {
            id: spot.id,
            spotNumber: spot.spotNumber,
            locationId: spot.locationId,
            location: location ? `${location.office} - ${location.level}` : 'Unknown',
            building: location?.building || 'Unknown'
          } : null,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          } : null
        };
      }));

      res.json(enrichedAssignments);
    } catch (error) {
      console.error("Error fetching scheduled assignments:", error);
      res.status(500).json({ error: "Failed to fetch scheduled assignments" });
    }
  });

  // Cancel a pending scheduled assignment (Admin only)
  app.delete("/api/admin/scheduled-assignments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const assignment = await storage.getScheduledAssignment(id);

      if (!assignment) {
        return res.status(404).json({ error: "Scheduled assignment not found" });
      }

      if (assignment.status !== 'pending') {
        return res.status(400).json({ error: "Only pending scheduled assignments can be cancelled" });
      }

      const updated = await storage.updateScheduledAssignment(id, { status: 'cancelled' });

      await auditService.logAction("CANCEL_SCHEDULE", "parking_spot", {
        entityId: assignment.spotId,
        message: `Cancelled scheduled assignment for spot ${assignment.spotId} (was scheduled for ${assignment.scheduledDate})`,
        before: assignment,
        after: updated
      });

      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Error cancelling scheduled assignment:", error);
      res.status(500).json({ error: "Failed to cancel scheduled assignment" });
    }
  });

  // Bulk assign parking spots to a user (Admin only)
  app.post("/api/admin/bulk-assign-spots", requireAdmin, async (req, res) => {
    try {
      const bulkAssignSchema = z.object({
        spotIds: z.array(z.string()).min(1, "At least one spotId is required"),
        userId: z.string().min(1, "userId is required"),
        isBciManaged: z.boolean().optional()
      });
      
      const { spotIds, userId, isBciManaged } = bulkAssignSchema.parse(req.body);

      // Get user info for audit logging
      const user = await storage.getUser(userId);
      
      // Check if user has an active waiting list entry and mark it as assigned (only once for bulk assignment)
      const waitingListEntry = await storage.getWaitingListByUser(userId);
      if (waitingListEntry) {
        // Store all assigned spot IDs as comma-separated string for bulk assignments
        const assignedSpotIds = spotIds.join(',');
        const updatedWaitingListEntry = await storage.updateWaitingListEntry(waitingListEntry.id, {
          status: 'assigned',
          assignedDate: new Date(),
          assignedSpotId: assignedSpotIds // Store all spot IDs (comma-separated for bulk assignments)
        });
        
        if (!updatedWaitingListEntry) {
          console.error(`Failed to update waiting list entry ${waitingListEntry.id} for user ${userId}`);
          return res.status(500).json({ error: "Failed to update waiting list entry during bulk assignment" });
        }
        
        // Audit the waiting list assignment
        await auditService.logAction("UPDATE", "waiting_list", {
          entityId: waitingListEntry.id,
          message: `Marked ${user?.firstName} ${user?.lastName} (${user?.email}) as assigned in waiting list due to bulk spot assignment (${spotIds.length} spots: ${assignedSpotIds})`,
          before: waitingListEntry,
          after: updatedWaitingListEntry
        });
      }
      
      const updatedSpots = [];
      const actorId = getAuthenticatedUserId(req);
      
      for (const spotId of spotIds) {
        // Fetch existing spot to preserve its isBciManaged value
        const existingSpot = await storage.getParkingSpot(spotId);
        
        // Build update data with proper isBciManaged logic
        // Since isBciManaged has .notNull().default(false), it ALWAYS has a value
        // 1. If isBciManaged is explicitly provided → use that value
        // 2. Otherwise → preserve the existing spot's isBciManaged value
        const updateData = {
          ownerId: userId,
          isBookable: false,
          ...(isBciManaged !== undefined 
            ? { isBciManaged } 
            : existingSpot?.isBciManaged !== undefined 
              ? { isBciManaged: existingSpot.isBciManaged }
              : {})
        };
        
        const updatedSpot = await storage.updateParkingSpot(spotId, updateData);
        if (updatedSpot) {
          updatedSpots.push(updatedSpot);
          
          // Record spot assignment history for each spot
          await storage.recordSpotAssignment({
            spotId,
            userId,
            action: 'assigned',
            effectiveAt: new Date(),
            actorId: actorId || undefined,
            notes: waitingListEntry ? 'Bulk assigned from waiting list' : 'Bulk assignment'
          });
        }
      }
      
      // Audit the bulk assignment
      await auditService.logAction("BULK_UPDATE", "parking_spot", {
        entityId: spotIds.join(","),
        message: `Bulk assigned ${updatedSpots.length} parking spots to ${user?.firstName} ${user?.lastName} (${user?.email})`,
        after: {
          spotIds,
          userId,
          assignedCount: updatedSpots.length,
          totalRequested: spotIds.length,
          assignedSpots: updatedSpots.map(s => ({ id: s.id, spotNumber: s.spotNumber, locationId: s.locationId }))
        }
      });
      
      // Automatic role change: if user doesn't have owner role, add it
      if (user && !user.roles.includes("owner")) {
        await storage.addUserRole(userId, "owner");
      }
      
      res.json({ 
        success: true, 
        assignedSpots: updatedSpots.length,
        totalRequested: spotIds.length,
        spots: updatedSpots 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error bulk assigning parking spots:", error);
      res.status(500).json({ error: "Failed to bulk assign parking spots" });
    }
  });

  // Create parking spot (Admin only) - allows null ownerId for unallocated spots
  app.post("/api/admin/spots", requireAdmin, async (req, res) => {
    try {
      // Validate request body - allow null ownerId for unallocated spots
      const adminSpotSchema = insertParkingSpotSchema.extend({
        ownerId: insertParkingSpotSchema.shape.ownerId.nullable()
      });
      
      const validatedData = adminSpotSchema.parse(req.body);
      
      const newSpot = await storage.createParkingSpot(validatedData);
      
      // Audit the admin spot creation
      await auditService.logAction("CREATE", "parking_spot", {
        entityId: newSpot.id,
        message: `Admin created parking spot ${newSpot.spotNumber}${newSpot.ownerId ? ` (assigned to ${newSpot.ownerId})` : ' (unallocated)'}`,
        after: newSpot
      });
      
      res.json(newSpot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating admin parking spot:", error);
      res.status(500).json({ error: "Failed to create parking spot" });
    }
  });

  // Get all users for assignment dropdown (Admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Support status filtering via query parameter
      const { status } = req.query;
      
      // Include deleted users only when filtering for "deleted" status
      const includeDeleted = status === 'deleted';
      
      // Get all actual users from storage
      const allUsers = await storage.getAllUsers?.(includeDeleted) || [];
      const allSpots = await storage.getAllParkingSpots?.() || [];
      const allBookings = await storage.getAllBookings?.() || [];
      const allDepartments = await storage.getDepartments?.() || [];
      
      // Create a map for quick department lookups
      const departmentMap = new Map(allDepartments.map((dept: any) => [dept.id, dept.name]));
      
      // Apply status filter if specified
      let filteredUsers = allUsers;
      if (status && status !== 'all' && typeof status === 'string') {
        filteredUsers = allUsers.filter(user => user.status === status);
      }
      
      // Calculate real spots and bookings counts for each user
      const usersWithCounts = filteredUsers.map(user => {
        const userSpots = allSpots.filter(spot => spot.ownerId === user.id);
        
        // Separate booking counts for renter vs owner
        const renterBookings = allBookings.filter(booking => booking.renterId === user.id);
        const ownerBookings = allBookings.filter(booking => booking.ownerId === user.id);
        
        // Get department name from department ID
        const departmentName = user.departmentId ? departmentMap.get(user.departmentId) : undefined;
        
        return {
          id: user.id,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
          email: user.email,
          phone: user.phone || "",
          departmentId: user.departmentId,
          department: departmentName || "Unknown",
          roles: user.roles,
          status: user.status || "active",
          spotsOwned: userSpots.length,
          renterBookingsCount: renterBookings.length,
          ownerBookingsCount: ownerBookings.length,
          lastLogin: user.lastLogin ? (user.lastLogin instanceof Date ? user.lastLogin.toISOString() : user.lastLogin) : new Date().toISOString(),
          memberSince: user.memberSince || (user.createdAt ? (user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt) : new Date().toISOString())
        };
      });
      
      res.json(usersWithCounts);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Search users for assignment (Admin only)
  app.get("/api/admin/search-users", requireAdmin, async (req, res) => {
    try {
      const { query } = req.query;
      
      // Validate query parameter
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query parameter is required" });
      }
      
      // Minimum query length check
      if (query.length < 3) {
        return res.status(400).json({ error: "Query must be at least 3 characters long" });
      }
      
      const users = await storage.searchUsers(query);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Get parking spots assigned to a specific user (Admin only)
  app.get("/api/admin/users/:userId/spots", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const spots = await storage.getParkingSpotsByOwner(userId);
      
      // No audit logging for simple data retrieval - saves database space
      
      res.json(spots);
    } catch (error) {
      console.error("Error fetching user parking spots:", error);
      res.status(500).json({ error: "Failed to fetch user parking spots" });
    }
  });

  // Helper function to handle spot unassignment logic
  // Cancels future bookings and sends notifications to affected users
  async function handleSpotUnassignment(
    spotId: string,
    spot: { spotNumber: string; locationId: number },
    formerOwner: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null | undefined
  ): Promise<{ cancelledBookingsCount: number; notifiedRenters: string[] }> {
    const result = { cancelledBookingsCount: 0, notifiedRenters: [] as string[] };
    
    if (!formerOwner) return result;
    
    try {
      // Get location details for notifications
      const location = await storage.getLocation(spot.locationId);
      const locationName = location ? `${location.office} - ${location.level}` : 'Unknown Location';
      const buildingName = location?.building || 'Unknown Building';
      
      // Get all bookings for this spot
      const allBookings = await storage.getBookingsBySpot(spotId);
      
      // Filter for future bookings (today and onwards) that are not already cancelled
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureBookings = allBookings.filter(booking => {
        const bookingDate = new Date(booking.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= today && booking.status !== 'cancelled';
      });
      
      if (futureBookings.length === 0) {
        // No future bookings to cancel, but still notify former owner
        const { sendSpotUnassignmentNotification } = await import('./notification-service');
        const formerOwnerPrefs = await storage.getNotificationPreferences(formerOwner.id);
        await sendSpotUnassignmentNotification(
          {
            name: `${formerOwner.firstName || ''} ${formerOwner.lastName || ''}`.trim() || 'User',
            email: formerOwner.email || null,
            id: formerOwner.id
          },
          { spotNumber: spot.spotNumber, location: locationName, building: buildingName },
          0,
          formerOwnerPrefs || {}
        );
        return result;
      }
      
      // Group bookings by renter for notifications
      const bookingsByRenter = new Map<string, typeof futureBookings>();
      
      for (const booking of futureBookings) {
        // Cancel the booking
        await storage.updateBooking(booking.id, { 
          status: 'cancelled',
          adminNotes: `Automatically cancelled due to spot unassignment on ${new Date().toISOString().split('T')[0]}`
        });
        result.cancelledBookingsCount++;
        
        // Group for notification
        const renterBookings = bookingsByRenter.get(booking.renterId) || [];
        renterBookings.push(booking);
        bookingsByRenter.set(booking.renterId, renterBookings);
      }
      
      // Import notification functions
      const { sendSpotUnassignmentNotification, sendBookingsCancelledDueToUnassignmentNotification } = await import('./notification-service');
      
      // Notify each affected renter
      for (const [renterId, renterBookings] of Array.from(bookingsByRenter.entries())) {
        const renter = await storage.getUser(renterId);
        if (renter) {
          const cancelledBookingDetails = renterBookings.map((b: typeof futureBookings[0]) => ({
            bookingDate: b.bookingDate,
            spotNumber: spot.spotNumber,
            location: locationName,
            building: buildingName
          }));
          
          const renterPrefs = await storage.getNotificationPreferences(renter.id);
          await sendBookingsCancelledDueToUnassignmentNotification(
            {
              name: `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || 'User',
              email: renter.email || null,
              id: renter.id
            },
            cancelledBookingDetails,
            `${formerOwner.firstName || ''} ${formerOwner.lastName || ''}`.trim() || 'Previous Owner',
            renterPrefs || {}
          );
          if (renter.email) {
            result.notifiedRenters.push(renter.email);
          }
        }
      }
      
      // Notify the former owner about unassignment
      const formerOwnerPrefs = await storage.getNotificationPreferences(formerOwner.id);
      await sendSpotUnassignmentNotification(
        {
          name: `${formerOwner.firstName || ''} ${formerOwner.lastName || ''}`.trim() || 'User',
          email: formerOwner.email || null,
          id: formerOwner.id
        },
        { spotNumber: spot.spotNumber, location: locationName, building: buildingName },
        result.cancelledBookingsCount,
        formerOwnerPrefs || {}
      );
      
      console.log(`[Spot Unassignment] Spot ${spot.spotNumber}: Cancelled ${result.cancelledBookingsCount} future booking(s), notified ${result.notifiedRenters.length} renter(s) and former owner`);
      
    } catch (error) {
      console.error('[Spot Unassignment] Error handling unassignment:', error);
    }
    
    return result;
  }

  // Get future bookings for a spot (Admin only) - used to show affected bookings before unassignment/reassignment
  app.get("/api/admin/spots/:spotId/future-bookings", requireAdmin, async (req, res) => {
    try {
      const { spotId } = req.params;
      
      // Check if spot exists
      const spot = await storage.getParkingSpot(spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Get all bookings for this spot
      const allBookings = await storage.getBookingsBySpot(spotId);
      
      // Filter for future bookings (today and onwards) that are not already cancelled
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const futureBookings = allBookings.filter(booking => {
        const bookingDate = new Date(booking.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate >= today && booking.status !== 'cancelled';
      });
      
      // Get renter details for each booking
      const bookingsWithDetails = await Promise.all(
        futureBookings.map(async (booking) => {
          const renter = await storage.getUser(booking.renterId);
          return {
            id: booking.id,
            bookingDate: booking.bookingDate,
            status: booking.status,
            renterName: renter ? `${renter.firstName || ''} ${renter.lastName || ''}`.trim() : 'Unknown',
            renterEmail: renter?.email || 'Unknown',
            dailyRate: booking.dailyRate
          };
        })
      );
      
      // Sort by booking date
      bookingsWithDetails.sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
      
      res.json({
        spotId,
        spotNumber: spot.spotNumber,
        count: bookingsWithDetails.length,
        bookings: bookingsWithDetails
      });
    } catch (error) {
      console.error("Error fetching future bookings:", error);
      res.status(500).json({ error: "Failed to fetch future bookings" });
    }
  });

  // Unassign parking spot from user (Admin only)
  app.put("/api/admin/spots/:spotId/unassign", requireAdmin, async (req, res) => {
    try {
      const { spotId } = req.params;
      
      // Check if spot exists
      const existingSpot = await storage.getParkingSpot(spotId);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Get user info for audit logging if spot is currently assigned
      let formerOwner = null;
      if (existingSpot.ownerId) {
        formerOwner = await storage.getUser(existingSpot.ownerId);
      }
      
      // Unassign by setting ownerId to null
      const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: null });
      if (!updatedSpot) {
        return res.status(404).json({ error: "Failed to unassign parking spot" });
      }
      
      // Record spot unassignment history
      if (existingSpot.ownerId) {
        const actorId = getAuthenticatedUserId(req);
        await storage.recordSpotAssignment({
          spotId,
          userId: existingSpot.ownerId,
          action: 'unassigned',
          effectiveAt: new Date(),
          actorId: actorId || undefined,
          notes: undefined
        });
      }
      
      // Audit the spot unassignment
      await auditService.logAction("UNASSIGN", "parking_spot", {
        entityId: spotId,
        message: `Admin unassigned parking spot ${updatedSpot.spotNumber}${formerOwner ? ` from ${formerOwner.firstName} ${formerOwner.lastName} (${formerOwner.email})` : ''}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      // Automatic role change: if former owner has 0 remaining spots and is an owner, remove owner role
      if (existingSpot.ownerId && formerOwner && formerOwner.roles.includes("owner")) {
        const remainingSpots = await storage.getParkingSpotsByOwner(existingSpot.ownerId);
        if (remainingSpots.length === 0) {
          await storage.removeUserRole(existingSpot.ownerId, "owner");
        }
      }
      
      // Handle unassignment: cancel future bookings and send notifications
      const unassignmentResult = await handleSpotUnassignment(
        spotId,
        { spotNumber: existingSpot.spotNumber, locationId: existingSpot.locationId },
        formerOwner
      );
      
      res.json({ 
        ...updatedSpot, 
        cancelledBookingsCount: unassignmentResult.cancelledBookingsCount,
        notifiedRenters: unassignmentResult.notifiedRenters
      });
    } catch (error) {
      console.error("Error unassigning parking spot:", error);
      res.status(500).json({ error: "Failed to unassign parking spot" });
    }
  });

  // Update any parking spot (Admin only)
  const updateSpotHandler = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if spot exists
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Validate request body
      const validatedData = insertParkingSpotSchema.partial().parse(req.body);
      
      // Check if ownerId is being changed (unassignment or reassignment)
      const isOwnerChanging = 'ownerId' in validatedData && 
        existingSpot.ownerId !== null && 
        existingSpot.ownerId !== validatedData.ownerId;
      
      // Get former owner info before update if owner is changing
      let formerOwner = null;
      if (isOwnerChanging && existingSpot.ownerId) {
        formerOwner = await storage.getUser(existingSpot.ownerId);
      }
      
      const updatedSpot = await storage.updateParkingSpot(id, validatedData);
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the admin spot update
      await auditService.logAction("UPDATE", "parking_spot", {
        entityId: updatedSpot.id,
        message: `Admin updated parking spot ${updatedSpot.spotNumber}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      // Handle owner change: cancel future bookings and notify affected users
      let unassignmentResult = { cancelledBookingsCount: 0, notifiedRenters: [] as string[] };
      if (isOwnerChanging && formerOwner) {
        // Record unassignment history
        const actorId = getAuthenticatedUserId(req);
        await storage.recordSpotAssignment({
          spotId: id,
          userId: existingSpot.ownerId!,
          action: 'unassigned',
          effectiveAt: new Date(),
          actorId: actorId || undefined,
          notes: validatedData.ownerId ? 'Reassigned to another user' : 'Unassigned'
        });
        
        // Cancel future bookings and send notifications
        unassignmentResult = await handleSpotUnassignment(
          id,
          { spotNumber: existingSpot.spotNumber, locationId: existingSpot.locationId },
          formerOwner
        );
        
        // Remove owner role if no remaining spots
        if (formerOwner.roles.includes("owner")) {
          const remainingSpots = await storage.getParkingSpotsByOwner(existingSpot.ownerId!);
          if (remainingSpots.length === 0) {
            await storage.removeUserRole(existingSpot.ownerId!, "owner");
          }
        }
      }
      
      res.json({
        ...updatedSpot,
        ...(isOwnerChanging ? {
          cancelledBookingsCount: unassignmentResult.cancelledBookingsCount,
          notifiedRenters: unassignmentResult.notifiedRenters
        } : {})
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating parking spot:", error);
      res.status(500).json({ error: "Failed to update parking spot" });
    }
  };

  app.put("/api/admin/spots/:id", requireAdmin, updateSpotHandler);
  app.patch("/api/admin/spots/:id", requireAdmin, updateSpotHandler);

  // Delete any parking spot (Admin only)
  app.delete("/api/admin/spots/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if spot exists
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Check for future paid bookings - prevent deletion if there are any
      const allBookings = await storage.getBookingsBySpot(id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find future bookings that are paid/confirmed
      const futurePaidBookings = allBookings.filter(b => {
        const bookingDate = new Date(b.bookingDate);
        bookingDate.setHours(0, 0, 0, 0);
        const isFuture = bookingDate >= today;
        const isPaid = b.status === 'confirmed' || b.status === 'completed' || 
                       b.paymentStatus === 'received' || b.paymentStatus === 'payroll';
        return isFuture && isPaid;
      });
      
      if (futurePaidBookings.length > 0) {
        // Get renter details for each booking
        const bookingDetails = await Promise.all(futurePaidBookings.map(async (b) => {
          const renter = await storage.getUser(b.renterId);
          return {
            bookingDate: b.bookingDate,
            renterName: renter ? `${renter.firstName || ''} ${renter.lastName || ''}`.trim() : 'Unknown',
            renterEmail: renter?.email || 'Unknown',
            status: b.status,
            paymentStatus: b.paymentStatus
          };
        }));
        
        // Format as a simple comma-separated list for clean display
        const bookingSummary = bookingDetails.map(b => 
          `${b.bookingDate} (${b.renterName})`
        ).join(', ');
        
        return res.status(409).json({ 
          error: `Cannot delete spot with ${futurePaidBookings.length} future paid booking(s). Please cancel or refund first: ${bookingSummary}`
        });
      }
      
      // Delete related records first to avoid foreign key violations
      // 1. Delete spot assignment history
      await storage.deleteSpotAssignmentHistoryBySpotId(id);
      
      // 2. Delete any spot locks
      await storage.deleteSpotLocksBySpotId(id);
      
      // 3. Soft-delete spot listings (set deleted_at) - this includes unbooked available listings
      await storage.softDeleteListingsBySpotId(id);
      
      const deleted = await storage.deleteParkingSpot(id);
      if (!deleted) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the admin spot deletion
      await auditService.logAction("DELETE", "parking_spot", {
        entityId: id,
        message: `Admin deleted parking spot ${existingSpot.spotNumber}`,
        before: existingSpot
      });
      
      res.json({ success: true, message: "Parking spot deleted successfully" });
    } catch (error) {
      console.error("Error deleting parking spot:", error);
      res.status(500).json({ error: "Failed to delete parking spot" });
    }
  });

  // Toggle spot bookability (Admin only)
  app.post("/api/admin/spots/toggle-bookability", requireAdmin, async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = toggleBookabilitySchema.parse(req.body);
      const { spotId, isBookable } = validatedData;
      
      // Get spot info before update for audit logging
      const existingSpot = await storage.getParkingSpot(spotId);
      
      const updatedSpot = await storage.toggleSpotBookability(spotId, isBookable);
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the bookability toggle
      await auditService.logAction("UPDATE", "parking_spot", {
        entityId: spotId,
        message: `${isBookable ? 'Enabled' : 'Disabled'} bookability for spot ${updatedSpot.spotNumber}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      res.json({ 
        success: true, 
        spot: updatedSpot,
        message: `Spot ${updatedSpot.spotNumber} bookability ${isBookable ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error toggling spot bookability:", error);
      res.status(500).json({ error: "Failed to toggle spot bookability" });
    }
  });

  // Bulk toggle spot bookability (Admin only)
  app.post("/api/admin/spots/bulk-toggle-bookability", requireAdmin, async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = bulkToggleBookabilitySchema.parse(req.body);
      const { spotIds, isBookable } = validatedData;
      
      const updatedSpots = await storage.bulkToggleSpotBookability(spotIds, isBookable);
      
      // Audit the bulk bookability toggle
      await auditService.logAction("BULK_UPDATE", "parking_spot", {
        entityId: spotIds.join(","),
        message: `Bulk ${isBookable ? 'enabled' : 'disabled'} bookability for ${updatedSpots.length} spots`,
        after: { 
          spotIds, 
          isBookable, 
          count: updatedSpots.length,
          updatedSpots: updatedSpots.map(s => ({ id: s.id, spotNumber: s.spotNumber, isBookable: s.isBookable }))
        }
      });
      
      res.json({ 
        success: true, 
        updatedSpots,
        count: updatedSpots.length,
        message: `${updatedSpots.length} spots bookability ${isBookable ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error bulk toggling spot bookability:", error);
      res.status(500).json({ error: "Failed to bulk toggle spot bookability" });
    }
  });

  // Bulk update parking spots (Admin only)
  app.post("/api/admin/spots/bulk-update", requireAdmin, async (req, res) => {
    try {
      // Validate request body with Zod
      const validatedData = bulkUpdateSpotsSchema.parse(req.body);
      const { spotIds, updates } = validatedData;
      
      // Build the update object with only provided fields
      const updateData: any = {};
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.isBookable !== undefined) updateData.isBookable = updates.isBookable;
      
      // Perform bulk update using Drizzle with inArray
      await db.update(parkingSpots)
        .set(updateData)
        .where(inArray(parkingSpots.id, spotIds));
      
      // Fetch updated spots for audit and response
      const updatedSpots = await Promise.all(
        spotIds.map(id => storage.getParkingSpot(id))
      );
      const validUpdatedSpots = updatedSpots.filter(spot => spot !== undefined);
      
      // Audit the bulk update
      const updateDescription = Object.entries(updates)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      
      await auditService.logAction("BULK_UPDATE", "parking_spot", {
        entityId: spotIds.join(","),
        message: `Bulk updated ${validUpdatedSpots.length} spots: ${updateDescription}`,
        after: { 
          spotIds, 
          updates,
          count: validUpdatedSpots.length,
          updatedSpots: validUpdatedSpots.map(s => ({ 
            id: s!.id, 
            spotNumber: s!.spotNumber, 
            isActive: s!.isActive,
            isBookable: s!.isBookable 
          }))
        }
      });
      
      res.json({ 
        success: true, 
        count: validUpdatedSpots.length,
        message: `Successfully updated ${validUpdatedSpots.length} spots` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error bulk updating spots:", error);
      res.status(500).json({ error: "Failed to bulk update spots" });
    }
  });

  // Bulk update seat numbers from mapping (Admin only)
  app.post("/api/admin/spots/bulk-seat-numbers", requireAdmin, async (req, res) => {
    try {
      const { mappings } = req.body;
      
      if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ error: "Invalid input: 'mappings' array required" });
      }
      
      // Validate each mapping has spotNumber and seatNumber
      const validMappings = mappings.filter((m: any) => m.spotNumber && m.seatNumber);
      
      if (validMappings.length === 0) {
        return res.status(400).json({ error: "No valid mappings found. Each mapping needs spotNumber and seatNumber." });
      }
      
      // Get all spots to find IDs by spotNumber
      const allSpots = await db.select().from(parkingSpots);
      const spotsByNumber = new Map(allSpots.map(s => [s.spotNumber, s]));
      
      let updated = 0;
      let notFound: string[] = [];
      
      for (const mapping of validMappings) {
        const spot = spotsByNumber.get(mapping.spotNumber);
        if (spot) {
          await db.update(parkingSpots)
            .set({ seatNumber: String(mapping.seatNumber) })
            .where(eq(parkingSpots.id, spot.id));
          updated++;
        } else {
          notFound.push(mapping.spotNumber);
        }
      }
      
      // Audit the bulk seat number update
      await auditService.logAction("BULK_UPDATE", "parking_spot", {
        entityId: "seat_numbers",
        message: `Bulk updated seat numbers for ${updated} spots`,
        after: { 
          updated,
          notFound,
          mappingsCount: validMappings.length
        }
      });
      
      res.json({ 
        success: true, 
        updated,
        notFound,
        message: `Updated ${updated} spots. ${notFound.length > 0 ? `Not found: ${notFound.join(', ')}` : ''}` 
      });
    } catch (error) {
      console.error("Error bulk updating seat numbers:", error);
      res.status(500).json({ error: "Failed to bulk update seat numbers" });
    }
  });

  // Bulk create spot listings (Admin only)
  app.post("/api/admin/bulk-create-listings", requireAdmin, async (req: any, res) => {
    try {
      console.log('[DEBUG] Bulk create listings - req.body.dailyRate:', req.body.dailyRate, 'Type:', typeof req.body.dailyRate);
      
      // Validate request body with Zod
      const validatedData = bulkCreateListingsSchema.parse(req.body);
      const { spotIds, listingType, singleDate, periodStartDate, periodEndDate, dailyRate, donateToCharity } = validatedData;
      
      console.log('[DEBUG] After Zod validation - dailyRate:', dailyRate, 'Type:', typeof dailyRate);
      
      // Get admin user ID for listings ownership
      const adminUserId = getAuthenticatedUserId(req);
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // DATE VALIDATION: Ensure all dates are today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      if (listingType === 'single') {
        if (singleDate && singleDate < todayStr) {
          return res.status(400).json({ 
            error: "Cannot create listing for past dates. Please select today or a future date."
          });
        }
      } else if (listingType === 'period') {
        if (periodStartDate && periodStartDate < todayStr) {
          return res.status(400).json({ 
            error: "Period start date cannot be in the past. Please select today or a future date."
          });
        }
        if (periodEndDate && periodEndDate < todayStr) {
          return res.status(400).json({ 
            error: "Period end date cannot be in the past."
          });
        }
      }
      
      // MAX FUTURE DATE VALIDATION: Ensure dates are within 6 months from today
      const maxFutureDateStr = getMaxFutureDate().toISOString().split('T')[0];
      if (listingType === 'single') {
        if (singleDate && isDateBeyondMaxFuture(singleDate)) {
          return res.status(400).json({ 
            error: `Cannot create listings more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      } else if (listingType === 'period') {
        if (periodStartDate && isDateBeyondMaxFuture(periodStartDate)) {
          return res.status(400).json({ 
            error: `Period start date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
        if (periodEndDate && isDateBeyondMaxFuture(periodEndDate)) {
          return res.status(400).json({ 
            error: `Period end date cannot be more than ${MAX_FUTURE_MONTHS} months in the future. Maximum allowed date is ${maxFutureDateStr}.`
          });
        }
      }
      
      // Check for overlapping listings on each spot
      for (const spotId of spotIds) {
        const existingListings = await storage.getSpotListingsBySpot(spotId);
        const activeListings = existingListings.filter(l => l.status === 'available' || l.status === 'booked');
        
        const newListing = {
          listingType,
          singleDate: singleDate || null,
          periodStartDate: periodStartDate || null,
          periodEndDate: periodEndDate || null,
          recurringStartDate: null,
          recurringEndDate: null,
          daysOfWeek: null
        };
        
        for (const existing of activeListings) {
          const overlappingDates = checkListingOverlap(newListing, existing);
          
          if (overlappingDates.length > 0) {
            const spot = await storage.getParkingSpot(spotId);
            const overlapCount = overlappingDates.length;
            const sampleDates = overlappingDates.slice(0, 3).join(', ');
            const moreText = overlapCount > 3 ? ` and ${overlapCount - 3} more date(s)` : '';
            
            return res.status(409).json({ 
              error: `Spot ${spot?.spotNumber || spotId} already has a listing that overlaps with the dates you selected. Conflicting dates: ${sampleDates}${moreText}. Please remove the existing listing first or choose different dates.`
            });
          }
        }
      }
      
      // Create the listing data object
      const dailyRateString = dailyRate.toString();
      console.log('[DEBUG] dailyRate after toString():', dailyRateString);
      
      const listingData: any = {
        listingType,
        dailyRate: dailyRateString,
        status: "available",
        donateToCharity: donateToCharity || false,
        createdByAdmin: true  // Admin-created listings always use payroll deduction
      };

      if (listingType === "single" && singleDate) {
        listingData.singleDate = singleDate;
      } else if (listingType === "period" && periodStartDate && periodEndDate) {
        listingData.periodStartDate = periodStartDate;
        listingData.periodEndDate = periodEndDate;
      }

      // Create listings for all selected spots with admin as owner
      const createdListings = await storage.bulkCreateSpotListings(spotIds, listingData, adminUserId);
      
      // Update all spots to be bookable when listings are created
      for (const spotId of spotIds) {
        await storage.updateParkingSpot(spotId, { isBookable: true });
      }
      
      // Audit the bulk creation
      const dateDescription = listingType === "single" 
        ? `for ${singleDate}`
        : `from ${periodStartDate} to ${periodEndDate}`;
      
      await auditService.logAction("CREATE", "spot_listing", {
        entityId: spotIds.join(","),
        message: `Bulk created ${createdListings.length} spot listings ${dateDescription} at $${dailyRate}/day`,
        after: { 
          spotIds, 
          listingType,
          singleDate,
          periodStartDate,
          periodEndDate,
          dailyRate,
          count: createdListings.length,
          createdListings: createdListings.map(l => ({ 
            id: l.id, 
            spotId: l.spotId, 
            dailyRate: l.dailyRate,
            listingType: l.listingType
          }))
        }
      });
      
      res.json({ 
        success: true, 
        createdListings,
        count: createdListings.length,
        message: `Successfully created ${createdListings.length} spot listings` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error bulk creating spot listings:", error);
      res.status(500).json({ error: "Failed to bulk create spot listings" });
    }
  });

  // Get recent assignments (Admin only)
  app.get("/api/admin/recent-assignments", requireAdmin, async (req, res) => {
    try {
      const { days } = req.query;
      const daysBack = days ? parseInt(days as string) : 7;
      
      if (isNaN(daysBack) || daysBack <= 0) {
        return res.status(400).json({ error: "Invalid days parameter" });
      }
      
      const recentAssignments = await storage.getRecentAssignments(daysBack);
      
      // Enrich with spot details
      const enrichedAssignments = await Promise.all(
        recentAssignments.map(async (assignment) => {
          const spot = assignment.assignedSpotId 
            ? await storage.getParkingSpot(assignment.assignedSpotId)
            : null;
          
          return {
            ...assignment,
            spotDetails: spot ? {
              spotNumber: spot.spotNumber,
              locationId: spot.locationId,
              spotTypeId: spot.spotTypeId,
              isIndoor: spot.isIndoor
            } : null
          };
        })
      );
      
      res.json(enrichedAssignments);
    } catch (error) {
      console.error("Error fetching recent assignments:", error);
      res.status(500).json({ error: "Failed to fetch recent assignments" });
    }
  });

  // ===== LOCKER MANAGEMENT ENDPOINTS =====

  // 1. GET /api/admin/lockers - Get all lockers (Admin only)
  app.get("/api/admin/lockers", requireAdmin, async (req, res) => {
    try {
      const lockers = await storage.getAllLockers();
      res.json(lockers);
    } catch (error) {
      console.error("Error fetching lockers:", error);
      res.status(500).json({ error: "Failed to fetch lockers" });
    }
  });

  // 2. GET /api/admin/lockers/:id - Get locker by ID (Admin only)
  app.get("/api/admin/lockers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const locker = await storage.getLockerById(id);
      
      if (!locker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      res.json(locker);
    } catch (error) {
      console.error("Error fetching locker:", error);
      res.status(500).json({ error: "Failed to fetch locker" });
    }
  });

  // 3. GET /api/admin/lockers/location/:locationId - Get lockers by location (Admin only)
  app.get("/api/admin/lockers/location/:locationId", requireAdmin, async (req, res) => {
    try {
      const { locationId } = req.params;
      const lockers = await storage.getLockersByLocation(parseInt(locationId));
      res.json(lockers);
    } catch (error) {
      console.error("Error fetching lockers by location:", error);
      res.status(500).json({ error: "Failed to fetch lockers by location" });
    }
  });

  // 4. POST /api/admin/lockers - Create new locker (Admin only)
  app.post("/api/admin/lockers", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertLockerSchema.parse(req.body);
      const newLocker = await storage.createLocker(validatedData);
      
      await auditService.logAction("CREATE", "locker", {
        entityId: newLocker.id,
        message: `Created locker ${newLocker.lockerNumber}`,
        after: newLocker
      });
      
      res.status(201).json(newLocker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating locker:", error);
      res.status(500).json({ error: "Failed to create locker" });
    }
  });

  // 5. PATCH /api/admin/lockers/:id - Update locker (Admin only)
  app.patch("/api/admin/lockers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingLocker = await storage.getLockerById(id);
      if (!existingLocker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      const validatedData = insertLockerSchema.partial().parse(req.body);
      const updatedLocker = await storage.updateLocker(id, validatedData);
      
      if (!updatedLocker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      await auditService.logAction("UPDATE", "locker", {
        entityId: updatedLocker.id,
        message: `Updated locker ${updatedLocker.lockerNumber}`,
        before: existingLocker,
        after: updatedLocker
      });
      
      res.json(updatedLocker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating locker:", error);
      res.status(500).json({ error: "Failed to update locker" });
    }
  });

  // 6. DELETE /api/admin/lockers/:id - Delete locker (Admin only)
  app.delete("/api/admin/lockers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingLocker = await storage.getLockerById(id);
      if (!existingLocker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      await storage.deleteLocker(id);
      
      await auditService.logAction("DELETE", "locker", {
        entityId: id,
        message: `Deleted locker ${existingLocker.lockerNumber}`,
        before: existingLocker
      });
      
      res.json({ success: true, message: "Locker deleted successfully" });
    } catch (error) {
      console.error("Error deleting locker:", error);
      res.status(500).json({ error: "Failed to delete locker" });
    }
  });

  // 7. POST /api/admin/lockers/:id/assign - Assign locker to user (Admin only)
  app.post("/api/admin/lockers/:id/assign", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId, effectiveDate, notes } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      
      const actorId = getAuthenticatedUserId(req);
      if (!actorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const existingLocker = await storage.getLockerById(id);
      if (!existingLocker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const assignedLocker = await storage.assignLocker(id, userId, actorId, effectiveDate, notes);
      
      if (!assignedLocker) {
        return res.status(500).json({ error: "Failed to assign locker" });
      }
      
      await auditService.logAction("ASSIGN", "locker", {
        entityId: id,
        message: `Assigned locker ${assignedLocker.lockerNumber} to ${user.firstName} ${user.lastName} (${user.email})`,
        before: existingLocker,
        after: assignedLocker
      });
      
      res.json(assignedLocker);
    } catch (error) {
      console.error("Error assigning locker:", error);
      res.status(500).json({ error: "Failed to assign locker" });
    }
  });

  // 8. POST /api/admin/lockers/:id/unassign - Unassign locker (Admin only)
  app.post("/api/admin/lockers/:id/unassign", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { effectiveDate, notes } = req.body;
      
      const actorId = getAuthenticatedUserId(req);
      if (!actorId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const existingLocker = await storage.getLockerById(id);
      if (!existingLocker) {
        return res.status(404).json({ error: "Locker not found" });
      }
      
      let formerUser = null;
      if (existingLocker.userId) {
        formerUser = await storage.getUser(existingLocker.userId);
      }
      
      const unassignedLocker = await storage.unassignLocker(id, actorId, effectiveDate, notes);
      
      if (!unassignedLocker) {
        return res.status(500).json({ error: "Failed to unassign locker" });
      }
      
      await auditService.logAction("UNASSIGN", "locker", {
        entityId: id,
        message: `Unassigned locker ${unassignedLocker.lockerNumber}${formerUser ? ` from ${formerUser.firstName} ${formerUser.lastName} (${formerUser.email})` : ''}`,
        before: existingLocker,
        after: unassignedLocker
      });
      
      res.json(unassignedLocker);
    } catch (error) {
      console.error("Error unassigning locker:", error);
      res.status(500).json({ error: "Failed to unassign locker" });
    }
  });

  // 9. GET /api/admin/locker-waitlist - Get all waitlist entries (Admin only)
  app.get("/api/admin/locker-waitlist", requireAdmin, async (req, res) => {
    try {
      const waitlist = await storage.getLockerWaitlist();
      res.json(waitlist);
    } catch (error) {
      console.error("Error fetching locker waitlist:", error);
      res.status(500).json({ error: "Failed to fetch locker waitlist" });
    }
  });

  // 10. POST /api/admin/locker-waitlist - Add to waitlist (Admin only)
  app.post("/api/admin/locker-waitlist", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertLockerWaitlistSchema.parse(req.body);
      const newEntry = await storage.addToLockerWaitlist(validatedData);
      
      await auditService.logAction("CREATE", "locker_waitlist", {
        entityId: newEntry.id,
        message: `Added user ${validatedData.userId} to locker waitlist`,
        after: newEntry
      });
      
      res.status(201).json(newEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error adding to locker waitlist:", error);
      res.status(500).json({ error: "Failed to add to locker waitlist" });
    }
  });

  // 11. PATCH /api/admin/locker-waitlist/:id - Update waitlist status (Admin only)
  app.patch("/api/admin/locker-waitlist/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, fulfilledAt } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      
      // Get existing entry for audit
      const allEntries = await storage.getLockerWaitlist();
      const existingEntry = allEntries.find(entry => entry.id === id);
      
      if (!existingEntry) {
        return res.status(404).json({ error: "Waitlist entry not found" });
      }
      
      const updatedEntry = await storage.updateLockerWaitlistStatus(id, status, fulfilledAt ? new Date(fulfilledAt) : undefined);
      
      if (!updatedEntry) {
        return res.status(404).json({ error: "Waitlist entry not found" });
      }
      
      await auditService.logAction("UPDATE", "locker_waitlist", {
        entityId: id,
        message: `Updated locker waitlist entry for user ${updatedEntry.userId} - status: ${status}`,
        before: existingEntry,
        after: updatedEntry
      });
      
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating locker waitlist:", error);
      res.status(500).json({ error: "Failed to update locker waitlist" });
    }
  });

  // 12. DELETE /api/admin/locker-waitlist/:id - Remove from waitlist (Admin only)
  app.delete("/api/admin/locker-waitlist/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing entry for audit
      const allEntries = await storage.getLockerWaitlist();
      const existingEntry = allEntries.find(entry => entry.id === id);
      
      if (!existingEntry) {
        return res.status(404).json({ error: "Waitlist entry not found" });
      }
      
      await storage.removeFromLockerWaitlist(id);
      
      await auditService.logAction("DELETE", "locker_waitlist", {
        entityId: id,
        message: `Removed user ${existingEntry.userId} from locker waitlist`,
        before: existingEntry
      });
      
      res.json({ success: true, message: "Waitlist entry removed successfully" });
    } catch (error) {
      console.error("Error removing from locker waitlist:", error);
      res.status(500).json({ error: "Failed to remove from locker waitlist" });
    }
  });

  // 13. GET /api/admin/locker-assignment-history - Get assignment history (Admin only)
  app.get("/api/admin/locker-assignment-history", requireAdmin, async (req, res) => {
    try {
      const { lockerId, userId } = req.query;
      
      const history = await storage.getLockerAssignmentHistory(
        lockerId as string | undefined,
        userId as string | undefined
      );
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching locker assignment history:", error);
      res.status(500).json({ error: "Failed to fetch locker assignment history" });
    }
  });

  // 14. GET /api/admin/locker-types - Get all locker types (Admin only)
  app.get("/api/admin/locker-types", requireAdmin, async (req, res) => {
    try {
      const lockerTypes = await storage.getAllLockerTypes();
      res.json(lockerTypes);
    } catch (error) {
      console.error("Error fetching locker types:", error);
      res.status(500).json({ error: "Failed to fetch locker types" });
    }
  });

  // ===== SERVER TIME ENDPOINT =====

  // GET /api/admin/today-pst - Returns today's date string in the configured timezone (Admin only)
  app.get("/api/admin/today-pst", requireAdmin, async (req, res) => {
    try {
      const today = await getTodayInTimezone();
      res.json({ today });
    } catch (error) {
      console.error("[TodayPST] Error fetching today's date:", error);
      res.status(500).json({ error: "Failed to fetch today's date" });
    }
  });

  // ===== APP CONFIGURATION ENDPOINTS =====

  // GET /api/admin/app-configs - Get all app configurations (Admin only)
  app.get("/api/admin/app-configs", requireAdmin, async (req, res) => {
    try {
      let configs = await storage.getAllAppConfigs();
      console.log(`[AppConfigs] Found ${configs.length} existing configs`);
      
      // Auto-initialize any missing default configs
      const defaultConfigs = [
        {
          key: 'lock_timeout_ms',
          value: '30000',
          label: 'Lock Timeout',
          dataType: 'number',
          category: 'booking',
          description: 'Duration in seconds for how long a booking lock is held before it automatically expires. Users must complete their booking within this time.'
        },
        {
          key: 'max_daily_rate',
          value: '18',
          label: 'Maximum Daily Rate',
          dataType: 'number',
          category: 'booking',
          description: 'Maximum allowed daily rate for parking spot listings. Owners and admins cannot set rates higher than this amount.'
        },
        {
          key: 'timezone',
          value: 'America/Los_Angeles',
          label: 'Application Timezone',
          dataType: 'string',
          category: 'system',
          description: 'The timezone used for displaying and calculating all dates and times in the application (e.g., America/Los_Angeles for PST/PDT)'
        },
        {
          key: 'cancellation_window_hours',
          value: '24',
          label: 'Cancellation Window',
          dataType: 'number',
          category: 'booking',
          description: 'Minimum hours before the booking date that cancellation is allowed. Users cannot cancel bookings within this time window.'
        },
        {
          key: 'city_parking_daily_rate',
          value: '15',
          label: 'City Parking Daily Rate',
          dataType: 'number',
          category: 'Pricing',
          description: 'Daily rate (CAD) for city/municipal parking used to compare renter spending against equivalent city parking cost. Renters can toggle this comparison on their Statistics page.'
        },
        {
          key: 'new_badge_days',
          value: '30',
          label: 'New Badge Duration (days)',
          dataType: 'number',
          category: 'system',
          description: 'Number of days a "New!" badge appears on newly introduced features before automatically disappearing.'
        },
        {
          key: 'week_start_day',
          value: 'sunday',
          label: 'Week Start Day',
          dataType: 'string',
          category: 'system',
          description: 'The first day of the week used for the "This Week" date filter. "sunday" means the week runs Sunday to Saturday (end = Saturday). "monday" means the week runs Monday to Sunday (end = Sunday).'
        }
      ];
      
      const existingKeys = new Set(configs.map((c: any) => c.key));
      const missingConfigs = defaultConfigs.filter(d => !existingKeys.has(d.key));
      
      if (missingConfigs.length > 0) {
        console.log(`[AppConfigs] Inserting ${missingConfigs.length} missing default configs...`);
        for (const config of missingConfigs) {
          try {
            await storage.createAppConfig(config);
            console.log(`[AppConfigs] Created config: ${config.key}`);
          } catch (createError) {
            console.error(`[AppConfigs] Failed to create config ${config.key}:`, createError);
          }
        }
        
        configs = await storage.getAllAppConfigs();
        console.log(`[AppConfigs] After initialization: ${configs.length} configs`);
      }
      
      res.json(configs);
    } catch (error) {
      console.error("Error fetching app configs:", error);
      res.status(500).json({ error: "Failed to fetch app configurations" });
    }
  });

  // GET /api/app-configs/:key - Get specific app configuration (Authenticated users)
  app.get("/api/app-configs/:key", isAuthenticated, async (req, res) => {
    try {
      const { key } = req.params;
      const value = await storage.getAppConfigValue(key);
      if (value === undefined) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json({ key, value });
    } catch (error) {
      console.error("Error fetching app config:", error);
      res.status(500).json({ error: "Failed to fetch app configuration" });
    }
  });

  // GET /api/admin/app-configs/:key - Get specific app configuration (Admin only)
  app.get("/api/admin/app-configs/:key", requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const config = await storage.getAppConfig(key);
      
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error fetching app config:", error);
      res.status(500).json({ error: "Failed to fetch app configuration" });
    }
  });

  // PATCH /api/admin/app-configs/:key - Update app configuration (Admin only)
  app.patch("/api/admin/app-configs/:key", requireAdmin, async (req: any, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      
      if (value === undefined || value === null) {
        return res.status(400).json({ error: "Value is required" });
      }
      
      // Get the config to check its data type
      const config = await storage.getAppConfig(key);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      
      // Validate based on data type
      if (config.dataType === 'number') {
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) {
          return res.status(400).json({ error: "Value must be a valid number" });
        }
        // Special validation for timeout values (must be positive)
        if ((key.includes('timeout') || key === 'cancellation_window_hours') && numValue <= 0) {
          return res.status(400).json({ error: "Timeout value must be greater than 0" });
        }
      }
      
      const updatedConfig = await storage.updateAppConfig(key, String(value), req.user?.id);
      
      if (!updatedConfig) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      
      res.json(updatedConfig);
    } catch (error) {
      console.error("Error updating app config:", error);
      res.status(500).json({ error: "Failed to update app configuration" });
    }
  });

  // ===== AUDIT ENDPOINTS =====

  // Get audit logs (Admin only)
  app.get("/api/admin/audits", requireAdmin, async (req, res) => {
    try {
      // Validate and parse query parameters
      const validatedQuery = auditQuerySchema.parse(req.query);
      const {
        from,
        to,
        actorId,
        action,
        entityType,
        entityId,
        success,
        q,
        page = "1",
        pageSize = "50"
      } = validatedQuery;

      // Build audit query filters
      const filters: AuditQueryFilters = {};
      
      if (from) filters.startDate = new Date(from);
      if (to) filters.endDate = new Date(to);
      if (actorId) filters.actorId = actorId;
      if (action) filters.action = action as AuditAction;
      if (entityType) filters.entityType = entityType as EntityType;
      if (entityId) filters.entityId = entityId;
      if (success !== undefined) filters.success = success === "true";
      if (q) filters.searchTerm = q;

      // Build pagination parameters
      const pagination: AuditPagination = {
        page: parseInt(page),
        limit: parseInt(pageSize),
        sortBy: 'occurredAt',
        sortOrder: 'desc'
      };

      // Query audit logs
      const result = await auditStorage.queryAuditLogs(filters, pagination);
      
      // Return data in expected format
      res.json({
        items: result.logs,
        total: result.totalCount,
        page: result.page,
        pageSize: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: error.errors 
        });
      }
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Export audit logs as CSV (Admin only)
  app.get("/api/admin/audits/export", requireAdmin, async (req, res) => {
    try {
      // Validate and parse query parameters
      const validatedQuery = auditQuerySchema.parse(req.query);
      const {
        from,
        to,
        actorId,
        action,
        entityType,
        entityId,
        success,
        q
      } = validatedQuery;

      // Build audit query filters
      const filters: AuditQueryFilters = {};
      
      if (from) filters.startDate = new Date(from);
      if (to) filters.endDate = new Date(to);
      if (actorId) filters.actorId = actorId;
      if (action) filters.action = action as AuditAction;
      if (entityType) filters.entityType = entityType as EntityType;
      if (entityId) filters.entityId = entityId;
      if (success !== undefined) filters.success = success === "true";
      if (q) filters.searchTerm = q;

      // Get all matching audit logs (no pagination for export)
      const pagination: AuditPagination = {
        page: 1,
        limit: 10000, // Large limit for export
        sortBy: 'occurredAt',
        sortOrder: 'desc'
      };

      const result = await auditStorage.queryAuditLogs(filters, pagination);
      
      // Generate CSV content
      const csvHeaders = [
        'Date/Time',
        'Actor ID',
        'Actor Email',
        'Actor Role',
        'Action',
        'Entity Type',
        'Entity ID',
        'Success',
        'Message',
        'IP Address',
        'User Agent'
      ];

      const csvRows = result.logs.map(log => [
        log.occurredAt.toISOString(),
        log.actorId || '',
        log.actorEmail || '',
        log.actorRole || '',
        log.action,
        log.entityType || '',
        log.entityId || '',
        log.success ? 'Yes' : 'No',
        log.message || '',
        (log.requestMeta as any)?.ip || '',
        (log.requestMeta as any)?.userAgent || ''
      ]);

      // Combine headers and rows
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Set CSV response headers
      const timestamp = await getTodayInTimezone();
      const filename = `audit-logs-${timestamp}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: error.errors 
        });
      }
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ error: "Failed to export audit logs" });
    }
  });

  // Get recent user activity (Admin only)
  app.get("/api/admin/user-activity", requireAdmin, async (req, res) => {
    try {
      // Validate and parse query parameters using same schema as audits
      const validatedQuery = auditQuerySchema.parse(req.query);
      const {
        from,
        to,
        actorId,
        q,
        page = "1",
        pageSize = "25"
      } = validatedQuery;

      // Build audit query filters for user-related activities
      const filters: AuditQueryFilters = {
        actions: ["CREATE", "UPDATE", "LOGIN", "LOGOUT", "ACTIVATE", "DEACTIVATE"], 
        entityType: "user"
      };
      
      if (from) filters.startDate = new Date(from);
      if (to) filters.endDate = new Date(to);
      if (actorId) filters.actorId = actorId;
      if (q) filters.searchTerm = q;

      // Build pagination parameters
      const pagination: AuditPagination = {
        page: parseInt(page),
        limit: parseInt(pageSize),
        sortBy: 'occurredAt',
        sortOrder: 'desc'
      };

      // Query audit logs for user activities
      const result = await auditStorage.queryAuditLogs(filters, pagination);
      
      // Transform audit logs to user activity format
      const activityItems = result.logs.map(log => ({
        id: log.id,
        type: log.action === "CREATE" ? "user_created" as const :
              log.action === "UPDATE" ? "user_updated" as const :
              log.action === "LOGIN" ? "login" as const :
              log.action === "LOGOUT" ? "logout" as const :
              log.action === "ACTIVATE" ? "account_activated" as const :
              log.action === "DEACTIVATE" ? "account_deactivated" as const :
              "user_updated" as const,
        user: log.actorEmail || "System User",
        userEmail: log.actorEmail || "",
        action: log.action,
        timestamp: log.occurredAt.toISOString(),
        details: log.message || `${log.action} action on ${log.entityType}`,
        success: log.success
      }));
      
      // Return data in expected format
      res.json({
        items: activityItems,
        total: result.totalCount,
        page: result.page,
        pageSize: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: error.errors 
        });
      }
      console.error("Error fetching user activity:", error);
      res.status(500).json({ error: "Failed to fetch user activity" });
    }
  });

  // Get recent booking activity (Admin only)
  app.get("/api/admin/booking-activity", requireAdmin, async (req, res) => {
    try {
      // Validate and parse query parameters
      const validatedQuery = auditQuerySchema.parse(req.query);
      const {
        from,
        to,
        actorId,
        q,
        page = "1",
        pageSize = "25"
      } = validatedQuery;

      // Get scope parameter
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';

      // Build audit query filters for booking-related activities
      const filters: AuditQueryFilters = {
        actions: ["CREATE", "UPDATE", "CANCEL", "COMPLETE"],
        entityType: undefined // Will search across booking, spot_listing, and parking_spot
      };
      
      if (from) filters.startDate = new Date(from);
      if (to) filters.endDate = new Date(to);
      if (actorId) filters.actorId = actorId;
      if (q) filters.searchTerm = q;

      // Build pagination parameters
      const pagination: AuditPagination = {
        page: parseInt(page),
        limit: parseInt(pageSize),
        sortBy: 'occurredAt',
        sortOrder: 'desc'
      };

      // Query audit logs for booking activities
      const result = await auditStorage.queryAuditLogs(filters, pagination);
      
      // Filter and transform audit logs to booking activity format
      const activityItems = result.logs
        .filter(log => ["booking", "spot_listing", "parking_spot"].includes(log.entityType))
        .map(log => {
          let activityType: 'booking_created' | 'booking_cancelled' | 'booking_completed' | 'payment_received' | 'payment_updated' | 'spot_assigned' | 'listing_created' | 'listing_updated';
          
          if (log.entityType === "booking") {
            if (log.action === "CREATE") activityType = "booking_created";
            else if (log.action === "CANCEL") activityType = "booking_cancelled";
            else if (log.action === "COMPLETE") activityType = "booking_completed";
            else if (log.action === "UPDATE") {
              // Check if it's a payment update based on message content
              if (log.message?.toLowerCase().includes("payment")) {
                activityType = "payment_received";
              } else {
                activityType = "payment_updated";
              }
            } else activityType = "booking_created";
          } else if (log.entityType === "spot_listing") {
            if (log.action === "CREATE") activityType = "listing_created";
            else activityType = "listing_updated";
          } else { // parking_spot
            activityType = "spot_assigned";
          }

          return {
            id: log.id,
            type: activityType,
            user: log.actorEmail || "System User", 
            userEmail: log.actorEmail || "",
            action: log.action,
            timestamp: log.occurredAt.toISOString(),
            details: log.message || `${log.action} action on ${log.entityType}`,
            success: log.success,
            relatedEntity: log.entityId ? {
              type: log.entityType as 'booking' | 'spot_listing' | 'parking_spot',
              id: log.entityId,
              description: log.message?.split(' ')[0] || log.entityType
            } : undefined
          };
        });
      
      // Filter by BCI-managed spots if requested
      let filteredActivityItems = activityItems;
      if (isBciOnly) {
        filteredActivityItems = await Promise.all(
          activityItems.map(async (item) => {
            if (!item.relatedEntity) return null;
            
            try {
              if (item.relatedEntity.type === 'booking') {
                const booking = await storage.getBooking(item.relatedEntity.id);
                if (!booking) return null;
                const spot = await storage.getParkingSpot(booking.spotId);
                return spot?.isBciManaged ? item : null;
              } else if (item.relatedEntity.type === 'spot_listing') {
                const listing = await storage.getSpotListing(item.relatedEntity.id);
                if (!listing) return null;
                const spot = await storage.getParkingSpot(listing.spotId);
                return spot?.isBciManaged ? item : null;
              } else if (item.relatedEntity.type === 'parking_spot') {
                const spot = await storage.getParkingSpot(item.relatedEntity.id);
                return spot?.isBciManaged ? item : null;
              }
              return null;
            } catch (error) {
              console.error(`Error filtering activity item ${item.id}:`, error);
              return null;
            }
          })
        ).then(results => results.filter(item => item !== null));
      }
      
      // Return data in expected format
      res.json({
        items: filteredActivityItems,
        total: filteredActivityItems.length, // Use filtered count
        page: result.page,
        pageSize: result.limit,
        totalPages: Math.ceil(filteredActivityItems.length / result.limit)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid query parameters", 
          details: error.errors 
        });
      }
      console.error("Error fetching booking activity:", error);
      res.status(500).json({ error: "Failed to fetch booking activity" });
    }
  });

  // ===== WAITING LIST ENDPOINTS =====

  // Get all waiting list entries (admin)
  app.get("/api/waiting-list", requireAdmin, async (req, res) => {
    try {
      const entries = await storage.getAllWaitingList();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching waiting list:", error);
      res.status(500).json({ error: "Failed to fetch waiting list" });
    }
  });

  // Get active waiting list entries (admin)
  app.get("/api/waiting-list/active", requireAdmin, async (req, res) => {
    try {
      const entries = await storage.getActiveWaitingList();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching active waiting list:", error);
      res.status(500).json({ error: "Failed to fetch active waiting list" });
    }
  });

  // Get user's waiting list entry
  app.get("/api/waiting-list/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = getAuthenticatedUserId(req);
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to see their own waiting list entry, or admins to see any
      const userRole = await getAuthenticatedUserBaseRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access this waiting list entry" });
      }
      
      const entry = await storage.getWaitingListByUser(userId);
      if (!entry) {
        return res.status(404).json({ error: "No waiting list entry found for this user" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error fetching user waiting list entry:", error);
      res.status(500).json({ error: "Failed to fetch user waiting list entry" });
    }
  });

  // Create waiting list entry
  app.post("/api/waiting-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Get user info for the waiting list entry
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user already has a BCI-managed spot
      const userBciSpots = await db
        .select()
        .from(parkingSpots)
        .where(and(
          eq(parkingSpots.ownerId, userId),
          eq(parkingSpots.isBciManaged, true)
        ))
        .limit(1);
      
      if (userBciSpots.length > 0) {
        return res.status(403).json({ 
          error: "You already have a BCI-assigned spot and cannot enroll in the waiting list" 
        });
      }
      
      // Validate request body and add user information
      const waitingListData = insertWaitingListSchema.parse({
        ...req.body,
        userId: userId,
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
        userEmail: user.email || ''
      });
      
      const entry = await storage.createWaitingListEntry(waitingListData);
      
      // Audit the waiting list entry creation
      await auditService.logAction("CREATE", "waiting_list", {
        entityId: entry.id,
        message: `Created waiting list entry for ${entry.userName} (${entry.userEmail})`,
        after: entry
      });
      
      // Send email notifications for waiting list enrollment
      try {
        const { 
          createWaitingListEnrollmentNotification, 
          createWaitingListEnrollmentAdminNotification,
          sendEmailNotification 
        } = await import('./notification-service');
        
        // Get preferred spot type name if specified
        let preferredSpotTypeName: string | null = null;
        if (entry.preferredSpotTypeId) {
          const spotType = await storage.getSpotType(entry.preferredSpotTypeId);
          preferredSpotTypeName = spotType?.name || null;
        }
        
        const enrollmentDetails = {
          priority: entry.priority,
          preferredSpotType: preferredSpotTypeName,
          enrolledDate: entry.enrolledDate ? new Date(entry.enrolledDate) : new Date()
        };
        
        // Send confirmation email to user
        const userNotification = createWaitingListEnrollmentNotification(
          { name: entry.userName, email: entry.userEmail },
          enrollmentDetails
        );
        await sendEmailNotification(userNotification);
        
        // Send notification to all admins
        const allUsers = await storage.getAllUsers();
        const admins = allUsers.filter(u => u.roles?.includes('admin') && u.email);
        
        for (const admin of admins) {
          const adminNotification = createWaitingListEnrollmentAdminNotification(
            { name: admin.firstName || admin.email || 'Admin', email: admin.email! },
            { name: entry.userName, email: entry.userEmail },
            enrollmentDetails
          );
          await sendEmailNotification(adminNotification);
        }
        
        console.log(`✓ Waiting list enrollment emails sent for ${entry.userName}`);
      } catch (emailError) {
        console.error('Failed to send waiting list enrollment emails:', emailError);
        // Don't fail the request if email sending fails
      }
      
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating waiting list entry:", error);
      res.status(500).json({ error: "Failed to create waiting list entry" });
    }
  });

  // Create waiting list entry (admin) - allows admins to add any user
  app.post("/api/admin/waiting-list", requireAdmin, async (req, res) => {
    try {
      const { userId, ...waitingListData } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      // Get user info for the waiting list entry
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Validate request body and add user information
      const validatedData = insertWaitingListSchema.parse({
        ...waitingListData,
        userId: userId,
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
        userEmail: user.email || '',
        status: 'active'
      });
      
      const entry = await storage.createWaitingListEntry(validatedData);
      
      // Audit the waiting list entry creation
      await auditService.logAction("CREATE", "waiting_list", {
        entityId: entry.id,
        message: `Admin added ${entry.userName} (${entry.userEmail}) to waiting list`,
        after: entry
      });
      
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating waiting list entry (admin):", error);
      res.status(500).json({ error: "Failed to create waiting list entry" });
    }
  });

  // Update waiting list entry (admin)
  app.put("/api/waiting-list/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing entry for audit logging
      const existingEntry = await storage.getWaitingListById(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      
      // Validate request body
      const validatedData = insertWaitingListSchema.partial().parse(req.body);
      
      const updatedEntry = await storage.updateWaitingListEntry(id, validatedData);
      if (!updatedEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      
      // Audit the waiting list entry update
      await auditService.logAction("UPDATE", "waiting_list", {
        entityId: updatedEntry.id,
        message: `Updated waiting list entry for ${updatedEntry.userName} (${updatedEntry.userEmail})`,
        before: existingEntry,
        after: updatedEntry
      });
      
      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating waiting list entry:", error);
      res.status(500).json({ error: "Failed to update waiting list entry" });
    }
  });

  // Assign waiting list user to a spot (admin) - WITH NOTIFICATIONS
  app.post("/api/waiting-list/:id/assign", async (req, res) => {
    try {
      const { id } = req.params;
      const { spotId, spotDetails } = req.body;
      
      if (!spotId) {
        return res.status(400).json({ error: "Spot ID is required" });
      }

      // Get the waiting list entry before assignment
      const waitingListEntry = await storage.getWaitingListById(id);
      if (!waitingListEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }

      // Perform the assignment
      const assignedEntry = await storage.assignWaitingListUser(id, spotId);
      if (!assignedEntry) {
        return res.status(404).json({ error: "Failed to assign waiting list user" });
      }

      // Audit the waiting list assignment
      await auditService.logAction("ASSIGN", "waiting_list", {
        entityId: id,
        message: `Assigned waiting list user ${waitingListEntry.userName} to spot ${spotId}`,
        before: waitingListEntry,
        after: assignedEntry
      });

      // Send notifications (don't block the assignment if notifications fail)
      try {
        const user = {
          id: waitingListEntry.userId,
          name: waitingListEntry.userName,
          email: waitingListEntry.userEmail
        };
        
        // Default spot details if not provided
        const defaultSpotDetails = spotDetails || {
          spotNumber: `Spot-${spotId.slice(-3)}`,
          location: `Building A, Floor 1`,
          building: 'Building A'
        };

        // Send assignment notifications
        const notificationResult = await sendAssignmentNotification(
          user,
          waitingListEntry,
          defaultSpotDetails,
          { emailNotifications: true, pushNotifications: true } // Default preferences
        );

        console.log(`✓ Assignment notifications sent to ${user.name}:`, notificationResult);
        
        res.json({
          ...assignedEntry,
          notificationsSent: notificationResult
        });
      } catch (notificationError) {
        console.error('❌ Failed to send assignment notifications:', notificationError);
        // Still return success for the assignment even if notifications failed
        res.json(assignedEntry);
      }
    } catch (error) {
      console.error('Assignment error:', error);
      res.status(500).json({ error: "Failed to assign waiting list user" });
    }
  });

  // Remove own waiting list entry (user self-service)
  app.delete("/api/waiting-list/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = getAuthenticatedUserId(req);
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Users can only remove their own entry (unless admin)
      const userRole = await getAuthenticatedUserBaseRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "You can only remove your own waiting list entry" });
      }
      
      // Find the user's waiting list entry
      const userEntry = await storage.getWaitingListByUser(userId);
      if (!userEntry) {
        return res.status(404).json({ error: "No waiting list entry found for this user" });
      }
      
      const deleted = await storage.deleteWaitingListEntry(userEntry.id);
      if (!deleted) {
        return res.status(404).json({ error: "Failed to remove waiting list entry" });
      }
      
      // Audit the waiting list entry removal
      await auditService.logAction("DELETE", "waiting_list", {
        entityId: userEntry.id,
        message: `User ${userEntry.userName} (${userEntry.userEmail}) removed themselves from waiting list`,
        before: userEntry
      });
      
      // Send confirmation email to user
      try {
        const { createWaitingListRemovalNotification, sendEmailNotification } = await import('./notification-service');
        const removalNotification = createWaitingListRemovalNotification(
          { name: userEntry.userName, email: userEntry.userEmail }
        );
        await sendEmailNotification(removalNotification);
        console.log(`✓ Waiting list removal email sent for ${userEntry.userName}`);
      } catch (emailError) {
        console.error('Failed to send waiting list removal email:', emailError);
      }
      
      res.json({ success: true, message: "Successfully removed from waiting list" });
    } catch (error) {
      console.error("Error removing user from waiting list:", error);
      res.status(500).json({ error: "Failed to remove from waiting list" });
    }
  });

  // Cancel/remove waiting list entry (admin)
  app.delete("/api/waiting-list/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing entry for audit logging
      const existingEntry = await storage.getWaitingListById(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      
      const deleted = await storage.deleteWaitingListEntry(id);
      if (!deleted) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      
      // Audit the waiting list entry deletion
      await auditService.logAction("DELETE", "waiting_list", {
        entityId: id,
        message: `Deleted waiting list entry for ${existingEntry.userName} (${existingEntry.userEmail})`,
        before: existingEntry
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting waiting list entry:", error);
      res.status(500).json({ error: "Failed to delete waiting list entry" });
    }
  });

  // Permanently delete waiting list entry (admin only - for cancelled records)
  app.delete("/api/waiting-list/:id/permanent", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get existing entry for audit logging
      const existingEntry = await storage.getWaitingListById(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      
      if (existingEntry.status !== 'cancelled') {
        return res.status(400).json({ error: "Only cancelled entries can be permanently deleted" });
      }
      
      const deleted = await storage.permanentDeleteWaitingListEntry(id);
      if (!deleted) {
        return res.status(404).json({ error: "Failed to permanently delete waiting list entry" });
      }
      
      // Audit the permanent deletion
      await auditService.logAction("DELETE", "waiting_list", {
        entityId: id,
        message: `Permanently deleted waiting list entry for ${existingEntry.userName} (${existingEntry.userEmail})`,
        before: existingEntry,
        metadata: { permanentDelete: true }
      });
      
      res.json({ success: true, message: "Waiting list entry permanently deleted" });
    } catch (error: any) {
      console.error("Error permanently deleting waiting list entry:", error);
      res.status(500).json({ error: error.message || "Failed to permanently delete waiting list entry" });
    }
  });

  // ===== NOTIFICATION API ENDPOINTS =====

  // Get user notifications
  app.get("/api/notifications/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = getAuthenticatedUserId(req);
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to see their own notifications, or admins to see any
      const userRole = await getAuthenticatedUserBaseRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access these notifications" });
      }
      
      const notifications = await storage.getInAppNotifications(userId, true);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      if (!updatedNotification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read for user
  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      await storage.markAllNotificationsAsRead(userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Delete all notifications for the authenticated user (must be before :id route)
  app.delete("/api/notifications/delete-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      await storage.deleteAllUserNotifications(userId);
      res.json({ success: true, message: "All notifications deleted" });
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      res.status(500).json({ error: "Failed to delete all notifications" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      await storage.deleteInAppNotification(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Get unread notification count for user
  app.get("/api/notifications/:userId/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = getAuthenticatedUserId(req);
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to see their own unread count, or admins to see any
      const userRole = await getAuthenticatedUserBaseRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access this unread count" });
      }
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Send welcome notification for new waiting list enrollment (Admin only)
  app.post("/api/notifications/welcome", requireAdmin, async (req, res) => {
    try {
      const welcomeNotificationSchema = z.object({
        userId: z.string().min(1, "userId is required"),
        userName: z.string().min(1, "userName is required"),
        userEmail: z.string().email("Valid email is required"),
        waitingListEntry: z.object({
          position: z.number().positive("Position must be positive"),
          requestedDate: z.string(),
          spotPreferences: z.object({
            building: z.string().optional(),
            floor: z.string().optional(),
            spotType: z.string().optional()
          }).optional()
        }),
        preferences: z.object({
          emailNotifications: z.boolean().optional().default(true),
          pushNotifications: z.boolean().optional().default(true)
        }).optional()
      });
      
      const { userId, userName, userEmail, waitingListEntry, preferences } = welcomeNotificationSchema.parse(req.body);

      const user = { id: userId, name: userName, email: userEmail };
      const userPreferences = preferences || { emailNotifications: true, pushNotifications: true };
      
      // Create a mock WaitingList entry for the notification
      const mockWaitingListEntry: WaitingList = {
        id: `temp-${Date.now()}`,
        userId,
        userName,
        userEmail,
        preferredSpotTypeId: null,
        preferredLocationId: null,
        priority: waitingListEntry.position,
        status: "active",
        reason: `Position ${waitingListEntry.position} on waiting list`,
        enrolledDate: new Date(),
        assignedDate: null,
        assignedSpotId: null,
        enrolledBy: "admin",
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await sendWelcomeNotification(user, mockWaitingListEntry, userPreferences);
      
      res.json({ 
        success: true, 
        notificationsSent: result,
        message: "Welcome notifications processed"
      });
    } catch (error) {
      console.error('❌ Failed to send welcome notifications:', error);
      res.status(500).json({ error: "Failed to send welcome notifications" });
    }
  });

  // Check and send payment reminders for due/overdue bookings (Admin only)
  app.post("/api/notifications/payment-reminders", requireAdmin, async (req, res) => {
    try {
      // Get all bookings that haven't received payment
      const allBookings = await storage.getAllBookings();
      const unpaidBookings = allBookings.filter(booking => !booking.paymentReceived);
      
      const reminderResults = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      
      for (const booking of unpaidBookings) {
        try {
          // Calculate due date (7 days after booking date)
          const bookingDate = new Date(booking.bookingDate);
          const dueDate = new Date(bookingDate);
          dueDate.setDate(dueDate.getDate() + 7); // Payment due 7 days after booking
          dueDate.setHours(0, 0, 0, 0);
          
          // Calculate days difference (positive = overdue, negative = not due yet)
          const timeDiff = today.getTime() - dueDate.getTime();
          const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
          
          // Send reminders for: due today (0), 1 day overdue, 3 days overdue, 7 days overdue
          const shouldSendReminder = daysDiff === 0 || daysDiff === 1 || daysDiff === 3 || daysDiff === 7;
          
          if (shouldSendReminder) {
            // Get user information
            const user = await storage.getUser(booking.renterId);
            if (user) {
              // Get spot information for spot number
              const spot = await storage.getParkingSpot(booking.spotId);
              if (spot) {
                // Get user's notification preferences
                const notificationPreferences = await storage.getNotificationPreferences(user.id);
                
                // Construct display name
                const displayName = user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || user.lastName || user.email || 'User';
                
                // Get listing to check if it's a Workplace Services listing
                const bulkListing = booking.listingId ? await storage.getSpotListing(booking.listingId) : null;
                const isWsListing = bulkListing?.createdByAdmin === true;

                // Get spot owner info (skip for Workplace Services listings)
                const owner = (!isWsListing && booking.ownerId) ? await storage.getUser(booking.ownerId) : null;
                const ownerDisplayName = isWsListing
                  ? 'Workplace Services'
                  : owner && (owner.firstName || owner.lastName)
                    ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
                    : undefined;

                // Prepare payment details
                const paymentDetails = {
                  bookingId: booking.id,
                  spotNumber: spot.spotNumber,
                  amount: Number(booking.totalAmount), // Convert decimal to number
                  dueDate: dueDate,
                  daysOverdue: daysDiff > 0 ? daysDiff : undefined,
                  ownerName: ownerDisplayName,
                  ownerEmail: isWsListing ? undefined : (owner?.email || undefined),
                  isWorkplaceServicesListing: isWsListing
                };
                
                // Send payment reminder asynchronously
                setImmediate(async () => {
                  try {
                    const result = await sendPaymentReminderNotification(
                      { name: displayName, email: user.email || '', id: user.id },
                      paymentDetails,
                      notificationPreferences || {}
                    );
                    
                    console.log(`Payment reminder sent for booking ${booking.id}: ${result.emailSent ? 'email' : 'no email'}, ${result.inAppSent ? 'in-app' : 'no in-app'}`);
                  } catch (emailError) {
                    console.error(`Failed to send payment reminder for booking ${booking.id}:`, emailError);
                  }
                });
                
                reminderResults.push({
                  bookingId: booking.id,
                  userId: user.id,
                  spotNumber: spot.spotNumber,
                  dueDate: dueDate.toISOString(),
                  daysOverdue: daysDiff > 0 ? daysDiff : 0,
                  reminderSent: true
                });
              }
            }
          }
        } catch (bookingError) {
          console.error(`Error processing booking ${booking.id} for payment reminders:`, bookingError);
          reminderResults.push({
            bookingId: booking.id,
            error: 'Processing failed',
            reminderSent: false
          });
        }
      }
      
      res.json({
        success: true,
        message: `Processed ${unpaidBookings.length} unpaid bookings, sent ${reminderResults.filter(r => r.reminderSent).length} reminders`,
        totalUnpaidBookings: unpaidBookings.length,
        remindersSent: reminderResults.filter(r => r.reminderSent).length,
        results: reminderResults
      });
      
    } catch (error) {
      console.error('❌ Failed to send payment reminders:', error);
      res.status(500).json({ error: "Failed to send payment reminders" });
    }
  });

  // Check payment reminders for a specific user (Authenticated users)
  app.post("/api/notifications/check-payment-reminders/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = getAuthenticatedUserId(req);
      
      if (!authenticatedUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to check their own reminders, or admins to check any
      const userRole = await getAuthenticatedUserBaseRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to check payment reminders for this user" });
      }
      
      // Get user's unpaid bookings
      const userBookings = await storage.getBookingsByRenter(userId);
      const unpaidBookings = userBookings.filter(booking => !booking.paymentReceived);
      
      const reminderResults = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const booking of unpaidBookings) {
        // Calculate due date (7 days after booking date)
        const bookingDate = new Date(booking.bookingDate);
        const dueDate = new Date(bookingDate);
        dueDate.setDate(dueDate.getDate() + 7);
        dueDate.setHours(0, 0, 0, 0);
        
        // Calculate days difference
        const timeDiff = today.getTime() - dueDate.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
        
        // Check if payment is due or overdue
        if (daysDiff >= 0) {
          const spot = await storage.getParkingSpot(booking.spotId);
          if (spot) {
            reminderResults.push({
              bookingId: booking.id,
              spotNumber: spot.spotNumber,
              amount: Number(booking.totalAmount),
              dueDate: dueDate.toISOString(),
              daysOverdue: daysDiff,
              status: daysDiff === 0 ? 'due_today' : 'overdue'
            });
          }
        }
      }
      
      res.json({
        success: true,
        userId,
        unpaidBookingsCount: unpaidBookings.length,
        duePaymentsCount: reminderResults.length,
        duePayments: reminderResults
      });
      
    } catch (error) {
      console.error('❌ Failed to check payment reminders:', error);
      res.status(500).json({ error: "Failed to check payment reminders" });
    }
  });

  // Generate and send weekly summary reports (Admin only)
  app.post("/api/notifications/weekly-summaries", requireAdmin, async (req, res) => {
    try {
      const weeklyNotificationSchema = z.object({
        userId: z.string().optional(), // If provided, send only to this user; otherwise send to all users
        weekStart: z.string().optional(), // ISO date string, defaults to last Monday
        weekEnd: z.string().optional() // ISO date string, defaults to last Sunday
      });
      
      const { userId, weekStart, weekEnd } = weeklyNotificationSchema.parse(req.body);
      
      // Calculate default week dates (previous Monday to Sunday)
      const getLastWeekDates = () => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Calculate days to subtract to get to last Monday
        const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 + 7; // If Sunday, go back 6 days; otherwise go back to previous Monday
        
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysToLastMonday);
        lastMonday.setHours(0, 0, 0, 0);
        
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        lastSunday.setHours(23, 59, 59, 999);
        
        return { start: lastMonday, end: lastSunday };
      };
      
      const weekDates = weekStart && weekEnd 
        ? { start: new Date(weekStart), end: new Date(weekEnd) }
        : getLastWeekDates();
      
      // Get target users
      const targetUsers = userId 
        ? [await storage.getUser(userId)].filter((u): u is User => u !== undefined && u !== null)
        : await storage.getAllUsers();
      
      const summaryResults = [];
      
      for (const user of targetUsers) {
        try {
          // Get user's notification preferences
          const notificationPreferences = await storage.getNotificationPreferences(user.id);
          
          // Skip if user has weekly reports disabled
          if (notificationPreferences && notificationPreferences.weeklyReports === false) {
            summaryResults.push({
              userId: user.id,
              email: user.email,
              skipped: true,
              reason: 'Weekly reports disabled in preferences'
            });
            continue;
          }
          
          // Get user's bookings for the week
          const allBookings = await storage.getAllBookings();
          const userBookings = allBookings.filter(booking => {
            const bookingDate = new Date(booking.bookingDate);
            return booking.renterId === user.id && 
                   bookingDate >= weekDates.start && 
                   bookingDate <= weekDates.end;
          });
          
          // Get user's active spot listings for the week
          const allListings = await storage.getAllSpotListings();
          const userListings = allListings.filter(listing => {
            return listing.ownerId === user.id && listing.status === 'available';
          });
          
          // Calculate summary statistics
          const totalBookings = userBookings.length;
          const totalAmount = userBookings.reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
          const activeSpots = userListings.length;
          
          // Get upcoming bookings (next 7 days)
          const nextWeekStart = new Date();
          const nextWeekEnd = new Date();
          nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
          
          const upcomingBookings = allBookings.filter(booking => {
            const bookingDate = new Date(booking.bookingDate);
            return booking.renterId === user.id && 
                   bookingDate >= nextWeekStart && 
                   bookingDate <= nextWeekEnd;
          }).length;
          
          // Get pending payments
          const pendingPayments = userBookings.filter(booking => !booking.paymentReceived).length;
          
          // Only send summary if user has activity or pending items
          if (totalBookings > 0 || activeSpots > 0 || upcomingBookings > 0 || pendingPayments > 0) {
            // Construct display name
            const displayName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || user.lastName || user.email || 'User';
            
            // Prepare summary data
            const summaryData = {
              weekStart: weekDates.start,
              weekEnd: weekDates.end,
              totalBookings,
              totalAmount,
              activeSpots,
              upcomingBookings,
              pendingPayments
            };
            
            // Send weekly summary notification asynchronously
            setImmediate(async () => {
              try {
                const result = await sendWeeklySummaryNotification(
                  { name: displayName, email: user.email || '', id: user.id },
                  summaryData,
                  notificationPreferences || {}
                );
                
                console.log(`Weekly summary sent to ${user.email}: ${result.emailSent ? 'email' : 'no email'}, ${result.inAppSent ? 'in-app' : 'no in-app'}`);
              } catch (emailError) {
                console.error(`Failed to send weekly summary to ${user.email}:`, emailError);
              }
            });
            
            summaryResults.push({
              userId: user.id,
              email: user.email,
              sent: true,
              summary: summaryData
            });
          } else {
            summaryResults.push({
              userId: user.id,
              email: user.email,
              skipped: true,
              reason: 'No activity to report'
            });
          }
        } catch (userError) {
          console.error(`Error processing weekly summary for user ${user.id}:`, userError);
          summaryResults.push({
            userId: user.id,
            email: user.email,
            error: 'Processing failed',
            sent: false
          });
        }
      }
      
      res.json({
        success: true,
        message: `Processed ${targetUsers.length} users for weekly summaries`,
        weekPeriod: {
          start: weekDates.start.toISOString(),
          end: weekDates.end.toISOString()
        },
        totalUsers: targetUsers.length,
        summariesSent: summaryResults.filter(r => r.sent).length,
        skipped: summaryResults.filter(r => r.skipped).length,
        results: summaryResults
      });
      
    } catch (error) {
      console.error('❌ Failed to send weekly summaries:', error);
      res.status(500).json({ error: "Failed to send weekly summaries" });
    }
  });

  // Send system maintenance notifications (Admin only)
  app.post("/api/notifications/system-maintenance", requireAdmin, async (req, res) => {
    try {
      const maintenanceNotificationSchema = z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        startDate: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid start date"),
        endDate: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid end date"),
        affectedServices: z.array(z.string()).min(1, "At least one affected service is required"),
        isUrgent: z.boolean().default(false),
        targetUsers: z.array(z.string()).optional(), // If provided, send only to these user IDs; otherwise send to all users
        skipUsersWithDisabledNotifications: z.boolean().default(true) // Whether to skip users who have disabled system maintenance notifications
      });
      
      const {
        title,
        description,
        startDate,
        endDate,
        affectedServices,
        isUrgent,
        targetUsers,
        skipUsersWithDisabledNotifications
      } = maintenanceNotificationSchema.parse(req.body);
      
      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }
      
      // Get target users
      const allUsers = await storage.getAllUsers();
      const usersToNotify = targetUsers && targetUsers.length > 0
        ? allUsers.filter(user => targetUsers.includes(user.id))
        : allUsers;
      
      const maintenanceResults = [];
      
      for (const user of usersToNotify) {
        try {
          // Get user's notification preferences
          const notificationPreferences = await storage.getNotificationPreferences(user.id);
          
          // Skip if user has system maintenance notifications disabled (unless urgent)
          if (skipUsersWithDisabledNotifications && 
              notificationPreferences && 
              notificationPreferences.systemMaintenance === false && 
              !isUrgent) {
            maintenanceResults.push({
              userId: user.id,
              email: user.email,
              skipped: true,
              reason: 'System maintenance notifications disabled (non-urgent)'
            });
            continue;
          }
          
          // Construct display name
          const displayName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || user.email || 'User';
          
          // Prepare maintenance details
          const maintenanceDetails = {
            title,
            description,
            startDate: start,
            endDate: end,
            affectedServices,
            isUrgent
          };
          
          // Send system maintenance notification asynchronously
          setImmediate(async () => {
            try {
              const result = await sendSystemMaintenanceNotification(
                { name: displayName, email: user.email || '', id: user.id },
                maintenanceDetails,
                notificationPreferences || {}
              );
              
              console.log(`System maintenance notification sent to ${user.email}: ${result.emailSent ? 'email' : 'no email'}, ${result.inAppSent ? 'in-app' : 'no in-app'}`);
            } catch (emailError) {
              console.error(`Failed to send system maintenance notification to ${user.email}:`, emailError);
            }
          });
          
          maintenanceResults.push({
            userId: user.id,
            email: user.email,
            sent: true,
            maintenanceType: isUrgent ? 'urgent' : 'scheduled'
          });
          
        } catch (userError) {
          console.error(`Error processing system maintenance notification for user ${user.id}:`, userError);
          maintenanceResults.push({
            userId: user.id,
            email: user.email,
            error: 'Processing failed',
            sent: false
          });
        }
      }
      
      res.json({
        success: true,
        message: `Processed ${usersToNotify.length} users for system maintenance notifications`,
        maintenanceWindow: {
          title,
          start: start.toISOString(),
          end: end.toISOString(),
          isUrgent,
          affectedServices
        },
        totalUsers: usersToNotify.length,
        notificationsSent: maintenanceResults.filter(r => r.sent).length,
        skipped: maintenanceResults.filter(r => r.skipped).length,
        results: maintenanceResults
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error('❌ Failed to send system maintenance notifications:', error);
      res.status(500).json({ error: "Failed to send system maintenance notifications" });
    }
  });

  // Reports Hub API endpoints (Admin only)
  app.get("/api/admin/reports/overview", requireAdmin, getReportOverview);
  app.get("/api/admin/reports/utilization", requireAdmin, getReportUtilization);
  app.get("/api/admin/reports/revenue", requireAdmin, getReportRevenue);
  app.get("/api/admin/reports/user-compliance", requireAdmin, getReportUserCompliance);
  app.get("/api/admin/reports/waitlist-performance", requireAdmin, getReportWaitlistPerformance);
  app.get("/api/admin/reports/spot-assignments", requireAdmin, getSpotAssignmentReport);
  app.get("/api/admin/reports/shared-pool-usage", requireAdmin, getSharedPoolUsageReport);
  app.get("/api/admin/reports/active-users", requireAdmin, getActiveUsersReport);
  app.get("/api/admin/rankings/renters", requireAdmin, getRenterRankings);
  app.get("/api/admin/rankings/owners", requireAdmin, getOwnerRankings);
  
  // Email report endpoint
  app.post("/api/admin/reports/:type/email", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { recipients, from, to, scope } = req.body;
      
      // Validate report type
      const validTypes = ['overview', 'utilization', 'revenue', 'user-compliance', 'waitlist-performance', 'spot-assignments'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "Invalid report type" });
      }
      
      // Validate recipients
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "Recipients array is required" });
      }
      
      // Check if email service is available
      if (!isEmailServiceAvailable()) {
        return res.status(503).json({ 
          error: "Email service unavailable",
          message: "Mailgun is not configured. Please contact your administrator to set up email delivery."
        });
      }
      
      // Fetch report data based on type
      let reportData: any;
      const todayStr = await getTodayInTimezone();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoStr = await formatDateInTimezone(thirtyDaysAgo);
      
      const dateRange = { 
        from: from || thirtyDaysAgoStr,
        to: to || todayStr
      };
      const reportScope = scope || 'all';
      
      // Call the appropriate controller to get data
      const mockReq = { query: { from: dateRange.from, to: dateRange.to, scope: reportScope } } as any;
      const mockRes = {
        json: (data: any) => { reportData = data; },
        status: (code: number) => ({
          json: (data: any) => { throw new Error(data.error || 'Failed to fetch report data'); }
        })
      } as any;
      
      switch (type) {
        case 'overview':
          await getReportOverview(mockReq, mockRes);
          break;
        case 'utilization':
          await getReportUtilization(mockReq, mockRes);
          break;
        case 'revenue':
          await getReportRevenue(mockReq, mockRes);
          break;
        case 'user-compliance':
          await getReportUserCompliance(mockReq, mockRes);
          break;
        case 'waitlist-performance':
          await getReportWaitlistPerformance(mockReq, mockRes);
          break;
        case 'spot-assignments':
          await getSpotAssignmentReport(mockReq, mockRes);
          break;
      }
      
      // Send email with report
      const result = await sendReportEmail(
        type as any,
        reportData,
        recipients,
        dateRange,
        reportScope
      );
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ error: result.message });
      }
    } catch (error) {
      console.error("Error sending report email:", error);
      res.status(500).json({ error: "Failed to send report email" });
    }
  });

  // ==================== ISSUE TRACKING ROUTES ====================
  
  // Create a new issue (all authenticated users)
  app.post("/api/issues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const validatedData = insertIssueSchema.parse({
        ...req.body,
        reporterId: userId,
        reporterName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        reporterEmail: user.email || '',
      });
      
      const [newIssue] = await db.insert(issues).values(validatedData as any).returning();
      
      // Send issue report email - in production CC all admins, in dev skip CC
      setImmediate(async () => {
        try {
          const { sendIssueReportNotification } = await import('./notification-service');
          const isProduction = process.env.NODE_ENV === 'production';
          let adminEmails: string[] = [];
          if (isProduction) {
            const allUsers = await storage.getAllUsers();
            adminEmails = allUsers
              .filter(u => u.roles?.includes('admin') && u.email)
              .map(u => u.email!);
          }
          
          const reporterName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
          await sendIssueReportNotification(
            { name: reporterName, email: user.email || '' },
            { title: newIssue.title, description: newIssue.description || '', priority: newIssue.priority },
            adminEmails
          );
        } catch (emailError) {
          console.error('Failed to send issue report email:', emailError);
        }
      });
      
      res.status(201).json(newIssue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating issue:", error);
      res.status(500).json({ error: "Failed to create issue" });
    }
  });
  
  // Get all issues (admin only)
  app.get("/api/admin/issues", requireAdmin, async (req, res) => {
    try {
      const { status, priority } = req.query;
      
      let query = db.select().from(issues);
      
      const allIssues = await query.orderBy(sql`${issues.createdAt} DESC`);
      
      // Filter in memory for simplicity
      let filteredIssues = allIssues;
      if (status && status !== 'all') {
        filteredIssues = filteredIssues.filter(i => i.status === status);
      }
      if (priority && priority !== 'all') {
        filteredIssues = filteredIssues.filter(i => i.priority === priority);
      }
      
      res.json(filteredIssues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });
  
  // Get single issue (admin only)
  app.get("/api/admin/issues/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [issue] = await db.select().from(issues).where(eq(issues.id, id));
      
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      res.json(issue);
    } catch (error) {
      console.error("Error fetching issue:", error);
      res.status(500).json({ error: "Failed to fetch issue" });
    }
  });
  
  // Update issue status (admin only)
  app.patch("/api/admin/issues/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getAuthenticatedUserId(req);
      
      const validatedData = updateIssueSchema.parse(req.body);
      
      // If status is being set to completed, record resolution info
      if (validatedData.status === 'completed') {
        validatedData.resolvedAt = new Date();
        validatedData.resolvedBy = userId;
      }
      
      const notifyUser = req.body.notifyUser === true;
      const resolutionNotes = req.body.resolutionNotes || null;
      
      const updateData: any = {
        ...validatedData,
        updatedAt: new Date(),
      };
      
      if (resolutionNotes !== null) {
        updateData.resolutionNotes = resolutionNotes;
      }
      
      const [updatedIssue] = await db
        .update(issues)
        .set(updateData)
        .where(eq(issues.id, id))
        .returning();
      
      if (!updatedIssue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      // Send resolution notification to the reporter if requested
      if (validatedData.status === 'completed' && notifyUser && updatedIssue.reporterEmail) {
        setImmediate(async () => {
          try {
            const { sendFeedbackResolvedNotification } = await import('./notification-service');
            await sendFeedbackResolvedNotification(
              { name: updatedIssue.reporterName || 'User', email: updatedIssue.reporterEmail! },
              { title: updatedIssue.title, description: updatedIssue.description || '' },
              resolutionNotes || undefined
            );
          } catch (emailError) {
            console.error('Failed to send feedback resolved email:', emailError);
          }
        });
      }
      
      res.json(updatedIssue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating issue:", error);
      res.status(500).json({ error: "Failed to update issue" });
    }
  });
  
  // Delete issue (admin only)
  app.delete("/api/admin/issues/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [deletedIssue] = await db
        .delete(issues)
        .where(eq(issues.id, id))
        .returning();
      
      if (!deletedIssue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      res.json({ success: true, message: "Issue deleted successfully" });
    } catch (error) {
      console.error("Error deleting issue:", error);
      res.status(500).json({ error: "Failed to delete issue" });
    }
  });
  
  // Get issues count by status (admin only - for dashboard)
  app.get("/api/admin/issues/stats", requireAdmin, async (req, res) => {
    try {
      const allIssues = await db.select().from(issues);
      
      const stats = {
        total: allIssues.length,
        backlog: allIssues.filter(i => i.status === 'backlog').length,
        todo: allIssues.filter(i => i.status === 'todo').length,
        inProgress: allIssues.filter(i => i.status === 'in_progress').length,
        completed: allIssues.filter(i => i.status === 'completed').length,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching issue stats:", error);
      res.status(500).json({ error: "Failed to fetch issue stats" });
    }
  });

  // ==========================================
  // API Key Management (for MCP server access) - Admin only
  // ==========================================

  // Create a new system-wide API key
  app.post("/api/admin/api-keys", requireAdmin, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check limit (max 10 system-wide keys)
      const existingKeys = await storage.getAllApiKeys();
      if (existingKeys.length >= 10) {
        return res.status(400).json({ error: "Maximum of 10 active API keys allowed" });
      }

      // Generate a random API key
      const crypto = await import("crypto");
      const rawKey = `bci_pk_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.substring(0, 15);

      const apiKey = await storage.createApiKey({
        keyHash,
        keyPrefix,
        name: name.trim(),
      });

      // Return the raw key ONLY on creation (never stored or shown again)
      res.json({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        key: rawKey,
        createdAt: apiKey.createdAt,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  // List ALL active system-wide API keys (admin only)
  app.get("/api/admin/api-keys", requireAdmin, async (req: any, res) => {
    try {
      const keys = await storage.getAllApiKeys();
      const result = keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      }));
      res.json(result);
    } catch (error) {
      console.error("Error listing API keys:", error);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  // Revoke an API key (admin can revoke any key)
  app.delete("/api/admin/api-keys/:id", requireAdmin, async (req: any, res) => {
    try {
      const success = await storage.revokeApiKeyAdmin(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "API key not found" });
      }

      res.json({ success: true, message: "API key revoked" });
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  // ===========================
  // Feature Announcements routes
  // ===========================

  // GET /api/announcements - Get unseen announcements for the authenticated user
  app.get("/api/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const announcements = await storage.getUnseenAnnouncements(userId);
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  // POST /api/announcements/dismiss - Dismiss all announcements (mark as seen up to current max)
  app.post("/api/announcements/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      await storage.dismissAnnouncements(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing announcements:", error);
      res.status(500).json({ error: "Failed to dismiss announcements" });
    }
  });

  // GET /api/admin/announcements - List all announcements (admin)
  app.get("/api/admin/announcements", requireAdmin, async (req: any, res) => {
    try {
      const announcements = await storage.getAllAnnouncements();
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching admin announcements:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  // POST /api/admin/announcements - Create a new announcement (admin)
  app.post("/api/admin/announcements", requireAdmin, async (req: any, res) => {
    try {
      const { insertFeatureAnnouncementSchema } = await import("@shared/schema");
      const data = insertFeatureAnnouncementSchema.parse(req.body);
      const announcement = await storage.createAnnouncement(data);
      res.status(201).json(announcement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error creating announcement:", error);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  // PATCH /api/admin/announcements/:id - Update an announcement (admin)
  app.patch("/api/admin/announcements/:id", requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid announcement ID" });
      }
      const { updateFeatureAnnouncementSchema } = await import("@shared/schema");
      const updates = updateFeatureAnnouncementSchema.parse(req.body);
      const announcement = await storage.updateAnnouncement(id, updates);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error updating announcement:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  // DELETE /api/admin/announcements/:id - Delete an announcement (admin)
  app.delete("/api/admin/announcements/:id", requireAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid announcement ID" });
      }
      const success = await storage.deleteAnnouncement(id);
      if (!success) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ===== Sale Events API (Admin only) =====

  // GET /api/admin/sale-events - List all sale events
  app.get("/api/admin/sale-events", requireAdmin, async (req: any, res) => {
    try {
      const events = await storage.getAllSaleEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching sale events:", error);
      res.status(500).json({ error: "Failed to fetch sale events" });
    }
  });

  // GET /api/admin/sale-events/preview - Preview how many WPS listings would be affected
  // IMPORTANT: This must be registered BEFORE the /:id route to avoid being shadowed
  app.get("/api/admin/sale-events/preview", requireAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate query params required" });
      }
      const preview = await storage.previewSaleEventListings(startDate as string, endDate as string);
      res.json(preview);
    } catch (error) {
      console.error("Error previewing sale event:", error);
      res.status(500).json({ error: "Failed to preview sale event" });
    }
  });

  // GET /api/admin/sale-events/:id - Get a single sale event
  app.get("/api/admin/sale-events/:id", requireAdmin, async (req: any, res) => {
    try {
      const event = await storage.getSaleEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Sale event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error fetching sale event:", error);
      res.status(500).json({ error: "Failed to fetch sale event" });
    }
  });

  // POST /api/admin/sale-events - Create a new sale event (does NOT activate automatically)
  app.post("/api/admin/sale-events", requireAdmin, async (req: any, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const schema = z.object({
        name: z.string().min(1, "Name is required"),
        calendarLabel: z.string().min(1, "Calendar label is required"),
        startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
        endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
        discountType: z.enum(["percentage", "fixed_price"]),
        discountValue: z.number().positive("Discount value must be positive"),
        labelColor: z.enum(["fuchsia", "violet", "blue", "green", "orange", "red", "amber", "rose"]).default("fuchsia"),
        notifyPastRenters: z.boolean().default(false),
        notifyActiveRenters: z.boolean().default(false),
      }).refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
        message: "End date must be on or after start date",
        path: ["endDate"],
      });

      const body = schema.parse(req.body);

      // Validate percentage discount
      if (body.discountType === 'percentage' && body.discountValue > 100) {
        return res.status(400).json({ error: "Percentage discount cannot exceed 100%" });
      }

      const event = await storage.createSaleEvent({ ...body, createdBy: userId || undefined });
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating sale event:", error);
      res.status(500).json({ error: "Failed to create sale event" });
    }
  });

  // PUT /api/admin/sale-events/:id - Update a sale event (only allowed when inactive)
  app.put("/api/admin/sale-events/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getSaleEvent(id);
      if (!event) return res.status(404).json({ error: "Sale event not found" });
      if (event.status === 'active') {
        return res.status(400).json({ error: "Cannot edit an active sale event. Deactivate it first." });
      }

      const schema = z.object({
        name: z.string().min(1, "Name is required").optional(),
        calendarLabel: z.string().min(1, "Calendar label is required").optional(),
        startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date").optional(),
        endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date").optional(),
        discountType: z.enum(["percentage", "fixed_price"]).optional(),
        discountValue: z.number().positive("Discount value must be positive").optional(),
        labelColor: z.enum(["fuchsia", "violet", "blue", "green", "orange", "red", "amber", "rose"]).optional(),
        notifyPastRenters: z.boolean().optional(),
        notifyActiveRenters: z.boolean().optional(),
      });

      const body = schema.parse(req.body);

      if (body.discountType === 'percentage' && (body.discountValue ?? 0) > 100) {
        return res.status(400).json({ error: "Percentage discount cannot exceed 100%" });
      }

      const updated = await storage.updateSaleEvent(id, body);
      if (!updated) return res.status(404).json({ error: "Sale event not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating sale event:", error);
      res.status(500).json({ error: "Failed to update sale event" });
    }
  });

  // POST /api/admin/sale-events/:id/activate - Activate a sale event (reprice WPS listings)
  app.post("/api/admin/sale-events/:id/activate", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getSaleEvent(id);
      if (!event) return res.status(404).json({ error: "Sale event not found" });
      if (event.status === 'active') {
        return res.status(400).json({ error: "Sale event is already active" });
      }

      const { updatedListings } = await storage.activateSaleEvent(id);

      // Resolve notification recipients synchronously (needed for response count)
      // Step 1: Build promo recipient set (union of past/active renters, owners excluded)
      const notifyPastRenters = event.notifyPastRenters ?? false;
      const notifyActiveRenters = event.notifyActiveRenters ?? false;
      const promoRecipientIds = new Set<string>();

      if (notifyPastRenters || notifyActiveRenters) {
        try {
          const allUsers = await storage.getAllUsers();
          for (const user of allUsers) {
            if (!user.email) continue;
            if (user.status !== 'active') continue;
            // Universal exclusion: spot owners never receive promotion emails
            if (user.roles.includes('owner')) continue;

            let qualifies = false;
            if (notifyPastRenters) {
              const userBookings = await storage.getBookingsByRenter(user.id);
              if (userBookings.some(b => b.status === 'completed')) qualifies = true;
            }
            if (!qualifies && notifyActiveRenters) {
              // Any active non-owner user qualifies (owner exclusion is already handled above)
              qualifies = true;
            }
            if (qualifies) promoRecipientIds.add(user.id);
          }
        } catch (err) {
          console.error('[PromoBroadcast] Error resolving recipient list:', err);
        }
      }

      // Total notified = promo recipients (they replace spot alerts for overlapping users)
      const notifiedCount = promoRecipientIds.size;

      // Async: dispatch all emails (fire-and-forget)
      (async () => {
        try {
          // Track users who received any email to guarantee one email per user per activation
          const emailedUserIds = new Set<string>();

          // Step 2: Send promotion broadcast emails first
          if (promoRecipientIds.size > 0) {
            for (const userId of Array.from(promoRecipientIds)) {
              const user = await storage.getUser(userId);
              if (!user?.email) continue;
              const userName = user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.firstName || user.email;

              emailedUserIds.add(userId);
              createPromotionBroadcastNotification(
                { name: userName, email: user.email },
                {
                  name: event.name,
                  startDate: event.startDate,
                  endDate: event.endDate,
                  discountType: event.discountType as 'percentage' | 'fixed_price',
                  discountValue: parseFloat(event.discountValue),
                }
              ).catch(err => console.error(`[PromoBroadcast] Failed to send promo email to ${user.email}:`, err));
            }
            console.log(`[PromoBroadcast] Dispatched promotion emails to ${promoRecipientIds.size} recipients`);
          }

          // Step 3: Send spot alert emails — skip any user already emailed via promo
          if (updatedListings.length > 0) {
            const subscribers = await storage.getActiveSpotAlertSubscribers();

            for (const updated of updatedListings) {
              const spot = await storage.getParkingSpot(updated.spotId);
              if (!spot) continue;

              let locationName = 'BCI Parkade';
              if (spot.locationId) {
                const loc = await storage.getLocation(spot.locationId);
                if (loc) locationName = `${loc.office} - ${loc.building}`;
              }

              const listing = await storage.getSpotListing(updated.id);
              if (!listing) continue;
              const allListingDates = getListingDates(listing as any);
              const listingDates = allListingDates.filter(d => d >= event.startDate && d <= event.endDate);
              if (listingDates.length === 0) continue;

              const listingRate = parseFloat(updated.dailyRate);

              for (const subscriber of subscribers) {
                // Skip if already emailed (promo email takes precedence)
                if (emailedUserIds.has(subscriber.userId)) continue;
                if (subscriber.userId === listing.ownerId) continue;
                if (subscriber.maxDailyPrice && listingRate > parseFloat(subscriber.maxDailyPrice)) continue;

                const matchingDate = subscriber.daysOfWeek && subscriber.daysOfWeek.length > 0
                  ? listingDates.find(d => {
                      const dow = new Date(d + 'T12:00:00').getDay();
                      return subscriber.daysOfWeek.includes(dow);
                    })
                  : listingDates[0];

                if (!matchingDate) continue;

                const user = await storage.getUser(subscriber.userId);
                if (!user?.email) continue;
                const userName = user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.firstName || user.email;

                // Mark as emailed before sending to prevent duplicate spot alerts across listings
                emailedUserIds.add(subscriber.userId);

                sendSpotAlertEmail(
                  { name: userName, email: user.email },
                  {
                    id: listing.id,
                    spotNumber: spot.spotNumber,
                    location: locationName,
                    date: matchingDate,
                    dailyRate: listingRate
                  }
                ).catch(err => console.error(`[SaleAlerts] Failed to send alert to ${user.email}:`, err));
              }
            }
          }

        } catch (err) {
          console.error('[SaleAlerts] Error processing notifications after activation:', err);
        }
      })();

      res.json({ success: true, updatedCount: updatedListings.length, notifiedCount, promoEnabled: notifyPastRenters || notifyActiveRenters });
    } catch (error) {
      console.error("Error activating sale event:", error);
      res.status(500).json({ error: "Failed to activate sale event" });
    }
  });

  // POST /api/admin/sale-events/:id/deactivate - Deactivate a sale event (restore prices)
  app.post("/api/admin/sale-events/:id/deactivate", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getSaleEvent(id);
      if (!event) return res.status(404).json({ error: "Sale event not found" });
      if (event.status !== 'active') {
        return res.status(400).json({ error: "Sale event is not active" });
      }

      const { restoredCount } = await storage.deactivateSaleEvent(id);
      res.json({ success: true, restoredCount });
    } catch (error) {
      console.error("Error deactivating sale event:", error);
      res.status(500).json({ error: "Failed to deactivate sale event" });
    }
  });

  // DELETE /api/admin/sale-events/:id - Delete a sale event
  app.delete("/api/admin/sale-events/:id", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSaleEvent(id);
      if (!success) return res.status(404).json({ error: "Sale event not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale event:", error);
      res.status(500).json({ error: "Failed to delete sale event" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
