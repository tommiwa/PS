import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import { db } from "./db";
import { users, parkingSpots, termsVersions, type User } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Extend Express Session to include viewAsRole
declare module 'express-session' {
  interface SessionData {
    viewAsRole?: string;
  }
}

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
      secure: true,
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
  const userId = claims["sub"];
  const userEmail = claims["email"];
  
  // Check if user exists in database by ID OR email to preserve their roles
  console.log(`[UPSERT] Checking database for existing user: ${userId} (${userEmail})`);
  const existingDbUser = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
  
  // Also check by email in case admin pre-created this user with a different ID
  let existingEmailUser = null;
  if (!existingDbUser && userEmail) {
    existingEmailUser = await db.select().from(users).where(eq(users.email, userEmail)).then(rows => rows[0]);
    if (existingEmailUser) {
      console.log(`[UPSERT] Found user by email with different ID: ${existingEmailUser.id} → ${userId}`);
    }
  }
  
  // Use email-matched user if found, otherwise use ID-matched user
  const matchedUser = existingDbUser || existingEmailUser;
  console.log(`[UPSERT] Existing user:`, matchedUser ? `Found with roles: ${JSON.stringify(matchedUser.roles)}` : 'Not found');
  
  // Determine if this should be an admin user based on specific user IDs and emails
  const isAdmin = claims["sub"] === "user-admin-001" || 
                  claims["email"] === "david.thomps@replit.com" ||
                  claims["email"] === "d.thompson@bci.ca" ||
                  claims["email"] === "lijin.joseji@bci.ca";
  console.log(`[UPSERT] Is hardcoded admin: ${isAdmin}`);
  
  // Determine final roles: preserve existing roles (including manually assigned admin)
  let finalRoles = matchedUser?.roles || ["renter"];
  if (isAdmin && !finalRoles.includes("admin")) {
    finalRoles = [...finalRoles.filter(r => r !== "renter"), "admin"];
  }
  
  // Check if user owns any parking spots
  const userSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, userId));
  const hasSpots = userSpots.length > 0;
  console.log(`[UPSERT] User has ${userSpots.length} parking spots`);
  
  // Update roles based on spots
  if (hasSpots && !finalRoles.includes("owner")) {
    finalRoles = [...finalRoles.filter(r => r !== "renter"), "owner"];
  } else if (!hasSpots && !isAdmin && finalRoles.includes("owner")) {
    // Optionally remove owner role if they no longer have spots (only if not admin)
    // For now, keep the owner role for historical reasons
  }
  console.log(`[UPSERT] Final roles after spot check: ${JSON.stringify(finalRoles)}`);
  
  // Prepare user data with roles included
  const userData = {
    id: userId,
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  };
  
  const now = new Date();
  
  // Handle user migration: if found by email with different ID, migrate to OIDC ID
  if (existingEmailUser && !existingDbUser) {
    console.log(`[UPSERT] Migrating user from ${existingEmailUser.id} to ${userId}`);
    
    // Delete the old user record (admin-created with random UUID)
    await db.delete(users).where(eq(users.id, existingEmailUser.id));
    
    // Create new user with OIDC ID, preserving roles and other data
    await db.insert(users).values({
      id: userId,
      email: userData.email,
      firstName: userData.firstName || existingEmailUser.firstName,
      lastName: userData.lastName || existingEmailUser.lastName,
      profileImageUrl: userData.profileImageUrl,
      phone: existingEmailUser.phone,
      departmentId: existingEmailUser.departmentId,
      memberSince: existingEmailUser.memberSince,
      roles: finalRoles,
      lastLogin: now,
      createdAt: existingEmailUser.createdAt, // Preserve original creation date
      updatedAt: now,
    });
    
    // Remove old user from in-memory storage
    await storage.deleteUser(existingEmailUser.id);
  } else if (existingDbUser) {
    // Update existing user in database
    await db.update(users)
      .set({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        roles: finalRoles,
        lastLogin: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  } else {
    // Insert new user into database
    await db.insert(users).values({
      id: userId,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      roles: finalRoles,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  
  // Update in-memory storage with complete user data including roles (single atomic operation)
  await storage.upsertUser({
    ...userData,
    roles: finalRoles,
  } as any);
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

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  
  // Add dev domain for development
  if (process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN) {
    domains.push(process.env.REPLIT_DEV_DOMAIN);
  }
  
  for (const domain of domains) {
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

  // Helper to get the correct domain for the current request
  const getDomainForRequest = (req: any) => {
    // In development, use REPLIT_DEV_DOMAIN
    if (process.env.NODE_ENV !== "production" && process.env.REPLIT_DEV_DOMAIN) {
      return process.env.REPLIT_DEV_DOMAIN;
    }
    // In production, use the request hostname
    return req.hostname;
  };

  app.get("/api/login", (req, res, next) => {
    // Check if user accepted terms (passed as query param from frontend)
    // Store in session for callback to use
    if (req.query.acceptTerms === 'true') {
      // Generate a secure random nonce
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      // Store both flag and nonce in session
      (req.session as any).termsAcceptanceNonce = nonce;
      (req.session as any).pendingTermsAcceptance = true;
      
      console.log('[TERMS] Setting pendingTermsAcceptance in session:', req.sessionID);
      
      // Save session before redirecting to OIDC
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Failed to save session before OIDC:", saveErr);
        } else {
          console.log('[TERMS] Session saved successfully before OIDC redirect');
        }
        
        // Continue with authentication even if save fails
        proceedWithAuth();
      });
      
      return; // Wait for session save
    }
    
    // If no terms acceptance, proceed immediately
    proceedWithAuth();
    
    function proceedWithAuth() {
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
      
      const domain = getDomainForRequest(req);
      passport.authenticate(`replitauth:${domain}`, {
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    }
  });

  app.get("/api/callback", (req, res, next) => {
    const domain = getDomainForRequest(req);
    passport.authenticate(`replitauth:${domain}`, async (err: any, user: any, info: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        console.error("No user returned from authentication");
        return res.redirect("/api/login");
      }
      
      // Log the user in
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          
          // Log failed authentication
          auditService.auditAuth(
            "LOGIN",
            "unknown",
            "unknown",
            false,
            `Login failed: ${loginErr.message}`
          ).catch(error => {
            console.error("Failed to log authentication failure:", error);
          });
          
          return res.redirect("/api/login");
        }
        
        // Get user ID from claims
        const userId = user.claims?.sub;
        const userEmail = user.claims?.email;
        
        if (!userId) {
          console.error("No user ID in claims");
          return res.redirect("/api/login");
        }
        
        try {
          // Fetch user from PostgreSQL database directly to get their roles
          // This ensures we check the database first before falling back to in-memory storage
          console.log(`[AUTH] Querying database for user ${userId}`);
          let dbUser: User | undefined = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
          console.log(`[AUTH] Database query result:`, dbUser ? `User found with roles: ${JSON.stringify(dbUser.roles)}` : 'User not found in database');
          
          // If not found in database, check in-memory storage
          if (!dbUser) {
            console.log(`[AUTH] Falling back to in-memory storage for user ${userId}`);
            dbUser = await storage.getUser(userId);
            console.log(`[AUTH] In-memory storage result:`, dbUser ? `User found with roles: ${JSON.stringify(dbUser.roles)}` : 'User not found in storage');
          }
          
          if (!dbUser) {
            console.error("User not found in database or storage after authentication");
            
            // Log failed authentication
            auditService.auditAuth(
              "LOGIN",
              userId,
              userEmail || "unknown",
              false,
              "User not found in database after authentication"
            ).catch(error => {
              console.error("Failed to log authentication failure:", error);
            });
            
            return res.redirect("/api/login");
          }
          
          // Check if user is suspended or deleted
          if (dbUser.status === "suspended" || dbUser.status === "deleted") {
            console.error(`Login blocked: User ${userId} has status '${dbUser.status}'`);
            
            // Log failed authentication due to status
            auditService.auditAuth(
              "LOGIN",
              userId,
              userEmail || "unknown",
              false,
              `Login blocked: User account is ${dbUser.status}`
            ).catch(error => {
              console.error("Failed to log authentication failure:", error);
            });
            
            // Logout user first (clears req.user)
            req.logout((logoutErr) => {
              if (logoutErr) {
                console.error("Logout error during status check:", logoutErr);
              }
              
              // Destroy the session completely and redirect only after completion
              req.session.destroy((destroyErr) => {
                if (destroyErr) {
                  console.error("Session destruction error:", destroyErr);
                }
                
                // Clear the cookie
                res.clearCookie('connect.sid');
                
                // Redirect to login with error message in query parameter (only after session is fully destroyed)
                return res.redirect(`/login?error=${dbUser.status === "suspended" ? "account_suspended" : "account_deleted"}`);
              });
            });
            
            return; // Prevent execution from continuing
          }
          
          // Log successful authentication
          auditService.auditAuth(
            "LOGIN",
            userId,
            userEmail || "unknown",
            true,
            `User logged in successfully with roles: ${JSON.stringify(dbUser.roles)}`
          ).catch(error => {
            console.error("Failed to log authentication success:", error);
          });
          
          // Check if user accepted terms during login
          console.log('[TERMS] Checking for pendingTermsAcceptance in callback session:', req.sessionID);
          console.log('[TERMS] pendingTermsAcceptance value:', (req.session as any).pendingTermsAcceptance);
          
          if ((req.session as any).pendingTermsAcceptance) {
            console.log('[TERMS] Found pendingTermsAcceptance flag, auto-accepting terms for user:', userId);
            try {
              // Get latest terms version
              const latestTerms = await db
                .select()
                .from(termsVersions)
                .where(eq(termsVersions.isActive, true))
                .orderBy(desc(termsVersions.version))
                .limit(1)
                .then(rows => rows[0]);
              
              if (latestTerms) {
                // Auto-accept terms for the user
                await db
                  .update(users)
                  .set({
                    acceptedTermsVersion: latestTerms.version,
                    acceptedTermsAt: new Date(),
                  })
                  .where(eq(users.id, userId));
                
                console.log(`[TERMS] Auto-accepted terms version ${latestTerms.version} for user ${userId}`);
              } else {
                console.log('[TERMS] No active terms found in database');
              }
            } catch (termsError) {
              console.error("[TERMS] Error auto-accepting terms:", termsError);
              // Continue with login even if terms acceptance fails
            }
            
            // Clear the flag from session
            delete (req.session as any).pendingTermsAcceptance;
            delete (req.session as any).termsAcceptanceNonce;
            console.log('[TERMS] Cleared pendingTermsAcceptance from session');
          } else {
            console.log('[TERMS] No pendingTermsAcceptance flag found in callback session');
          }
          
          // Redirect based on user roles
          let redirectUrl = "/search"; // Default redirect for renters
          
          if (dbUser.roles.includes("admin")) {
            redirectUrl = "/admin";
          } else if (dbUser.roles.includes("owner")) {
            redirectUrl = "/my-spots";
          } else if (dbUser.roles.includes("renter")) {
            redirectUrl = "/search";
          }
          
          console.log(`Redirecting user ${userId} (${JSON.stringify(dbUser.roles)}) to ${redirectUrl}`);
          return res.redirect(redirectUrl);
          
        } catch (error) {
          console.error("Error fetching user role:", error);
          
          // Log failed authentication
          auditService.auditAuth(
            "LOGIN",
            userId,
            userEmail || "unknown",
            false,
            `Error fetching user role: ${error instanceof Error ? error.message : String(error)}`
          ).catch(logError => {
            console.error("Failed to log authentication failure:", logError);
          });
          
          // Default to search on error (default renter page)
          return res.redirect("/search");
        }
      });
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
    
    // Clear view-as role before destroying session
    if (req.session?.viewAsRole) {
      delete req.session.viewAsRole;
    }
    
    // Clear the session
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
      }
      
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
      
      // Clear the cookie
      res.clearCookie('connect.sid');
      
      // Redirect to login page
      console.log(`User ${actorId} (${actorEmail}) logged out successfully`);
      res.redirect('/');
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
      if (demoUser && demoUser.roles?.includes("admin")) {
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
    // Use BASE role to check admin privileges, not impersonated role
    // This ensures admins can still access admin endpoints even when using "view as"
    const baseRole = await getAuthenticatedUserBaseRole(req);
    
    if (baseRole !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (error) {
    console.error("Error in requireAdmin middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper to get authenticated user ID from request
export function getAuthenticatedUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

// Helper to get authenticated user roles
export async function getAuthenticatedUserRole(req: any): Promise<string | null> {
  // Check for view-as override in session (for admin impersonation)
  if (req.session?.viewAsRole) {
    return req.session.viewAsRole;
  }
  
  const userId = getAuthenticatedUserId(req);
  if (!userId) return null;
  
  try {
    const user = await storage.getUser(userId);
    // Return the primary role (first one in the array) for backward compatibility
    return user?.roles?.[0] || null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

// Helper to get authenticated user's BASE role (ignores viewAsRole)
// This is used for privilege checks to ensure admins maintain their permissions even when impersonating
export async function getAuthenticatedUserBaseRole(req: any): Promise<string | null> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return null;
  
  try {
    const user = await storage.getUser(userId);
    // If user has admin role anywhere in their roles array, return 'admin'
    // Otherwise return the primary role (first one in the array) for backward compatibility
    if (user?.roles?.includes('admin')) {
      return 'admin';
    }
    return user?.roles?.[0] || null;
  } catch (error) {
    console.error("Error getting user base role:", error);
    return null;
  }
}