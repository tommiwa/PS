import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import type { Express } from "express";
import cors from "cors";
import { createHash } from "crypto";
import { storage } from "./storage";
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

async function authenticateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await storage.getApiKeyByHash(keyHash);
  if (!keyRecord) return false;
  storage.updateApiKeyLastUsed(keyRecord.id).catch(() => {});
  return true;
}

function createMcpServer(): McpServer {
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
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const isAuthenticated = await authenticateApiKey(apiKey);
      if (!isAuthenticated) {
        res.status(401).json({ error: "Invalid or revoked API key" });
        return;
      }
    }

    const server = createMcpServer();
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
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const isAuthenticated = await authenticateApiKey(apiKey);
      if (!isAuthenticated) {
        res.status(401).json({ error: "Invalid or revoked API key" });
        return;
      }
    }

    if (req.method === 'POST' && !req.headers['x-requested-with']) {
      req.headers['x-requested-with'] = 'mcp-client';
    }

    const server = createMcpServer();
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
      mcpApps: ["spots-search"],
      tools: ["search_available_spots", "get_locations"],
      authentication: "Optional - Bearer token (API key) in Authorization header. Works without auth for read-only tools.",
      endpoints: { sse: "/mcp/sse", messages: "/mcp/messages", stream: "/mcp/stream", health: "/mcp/health" },
    });
  });

  console.log("[MCP] Routes registered on main server under /mcp/*");
  console.log("[MCP] SSE endpoint: /mcp/sse");
  console.log("[MCP] Streamable HTTP endpoint: /mcp/stream");
  console.log("[MCP] Health check: /mcp/health");
}
