import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

// These tests load the real service-worker.js source and execute it inside a
// sandboxed ServiceWorkerGlobalScope-like context (self/caches/fetch are all
// mocked). This lets us exercise the actual caching/update/offline logic that
// ships to users without needing a browser, and without touching the SW file
// itself (so there is zero risk of these tests changing production behavior).

const SW_SOURCE_PATH = path.resolve(__dirname, "../../public/service-worker.js");
const SW_SOURCE = fs.readFileSync(SW_SOURCE_PATH, "utf-8");

function mockResponse(body: string, init?: ResponseInit) {
  return new Response(body, { status: 200, ...init });
}

function createMockCaches() {
  const store = new Map<string, Map<string, Response>>();

  function keyFor(reqOrUrl: any): string {
    return typeof reqOrUrl === "string" ? reqOrUrl : reqOrUrl.url;
  }

  const caches = {
    _store: store,
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const cacheMap = store.get(name)!;
      return {
        async addAll(urls: string[]) {
          for (const u of urls) {
            cacheMap.set(u, mockResponse(`precached:${u}`));
          }
        },
        async put(req: any, res: Response) {
          cacheMap.set(keyFor(req), res.clone ? res.clone() : res);
        },
        async match(req: any) {
          return cacheMap.get(keyFor(req));
        },
      };
    },
    async match(req: any) {
      for (const cacheMap of store.values()) {
        const hit = cacheMap.get(keyFor(req));
        if (hit) return hit;
      }
      return undefined;
    },
    async keys() {
      return Array.from(store.keys());
    },
    async delete(name: string) {
      return store.delete(name);
    },
  };
  return caches;
}

interface SandboxHandle {
  sandbox: any;
  listeners: Record<string, Array<(event: any) => any>>;
  caches: ReturnType<typeof createMockCaches>;
  fetchMock: ReturnType<typeof vi.fn>;
  skipWaiting: ReturnType<typeof vi.fn>;
  clientsClaim: ReturnType<typeof vi.fn>;
}

function createSandbox(): SandboxHandle {
  const listeners: Record<string, Array<(event: any) => any>> = {};
  const caches = createMockCaches();
  const fetchMock = vi.fn();
  const skipWaiting = vi.fn();
  const clientsClaim = vi.fn();

  const self: any = {
    addEventListener(type: string, cb: (event: any) => any) {
      (listeners[type] ||= []).push(cb);
    },
    skipWaiting,
    clients: { claim: clientsClaim },
  };

  const sandboxContext = {
    self,
    caches,
    fetch: fetchMock,
    Response,
    URL,
    console,
  };

  const context = vm.createContext(sandboxContext);
  vm.runInContext(SW_SOURCE, context, { filename: "service-worker.js" });

  return { sandbox: sandboxContext, listeners, caches, fetchMock, skipWaiting, clientsClaim };
}

function fireInstall(handle: SandboxHandle) {
  const cbs = handle.listeners["install"] || [];
  const waits: Promise<any>[] = [];
  const event = { waitUntil: (p: Promise<any>) => waits.push(p) };
  cbs.forEach((cb) => cb(event));
  return Promise.all(waits);
}

function fireActivate(handle: SandboxHandle) {
  const cbs = handle.listeners["activate"] || [];
  const waits: Promise<any>[] = [];
  const event = { waitUntil: (p: Promise<any>) => waits.push(p) };
  cbs.forEach((cb) => cb(event));
  return Promise.all(waits);
}

async function fireFetch(handle: SandboxHandle, request: any): Promise<Response> {
  const cbs = handle.listeners["fetch"] || [];
  let responsePromise: Promise<Response> | undefined;
  const event = {
    request,
    respondWith(p: Promise<Response> | Response) {
      responsePromise = Promise.resolve(p);
    },
  };
  cbs.forEach((cb) => cb(event));
  if (!responsePromise) {
    throw new Error("fetch handler did not call respondWith for this request");
  }
  return responsePromise;
}

function fireMessage(handle: SandboxHandle, data: any) {
  const cbs = handle.listeners["message"] || [];
  cbs.forEach((cb) => cb({ data }));
}

function makeRequest(url: string, opts: { mode?: string; destination?: string } = {}) {
  return {
    method: "GET",
    url,
    mode: opts.mode ?? "no-cors",
    destination: opts.destination ?? "",
  };
}

describe("service-worker.js install/activate (deployment freshness)", () => {
  it("precaches the offline fallback page and calls skipWaiting so updates aren't stuck waiting", async () => {
    const handle = createSandbox();
    await fireInstall(handle);

    expect(handle.skipWaiting).toHaveBeenCalled();

    const currentCacheName = Array.from(handle.caches._store.keys())[0];
    expect(currentCacheName).toBeTruthy();
    const cached = await handle.caches._store.get(currentCacheName!)!.get("/offline.html");
    expect(cached).toBeTruthy();
  });

  it("deletes stale caches from a previous deployment and claims clients immediately", async () => {
    const handle = createSandbox();
    await fireInstall(handle);
    const currentCacheName = Array.from(handle.caches._store.keys())[0];

    // Simulate a leftover cache from a previous app version.
    handle.caches._store.set("bci-parkshare-v-old", new Map([["/stale.js", mockResponse("stale")]]));

    await fireActivate(handle);

    expect(handle.caches._store.has("bci-parkshare-v-old")).toBe(false);
    expect(handle.caches._store.has(currentCacheName!)).toBe(true);
    expect(handle.clientsClaim).toHaveBeenCalled();
  });
});

