import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

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

  const httpServer = createServer(app);

  return httpServer;
}
