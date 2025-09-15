import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireAdmin, getAuthenticatedUserId, getAuthenticatedUserRole } from "./replitAuth";
import { z } from "zod";
import { 
  sendAssignmentNotification, 
  sendWelcomeNotification,
  getUserNotifications,
  markNotificationAsRead,
  getUnreadNotificationCount,
  type InAppNotification 
} from "./notification-service";
import { 
  insertParkingSpotSchema,
  insertSpotListingSchema,
  insertBookingSchema,
  insertWaitingListSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);

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

  // Get all unallocated parking spots (Admin only)
  app.get("/api/admin/unallocated-spots", requireAdmin, async (req, res) => {
    try {
      const allSpots = await storage.getAllParkingSpots();
      const unallocatedSpots = allSpots.filter(spot => !spot.ownerId);
      res.json(unallocatedSpots);
    } catch (error) {
      console.error("Error fetching unallocated spots:", error);
      res.status(500).json({ error: "Failed to fetch unallocated spots" });
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

      const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: userId });
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
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
        userId: z.string().min(1, "userId is required")
      });
      
      const { spotIds, userId } = bulkAssignSchema.parse(req.body);

      const updatedSpots = [];
      for (const spotId of spotIds) {
        const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: userId });
        if (updatedSpot) {
          updatedSpots.push(updatedSpot);
        }
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

  // Get all users for assignment dropdown (Admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Get all actual users from storage
      const allUsers = await storage.getAllUsers?.() || [];
      
      // Format users for the dropdown
      const usersForDropdown = allUsers.map(user => ({
        id: user.id,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
        email: user.email,
        department: user.department || "Unknown"
      }));
      
      res.json(usersForDropdown);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
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
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating waiting list entry:", error);
      res.status(500).json({ error: "Failed to create waiting list entry" });
    }
  });

  // Update waiting list entry (admin)
  app.put("/api/waiting-list/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const validatedData = insertWaitingListSchema.partial().parse(req.body);
      
      const updatedEntry = await storage.updateWaitingListEntry(id, validatedData);
      if (!updatedEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
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
      const deleted = await storage.deleteWaitingListEntry(id);
      if (!deleted) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
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
      
      const result = await sendWelcomeNotification(user, waitingListEntry, userPreferences);
      
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
