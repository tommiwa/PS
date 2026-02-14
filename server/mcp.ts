import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import type { Express } from "express";
import cors from "cors";
import { createHash } from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import fs from "node:fs";
import path from "node:path";

const MCP_APPS_DIR = path.join(import.meta.dirname, "..", "mcp-apps", "dist");

function readAppHtml(filename: string): string {
  try {
    return fs.readFileSync(path.join(MCP_APPS_DIR, filename), "utf-8");
  } catch {
    return `<html><body><p>MCP App UI not built. Run the build step first.</p></body></html>`;
  }
}

async function authenticateApiKey(apiKey: string): Promise<User | null> {
  if (!apiKey) return null;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await storage.getApiKeyByHash(keyHash);
  if (!keyRecord) return null;
  storage.updateApiKeyLastUsed(keyRecord.id).catch(() => {});
  const user = await storage.getUser(keyRecord.userId);
  if (!user || user.status !== 'active') return null;
  return user;
}

function formatDate(d: Date | string | null): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return d.toISOString().split('T')[0];
}

async function getLocationName(locationId: number): Promise<string> {
  const loc = await storage.getLocation(locationId);
  if (!loc) return 'Unknown';
  return `${loc.office} - ${loc.building} ${loc.level}`;
}

async function getSpotTypeName(spotTypeId: number): Promise<string> {
  const st = await storage.getSpotType(spotTypeId);
  return st?.name || 'Unknown';
}

