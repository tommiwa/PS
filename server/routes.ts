import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { broadcastLockEvent } from "./websocket";
import { setupAuth, isAuthenticated, requireAdmin, getAuthenticatedUserId, getAuthenticatedUserRole, getAuthenticatedUserBaseRole } from "./replitAuth";
import { z } from "zod";
import { db } from "./db";
import { parkingSpots, spotLocks, spotListings, bookings } from "@shared/schema";
import { inArray, and, eq, lt, gt, not, or, sql } from "drizzle-orm";
import { 
  sendAssignmentNotification, 
  sendWelcomeNotification,
  sendBookingConfirmationNotification,
  sendPaymentReminderNotification,
  sendSpotAvailabilityNotification,
  sendWeeklySummaryNotification,
  sendSystemMaintenanceNotification,
  type InAppNotification 
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
import { auditStorage, type AuditQueryFilters, type AuditPagination } from "./audit-storage";
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
  getSpotAssignmentReport
} from "./reports-controller";
import { sendReportEmail, isEmailServiceAvailable } from "./report-service";

// Lock duration configuration
const LOCK_DURATION_MS = 120000; // 2 minutes (120 seconds)

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
  dailyRate: z.number().positive("Daily rate must be positive")
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

export async function registerRoutes(app: Express): Promise<Server> {
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
          licensePlate: primaryVehicle.licensePlate,
          make: primaryVehicle.make,
          model: primaryVehicle.model
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
      
      if (existingSpot.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this parking spot" });
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
      
      if (existingSpot.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this parking spot" });
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
      
      // PERMISSION CHECK: Prevent creating listings for BCI-managed spots
      const spot = await storage.getParkingSpot(validatedData.spotId);
      if (!spot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      if (spot.isBciManaged) {
        return res.status(403).json({ 
          error: "Cannot create listings for BCI-managed spots. Contact administrator." 
        });
      }
      
      // Verify that the user owns the spot
      if (spot.ownerId !== userId) {
        return res.status(403).json({ 
          error: "You can only create listings for spots you own" 
        });
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

      // Send spot availability notifications (fire-and-forget to avoid blocking response)
      setImmediate(async () => {
        try {
          // Get the parking spot details
          const spot = await storage.getParkingSpot(newListing.spotId);
          if (spot) {
            // Get all users from waiting list who might be interested in this spot type/location
            const waitingListEntries = await storage.getAllWaitingList();
            const interestedUsers = waitingListEntries.filter(entry => {
              // Match users who prefer this spot type or have no preference (null)
              const matchesSpotType = !entry.preferredSpotTypeId || entry.preferredSpotTypeId === spot.spotTypeId;
              // Match users who prefer this location or have no preference (null)
              const matchesLocation = !entry.preferredLocationId || entry.preferredLocationId === spot.locationId;
              return matchesSpotType && matchesLocation;
            });

            // Send notifications to interested users
            for (const waitingEntry of interestedUsers) {
              try {
                // Get user details and notification preferences
                const user = await storage.getUser(waitingEntry.userId);
                if (user) {
                  const notificationPreferences = await storage.getNotificationPreferences(user.id);
                  
                  // Construct display name
                  const displayName = user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.lastName || user.email || 'User';
                  
                  // Prepare spot details for email (single spot in array)
                  const availableSpots = [{
                    spotNumber: spot.spotNumber,
                    location: 'BCI Campus',
                    building: 'BCI Campus',
                    type: 'Parking Spot',
                    rate: Number(newListing.dailyRate) // Convert decimal to number
                  }];

                  // Send spot availability notification
                  await sendSpotAvailabilityNotification(
                    { name: displayName, email: user.email || '', id: user.id },
                    availableSpots,
                    notificationPreferences || {}
                  );
                }
              } catch (userNotificationError) {
                console.error(`Failed to send spot availability notification to user ${waitingEntry.userId}:`, userNotificationError);
              }
            }

            console.log(`✓ Sent spot availability notifications for ${spot.spotNumber} to ${interestedUsers.length} interested users`);
          }
        } catch (availabilityError) {
          console.error('Failed to send spot availability notifications:', availabilityError);
        }
      });
      
      res.json(newListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating spot listing:", error);
      res.status(500).json({ error: "Failed to create spot listing" });
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
      
      res.json(updatedListing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating listing:", error);
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  // Delete listing
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
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ error: "Failed to update payment status" });
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
        
        // Find the most relevant booking based on listing status
        let booking = null;
        
        if (listingBookings.length > 0) {
          if (listing.status === 'booked' || listing.status === 'used') {
            // Get the most recent active booking (confirmed or completed)
            // Sort by booking date descending to get the most recent one
            const activeBookings = listingBookings
              .filter(b => b.status === 'confirmed' || b.status === 'completed')
              .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
            
            booking = activeBookings[0] || null;
          }
          // For "available" or "unused" status, booking remains null
        }
        
        let renterName = null;
        
        if (booking) {
          const renter = await storage.getUser(booking.renterId);
          if (renter) {
            renterName = `${renter.firstName} ${renter.lastName}`;
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
        
        return {
          ...listing,
          spot: {
            spotNumber: spot?.spotNumber || 'Unknown',
            location: locationName,
            spotType: spotTypeName
          },
          date: displayDate,
          price: listing.dailyRate,
          renterName,
          paymentReceived: booking?.paymentReceived || false
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
      
      // Enrich bookings with spot and owner details
      const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
        const spot = await storage.getParkingSpot(booking.spotId);
        const owner = await storage.getUser(booking.ownerId);
        
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
        
        return {
          ...booking,
          spotNumber: spot?.spotNumber || 'Unknown',
          location: locationName,
          spotType: spotTypeName,
          ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown',
          // Get payment status text
          paymentStatus: booking.paymentReceived ? 'Paid' : 'Pending'
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
      
      // Get today's date for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Filter bookings to only confirmed/completed and today/future dates
      const relevantBookings = allBookings.filter(booking => {
        const isConfirmedOrCompleted = booking.status === 'confirmed' || booking.status === 'completed';
        const bookingDate = new Date(booking.bookingDate);
        const bookingDateStr = bookingDate.toISOString().split('T')[0];
        const isTodayOrFuture = bookingDateStr >= todayStr;
        
        return isConfirmedOrCompleted && isTodayOrFuture;
      });
      
      // Create a map of spotId -> Set of booked dates for quick lookup
      const bookedDatesBySpotId = new Map<string, Set<string>>();
      relevantBookings.forEach(booking => {
        if (!bookedDatesBySpotId.has(booking.spotId)) {
          bookedDatesBySpotId.set(booking.spotId, new Set());
        }
        const bookingDate = new Date(booking.bookingDate).toISOString().split('T')[0];
        bookedDatesBySpotId.get(booking.spotId)!.add(bookingDate);
      });
      
      // Helper to generate all dates in a range
      const generateDateRange = (startDate: string, endDate: string): string[] => {
        const dates: string[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
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
      const availableSpots = allSpots
        .filter(spot => {
          return spot.isActive && 
                 spot.isBookable && 
                 listingsBySpotId.has(spot.id);
        })
        .map(spot => {
          const listings = listingsBySpotId.get(spot.id) || [];
          
          // Safety check: should not happen due to filter above, but handle gracefully
          if (listings.length === 0) {
            return null;
          }
          
          // Build date-to-listing mapping for proper price display
          // Key: date string, Value: {listingId, dailyRate}
          const dateToListing = new Map<string, {listingId: string, dailyRate: number}>();
          const availabilityDates: string[] = [];
          
          listings.forEach(listing => {
            if (listing.listingType === 'single' && listing.singleDate) {
              // Single day listing
              const dateStr = listing.singleDate;
              availabilityDates.push(dateStr);
              dateToListing.set(dateStr, {
                listingId: listing.id,
                dailyRate: listing.dailyRate
              });
            } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
              // Period listing - expand to all dates in range
              const dates = generateDateRange(listing.periodStartDate, listing.periodEndDate);
              dates.forEach(dateStr => {
                availabilityDates.push(dateStr);
                // Only set if not already set (single day listings take precedence)
                if (!dateToListing.has(dateStr)) {
                  dateToListing.set(dateStr, {
                    listingId: listing.id,
                    dailyRate: listing.dailyRate
                  });
                }
              });
            }
            // TODO: Handle recurring listings
          });
          
          // Remove duplicate dates
          const uniqueDates = Array.from(new Set(availabilityDates));
          
          // Use first date's listing as "primary" for backward compatibility
          const firstDate = uniqueDates.sort()[0];
          const primaryListing = firstDate ? dateToListing.get(firstDate) : null;
          const primaryListingId = primaryListing?.listingId || listings[0].id;
          const primaryDailyRate = primaryListing?.dailyRate || listings[0].dailyRate;
          
          // Check which availability dates are already booked
          const bookedDatesSet = bookedDatesBySpotId.get(spot.id) || new Set();
          const bookedDates = uniqueDates.filter(date => bookedDatesSet.has(date));
          
          // Convert dateToListing map to object for JSON serialization
          const dateToPrice: Record<string, {listingId: string, dailyRate: number}> = {};
          dateToListing.forEach((value, key) => {
            dateToPrice[key] = value;
          });
          
          // Enrich spot with listing data and booking information
          return {
            ...spot,
            listingId: primaryListingId,
            dailyRate: primaryDailyRate,
            availabilityDates: uniqueDates, // Array of all available dates (deduplicated)
            bookedDates: bookedDates, // Array of dates that are already booked
            dateToPrice: dateToPrice, // Map of date -> {listingId, dailyRate} for accurate pricing
            // Keep backward compatibility with single date
            availability: uniqueDates.length > 0 ? {
              date: uniqueDates[0]
            } : undefined
          };
        })
        .filter(spot => spot !== null); // Remove any null entries from safety check
      
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
        // Step 1: Check for existing active locks on this listing+date combination (with row-level lock)
        const existingLock = await tx
          .select()
          .from(spotLocks)
          .where(and(
            eq(spotLocks.listingId, listingId),
            eq(spotLocks.bookingDate, bookingDate),
            eq(spotLocks.status, 'active')
          ))
          .for('update');
        
        if (existingLock.length > 0) {
          throw new Error('SPOT_ALREADY_LOCKED');
        }
        
        // Step 2: Check if user already has an active lock (enforce one lock per user)
        const userActiveLock = await tx
          .select()
          .from(spotLocks)
          .where(and(
            eq(spotLocks.userId, userId),
            eq(spotLocks.status, 'active')
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

      // Additional validation: Ensure user is not booking their own spot
      if (spot.ownerId === userId) {
        return res.status(400).json({ 
          error: "You cannot book your own parking spot" 
        });
      }

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

      if (!correctListing || correctListing.length === 0) {
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
      const actualDailyRate = Number(listing.dailyRate);
      const actualTotalAmount = actualDailyRate; // Single day booking

      console.log(`[Booking] Using CORRECT listing ${listing.id} with price: dailyRate=${actualDailyRate}, totalAmount=${actualTotalAmount}`);

      // Create the booking with the authenticated user as renter
      const newBooking = await storage.createBooking({
        ...validatedData,
        renterId: userId,
        // Ensure ownerId matches the spot owner
        ownerId: spot.ownerId || "unassigned",
        // SECURITY: Override frontend prices with actual database prices
        dailyRate: actualDailyRate.toString(),
        totalAmount: actualTotalAmount.toString()
      } as any); // Type assertion since we're adding required fields server-side

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
            
            // Prepare booking details for email with correct field mapping
            const bookingDetails = {
              id: newBooking.id,
              spotNumber: spot.spotNumber,
              location: 'BCI Campus',
              building: 'BCI Campus',
              startDate: new Date(newBooking.bookingDate), // Use bookingDate as start date
              endDate: new Date(newBooking.bookingDate), // Same day booking
              rate: Number(newBooking.dailyRate), // Convert decimal to number
              totalAmount: Number(newBooking.totalAmount) // Convert decimal to number
            };

            // Send the notification asynchronously
            await sendBookingConfirmationNotification(
              { name: displayName, email: user.email || '', id: user.id },
              bookingDetails,
              notificationPreferences || {}
            );
          }
        } catch (emailError) {
          // Log error but don't impact the user experience
          console.error('Failed to send booking confirmation email:', emailError);
        }
      });

      res.json(newBooking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid booking data", details: error.errors });
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

  // Analytics API endpoints (Admin only)
  app.get("/api/admin/analytics-overview", requireAdmin, async (req, res) => {
    try {
      // Extract and validate scope parameter
      const scopeParam = req.query.scope as string;
      const scope: 'bci' | 'all' = scopeParam === 'bci' ? 'bci' : 'all';
      
      const overview = await storage.getAnalyticsOverview(scope);
      const now = new Date();
      
      res.json({
        ...overview,
        generatedAt: now.toISOString(),
        dateContext: {
          today: now.toISOString().split('T')[0],
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
      
      // Debug: Check MT spot in response
      const mtSpot = allSpots.find(s => s.spotNumber === 'MT');
      if (mtSpot) {
        console.log('[API RESPONSE] MT Spot being sent to frontend:', {
          spotNumber: mtSpot.spotNumber,
          spotTypeId: mtSpot.spotTypeId,
          spotTypeName: mtSpot.spotTypeName,
          locationName: mtSpot.locationName
        });
      }
      
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

  // Get active bookings (confirmed/pending, future dates) (Admin only)
  app.get("/api/admin/active-bookings", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const activeBookings = await storage.getActiveBookings(isBciOnly);
      res.json(activeBookings);
    } catch (error) {
      console.error("Error fetching active bookings:", error);
      res.status(500).json({ error: "Failed to fetch active bookings" });
    }
  });

  // Get past bookings (completed/cancelled or past dates) (Admin only)
  app.get("/api/admin/past-bookings", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      const pastBookings = await storage.getPastBookings(isBciOnly);
      res.json(pastBookings);
    } catch (error) {
      console.error("Error fetching past bookings:", error);
      res.status(500).json({ error: "Failed to fetch past bookings" });
    }
  });

  // Get booking analytics (Admin only)
  app.get("/api/admin/booking-analytics", requireAdmin, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const isBciOnly = scope === 'bci';
      
      // Fetch data with scope filtering
      const activeBookings = await storage.getActiveBookings(isBciOnly);
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Calculate this week's start date (Monday)
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];
      
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

      res.json(cancelledListing);
    } catch (error) {
      console.error("Error cancelling spot listing:", error);
      res.status(500).json({ error: "Failed to cancel spot listing" });
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

      // Don't allow cancelling already completed or cancelled bookings
      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return res.status(400).json({ error: `Cannot cancel ${booking.status} booking` });
      }

      const cancelledBooking = await storage.cancelBookingWithReason(id, "Cancelled by renter");
      
      await auditService.logAction("CANCEL", "booking", {
        entityId: id,
        message: `Booking ${id} cancelled by renter`,
        before: booking,
        after: cancelledBooking
      });

      res.json(cancelledBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
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
      
      await auditService.logAction("CANCEL", "booking", {
        entityId: id,
        message: `Booking ${id} cancelled by admin: ${reason}`,
        before: booking,
        after: cancelledBooking
      });

      res.json(cancelledBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
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
      const { name, slug, description, isActive } = req.body;
      
      if (!name || !slug) {
        return res.status(400).json({ error: "Name and slug are required" });
      }
      
      const spotType = await storage.createSpotType({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim(),
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
      const { name, slug, description, isActive } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid spot type ID" });
      }
      
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (slug !== undefined) updates.slug = slug.trim().toLowerCase();
      if (description !== undefined) updates.description = description?.trim();
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
        isBciManaged: z.boolean().optional()
      });
      
      const { spotId, userId, isBciManaged } = assignSpotSchema.parse(req.body);

      // Get spot info before assignment for audit logging
      const existingSpot = await storage.getParkingSpot(spotId);
      const user = await storage.getUser(userId);
      
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
      
      res.json(updatedSpot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error assigning parking spot:", error);
      res.status(500).json({ error: "Failed to assign parking spot" });
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
      
      // Business Rule: Reserved spots (spotTypeId = 2) should NOT be bookable (reserved for C-suite)
      if (validatedData.spotTypeId === 2) {
        validatedData.isBookable = false;
      }
      
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
      
      res.json(updatedSpot);
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
      
      // Business Rule: Reserved spots (spotTypeId = 2) should NOT be bookable (reserved for C-suite)
      if (validatedData.spotTypeId === 2) {
        validatedData.isBookable = false;
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
      
      res.json(updatedSpot);
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

  // Bulk create spot listings (Admin only)
  app.post("/api/admin/bulk-create-listings", requireAdmin, async (req: any, res) => {
    try {
      console.log('[DEBUG] Bulk create listings - req.body.dailyRate:', req.body.dailyRate, 'Type:', typeof req.body.dailyRate);
      
      // Validate request body with Zod
      const validatedData = bulkCreateListingsSchema.parse(req.body);
      const { spotIds, listingType, singleDate, periodStartDate, periodEndDate, dailyRate } = validatedData;
      
      console.log('[DEBUG] After Zod validation - dailyRate:', dailyRate, 'Type:', typeof dailyRate);
      
      // Get admin user ID for listings ownership
      const adminUserId = getAuthenticatedUserId(req);
      if (!adminUserId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Create the listing data object
      const dailyRateString = dailyRate.toString();
      console.log('[DEBUG] dailyRate after toString():', dailyRateString);
      
      const listingData: any = {
        listingType,
        dailyRate: dailyRateString,
        status: "available"
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

  // ===== APP CONFIGURATION ENDPOINTS =====

  // GET /api/admin/app-configs - Get all app configurations (Admin only)
  app.get("/api/admin/app-configs", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllAppConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching app configs:", error);
      res.status(500).json({ error: "Failed to fetch app configurations" });
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
        if (key.includes('timeout') && numValue <= 0) {
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
      const timestamp = new Date().toISOString().split('T')[0];
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
                
                // Prepare payment details
                const paymentDetails = {
                  bookingId: booking.id,
                  spotNumber: spot.spotNumber,
                  amount: Number(booking.totalAmount), // Convert decimal to number
                  dueDate: dueDate,
                  daysOverdue: daysDiff > 0 ? daysDiff : undefined
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

  // POST /api/admin/seed-sample-bookings - Create sample bookings for testing (Admin only)
  app.post("/api/admin/seed-sample-bookings", requireAdmin, async (req, res) => {
    try {
      // Get some parking spots and users for sample bookings
      const spots = await storage.getAllParkingSpots();
      const users = await storage.getAllUsers();
      
      if (spots.length === 0 || users.length < 2) {
        return res.status(400).json({ 
          error: "Not enough data to create sample bookings. Need at least some parking spots and 2 users." 
        });
      }
      
      // Find or use sample users
      const renter = users.find(u => u.roles?.includes('renter')) || users[0];
      const owner = users.find(u => u.roles?.includes('owner')) || users[1] || users[0];
      
      // Use first few spots
      const sampleSpots = spots.slice(0, 5);
      
      const createdBookings = [];
      const createdListings = [];
      
      // Helper to get dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      
      // Create listings for each spot
      for (let i = 0; i < sampleSpots.length; i++) {
        const spot = sampleSpots[i];
        
        // Create a listing for this spot
        const listing = await storage.createSpotListing({
          spotId: spot.id,
          ownerId: owner.id,
          listingType: 'single',
          singleDate: i === 0 ? formatDate(yesterday) : 
                      i === 1 ? formatDate(today) : 
                      i === 2 ? formatDate(tomorrow) :
                      i === 3 ? formatDate(nextWeek) :
                      formatDate(lastWeek),
          dailyRate: (25 + i * 5).toString(),
          status: 'active'
        });
        
        createdListings.push(listing);
        
        // Create a booking for each listing with different statuses
        let bookingStatus: 'confirmed' | 'pending' | 'cancelled' | 'completed';
        let paymentReceived = false;
        let bookingDate = listing.singleDate!;
        
        switch (i) {
          case 0:
            // Past confirmed booking with payment
            bookingStatus = 'completed';
            paymentReceived = true;
            break;
          case 1:
            // Today's confirmed booking, no payment yet
            bookingStatus = 'confirmed';
            paymentReceived = false;
            break;
          case 2:
            // Future pending booking
            bookingStatus = 'pending';
            paymentReceived = false;
            break;
          case 3:
            // Future confirmed booking with payment
            bookingStatus = 'confirmed';
            paymentReceived = true;
            break;
          case 4:
            // Past cancelled booking
            bookingStatus = 'cancelled';
            paymentReceived = false;
            break;
          default:
            bookingStatus = 'confirmed';
            paymentReceived = false;
        }
        
        const booking = await storage.createBooking({
          listingId: listing.id,
          spotId: spot.id,
          renterId: renter.id,
          ownerId: owner.id,
          bookingDate,
          dailyRate: listing.dailyRate,
          totalAmount: listing.dailyRate,
          status: bookingStatus,
          paymentReceived,
          notes: `Sample booking ${i + 1} - Status: ${bookingStatus}`,
          ...(bookingStatus === 'cancelled' ? { cancellationReason: 'Sample cancellation for testing' } : {})
        } as any); // Type assertion since we're adding required fields server-side
        
        createdBookings.push(booking);
      }
      
      res.json({
        success: true,
        message: `Created ${createdBookings.length} sample bookings with various statuses`,
        bookings: createdBookings.map(b => ({
          id: b.id,
          status: b.status,
          bookingDate: b.bookingDate,
          paymentReceived: b.paymentReceived,
          spotId: b.spotId
        })),
        listings: createdListings.map(l => ({
          id: l.id,
          spotId: l.spotId,
          singleDate: l.singleDate
        }))
      });
      
    } catch (error) {
      console.error('Failed to create sample bookings:', error);
      res.status(500).json({ error: "Failed to create sample bookings" });
    }
  });

  // Reports Hub API endpoints (Admin only)
  app.get("/api/admin/reports/overview", requireAdmin, getReportOverview);
  app.get("/api/admin/reports/utilization", requireAdmin, getReportUtilization);
  app.get("/api/admin/reports/revenue", requireAdmin, getReportRevenue);
  app.get("/api/admin/reports/user-compliance", requireAdmin, getReportUserCompliance);
  app.get("/api/admin/reports/waitlist-performance", requireAdmin, getReportWaitlistPerformance);
  app.get("/api/admin/reports/spot-assignments", requireAdmin, getSpotAssignmentReport);
  
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
          message: "SendGrid is not configured. Please contact your administrator to set up email delivery."
        });
      }
      
      // Fetch report data based on type
      let reportData: any;
      const dateRange = { 
        from: from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: to || new Date().toISOString().split('T')[0]
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

  const httpServer = createServer(app);

  return httpServer;
}
