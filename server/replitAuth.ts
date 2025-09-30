import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { auditService } from "./audit-service";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Always upsert the user first
  const userData = {
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  };
  
  await storage.upsertUser(userData);
  
  // Check if this should be an admin user based on specific user IDs and emails
  const isAdmin = claims["sub"] === "user-admin-001" || 
                  claims["email"] === "david.thomps@replit.com" ||
                  claims["email"] === "d.thompson@bci.ca" ||
                  claims["email"] === "lijin.joseji@bci.ca";
                  
  // If this is an admin user, ensure their role is set to admin
  if (isAdmin) {
    const existingUser = await storage.getUser(claims["sub"]);
    if (existingUser && existingUser.role !== "admin") {
      await storage.updateUser(claims["sub"], { role: "admin" });
    }
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Log login attempt
    const loginAttemptTime = Date.now();
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Extract user info if available
      let actorId: string | undefined;
      let actorEmail: string | undefined;
      
      if (req.user && (req.user as any).claims) {
        actorId = (req.user as any).claims.sub;
        actorEmail = (req.user as any).claims.email;
      }
      
      // Log authentication event
      auditService.auditAuth(
        "LOGIN",
        actorId || "unknown",
        actorEmail || "unknown",
        success,
        success ? "Login initiated successfully" : `Login failed with status ${res.statusCode}`
      ).catch(error => {
        console.error("Failed to log login event:", error);
      });
      
      return originalEnd.call(this, chunk, encoding);
    };
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const originalRedirect = res.redirect;
    
    res.redirect = function(...args: any[]) {
      const url = typeof args[0] === 'string' ? args[0] : args[1];
      const success = !url.includes("/api/login");
      
      // Extract user info if available
      let actorId: string | undefined;
      let actorEmail: string | undefined;
      
      if (req.user && (req.user as any).claims) {
        actorId = (req.user as any).claims.sub;
        actorEmail = (req.user as any).claims.email;
      }
      
      // Log authentication callback result
      auditService.auditAuth(
        "LOGIN",
        actorId || "unknown",
        actorEmail || "unknown",
        success,
        success ? "Authentication callback successful" : "Authentication callback failed - redirected to login"
      ).catch(error => {
        console.error("Failed to log authentication callback:", error);
      });
      
      return (originalRedirect as any).apply(this, args);
    } as any;
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    // Extract user info before logout
    let actorId: string | undefined;
    let actorEmail: string | undefined;
    
    if (req.user && (req.user as any).claims) {
      actorId = (req.user as any).claims.sub;
      actorEmail = (req.user as any).claims.email;
    }
    
    req.logout((err) => {
      // Log logout event
      auditService.auditAuth(
        "LOGOUT",
        actorId || "unknown",
        actorEmail || "unknown",
        !err,
        err ? `Logout failed: ${err.message}` : "User logged out successfully"
      ).catch(error => {
        console.error("Failed to log logout event:", error);
      });
      
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  // Check for demo authentication from frontend (only in development)
  const demoAuth = req.headers['x-demo-auth'];
  if (demoAuth && process.env.NODE_ENV !== "production") {
    try {
      const demoUser = JSON.parse(demoAuth as string);
      if (demoUser && demoUser.id) {
        // For demo mode, ensure user exists in database
        await storage.upsertUser({
          id: demoUser.id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          profileImageUrl: demoUser.profileImageUrl || null
        });
        
        // Set demo user on request for other middleware
        req.user = { claims: { sub: demoUser.id } };
        return next();
      }
    } catch (error) {
      console.error("Error parsing demo auth:", error);
    }
  }

  // Fallback to real Replit auth
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Helper middleware to check if user is admin
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  // Check for demo authentication from frontend (only in development)
  const demoAuth = req.headers['x-demo-auth'];
  if (demoAuth && process.env.NODE_ENV !== "production") {
    try {
      const demoUser = JSON.parse(demoAuth as string);
      if (demoUser && demoUser.role === "admin") {
        // For demo mode, create/ensure admin user exists in database
        await storage.upsertUser({
          id: demoUser.id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          profileImageUrl: demoUser.profileImageUrl || null
        });
        
        // Set demo user on request for other middleware
        req.user = { claims: { sub: demoUser.id } };
        return next();
      }
    } catch (error) {
      console.error("Error parsing demo auth:", error);
    }
  }
  
  // Fallback to real Replit auth
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const dbUser = await storage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper to get authenticated user ID from request
export function getAuthenticatedUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

// Helper to get authenticated user role
export async function getAuthenticatedUserRole(req: any): Promise<string | null> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return null;
  
  try {
    const user = await storage.getUser(userId);
    return user?.role || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}