function createMcpServerForUser(user: User): McpServer {
  const server = new McpServer({
    name: "BCI ParkShare",
    version: "1.0.0",
  });

  const spotsSearchUri = "ui://parkshare/spots-search.html";
  registerAppTool(
    server,
    "search_available_spots",
    {
      title: "Search Available Spots",
      description: "Search for available parking spots. Returns spots with active listings that can be booked.",
      inputSchema: {
        location: z.string().optional().describe("Filter by location name (partial match)"),
        date: z.string().optional().describe("Filter by specific date (YYYY-MM-DD format)"),
      },
      _meta: { ui: { resourceUri: spotsSearchUri } },
    },
    async ({ location, date }): Promise<any> => {
      try {
        const activeListings = await storage.getActiveSpotListings();
        const allSpots = await storage.getAllParkingSpots();
        const locs = await storage.getLocations();
        const spotTypes = await storage.getSpotTypes();
        const spotsMap = new Map(allSpots.map(s => [s.id, s]));
        const locsMap = new Map(locs.map(l => [l.id, l]));
        const typesMap = new Map(spotTypes.map(t => [t.id, t]));

        let results: any[] = [];
        for (const listing of activeListings) {
          const spot = spotsMap.get(listing.spotId);
          if (!spot || !spot.isBookable) continue;
          const loc = locsMap.get(spot.locationId);
          const locName = loc ? `${loc.office} - ${loc.building} ${loc.level}` : 'Unknown';
          results.push({
            listingId: listing.id,
            spotId: listing.spotId,
            spotNumber: spot.spotNumber,
            location: locName,
            spotType: typesMap.get(spot.spotTypeId)?.name || 'Unknown',
            listingType: listing.listingType,
            dailyRate: listing.dailyRate,
            singleDate: listing.singleDate,
            periodStartDate: listing.periodStartDate,
            periodEndDate: listing.periodEndDate,
            recurringDays: listing.daysOfWeek,
            recurringStartDate: listing.recurringStartDate,
            recurringEndDate: listing.recurringEndDate,
            donateToCharity: listing.donateToCharity,
          });
        }

        if (location) {
          const lowerLoc = location.toLowerCase();
          results = results.filter(r => r.location.toLowerCase().includes(lowerLoc));
        }
        if (date) {
          results = results.filter(r => {
            if (r.listingType === 'single') return r.singleDate === date;
            if (r.listingType === 'period') return r.periodStartDate <= date && r.periodEndDate >= date;
            if (r.listingType === 'recurring') {
              if (r.recurringStartDate > date || r.recurringEndDate < date) return false;
              const dow = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              return r.recurringDays?.map((d: string) => d.toLowerCase()).includes(dow);
            }
            return true;
          });
        }

        return {
          content: [{ type: "text" as const, text: results.length > 0 ? JSON.stringify(results, null, 2) : "No available spots found." }],
        };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  registerAppResource(
    server,
    "Available Spots Search",
    spotsSearchUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: spotsSearchUri, mimeType: RESOURCE_MIME_TYPE, text: readAppHtml("spots-search.html") }],
    }),
  );

  const myBookingsUri = "ui://parkshare/my-bookings.html";
  registerAppTool(
    server,
    "get_my_bookings",
    {
      title: "Get My Bookings",
      description: "Get all your bookings (past and upcoming).",
      inputSchema: {
        status: z.enum(["confirmed", "completed", "cancelled", "all"]).optional().describe("Filter by status"),
      },
      _meta: { ui: { resourceUri: myBookingsUri } },
    },
    async ({ status }): Promise<any> => {
      try {
        let bookingsList = await storage.getBookingsByUser(user.id);
        const allSpots = await storage.getAllParkingSpots();
        const spotsMap = new Map(allSpots.map(s => [s.id, s]));
        if (status && status !== 'all') bookingsList = bookingsList.filter(b => b.status === status);
        const results = bookingsList.map(b => ({
          bookingId: b.id,
          spotNumber: spotsMap.get(b.spotId)?.spotNumber || 'Unknown',
          bookingDate: formatDate(b.bookingDate),
          status: b.status,
          dailyRate: b.dailyRate,
          totalAmount: b.totalAmount,
          paymentStatus: b.paymentStatus,
          createdAt: b.createdAt,
        }));
        return { content: [{ type: "text" as const, text: results.length > 0 ? JSON.stringify(results, null, 2) : "No bookings found." }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  registerAppResource(
    server,
    "My Bookings",
    myBookingsUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: myBookingsUri, mimeType: RESOURCE_MIME_TYPE, text: readAppHtml("my-bookings.html") }],
    }),
  );

  server.tool(
    "get_booking_details",
    "Get detailed information about a specific booking.",
    { bookingId: z.string().describe("The booking ID") },
    async ({ bookingId }) => {
      try {
        const booking = await storage.getBooking(bookingId);
        if (!booking) return { content: [{ type: "text" as const, text: "Booking not found" }] };
        if (booking.renterId !== user.id && booking.ownerId !== user.id)
          return { content: [{ type: "text" as const, text: "Access denied" }] };
        const spot = await storage.getParkingSpot(booking.spotId);
        const locName = spot ? await getLocationName(spot.locationId) : 'Unknown';
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            bookingId: booking.id, spotNumber: spot?.spotNumber || 'Unknown', location: locName,
            bookingDate: formatDate(booking.bookingDate), status: booking.status,
            dailyRate: booking.dailyRate, totalAmount: booking.totalAmount,
            paymentStatus: booking.paymentStatus, notes: booking.notes, createdAt: booking.createdAt,
          }, null, 2) }],
        };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "cancel_booking",
    "Cancel one of your confirmed bookings.",
    { bookingId: z.string().describe("The booking ID to cancel") },
    async ({ bookingId }) => {
      try {
        const booking = await storage.getBooking(bookingId);
        if (!booking) return { content: [{ type: "text" as const, text: "Booking not found" }] };
        if (booking.renterId !== user.id) return { content: [{ type: "text" as const, text: "You can only cancel your own bookings" }] };
        if (booking.status !== 'confirmed') return { content: [{ type: "text" as const, text: `Cannot cancel: status is ${booking.status}` }] };

        const cfg = await storage.getAppConfig('cancellation_window_hours');
        const windowHours = cfg ? parseInt(cfg.value) : 24;
        const hoursUntil = (new Date(booking.bookingDate).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < windowHours)
          return { content: [{ type: "text" as const, text: `Cannot cancel: within ${windowHours}-hour cancellation window.` }] };

        await storage.updateBooking(bookingId, { status: 'cancelled' });
        if (booking.listingId) await storage.updateSpotListing(booking.listingId, { status: 'available' });
        return { content: [{ type: "text" as const, text: `Booking ${bookingId} cancelled successfully.` }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_my_listings",
    "Get your spot listings.",
    { status: z.enum(["available", "booked", "cancelled", "used", "unused", "all"]).optional().describe("Filter by status") },
    async ({ status }) => {
      try {
        let listings = await storage.getSpotListingsByOwner(user.id);
        const allSpots = await storage.getAllParkingSpots();
        const spotsMap = new Map(allSpots.map(s => [s.id, s]));
        if (status && status !== 'all') listings = listings.filter(l => l.status === status);
        const results = listings.map(l => ({
          listingId: l.id, spotNumber: spotsMap.get(l.spotId)?.spotNumber || 'Unknown',
          listingType: l.listingType, status: l.status, dailyRate: l.dailyRate,
          singleDate: l.singleDate, periodStartDate: l.periodStartDate, periodEndDate: l.periodEndDate,
          recurringDays: l.daysOfWeek, donateToCharity: l.donateToCharity, createdAt: l.createdAt,
        }));
        return { content: [{ type: "text" as const, text: results.length > 0 ? JSON.stringify(results, null, 2) : "No listings found." }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "cancel_listing",
    "Cancel one of your active spot listings.",
    { listingId: z.string().describe("The listing ID to cancel") },
    async ({ listingId }) => {
      try {
        const listing = await storage.getSpotListing(listingId);
        if (!listing) return { content: [{ type: "text" as const, text: "Listing not found" }] };
        if (listing.ownerId !== user.id) return { content: [{ type: "text" as const, text: "You can only cancel your own listings" }] };
        if (listing.status !== 'available') return { content: [{ type: "text" as const, text: `Cannot cancel: status is ${listing.status}` }] };
        await storage.updateSpotListing(listingId, { status: 'cancelled' });
        return { content: [{ type: "text" as const, text: `Listing ${listingId} cancelled.` }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_my_spots",
    "Get your assigned parking spots.",
    {},
    async () => {
      try {
        const spots = await storage.getParkingSpotsByOwner(user.id);
        const results = await Promise.all(spots.map(async s => ({
          spotId: s.id, spotNumber: s.spotNumber,
          location: await getLocationName(s.locationId),
          spotType: await getSpotTypeName(s.spotTypeId),
          isBookable: s.isBookable, defaultPrice: s.defaultPrice,
        })));
        return { content: [{ type: "text" as const, text: results.length > 0 ? JSON.stringify(results, null, 2) : "No assigned spots." }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_my_notifications",
    "Get your recent in-app notifications.",
    { includeRead: z.boolean().optional().describe("Include read notifications (default: false)") },
    async ({ includeRead }) => {
      try {
        const notifs = await storage.getInAppNotifications(user.id, includeRead ?? false);
        const unreadCount = await storage.getUnreadNotificationCount(user.id);
        const results = notifs.slice(0, 20).map(n => ({
          id: n.id, title: n.title, message: n.message, type: n.type, isRead: n.read, createdAt: n.createdAt,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ unreadCount, notifications: results }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "mark_notification_read",
    "Mark a notification or all notifications as read.",
    { notificationId: z.string().optional().describe("Notification ID, or omit to mark all as read") },
    async ({ notificationId }) => {
      try {
        if (notificationId) {
          await storage.markNotificationAsRead(notificationId);
          return { content: [{ type: "text" as const, text: `Notification ${notificationId} marked as read.` }] };
        }
        await storage.markAllNotificationsAsRead(user.id);
        return { content: [{ type: "text" as const, text: "All notifications marked as read." }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_my_vehicles",
    "Get your registered vehicles.",
    {},
    async () => {
      try {
        const vs = await storage.getVehiclesByUser(user.id);
        return {
          content: [{ type: "text" as const, text: vs.length > 0
            ? JSON.stringify(vs.map(v => ({ id: v.id, make: v.make, model: v.model, year: v.year, color: v.color, isElectric: v.isElectric, isDefault: v.isDefault })), null, 2)
            : "No registered vehicles." }],
        };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  const parkingStatsUri = "ui://parkshare/parking-stats.html";
  registerAppTool(
    server,
    "get_renter_stats",
    {
      title: "Get Renter Stats",
      description: "Get your parking statistics as a renter.",
      inputSchema: {},
      _meta: { ui: { resourceUri: parkingStatsUri } },
    },
    async (): Promise<any> => {
      try {
        const bks = await storage.getBookingsByUser(user.id);
        const allSpots = await storage.getAllParkingSpots();
        const locs = await storage.getLocations();
        const spotsMap = new Map(allSpots.map(s => [s.id, s]));
        const locsMap = new Map(locs.map(l => [l.id, l]));
        const todayStr = new Date().toISOString().split('T')[0];
        const active = bks.filter(b => b.status === 'confirmed' && formatDate(b.bookingDate) >= todayStr);
        const completed = bks.filter(b => b.status === 'completed');
        const cancelled = bks.filter(b => b.status === 'cancelled');
        const spending = bks.filter(b => b.status !== 'cancelled').reduce((s, b) => s + parseFloat(b.totalAmount || '0'), 0);
        const locCounts: Record<string, number> = {};
        bks.filter(b => b.status !== 'cancelled').forEach(b => {
          const sp = spotsMap.get(b.spotId);
          if (sp) { const lc = locsMap.get(sp.locationId); const nm = lc ? `${lc.office} - ${lc.building}` : '?'; locCounts[nm] = (locCounts[nm] || 0) + 1; }
        });
        const favLoc = Object.entries(locCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
        return { content: [{ type: "text" as const, text: JSON.stringify({
          activeBookings: active.length, completedBookings: completed.length, cancelledBookings: cancelled.length,
          totalBookings: bks.length, totalSpending: `$${spending.toFixed(2)}`, favoriteLocation: favLoc,
        }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  registerAppResource(
    server,
    "Parking Stats",
    parkingStatsUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: parkingStatsUri, mimeType: RESOURCE_MIME_TYPE, text: readAppHtml("parking-stats.html") }],
    }),
  );

  server.tool(
    "get_owner_stats",
    "Get your statistics as a spot owner.",
    {},
    async () => {
      try {
        const listings = await storage.getSpotListingsByOwner(user.id);
        const bks = await storage.getBookingsByOwner(user.id);
        const rev = bks.filter(b => b.status !== 'cancelled').reduce((s, b) => s + parseFloat(b.totalAmount || '0'), 0);
        return { content: [{ type: "text" as const, text: JSON.stringify({
          totalListings: listings.length,
          activeListings: listings.filter(l => l.status === 'available').length,
          bookedListings: listings.filter(l => l.status === 'booked').length,
          totalBookingsReceived: bks.length,
          confirmedBookings: bks.filter(b => b.status === 'confirmed').length,
          completedBookings: bks.filter(b => b.status === 'completed').length,
          totalRevenue: `$${rev.toFixed(2)}`,
        }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_waiting_list_status",
    "Check your waiting list status.",
    {},
    async () => {
      try {
        const entry = await storage.getWaitingListByUser(user.id);
        if (!entry) return { content: [{ type: "text" as const, text: "You are not on the waiting list." }] };
        return { content: [{ type: "text" as const, text: JSON.stringify({
          status: entry.status, priority: entry.priority,
          preferredLocationId: entry.preferredLocationId, preferredSpotTypeId: entry.preferredSpotTypeId,
          reason: entry.reason, enrolledDate: entry.enrolledDate,
        }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_my_profile",
    "Get your profile information.",
    {},
    async () => {
      try {
        const depts = await storage.getDepartments();
        const dept = user.departmentId ? depts.find(d => d.id === user.departmentId) : null;
        return { content: [{ type: "text" as const, text: JSON.stringify({
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email, phone: user.phone, department: dept?.name || 'Not assigned',
          roles: user.roles, memberSince: user.memberSince,
        }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "get_locations",
    "Get all available parking locations.",
    {},
    async () => {
      try {
        const locs = await storage.getLocations();
        return { content: [{ type: "text" as const, text: JSON.stringify(locs.map(l => ({
          id: l.id, office: l.office, building: l.building, level: l.level, address: l.address,
        })), null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      }
    }
  );

  return server;
}

const mcpTransports = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

export function registerMcpRoutes(app: Express) {
  app.use("/mcp", cors());

  app.get("/mcp/sse", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "API key required. Use Authorization: Bearer <your-api-key>" });
      return;
    }

    const apiKey = authHeader.substring(7);
    const authenticatedUser = await authenticateApiKey(apiKey);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    const server = createMcpServerForUser(authenticatedUser);
    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;

    mcpTransports.set(sessionId, { transport, server });

    res.on("close", () => {
      mcpTransports.delete(sessionId);
    });

    await server.connect(transport);
  });

  app.post("/mcp/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const entry = mcpTransports.get(sessionId);
    if (!entry) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await entry.transport.handlePostMessage(req, res);
  });

  app.all("/mcp/stream", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "API key required" });
      return;
    }
    const apiKey = authHeader.substring(7);
    const authenticatedUser = await authenticateApiKey(apiKey);
    if (!authenticatedUser) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }
    const server = createMcpServerForUser(authenticatedUser);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[MCP] Streamable HTTP error:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  app.get("/mcp/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "BCI ParkShare MCP",
      version: "1.0.0",
      transport: ["SSE", "Streamable HTTP"],
      activeSessions: mcpTransports.size,
      mcpApps: ["spots-search", "my-bookings", "parking-stats"],
      tools: [
        "search_available_spots", "get_my_bookings", "get_booking_details", "cancel_booking",
        "get_my_listings", "cancel_listing", "get_my_spots", "get_my_notifications",
        "mark_notification_read", "get_my_vehicles", "get_renter_stats", "get_owner_stats",
        "get_waiting_list_status", "get_my_profile", "get_locations",
      ],
      authentication: "Bearer token (API key) in Authorization header",
      endpoints: { sse: "/mcp/sse", messages: "/mcp/messages", stream: "/mcp/stream", health: "/mcp/health" },
    });
  });

  console.log("[MCP] Routes registered on main server under /mcp/*");
  console.log("[MCP] SSE endpoint: /mcp/sse");
  console.log("[MCP] Streamable HTTP endpoint: /mcp/stream");
  console.log("[MCP] Health check: /mcp/health");
}
