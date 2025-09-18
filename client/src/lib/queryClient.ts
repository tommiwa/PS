import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: { method: string; body?: unknown } = { method: 'GET' },
): Promise<Response> {
  // Add demo authentication header for API requests
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
  };
  
  // Check if user is authenticated with demo auth
  const authUser = localStorage.getItem("bci_parking_user");
  if (authUser) {
    try {
      headers["x-demo-auth"] = authUser;
    } catch (error) {
      console.error("Error adding demo auth header:", error);
    }
  }

  const res = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Robust URL builder for TanStack Query keys
 * Supports:
 * - Variable-length path segments: ["/api/users", id, "roles"] → /api/users/123/roles
 * - Query params as objects: ["/api/users", { page: 1, pageSize: 25 }] → /api/users?page=1&pageSize=25
 * - Query params as strings: ["/api/users", "name=john&age=25"] → /api/users?name=john&age=25
 * - Mixed patterns: ["/api/users", id, { page: 1 }] → /api/users/123?page=1
 */
function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  if (queryKey.length === 0) {
    throw new Error("QueryKey cannot be empty");
  }

  const basePath = String(queryKey[0]);
  
  if (queryKey.length === 1) {
    return basePath;
  }

  const elements = queryKey.slice(1);
  const pathSegments: string[] = [];
  let queryParams: string = "";

  // Process each element after the base path
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    if (element == null) {
      // Skip null/undefined elements
      continue;
    }

    if (typeof element === "object" && !Array.isArray(element)) {
      // It's an object - treat as query parameters
      const searchParams = new URLSearchParams();
      Object.entries(element as Record<string, unknown>).forEach(([key, value]) => {
        if (value != null) {
          searchParams.set(key, String(value));
        }
      });
      queryParams = searchParams.toString();
      break; // Query params should be last
    } else if (typeof element === "string" && (element.includes("=") || element.includes("&"))) {
      // It's a string that looks like query parameters
      queryParams = element;
      break; // Query params should be last
    } else {
      // It's a path segment
      pathSegments.push(String(element));
    }
  }

  // Build the final URL
  let url = basePath;
  if (pathSegments.length > 0) {
    url += "/" + pathSegments.join("/");
  }
  if (queryParams) {
    url += "?" + queryParams;
  }

  return url;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add demo authentication header for queries
    const headers: Record<string, string> = {};
    
    // Check if user is authenticated with demo auth
    const authUser = localStorage.getItem("bci_parking_user");
    if (authUser) {
      try {
        headers["x-demo-auth"] = authUser;
      } catch (error) {
        console.error("Error adding demo auth header:", error);
      }
    }

    // Build URL using the robust URL builder
    const url = buildUrlFromQueryKey(queryKey);

    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