describe("service-worker.js fetch strategies", () => {
  let handle: SandboxHandle;

  beforeEach(async () => {
    handle = createSandbox();
    await fireInstall(handle);
  });

  it("uses cache-first for content-hashed build output under /assets/, so a repeat visit skips the network entirely", async () => {
    const req = makeRequest("https://app.example/assets/index-abc123.js");

    // First visit: cache miss, must hit the network once and populate the cache.
    handle.fetchMock.mockResolvedValueOnce(mockResponse("console.log('build v1')"));
    const first = await fireFetch(handle, req);
    expect(await first.text()).toBe("console.log('build v1')");
    expect(handle.fetchMock).toHaveBeenCalledTimes(1);

    // Second visit: cache hit — must be served straight from cache without
    // touching the network again. Content-hashed filenames make this safe:
    // the URL itself changes whenever the content does.
    const second = await fireFetch(handle, req);
    expect(await second.text()).toBe("console.log('build v1')");
    expect(handle.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cache-first assets fail closed (503) when offline with nothing cached yet, rather than throwing", async () => {
    const req = makeRequest("https://app.example/assets/index-abc123.js");
    handle.fetchMock.mockRejectedValueOnce(new Error("offline"));

    const res = await fireFetch(handle, req);
    expect(res.status).toBe(503);
  });

  it("uses network-first for dev-only unhashed module requests (Vite /src/, /@, /node_modules/) so local edits are never stale", async () => {
    const req = makeRequest("https://app.example/src/main.tsx");
    handle.fetchMock.mockResolvedValueOnce(mockResponse("console.log('latest source')"));

    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe("console.log('latest source')");
    expect(handle.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a cached unhashed asset when the network is unavailable", async () => {
    const req = makeRequest("https://app.example/src/main.tsx");

    // First request succeeds and populates the cache.
    handle.fetchMock.mockResolvedValueOnce(mockResponse("console.log('cached build')"));
    await fireFetch(handle, req);

    // Second request: network is down.
    handle.fetchMock.mockRejectedValueOnce(new Error("network down"));
    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe("console.log('cached build')");
  });

  it("serves the offline fallback page for a navigation when there is no network and no cache", async () => {
    const req = makeRequest("https://app.example/dashboard", { mode: "navigate", destination: "document" });
    handle.fetchMock.mockRejectedValueOnce(new Error("offline"));

    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe("precached:/offline.html");
  });

  it("serves a cached navigation page instead of the offline page when one was previously visited", async () => {
    const req = makeRequest("https://app.example/dashboard", { mode: "navigate", destination: "document" });

    handle.fetchMock.mockResolvedValueOnce(mockResponse("<html>dashboard</html>"));
    await fireFetch(handle, req);

    handle.fetchMock.mockRejectedValueOnce(new Error("offline"));
    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe("<html>dashboard</html>");
  });

  it("uses stale-while-revalidate for images outside /assets/: serves the cached image immediately without waiting on the network", async () => {
    const req = makeRequest("https://app.example/pwa-192.png", { destination: "image" });

    // Prime the cache with a previously-fetched image.
    handle.fetchMock.mockResolvedValueOnce(mockResponse("image-bytes-v1"));
    await fireFetch(handle, req);

    // Network is now slow/never resolves before we need the response back.
    handle.fetchMock.mockImplementationOnce(() => new Promise(() => {}));

    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe("image-bytes-v1");
  });

  it("always hits the network first for API requests and returns a 503 JSON error when offline with nothing cached", async () => {
    const req = makeRequest("https://app.example/api/bookings");
    handle.fetchMock.mockRejectedValueOnce(new Error("offline"));

    const res = await fireFetch(handle, req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Offline");
  });

  it("uses network-first for other unhashed static files (e.g. manifest.json) so stale metadata is never served ahead of a fresh copy", async () => {
    const req = makeRequest("https://app.example/manifest.json");
    handle.fetchMock.mockResolvedValueOnce(mockResponse('{"name":"BCI ParkShare"}'));

    const res = await fireFetch(handle, req);
    expect(await res.text()).toBe('{"name":"BCI ParkShare"}');
    expect(handle.fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("service-worker.js message handling", () => {
  it("skips waiting immediately when told to (used to activate an update without a page reload race)", async () => {
    const handle = createSandbox();
    await fireInstall(handle);
    handle.skipWaiting.mockClear();

    fireMessage(handle, { type: "SKIP_WAITING" });
    expect(handle.skipWaiting).toHaveBeenCalled();
  });

  it("clears every cache when asked to (used by the 'clear session data & restart' recovery action)", async () => {
    const handle = createSandbox();
    await fireInstall(handle);
    expect(handle.caches._store.size).toBeGreaterThan(0);

    fireMessage(handle, { type: "CLEAR_CACHE" });
    // Cache clearing is async inside the handler; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));

    expect(handle.caches._store.size).toBe(0);
  });
});
