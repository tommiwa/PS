import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import type { Express } from "express";
import cors from "cors";
import { createHash, randomUUID } from "crypto";
import { storage } from "./storage";
import fs from "node:fs";
import path from "node:path";

const MCP_APPS_DIR = path.join(process.cwd(), "mcp-apps", "dist");

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

function requireAuth(req: any): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return Promise.resolve(false);
  return authenticateApiKey(authHeader.substring(7));
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

const sseTransports = new Map<string, { transport: SSEServerTransport; server: McpServer }>();
const streamableSessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer; lastUsed: number }>();

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  const toDelete: string[] = [];
  streamableSessions.forEach((entry, id) => {
    if (now - entry.lastUsed > SESSION_TIMEOUT_MS) {
      entry.transport.close().catch(() => {});
      entry.server.close().catch(() => {});
      toDelete.push(id);
    }
  });
  toDelete.forEach(id => streamableSessions.delete(id));
}, 60 * 1000);

export function registerMcpRoutes(app: Express) {
  app.use("/mcp", cors());

  app.post("/mcp", async (req, res) => {
    const isValid = await requireAuth(req);
    if (!isValid) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && streamableSessions.has(sessionId)) {
      const entry = streamableSessions.get(sessionId)!;
      entry.lastUsed = Date.now();
      try {
        await entry.transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("[MCP] Streamable HTTP session error:", error);
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
        }
      }
      return;
    }

    if (sessionId && !streamableSessions.has(sessionId)) {
      res.status(404).json({ jsonrpc: "2.0", error: { code: -32000, message: "Session not found. Please reinitialize." }, id: null });
      return;
    }

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await server.connect(transport);

    transport.onclose = () => {
      const sid = (transport as any).sessionId;
      if (sid) streamableSessions.delete(sid);
      server.close().catch(() => {});
    };

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[MCP] Streamable HTTP init error:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
      return;
    }

    const newSessionId = (transport as any).sessionId;
    if (newSessionId) {
      streamableSessions.set(newSessionId, { transport, server, lastUsed: Date.now() });
    }
  });

  app.get("/mcp", async (req, res) => {
    const accept = req.headers.accept || '';
    if (!accept.includes('text/event-stream')) {
      res.status(405).json({ error: "Method not allowed. Use POST for MCP messages." });
      return;
    }

    const isValid = await requireAuth(req);
    if (!isValid) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && streamableSessions.has(sessionId)) {
      const entry = streamableSessions.get(sessionId)!;
      entry.lastUsed = Date.now();
      try {
        await entry.transport.handleRequest(req, res);
      } catch (error) {
        console.error("[MCP] GET SSE stream error:", error);
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
      return;
    }

    res.status(405).json({ error: "No active session. Send an initialize request via POST first." });
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && streamableSessions.has(sessionId)) {
      const entry = streamableSessions.get(sessionId)!;
      await entry.transport.close().catch(() => {});
      await entry.server.close().catch(() => {});
      streamableSessions.delete(sessionId);
      res.status(200).end();
      return;
    }
    res.status(404).json({ error: "Session not found" });
  });

  app.get("/mcp/sse", async (req, res) => {
    const isValid = await requireAuth(req);
    if (!isValid) {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }

    const server = createMcpServer();
    const transport = new SSEServerTransport("/mcp/messages", res);
    const sessionId = transport.sessionId;

    sseTransports.set(sessionId, { transport, server });

    res.on("close", () => {
      sseTransports.delete(sessionId);
    });

    await server.connect(transport);
  });

  app.post("/mcp/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const entry = sseTransports.get(sessionId);
    if (!entry) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await entry.transport.handlePostMessage(req, res);
  });

  app.get("/mcp/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "BCI ParkShare MCP",
      version: "1.0.0",
      transport: ["Streamable HTTP", "SSE (legacy)"],
      activeSessions: streamableSessions.size + sseTransports.size,
      mcpApps: ["spots-search"],
      tools: ["search_available_spots", "get_locations"],
      authentication: "Required - Bearer token (API key) in Authorization header.",
      endpoints: {
        streamableHttp: "/mcp (POST, GET, DELETE)",
        sse: "/mcp/sse (legacy)",
        messages: "/mcp/messages (legacy, for SSE transport)",
        health: "/mcp/health",
      },
    });
  });

  console.log("[MCP] Routes registered on main server under /mcp/*");
  console.log("[MCP] Streamable HTTP endpoint: /mcp (POST/GET/DELETE)");
  console.log("[MCP] SSE endpoint (legacy): /mcp/sse");
  console.log("[MCP] Health check: /mcp/health");
}
