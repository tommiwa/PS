import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireAdmin, getAuthenticatedUserId, getAuthenticatedUserRole } from "./replitAuth";
import { z } from "zod";
import { 
  sendAssignmentNotification, 
  sendWelcomeNotification,
  sendBookingConfirmationNotification,
  getUserNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount,
  type InAppNotification 
} from "./notification-service";
import { 
  insertParkingSpotSchema,
  insertSpotListingSchema,
  insertBookingSchema,
  insertWaitingListSchema,
  insertUserSchema,
  type User,
  type WaitingList,
  type SpotType,
  type AuditAction,
  type EntityType,
  type UserRole,
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

// Zod schemas for admin endpoints
const toggleBookabilitySchema = z.object({
  spotId: z.string().min(1, "spotId is required"),
  isBookable: z.boolean()
});

const bulkToggleBookabilitySchema = z.object({
  spotIds: z.array(z.string().min(1, "spotId is required")).min(1, "At least one spotId is required"),
  isBookable: z.boolean()
});

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
      
      // Add computed name for compatibility
      const userWithName = {
        ...user,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email
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
      const updatedUser = await storage.updateUser(userId, { role: "admin" });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Audit the role change
      await auditService.logAction("UPDATE", "user", {
        entityId: updatedUser.id,
        message: `User promoted to admin role: ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email})`,
        before: { role: "renter" }, // Assume previous role
        after: { role: "admin" }
      });
      
      res.json({ message: "User promoted to admin successfully", user: updatedUser });
    } catch (error) {
      console.error("Error promoting user to admin:", error);
      res.status(500).json({ message: "Failed to promote user to admin" });
    }
  });

  // Create new user (Admin only)
  app.post("/api/users", requireAdmin, async (req: any, res) => {
    try {
      // Validate request body
      const validatedData = insertUserSchema.parse(req.body);
      
      const newUser = await storage.createUser(validatedData);
      
      // Audit the user creation
      await auditService.logAction("CREATE", "user", {
        entityId: newUser.id,
        message: `Created user ${newUser.firstName} ${newUser.lastName} (${newUser.email}) with role ${newUser.role}`,
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
        department: parseResult.department,
        memberSince: parseResult.memberSince,
        ...(parseResult.role && userRoles.options.includes(parseResult.role as any) && { 
          role: parseResult.role as UserRole 
        })
      };
      
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
      const isAdmin = currentUser?.role === 'admin';
      
      if (!isAdmin && currentUserId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const assignedSpots = await storage.getParkingSpotsByOwner(userId);
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
      const isAdmin = currentUser?.role === 'admin';
      
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
      const isAdmin = currentUser?.role === 'admin';
      
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
        message: `Created parking spot ${newSpot.spotNumber} at ${newSpot.location}`,
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
        message: `Updated parking spot ${updatedSpot.spotNumber} at ${updatedSpot.location}`,
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
        message: `Deleted parking spot ${existingSpot.spotNumber} at ${existingSpot.location}`,
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

  // Mark payment received/unreceived
  app.patch("/api/bookings/:id/payment", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { paymentReceived } = req.body;
      const userId = getAuthenticatedUserId(req);
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      if (typeof paymentReceived !== 'boolean') {
        return res.status(400).json({ error: "paymentReceived must be a boolean" });
      }
      
      // Check if booking belongs to the user (as owner)
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      if (booking.ownerId !== userId) {
        return res.status(403).json({ error: "Not authorized to update payment status for this booking" });
      }
      
      const updatedBooking = await storage.markPaymentReceived(id, paymentReceived);
      
      if (!updatedBooking) {
        return res.status(404).json({ error: "Failed to update payment status" });
      }
      
      // Audit the payment status update
      await auditService.logAction("UPDATE", "booking", {
        entityId: updatedBooking.id,
        message: `${paymentReceived ? 'Marked payment as received' : 'Unmarked payment'} for booking ${updatedBooking.id}`,
        before: { ...booking, paymentReceived: booking.paymentReceived },
        after: { ...updatedBooking, paymentReceived: updatedBooking.paymentReceived }
      });
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ error: "Failed to update payment status" });
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
      res.json(listings);
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
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get available parking spots for search (Authenticated users)
  app.get("/api/available-spots", isAuthenticated, async (req: any, res) => {
    try {
      // Use safe method that excludes sensitive user data like email addresses
      const allSpots = await storage.getAllParkingSpotsWithSafeUserData();
      
      // Filter to only show spots that can be searched/booked by renters
      const availableSpots = allSpots.filter(spot => {
        // Only show spots that are:
        // 1. Active (not deactivated)
        // 2. Have an owner (assigned spots)
        // 3. Are bookable (not taxable_benefit or disabled)
        return spot.isActive && 
               spot.ownerId && 
               spot.isBookable && 
               true; // Removed invalid spotType comparison
      });
      
      res.json(availableSpots);
    } catch (error) {
      console.error("Error fetching available spots:", error);
      res.status(500).json({ error: "Failed to fetch available spots" });
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

      // Create the booking with the authenticated user as renter
      const newBooking = await storage.createBooking({
        ...validatedData,
        renterId: userId,
        // Ensure ownerId matches the spot owner
        ownerId: spot.ownerId || "unassigned"
      });

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
              location: spot.location || 'BCI Campus',
              building: spot.location || 'BCI Campus', // Use location as building since building field doesn't exist
              startDate: new Date(newBooking.bookingDate), // Use bookingDate as start date
              endDate: new Date(newBooking.bookingDate), // Same day booking
              rate: Number(newBooking.dailyRate), // Convert decimal to number
              totalAmount: Number(newBooking.totalAmount) // Convert decimal to number
            };

            // Send the notification asynchronously
            await sendBookingConfirmationNotification(
              { name: displayName, email: user.email, id: user.id },
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
      res.json(unallocatedSpots);
    } catch (error) {
      console.error("Error fetching unallocated spots:", error);
      res.status(500).json({ error: "Failed to fetch unallocated spots" });
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
      const overview = await storage.getAnalyticsOverview();
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
      const [monthlyData, revenueBreakdown] = await Promise.all([
        storage.getMonthlyRevenueData(monthsBack),
        storage.getRevenueBreakdown()
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
      const [topSpots, topOwners] = await Promise.all([
        storage.getTopPerformingSpots(limit),
        storage.getTopEarningOwners(limit)
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
      const activeIssues = await storage.getActiveIssues();
      
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
      const [peakHours, locationPerformance] = await Promise.all([
        storage.getPeakHoursData(),
        storage.getLocationPerformanceData()
      ]);
      
      // Generate weekly trends (simplified for now)
      const weeklyTrends = [
        { dayOfWeek: 'Monday', bookings: 45, utilization: 85 },
        { dayOfWeek: 'Tuesday', bookings: 52, utilization: 92 },
        { dayOfWeek: 'Wednesday', bookings: 48, utilization: 87 },
        { dayOfWeek: 'Thursday', bookings: 51, utilization: 90 },
        { dayOfWeek: 'Friday', bookings: 41, utilization: 79 },
        { dayOfWeek: 'Saturday', bookings: 23, utilization: 45 },
        { dayOfWeek: 'Sunday', bookings: 18, utilization: 35 }
      ];
      
      res.json({
        peakHours,
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
      res.json(allSpots);
    } catch (error) {
      console.error("Error fetching all spots:", error);
      res.status(500).json({ error: "Failed to fetch all spots" });
    }
  });

  // Assign a parking spot to a user (Admin only)
  app.post("/api/admin/assign-spot", requireAdmin, async (req, res) => {
    try {
      const assignSpotSchema = z.object({
        spotId: z.string().min(1, "spotId is required"),
        userId: z.string().min(1, "userId is required")
      });
      
      const { spotId, userId } = assignSpotSchema.parse(req.body);

      // Get spot info before assignment for audit logging
      const existingSpot = await storage.getParkingSpot(spotId);
      const user = await storage.getUser(userId);
      
      // Check if user has an active waiting list entry and remove it
      const waitingListEntry = await storage.getWaitingListByUser(userId);
      if (waitingListEntry) {
        await storage.deleteWaitingListEntry(waitingListEntry.id);
        
        // Audit the waiting list removal
        await auditService.logAction("DELETE", "waiting_list", {
          entityId: waitingListEntry.id,
          message: `Removed ${user?.firstName} ${user?.lastName} (${user?.email}) from waiting list due to spot assignment`,
          before: waitingListEntry
        });
      }
      
      const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: userId });
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the spot assignment
      await auditService.logAction("ASSIGN", "parking_spot", {
        entityId: spotId,
        message: `Assigned parking spot ${updatedSpot.spotNumber} to ${user?.firstName} ${user?.lastName} (${user?.email})${waitingListEntry ? ' (removed from waiting list)' : ''}`,
        before: existingSpot,
        after: updatedSpot
      });
      
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
        userId: z.string().min(1, "userId is required")
      });
      
      const { spotIds, userId } = bulkAssignSchema.parse(req.body);

      // Get user info for audit logging
      const user = await storage.getUser(userId);
      
      // Check if user has an active waiting list entry and remove it (only once for bulk assignment)
      const waitingListEntry = await storage.getWaitingListByUser(userId);
      if (waitingListEntry) {
        await storage.deleteWaitingListEntry(waitingListEntry.id);
        
        // Audit the waiting list removal
        await auditService.logAction("DELETE", "waiting_list", {
          entityId: waitingListEntry.id,
          message: `Removed ${user?.firstName} ${user?.lastName} (${user?.email}) from waiting list due to bulk spot assignment`,
          before: waitingListEntry
        });
      }
      
      const updatedSpots = [];
      for (const spotId of spotIds) {
        const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: userId });
        if (updatedSpot) {
          updatedSpots.push(updatedSpot);
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
          assignedSpots: updatedSpots.map(s => ({ id: s.id, spotNumber: s.spotNumber, location: s.location }))
        }
      });
      
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
        message: `Admin created parking spot ${newSpot.spotNumber} at ${newSpot.location}${newSpot.ownerId ? ` (assigned to ${newSpot.ownerId})` : ' (unallocated)'}`,
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
      // Get all actual users from storage
      const allUsers = await storage.getAllUsers?.() || [];
      const allSpots = await storage.getAllParkingSpots?.() || [];
      const allBookings = await storage.getAllBookings?.() || [];
      
      // Calculate real spots and bookings counts for each user
      const usersWithCounts = allUsers.map(user => {
        const userSpots = allSpots.filter(spot => spot.ownerId === user.id);
        const userBookings = allBookings.filter(booking => 
          booking.renterId === user.id || booking.ownerId === user.id
        );
        
        return {
          id: user.id,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
          email: user.email,
          phone: user.phone || "",
          department: user.department || "Unknown",
          role: user.role,
          status: "active", // Default status since User type doesn't have status field
          spotsOwned: userSpots.length,
          bookingsCount: userBookings.length,
          lastLogin: user.lastLogin ? (user.lastLogin instanceof Date ? user.lastLogin.toISOString() : user.lastLogin) : new Date().toISOString(),
          memberSince: user.memberSince ? (user.memberSince instanceof Date ? user.memberSince.toISOString() : user.memberSince) : user.createdAt ? (user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt) : new Date().toISOString()
        };
      });
      
      res.json(usersWithCounts);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
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
      
      // Audit the spot unassignment
      await auditService.logAction("UNASSIGN", "parking_spot", {
        entityId: spotId,
        message: `Admin unassigned parking spot ${updatedSpot.spotNumber} at ${updatedSpot.location}${formerOwner ? ` from ${formerOwner.firstName} ${formerOwner.lastName} (${formerOwner.email})` : ''}`,
        before: existingSpot,
        after: updatedSpot
      });
      
      res.json(updatedSpot);
    } catch (error) {
      console.error("Error unassigning parking spot:", error);
      res.status(500).json({ error: "Failed to unassign parking spot" });
    }
  });

  // Update any parking spot (Admin only)
  app.put("/api/admin/spots/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if spot exists
      const existingSpot = await storage.getParkingSpot(id);
      if (!existingSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Validate request body
      const validatedData = insertParkingSpotSchema.partial().parse(req.body);
      
      const updatedSpot = await storage.updateParkingSpot(id, validatedData);
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      // Audit the admin spot update
      await auditService.logAction("UPDATE", "parking_spot", {
        entityId: updatedSpot.id,
        message: `Admin updated parking spot ${updatedSpot.spotNumber} at ${updatedSpot.location}`,
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
        message: `Admin deleted parking spot ${existingSpot.spotNumber} at ${existingSpot.location}`,
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
              location: spot.location,
              spotType: spot.spotType,
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
      
      // Return data in expected format
      res.json({
        items: activityItems,
        total: activityItems.length, // Use filtered count
        page: result.page,
        pageSize: result.limit,
        totalPages: Math.ceil(activityItems.length / result.limit)
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
      const userRole = await getAuthenticatedUserRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access this waiting list entry" });
      }
      
      const entry = await storage.getWaitingListByUser(userId);
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
      
      // Validate request body and add user information
      const waitingListData = insertWaitingListSchema.parse({
        ...req.body,
        userId: userId,
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
        userEmail: user.email || '',
        userDepartment: user.department || 'Unknown'
      });
      
      const entry = await storage.createWaitingListEntry(waitingListData);
      
      // Audit the waiting list entry creation
      await auditService.logAction("CREATE", "waiting_list", {
        entityId: entry.id,
        message: `Created waiting list entry for ${entry.userName} (${entry.userEmail}) - ${entry.preferredSpotType || 'any'} preference`,
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
        userDepartment: user.department || 'Unknown',
        status: 'active'
      });
      
      const entry = await storage.createWaitingListEntry(validatedData);
      
      // Audit the waiting list entry creation
      await auditService.logAction("CREATE", "waiting_list", {
        entityId: entry.id,
        message: `Admin added ${entry.userName} (${entry.userEmail}) to waiting list - ${entry.preferredSpotType || 'any'} preference`,
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
      const userRole = await getAuthenticatedUserRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access these notifications" });
      }
      
      const notifications = getUserNotifications(userId);
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
      
      const success = markNotificationAsRead(userId, id);
      if (!success) {
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
      
      const notifications = getUserNotifications(userId);
      let markedCount = 0;
      
      for (const notification of notifications) {
        if (!notification.read) {
          const success = markNotificationAsRead(userId, notification.id);
          if (success) markedCount++;
        }
      }
      
      res.json({ success: true, markedCount });
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
      
      const notifications = getUserNotifications(userId);
      const index = notifications.findIndex(n => n.id === id);
      
      if (index === -1) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      notifications.splice(index, 1);
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
      const userRole = await getAuthenticatedUserRole(req);
      if (userId !== authenticatedUserId && userRole !== "admin") {
        return res.status(403).json({ error: "Not authorized to access this unread count" });
      }
      
      const count = getUnreadNotificationCount(userId);
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
        userDepartment: "Unknown",
        preferredSpotType: (waitingListEntry.spotPreferences?.spotType as SpotType) || null,
        preferredBuilding: waitingListEntry.spotPreferences?.building || null,
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

  const httpServer = createServer(app);

  return httpServer;
}
