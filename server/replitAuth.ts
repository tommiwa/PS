import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";
import { auditService } from "./audit-service";
import { db } from "./db";
import { 
  users, 
  parkingSpots, 
  notificationPreferences,
  inAppNotifications,
  spotLocks,
  bookings,
  waitingList,
  vehicles,
  paymentPreferences,
  spotAssignmentHistory,
  lockerWaitlist,
  lockerAssignmentHistory,
  spotListings,
  issues,
  disputes,
  lockers,
  refreshTokens,
  type User 
} from "@shared/schema";
import { eq, sql, and, gt, lt } from "drizzle-orm";

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

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MAX_REFRESH_TOKENS_PER_USER = 5;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function generateRefreshToken(userId: string, userAgent?: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent: userAgent || null,
  });

  const userTokens = await db
    .select({ id: refreshTokens.id, createdAt: refreshTokens.createdAt })
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, userId))
    .orderBy(refreshTokens.createdAt);

  if (userTokens.length > MAX_REFRESH_TOKENS_PER_USER) {
    const tokensToRemove = userTokens.slice(0, userTokens.length - MAX_REFRESH_TOKENS_PER_USER);
    for (const t of tokensToRemove) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, t.id));
    }
    console.log(`[Auth] Pruned ${tokensToRemove.length} old refresh tokens for user ${userId}`);
  }

  return rawToken;
}

async function validateRefreshToken(rawToken: string): Promise<{ userId: string } | "invalid"> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (rows.length === 0) {
    return "invalid";
  }

  const token = rows[0];

  if (token.expiresAt < now) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, token.id));
    return "invalid";
  }

  return { userId: token.userId };
}

async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

async function cleanupExpiredRefreshTokens(): Promise<void> {
  const now = new Date();
  const result = await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
  console.log(`[Refresh Token Cleanup] Removed expired refresh tokens`);
}

