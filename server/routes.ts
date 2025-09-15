import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Add explicit handler for /api to stop excessive HEAD requests
  app.all("/api", (req, res) => {
    if (req.method === "HEAD") {
      console.log("HEAD request to /api blocked");
      return res.status(200).end();
    }
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Get user's parking spots
  app.get("/api/my-spots", async (req, res) => {
    try {
      // For now, use mock user ID - in real app this would come from session
      const userId = "mock-user-id";
      const spots = await storage.getParkingSpotsByOwner(userId);
      res.json(spots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parking spots" });
    }
  });

  // Create new parking spot
  app.post("/api/my-spots", async (req, res) => {
    try {
      // For now, use mock user ID - in real app this would come from session
      const userId = "mock-user-id";
      const spotData = { ...req.body, ownerId: userId };
      const newSpot = await storage.createParkingSpot(spotData);
      res.json(newSpot);
    } catch (error) {
      res.status(500).json({ error: "Failed to create parking spot" });
    }
  });

  // Update parking spot
  app.put("/api/my-spots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedSpot = await storage.updateParkingSpot(id, req.body);
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      res.json(updatedSpot);
    } catch (error) {
      res.status(500).json({ error: "Failed to update parking spot" });
    }
  });

  // Delete parking spot
  app.delete("/api/my-spots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteParkingSpot(id);
      if (!deleted) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete parking spot" });
    }
  });

  // Create spot listing
  app.post("/api/spot-listings", async (req, res) => {
    try {
      // For now, use mock user ID - in real app this would come from session  
      const userId = "mock-user-id";
      const listingData = { ...req.body, ownerId: userId };
      const newListing = await storage.createSpotListing(listingData);
      res.json(newListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to create spot listing" });
    }
  });

  // Update listing (Edit)
  app.patch("/api/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedListing = await storage.updateListing(id, req.body);
      if (!updatedListing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json(updatedListing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update listing" });
    }
  });

  // Delete listing
  app.delete("/api/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteListing(id);
      if (!deleted) {
        return res.status(404).json({ error: "Listing not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete listing" });
    }
  });

  // Mark payment received/unreceived
  app.patch("/api/bookings/:id/payment", async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentReceived } = req.body;
      
      if (typeof paymentReceived !== 'boolean') {
        return res.status(400).json({ error: "paymentReceived must be a boolean" });
      }
      
      const updatedBooking = await storage.markPaymentReceived(id, paymentReceived);
      if (!updatedBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment status" });
    }
  });

  // Get user's listings (for owners in MyBookings)
  app.get("/api/my-listings", async (req, res) => {
    try {
      // For now, use mock user ID - in real app this would come from session
      const userId = "mock-user-id";
      const listings = await storage.getSpotListingsByOwner(userId);
      res.json(listings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch spot listings" });
    }
  });

  // Get user's bookings (for renters in MyBookings)
  app.get("/api/my-bookings", async (req, res) => {
    try {
      // For now, use mock user ID - in real app this would come from session
      const userId = "mock-user-id";
      const bookings = await storage.getBookingsByRenter(userId);
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get all unallocated parking spots (Admin only)
  app.get("/api/admin/unallocated-spots", async (req, res) => {
    try {
      const allSpots = await storage.getAllParkingSpots();
      const unallocatedSpots = allSpots.filter(spot => !spot.ownerId);
      res.json(unallocatedSpots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unallocated spots" });
    }
  });

  // Assign a parking spot to a user (Admin only)
  app.post("/api/admin/assign-spot", async (req, res) => {
    try {
      const { spotId, userId } = req.body;
      
      if (!spotId || !userId) {
        return res.status(400).json({ error: "spotId and userId are required" });
      }

      const updatedSpot = await storage.updateParkingSpot(spotId, { ownerId: userId });
      if (!updatedSpot) {
        return res.status(404).json({ error: "Parking spot not found" });
      }
      
      res.json(updatedSpot);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign parking spot" });
    }
  });

  // Bulk assign parking spots to a user (Admin only)
  app.post("/api/admin/bulk-assign-spots", async (req, res) => {
    try {
      const { spotIds, userId } = req.body;
      
      if (!spotIds || !Array.isArray(spotIds) || !userId) {
        return res.status(400).json({ error: "spotIds (array) and userId are required" });
      }

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
      res.status(500).json({ error: "Failed to bulk assign parking spots" });
    }
  });

  // Get all users for assignment dropdown (Admin only)
  app.get("/api/admin/users", async (req, res) => {
    try {
      // In a real app, this would get all users from the database
      // For now, return mock users
      const mockUsers = [
        { id: "user-001", name: "Sarah Chen", email: "sarah.chen@bci.ca", department: "Engineering" },
        { id: "user-002", name: "Michael Rodriguez", email: "m.rodriguez@bci.ca", department: "Marketing" },
        { id: "user-003", name: "Jennifer Kim", email: "j.kim@bci.ca", department: "Finance" },
        { id: "user-004", name: "David Thompson", email: "d.thompson@bci.ca", department: "IT" },
        { id: "user-005", name: "Emma Wilson", email: "e.wilson@bci.ca", department: "HR" },
        { id: "user-006", name: "John Park", email: "j.park@bci.ca", department: "Operations" },
        { id: "user-007", name: "Lisa Anderson", email: "l.anderson@bci.ca", department: "Legal" },
        { id: "user-008", name: "Robert Johnson", email: "r.johnson@bci.ca", department: "Sales" }
      ];
      res.json(mockUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // ===== WAITING LIST ENDPOINTS =====

  // Get all waiting list entries (admin)
  app.get("/api/waiting-list", async (req, res) => {
    try {
      const entries = await storage.getAllWaitingList();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch waiting list" });
    }
  });

  // Get active waiting list entries (admin)
  app.get("/api/waiting-list/active", async (req, res) => {
    try {
      const entries = await storage.getActiveWaitingList();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active waiting list" });
    }
  });

  // Get user's waiting list entry
  app.get("/api/waiting-list/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const entry = await storage.getWaitingListByUser(userId);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user waiting list entry" });
    }
  });

  // Create waiting list entry
  app.post("/api/waiting-list", async (req, res) => {
    try {
      const entry = await storage.createWaitingListEntry(req.body);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to create waiting list entry" });
    }
  });

  // Update waiting list entry (admin)
  app.put("/api/waiting-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedEntry = await storage.updateWaitingListEntry(id, req.body);
      if (!updatedEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      res.json(updatedEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update waiting list entry" });
    }
  });

  // Assign waiting list user to a spot (admin)
  app.post("/api/waiting-list/:id/assign", async (req, res) => {
    try {
      const { id } = req.params;
      const { spotId } = req.body;
      
      if (!spotId) {
        return res.status(400).json({ error: "Spot ID is required" });
      }

      const assignedEntry = await storage.assignWaitingListUser(id, spotId);
      if (!assignedEntry) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      res.json(assignedEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign waiting list user" });
    }
  });

  // Cancel/remove waiting list entry
  app.delete("/api/waiting-list/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteWaitingListEntry(id);
      if (!deleted) {
        return res.status(404).json({ error: "Waiting list entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete waiting list entry" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
