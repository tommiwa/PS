import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const mocks = vi.hoisted(() => ({
  getApiKeyByHash: vi.fn(),
  updateApiKeyLastUsed: vi.fn(),
  transports: [] as any[],
  servers: [] as any[],
}));

vi.mock("./storage", () => ({
  storage: {
    getApiKeyByHash: mocks.getApiKeyByHash,
    updateApiKeyLastUsed: mocks.updateApiKeyLastUsed,
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    tool = vi.fn();
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor() { mocks.servers.push(this); }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => ({
  SSEServerTransport: class {
    sessionId = "legacy-session";
    handlePostMessage = vi.fn().mockResolvedValue(undefined);
    constructor() { mocks.transports.push(this); }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class {
    sessionId = "http-session";
    handleRequest = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor() { mocks.transports.push(this); }
  },
}));

type Handler = (req: any, res: any) => Promise<void>;
let routes: Map<string, Handler>;
let activeKeys: Set<string>;

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

async function call(route: string, authorization?: string, sessionId?: string) {
  const res = response();
  await routes.get(route)!({
    headers: {
      ...(authorization === undefined ? {} : { authorization }),
      ...(sessionId === undefined ? {} : { "mcp-session-id": sessionId }),
      accept: "text/event-stream",
    },
    query: sessionId === undefined ? {} : { sessionId },
    body: {},
  }, res);
  return res;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.transports.length = 0;
  mocks.servers.length = 0;
  routes = new Map();
  activeKeys = new Set(["valid-key"]);
  mocks.getApiKeyByHash.mockImplementation(async (hash: string) => {
    for (const key of activeKeys) {
      if (createHash("sha256").update(key).digest("hex") === hash) {
        return { id: 1 };
      }
    }
    return undefined;
  });
  mocks.updateApiKeyLastUsed.mockResolvedValue(undefined);

  // Avoid leaving the module's session-expiry interval running in the test worker.
  vi.useFakeTimers();
  let registerMcpRoutes;
  try {
    ({ registerMcpRoutes } = await import("./mcp"));
  } finally {
    vi.clearAllTimers();
    vi.useRealTimers();
  }
  const app: any = { use: vi.fn() };
  for (const method of ["get", "post", "delete"]) {
    app[method] = (path: string, handler: Handler) => routes.set(`${method} ${path}`, handler);
  }
  registerMcpRoutes(app as Express);
});

describe.each([
  { start: "get /mcp/sse", follow: "post /mcp/messages", id: "legacy-session", method: "handlePostMessage" },
  { start: "post /mcp", follow: "delete /mcp", id: "http-session", method: "close" },
  { start: "post /mcp", follow: "post /mcp", id: "http-session", method: "handleRequest" },
  { start: "post /mcp", follow: "get /mcp", id: "http-session", method: "handleRequest" },
])("$follow authorization", ({ start, follow, id, method }) => {
  async function startSession() {
    await call(start, "Bearer valid-key");
    const transport = mocks.transports[0];
    transport[method].mockClear();
    return transport;
  }

  it.each([
    ["missing", undefined],
    ["malformed", "Basic valid-key"],
    ["empty", "Bearer "],
    ["invalid", "Bearer unknown-key"],
  ])("rejects %s credentials without using or closing the session", async (_label, header) => {
    const transport = await startSession();
    const res = await call(follow, header, id);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or revoked API key" });
    expect(transport[method]).not.toHaveBeenCalled();
    expect(mocks.servers[0].close).not.toHaveBeenCalled();

    // Rejection must not destroy the legitimate client's session.
    await call(follow, "Bearer valid-key", id);
    expect(transport[method]).toHaveBeenCalledTimes(1);
  });

  it("rechecks the key after creation and rejects it once revoked", async () => {
    const transport = await startSession();
    const lookupsBeforeRevocation = mocks.getApiKeyByHash.mock.calls.length;

    activeKeys.clear();
    const res = await call(follow, "Bearer valid-key", id);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.getApiKeyByHash).toHaveBeenCalledTimes(lookupsBeforeRevocation + 1);
    expect(transport[method]).not.toHaveBeenCalled();
  });

  it("authenticates before disclosing whether a session exists", async () => {
    const res = await call(follow, undefined, "nonexistent-session");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.transports).toHaveLength(0);
  });
});

it.each(["get /mcp/sse", "post /mcp"])("requires a valid key to initialize via %s", async (route) => {
  const res = await call(route, "Bearer unknown-key");
  expect(res.status).toHaveBeenCalledWith(401);
  expect(mocks.transports).toHaveLength(0);
});

it.each(["post /mcp/messages", "delete /mcp"])("preserves authenticated missing-session handling for %s", async (route) => {
  const res = await call(route, "Bearer valid-key", "nonexistent-session");
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: "Session not found" });
});

it("closes and removes a streamable session only after valid authentication", async () => {
  await call("post /mcp", "Bearer valid-key");
  const res = await call("delete /mcp", "Bearer valid-key", "http-session");
  expect(res.status).toHaveBeenCalledWith(200);
  expect(mocks.transports[0].close).toHaveBeenCalledTimes(1);
  expect(mocks.servers[0].close).toHaveBeenCalledTimes(1);
  const retry = await call("delete /mcp", "Bearer valid-key", "http-session");
  expect(retry.status).toHaveBeenCalledWith(404);
});