export function getSession() {
  const sessionTtlSeconds = 7 * 24 * 60 * 60; // 7 days in seconds
  const sessionTtlMs = sessionTtlSeconds * 1000; // 7 days in milliseconds (for cookie)
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds, // connect-pg-simple expects seconds
    tableName: "sessions",
  });
  
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    rolling: true, // Reset session expiry on every request (rolling sessions)
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isDevelopment,
      sameSite: 'lax',
      maxAge: sessionTtlMs, // express-session cookie expects milliseconds
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
  // Use case-insensitive comparison to prevent duplicate users with different email cases
  let existingEmailUser = null;
  if (!existingDbUser && userEmail) {
    existingEmailUser = await db.select().from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${userEmail})`)
      .then(rows => rows[0]);
    if (existingEmailUser) {
      console.log(`[UPSERT] Found user by email (case-insensitive) with different ID: ${existingEmailUser.id} → ${userId}`);
    }
  }
  
  // Use email-matched user if found, otherwise use ID-matched user
  const matchedUser = existingDbUser || existingEmailUser;
  console.log(`[UPSERT] Existing user:`, matchedUser ? `Found with roles: ${JSON.stringify(matchedUser.roles)}` : 'Not found');
  
  // Determine if this should be an admin user based on specific user IDs and emails
  const isAdmin = claims["email"]?.toLowerCase() === "lijin.joseji@bci.ca";
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
    
    const oldUserId = existingEmailUser.id;
    
    // Use a transaction for atomic migration
    try {
      await db.transaction(async (tx) => {
        // First, update the old user's email to avoid unique constraint violation
        const tempEmail = `${existingEmailUser.email}-old-${Date.now()}`;
        console.log(`[UPSERT] Changing old user email from ${existingEmailUser.email} to ${tempEmail}`);
        
        await tx.update(users)
          .set({ email: tempEmail })
          .where(eq(users.id, oldUserId));
        
        // Create new user with OIDC ID, preserving roles and other data
        console.log(`[UPSERT] Creating new user with ID ${userId} and email ${userData.email}`);
        await tx.insert(users).values({
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
        
        // Transfer all foreign key references from old user to new user
        console.log(`[UPSERT] Transferring foreign key references from ${oldUserId} to ${userId}`);
        
        // Update parking spots ownership
        await tx.update(parkingSpots)
          .set({ ownerId: userId })
          .where(eq(parkingSpots.ownerId, oldUserId));
        console.log(`[UPSERT] Transferred parking spots ownership`);
        
        // Update spot listings ownership
        await tx.update(spotListings)
          .set({ ownerId: userId })
          .where(eq(spotListings.ownerId, oldUserId));
        console.log(`[UPSERT] Transferred spot listings`);
        
        // Update bookings (as renter)
        await tx.update(bookings)
          .set({ renterId: userId })
          .where(eq(bookings.renterId, oldUserId));
        // Update bookings (as owner)
        await tx.update(bookings)
          .set({ ownerId: userId })
          .where(eq(bookings.ownerId, oldUserId));
        console.log(`[UPSERT] Transferred bookings`);
        
        // Update spot assignment history (both userId and actorId)
        await tx.update(spotAssignmentHistory)
          .set({ userId: userId })
          .where(eq(spotAssignmentHistory.userId, oldUserId));
        await tx.update(spotAssignmentHistory)
          .set({ actorId: userId })
          .where(eq(spotAssignmentHistory.actorId, oldUserId));
        console.log(`[UPSERT] Transferred spot assignment history`);
        
        // Update notification preferences
        await tx.update(notificationPreferences)
          .set({ userId: userId })
          .where(eq(notificationPreferences.userId, oldUserId));
        console.log(`[UPSERT] Transferred notification preferences`);
        
        // Update in-app notifications
        await tx.update(inAppNotifications)
          .set({ userId: userId })
          .where(eq(inAppNotifications.userId, oldUserId));
        console.log(`[UPSERT] Transferred in-app notifications`);
        
        // Update spot locks
        await tx.update(spotLocks)
          .set({ userId: userId })
          .where(eq(spotLocks.userId, oldUserId));
        console.log(`[UPSERT] Transferred spot locks`);
        
        // Update waiting list entries
        await tx.update(waitingList)
          .set({ userId: userId })
          .where(eq(waitingList.userId, oldUserId));
        console.log(`[UPSERT] Transferred waiting list entries`);
        
        // Update vehicles
        await tx.update(vehicles)
          .set({ userId: userId })
          .where(eq(vehicles.userId, oldUserId));
        console.log(`[UPSERT] Transferred vehicles`);
        
        // Update payment preferences
        await tx.update(paymentPreferences)
          .set({ userId: userId })
          .where(eq(paymentPreferences.userId, oldUserId));
        console.log(`[UPSERT] Transferred payment preferences`);
        
        // Update locker waitlist
        await tx.update(lockerWaitlist)
          .set({ userId: userId })
          .where(eq(lockerWaitlist.userId, oldUserId));
        console.log(`[UPSERT] Transferred locker waitlist`);
        
        // Update locker assignment history (both userId and actorId)
        await tx.update(lockerAssignmentHistory)
          .set({ userId: userId })
          .where(eq(lockerAssignmentHistory.userId, oldUserId));
        await tx.update(lockerAssignmentHistory)
          .set({ actorId: userId })
          .where(eq(lockerAssignmentHistory.actorId, oldUserId));
        console.log(`[UPSERT] Transferred locker assignment history`);
        
        // Update issues
        await tx.update(issues)
          .set({ reporterId: userId })
          .where(eq(issues.reporterId, oldUserId));
        console.log(`[UPSERT] Transferred issues`);
        
        // Update disputes (as reporter)
        await tx.update(disputes)
          .set({ reporterId: userId })
          .where(eq(disputes.reporterId, oldUserId));
        // Update disputes (as target user)
        await tx.update(disputes)
          .set({ targetUserId: userId })
          .where(eq(disputes.targetUserId, oldUserId));
        // Update disputes (as resolver)
        await tx.update(disputes)
          .set({ resolvedBy: userId })
          .where(eq(disputes.resolvedBy, oldUserId));
        console.log(`[UPSERT] Transferred disputes`);
        
        // Update lockers (assigned to user)
        await tx.update(lockers)
          .set({ userId: userId })
          .where(eq(lockers.userId, oldUserId));
        console.log(`[UPSERT] Transferred lockers`);
        
        console.log(`[UPSERT] All foreign key references transferred successfully`);
        
        // Now delete the old user record (admin-created with random UUID)
        console.log(`[UPSERT] Deleting old user record ${oldUserId}`);
        await tx.delete(users).where(eq(users.id, oldUserId));
      });
      
      // Remove old user from in-memory storage (outside transaction)
      await storage.deleteUser(oldUserId);
      console.log(`[UPSERT] Migration complete`);
    } catch (transferError) {
      console.error(`[UPSERT] Critical error during user migration:`, transferError);
      // Re-throw the error - do not proceed with partial migration
      throw new Error(`User migration failed: ${transferError instanceof Error ? transferError.message : 'Unknown error'}`);
    }
  } else if (existingDbUser) {
    // Update existing user in database
    // Preserve existing firstName/lastName if OIDC claims are empty
    await db.update(users)
      .set({
        email: userData.email ?? existingDbUser.email,
        firstName: userData.firstName || existingDbUser.firstName,
        lastName: userData.lastName || existingDbUser.lastName,
        profileImageUrl: userData.profileImageUrl ?? existingDbUser.profileImageUrl,
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
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: any) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      let actorId: string | undefined;
      let actorEmail: string | undefined;
      
      if (req.user && (req.user as any).claims) {
        actorId = (req.user as any).claims.sub;
        actorEmail = (req.user as any).claims.email;
      }
      
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
          
          // Issue refresh token for persistent login
          try {
            const rawRefreshToken = await generateRefreshToken(userId, req.headers['user-agent']);
            const isDev = process.env.NODE_ENV !== 'production';
            res.cookie('bci_refresh_token', rawRefreshToken, {
              httpOnly: true,
              secure: !isDev,
              sameSite: 'lax',
              maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
              path: '/',
            });
            console.log(`[Auth] Refresh token issued for user ${userId}`);
          } catch (tokenError) {
            console.error("[Auth] Failed to issue refresh token:", tokenError);
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

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const rawToken = req.cookies?.bci_refresh_token;
      if (!rawToken) {
        return res.status(401).json({ error: "No refresh token" });
      }

      const result = await validateRefreshToken(rawToken);

      if (result === "invalid") {
        res.clearCookie('bci_refresh_token', { path: '/' });
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      const { userId } = result;

      const dbUser = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
      if (!dbUser || dbUser.status === "suspended" || dbUser.status === "deleted") {
        await revokeRefreshToken(rawToken);
        res.clearCookie('bci_refresh_token', { path: '/' });
        return res.status(401).json({ error: "User not found or inactive" });
      }

      await revokeRefreshToken(rawToken);

      const newRawToken = await generateRefreshToken(userId, req.headers['user-agent']);
      const isDev = process.env.NODE_ENV !== 'production';
      res.cookie('bci_refresh_token', newRawToken, {
        httpOnly: true,
        secure: !isDev,
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
      });

      await new Promise<void>((resolve, reject) => {
        const fakeUser = {
          claims: {
            sub: dbUser.id,
            email: dbUser.email,
            first_name: dbUser.firstName,
            last_name: dbUser.lastName,
          },
        };
        req.logIn(fakeUser, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[Auth] Session refreshed for user ${userId} via refresh token`);
      return res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Refresh token error:", error);
      return res.status(500).json({ error: "Failed to refresh session" });
    }
  });

  app.get("/api/logout", (req, res) => {
    // Extract user info before logout
    let actorId: string | undefined;
    let actorEmail: string | undefined;
    
    if (req.user && (req.user as any).claims) {
      actorId = (req.user as any).claims.sub;
      actorEmail = (req.user as any).claims.email;
    }
    
    // Revoke refresh token
    const rawToken = req.cookies?.bci_refresh_token;
    if (rawToken) {
      revokeRefreshToken(rawToken).catch(err => {
        console.error("[Auth] Failed to revoke refresh token on logout:", err);
      });
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
      
      // Clear cookies
      res.clearCookie('connect.sid');
      res.clearCookie('bci_refresh_token', { path: '/' });
      
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
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // If token hasn't expired yet, proceed
  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now <= user.expires_at) {
    return next();
  }

  // Token expired — try to refresh it
  const refreshToken = user.refresh_token;
  if (refreshToken) {
    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      return next();
    } catch (error) {
      console.log(`[Auth] Token refresh failed for user ${user.claims.sub}, using existing session`);
    }
  }

  // Token refresh failed or no refresh token, but user has a valid session with known identity
  // Allow them to continue — the session cookie is still valid
  if (user.claims?.sub) {
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
  return;
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