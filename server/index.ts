import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { auditService } from "./audit-service";
import { dbAuditStorage as auditStorage } from "./audit-storage";
import { initTimezone } from "./timezone";
import { db } from "./db";
import { spotLocks, spotListings, bookings, parkingSpots, refreshTokens } from "@shared/schema";
import { and, eq, lt, lte, inArray, notInArray, sql, isNull, or } from "drizzle-orm";
import { setupWebSocket, broadcastLockEvent } from "./websocket";
import { runMigrations } from "./migrations";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Block HEAD requests to /api early to prevent spam
app.use((req, res, next) => {
  if (req.method === "HEAD" && req.path === "/api") {
    console.log(`[BLOCKED] HEAD /api request from ${req.ip} - User-Agent: ${req.get('User-Agent') || 'unknown'}`);
    return res.status(200).end();
  }
  next();
});

// Note: Audit middleware will be installed AFTER authentication setup
// to ensure req.user is available for proper actor attribution

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await runMigrations();

  // Initialize audit service with database-backed storage
  auditService.setStorage(auditStorage);
  
  // Initialize timezone utilities with storage
  const { storage } = await import("./storage");
  initTimezone(storage);
  
  // Seed departments if table is empty
  const seedDepartments = async () => {
    try {
      const existingDepartments = await storage.getDepartments();
      
      if (existingDepartments.length === 0) {
        const departmentNames = [
          "Legal Affairs",
          "Finance",
          "Infrastructure & Renewable Resources",
          "Human Resources",
          "Corporate Data & Operations",
          "Office of the CEO/CIO",
          "Office of the COO",
          "Capital Markets & Credit Investments",
          "Investment Strategy & Risk",
          "Investment Operations",
          "Technology",
          "Private Equity"
        ];
        
        for (const name of departmentNames) {
          await storage.createDepartment(name);
        }
        
        log(`Seeded ${departmentNames.length} departments`);
      }
    } catch (error) {
      console.error("Error seeding departments:", error);
    }
  };
  
  // Seed departments on startup
  await seedDepartments();
  
  // Seed initial terms and conditions if not present
  const seedTermsAndConditions = async () => {
    try {
      const { storage } = await import("./storage");
      const activeTerms = await storage.getActiveTermsVersion();
      
      const initialTermsContent = `# BCI ParkShare

## Terms and Conditions

**Effective Date: June 2, 2026**

These Terms and Conditions ("Terms") govern your use of BCI's ParkShare application (the "App"). In these Terms, "we," "us," and "our" refer to BCI. "You" and "your" refer to the User accessing or using the App. By accessing or using the App, you agree to be bound by these Terms.

Please read the ParkShare Privacy Notice, which describes how we collect and use personal information.

---

## Definitions

- "App" means BCI's ParkShare application.
- "BCI" means British Columbia Investment Management Corporation.
- "Tenant" means a User who lists their parking stall through the App.
- "Subtenant" means a User who books a parking stall through the App.
- "Sublease Agreement" means the agreement between a Tenant and BCI governing the terms and conditions under which the Tenant is permitted to sublease their parking stall.
- "User" means any BCI personnel who access or use the App, whether as a Tenant or Subtenant.

---

## Access and Use

Subject to and conditioned on your compliance with these Terms, BCI grants you the right to access and use the App solely for the purpose of listing or booking parking stalls as contemplated herein.

For Tenants, use of the App is also subject to the terms of your Sublease Agreement. In the event of any conflict between these Terms and your Sublease Agreement, your Sublease Agreement shall prevail. Nothing in these Terms modifies, amends, or supersedes any obligation or right under your Sublease Agreement.

---

## Listing Parking Stalls

Tenants may list their parking stall for temporary use by other BCI personnel through the App, subject to the following conditions:

- The Tenant may only list the parking stall assigned to them under their Sublease Agreement.
- The Tenant may not list their parking stall to the same Subtenant for more than six (6) consecutive months.
- The Tenant remains fully responsible for all obligations under their Sublease Agreement, including any damage or non-compliance caused by Subtenants.

BCI may list parking stalls owned or managed by BCI through the App. Such listings are not subject to sections 3.1 or 4, and BCI is not considered a Tenant for purposes of these Terms.

---

## Pricing Restrictions

The price charged for a parking stall listing must not exceed the pro-rated amount that the Tenant pays for the stall under their Sublease Agreement.

---

## Booking and Cancellations

Subtenants may book available parking stalls through the App subject to availability. Bookings are made on a daily basis and may cover one or more consecutive days. Each booked day entitles the Subtenant to use the parking stall until 11:59 p.m. on that day.

Both Tenants and Subtenants must provide a minimum of twenty-four (24) hours' notice for any cancellation.

BCI reserves the right to cancel any booking at its sole discretion.

---

## Payment

BCI does not process or guarantee any payments between Users. All payment arrangements between Tenants and Subtenants are made outside the App and are the sole responsibility of the parties involved.

Users must settle all payments within thirty (30) days of the booking date. Users may not make bookings through the App until all outstanding payments are settled.

Users are responsible for resolving any payment disputes directly with one another.

---

## User Conduct and Record-Keeping

Users are responsible for maintaining their own records of all bookings, cancellations, and payments made through or in connection with the App.

---

## Unauthorized Use of Parking Stalls and Wage Assignment

For purposes of these Terms, a User's use, occupation of, parking in, or accessing of any service or amenity associated with any parking stall, including an electric vehicle charger, without an active booking through the App for that parking stall constitutes unauthorized use. Unauthorized use includes use, occupation, parking, or access to any service or amenity associated with a parking stall even if the User has a parking lease for a different parking stall, uses the parking stall or associated service or amenity only briefly, or was unaware that a booking through the App was required.

By accessing or using the App and accepting these Terms, each User authorizes BCI to deduct from the User's wages an amount equal to one day's cost of leasing the applicable parking stall for each day on which the User engages in unauthorized use of that parking stall or any service or amenity associated with that parking stall, including an electric vehicle charger. This authorization constitutes an assignment of wages by the User to BCI in respect of such unauthorized use.

The charge described in section 8.2 is a daily flat rate for the applicable parking stall and will not be prorated based on the duration or nature of the unauthorized use, including where the unauthorized use occurs for only part of a day or involves accessing an electric vehicle charger without otherwise parking in the stall. This amount is intended to reflect the daily leasing cost of the applicable parking stall and is not a disciplinary or administrative penalty.

BCI is not required to provide a warning or notice of unauthorized use before applying the charge described in section 8.2. However, as an administrative practice, BCI may issue a warning in respect of unauthorized use. Any such warning is provided at BCI's discretion and does not limit BCI's right to apply the charge for the same or any subsequent instance of unauthorized use.

---

## Liability and Indemnification

BCI provides the App on an "as is" basis and makes no warranties, express or implied, regarding its availability, accuracy, or fitness for any particular purpose.

BCI is not responsible or liable for any injury, death, property damage, theft, disappearance, or any other loss occurring in, on, or about the parking facility in connection with use of the App.

Users are responsible for, and shall reimburse BCI for, any claims, damages, or liabilities arising from their use of the App or any parking stall booked or listed through the App, including any damage to property owned, leased, or managed by BCI.

The Tenant acknowledges that BCI may seek recovery from the Tenant for any claims, damages, or liabilities arising from the use of their parking stall listed through the App, including where caused by a Subtenant. To the extent such claims, damages, or liabilities are caused by a Subtenant, the Subtenant shall indemnify, defend, and hold harmless the Tenant against the same.

Any disputes between Tenants and Subtenants regarding damage or liability are solely between those parties, and BCI has no obligation to mediate, investigate, or resolve such disputes.

---

## Suspension and Termination

BCI may suspend or terminate a User's access to the App at any time, with or without cause, including for:

- violation of these Terms;
- violation of the User's Sublease Agreement;
- misuse of the App;
- unauthorized use; or
- any conduct that BCI determines, in its sole discretion, is detrimental to other Users or BCI.

Any conduct described in section 10.1 may result in disciplinary action by BCI and may be escalated internally, including to BCI's Chief Operating Officer or their designate. Any disciplinary action taken by BCI is separate from any charge or wage assignment described in section 8.

Termination of a User's Sublease Agreement will terminate their access to the App as a Tenant.

---

## Amendments

BCI may amend these Terms at any time by posting updated Terms through the App. Continued use of the App following any amendment constitutes acceptance of the amended Terms.

---

## General Provisions

These Terms are governed by the laws of British Columbia and the federal laws of Canada applicable therein.

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

BCI's failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.

---

## Contact

Questions regarding these Terms or the App should be directed to workplaceservices@bci.ca.

---

**By using the App, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.**

---

# ParkShare Privacy Notice

**Last Updated: June 2, 2026**

This Privacy Notice explains how we collect, use, disclose and protect your personal information when you use BCI's ParkShare application (the "App"). In this Privacy Notice, "we," "us," and "our" refer to BCI. "You" and "your" refer to the individual using the App.

By using the App, you acknowledge and agree to the collection, use, and disclosure of your personal information as described in this ParkShare Privacy Notice and in BCI's Privacy Notice - Canada. All personal information will be collected, used and disclosed in accordance with the Freedom of Information and Protection of Privacy Act (British Columbia) ("FIPPA").

BCI collects the following personal information through the App:

- identification information, including your name, work email, department, and vehicle details such as make and colour
- booking and listing information, including dates, times, parking stall numbers, and the identity of other users involved in each transaction
- cancellation records, including dates, times, and whether cancellations were made within the required notice period
- payment dispute information, including complaints received or made and their resolution status
- App usage information, including login timestamps and activity logs

For clarity, if you make a payment via Interac, the individual whose stall you have booked may see your Interac email ID, but this information is not collected or visible to BCI.

BCI collects this personal information for the following purposes:

- to administer and operate the App, including facilitating bookings between users
- to investigate and enforce breaches of these Terms
- to improve the App and related services
- for any other purpose specified in BCI's Privacy Notice \u2013 Canada

BCI will use and disclose your personal information only for the purposes described in this ParkShare Privacy Notice, for purposes consistent with those purposes, or as otherwise permitted or required under FIPPA. Your personal information may be disclosed to other users to the extent necessary to facilitate bookings (for example, when you book a stall, the individual whose stall you have booked will see your name).

If you have questions about the collection of your personal information through the App, please refer to BCI's Privacy Notice \u2013 Canada or contact BCI's Privacy Officer at privacy@bci.ca.`;

      if (!activeTerms) {
        await storage.createTermsVersion({
          version: 1,
          content: initialTermsContent,
          isActive: true,
          publishedAt: new Date()
        });
        
        log("Seeded initial Terms and Conditions (Version 1.0)");
      } else {
        const { createHash } = await import("crypto");
        const currentHash = createHash("sha256").update(activeTerms.content.trim()).digest("hex").substring(0, 16);
        const targetHash = createHash("sha256").update(initialTermsContent.trim()).digest("hex").substring(0, 16);
        const { termsVersions } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        if (currentHash !== targetHash) {
          const newVersion = activeTerms.version + 1;
          await db.update(termsVersions)
            .set({ 
              content: initialTermsContent,
              version: newVersion,
              publishedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(termsVersions.id, activeTerms.id));
          log(`Migrated Terms and Conditions to v${newVersion} (content hash ${currentHash} -> ${targetHash})`);
        } else if (!activeTerms.publishedAt) {
          await db.update(termsVersions)
            .set({ publishedAt: new Date(), updatedAt: new Date() })
            .where(eq(termsVersions.id, activeTerms.id));
          log(`Backfilled missing publishedAt on Terms v${activeTerms.version}`);
        }
      }
    } catch (error) {
      console.error("Error seeding terms and conditions:", error);
    }
  };
  
  // Seed terms and conditions on startup
  await seedTermsAndConditions();
  
  // Seed default app configs so they are available to all authenticated users
  // (not just admins who have visited the admin settings page)
  const seedDefaultAppConfigs = async () => {
    try {
      const defaultConfigs = [
        {
          key: 'lock_timeout_ms',
          value: '30000',
          label: 'Lock Timeout',
          dataType: 'number',
          category: 'booking',
          description: 'Duration in seconds for how long a booking lock is held before it automatically expires. Users must complete their booking within this time.'
        },
        {
          key: 'max_daily_rate',
          value: '18',
          label: 'Maximum Daily Rate',
          dataType: 'number',
          category: 'booking',
          description: 'Maximum allowed daily rate for parking spot listings. Owners and admins cannot set rates higher than this amount.'
        },
        {
          key: 'timezone',
          value: 'America/Los_Angeles',
          label: 'Application Timezone',
          dataType: 'string',
          category: 'system',
          description: 'The timezone used for displaying and calculating all dates and times in the application (e.g., America/Los_Angeles for PST/PDT)'
        },
        {
          key: 'cancellation_window_hours',
          value: '24',
          label: 'Cancellation Window',
          dataType: 'number',
          category: 'booking',
          description: 'Minimum hours before the booking date that cancellation is allowed. Users cannot cancel bookings within this time window.'
        },
        {
          key: 'city_parking_daily_rate',
          value: '15',
          label: 'City Parking Daily Rate',
          dataType: 'number',
          category: 'Pricing',
          description: 'Daily rate (CAD) for city/municipal parking used to compare renter spending against equivalent city parking cost. Renters can toggle this comparison on their Statistics page.'
        },
        {
          key: 'new_badge_days',
          value: '30',
          label: 'New Badge Duration (days)',
          dataType: 'number',
          category: 'system',
          description: 'Number of days a "New!" badge appears on newly introduced features before automatically disappearing.'
        },
        {
          key: 'week_start_day',
          value: 'sunday',
          label: 'Week Start Day',
          dataType: 'string',
          category: 'system',
          description: 'The first day of the week used for the "This Week" date filter. "sunday" means the week runs Sunday to Saturday (end = Saturday). "monday" means the week runs Monday to Sunday (end = Sunday).'
        },
        {
          key: 'expired_date_window_enabled',
          value: 'true',
          label: 'Expired Date Window',
          dataType: 'boolean',
          category: 'system',
          description: 'When enabled, limits how many past unbooked dates appear on the calendar for long-running listings. When disabled, all past unbooked dates are shown.'
        },
        {
          key: 'expired_date_window_days',
          value: '7',
          label: 'Expired Date Window (Days)',
          dataType: 'number',
          category: 'system',
          description: 'Number of past days to show as expired/unbooked on the calendar. Only applies when Expired Date Window is enabled. Minimum: 1.'
        },
        {
          key: 'milestone_start_date',
          value: '2026-03-16',
          label: 'Milestone Start Date',
          dataType: 'string',
          category: 'notifications',
          description: 'The date from which cumulative spend is counted for milestone email notifications (YYYY-MM-DD format). Emails fire when spend since this date crosses each interval threshold.'
        },
        {
          key: 'milestone_interval',
          value: '10000',
          label: 'Milestone Interval ($)',
          dataType: 'number',
          category: 'notifications',
          description: 'Dollar amount interval between milestone email notifications (e.g., 10000 sends emails at $10,000, $20,000, $30,000, ...). Set to 0 to disable milestone emails.'
        },
        {
          key: 'milestone_notifications_enabled',
          value: process.env.NODE_ENV === 'production' ? 'true' : 'false',
          label: 'Milestone Notifications Enabled',
          dataType: 'boolean',
          category: 'notifications',
          description: 'When enabled, spend milestone emails are sent to Workplace Services and admins. Defaults to disabled in non-production environments to prevent accidental emails during development or QA.'
        }
      ];

      const existingConfigs = await storage.getAllAppConfigs();
      const existingKeys = new Set(existingConfigs.map((c: any) => c.key));
      const missingConfigs = defaultConfigs.filter(d => !existingKeys.has(d.key));

      if (missingConfigs.length > 0) {
        for (const config of missingConfigs) {
          try {
            await storage.createAppConfig(config);
          } catch (createError) {
            console.error(`[AppConfigs Seed] Failed to create config ${config.key}:`, createError);
          }
        }
        log(`Seeded ${missingConfigs.length} missing default app config(s)`);
      }
    } catch (error) {
      console.error("[AppConfigs Seed] Error seeding default app configs:", error);
    }
  };
  await seedDefaultAppConfigs();
  
  // Background cleanup job for expired locks
  async function cleanupExpiredLocks() {
    try {
      const now = new Date();
      
      // Update all locks where expiresAt < now AND status = 'active'
      const expiredLocks = await db
        .update(spotLocks)
        .set({ status: 'expired' })
        .where(and(
          eq(spotLocks.status, 'active'),
          lt(spotLocks.expiresAt, now)
        ))
        .returning();
      
      if (expiredLocks.length > 0) {
        console.log(`[Lock Cleanup] Expired ${expiredLocks.length} lock(s)`);
        
        // Broadcast lock.expired event for each expired lock
        expiredLocks.forEach(lock => {
          broadcastLockEvent('lock.expired', {
            lockId: lock.id,
            spotId: lock.spotId,
            listingId: lock.listingId
          });
        });
      }
      
      return expiredLocks;
    } catch (error) {
      console.error("[Lock Cleanup] Error cleaning up expired locks:", error);
      return [];
    }
  }
  
  // Run cleanup once on startup to clean any locks that expired while server was down
  log("Running initial lock cleanup...");
  await cleanupExpiredLocks();
  
  // Set up interval to run cleanup every 30 seconds
  setInterval(cleanupExpiredLocks, 30000);
  log("Lock cleanup job scheduled (runs every 30 seconds)");

  // Background cleanup job for old audit logs (1 year retention policy)
  async function cleanupOldAuditLogs() {
    try {
      const RETENTION_DAYS = 365; // 1 year retention
      const deletedCount = await auditStorage.cleanupOldLogs(RETENTION_DAYS);
      
      if (deletedCount > 0) {
        console.log(`[Audit Cleanup] Deleted ${deletedCount} audit log(s) older than ${RETENTION_DAYS} days`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error("[Audit Cleanup] Error cleaning up old audit logs:", error);
      return 0;
    }
  }
  
  // Run audit cleanup once on startup
  log("Running initial audit log cleanup...");
  await cleanupOldAuditLogs();
  
  // Set up interval to run audit cleanup every 24 hours (86400000 ms)
  setInterval(cleanupOldAuditLogs, 86400000);
  log("Audit log cleanup job scheduled (runs daily, 1-year retention)");

  // Background cleanup job for expired (past unbooked) listings
  // Marks single-date listings that are past and not booked as "unused"
  async function markExpiredListingsAsUnused() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Get all single-date listings that are past their date and still "available"
      const expiredSingleListings = await db
        .update(spotListings)
        .set({ status: 'unused' })
        .where(and(
          eq(spotListings.listingType, 'single'),
          eq(spotListings.status, 'available'),
          lt(spotListings.singleDate, todayStr)
        ))
        .returning();
      
      // Get period listings that have ended and are still "available"
      const expiredPeriodListings = await db
        .update(spotListings)
        .set({ status: 'unused' })
        .where(and(
          eq(spotListings.listingType, 'period'),
          eq(spotListings.status, 'available'),
          lt(spotListings.periodEndDate, todayStr)
        ))
        .returning();
      
      // Get recurring listings that have ended and are still "available"
      const expiredRecurringListings = await db
        .update(spotListings)
        .set({ status: 'unused' })
        .where(and(
          eq(spotListings.listingType, 'recurring'),
          eq(spotListings.status, 'available'),
          lt(spotListings.recurringEndDate, todayStr)
        ))
        .returning();
      
      const totalExpired = expiredSingleListings.length + expiredPeriodListings.length + expiredRecurringListings.length;
      
      if (totalExpired > 0) {
        console.log(`[Listing Expiration] Marked ${totalExpired} listing(s) as unused (${expiredSingleListings.length} single, ${expiredPeriodListings.length} period, ${expiredRecurringListings.length} recurring)`);
      }
      
      return totalExpired;
    } catch (error) {
      console.error("[Listing Expiration] Error marking expired listings:", error);
      return 0;
    }
  }
  
  // Run listing expiration cleanup once on startup
  log("Running initial listing expiration cleanup...");
  await markExpiredListingsAsUnused();
  
  // Set up interval to run listing expiration every hour (3600000 ms)
  setInterval(markExpiredListingsAsUnused, 3600000);
  log("Listing expiration job scheduled (runs hourly)");
  
  // Background job to auto-complete BCI-managed bookings when booking date passes
  // BCI bookings use payroll deduction, so they auto-complete without manual payment confirmation
  async function autoCompleteBciBookings() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Find all confirmed BCI-managed bookings where the booking date has passed
      const bciBookingsToComplete = await db
        .select({
          booking: bookings,
          spot: parkingSpots
        })
        .from(bookings)
        .innerJoin(parkingSpots, eq(bookings.spotId, parkingSpots.id))
        .where(and(
          eq(bookings.status, 'confirmed'),
          eq(parkingSpots.isBciManaged, true),
          isNull(parkingSpots.ownerId), // Only pure WPS pool spots (no owner assigned)
          lt(bookings.bookingDate, todayStr) // Booking date is in the past
        ));
      
      if (bciBookingsToComplete.length > 0) {
        // Update each BCI booking to completed with payment received
        for (const { booking, spot } of bciBookingsToComplete) {
          await db
            .update(bookings)
            .set({
              status: 'completed',
              paymentStatus: 'received',
              paymentReceived: true,
              updatedAt: new Date()
            })
            .where(eq(bookings.id, booking.id));
          
          // Also update the listing to "used" if it exists
          if (booking.listingId) {
            await db
              .update(spotListings)
              .set({ status: 'used' })
              .where(eq(spotListings.id, booking.listingId));
          }
          
          // Create audit log for system auto-completion
          await auditStorage.createAuditLog({
            correlationId: `auto-complete-${booking.id}`,
            action: 'COMPLETE',
            entityType: 'booking',
            entityId: booking.id,
            actorId: 'SYSTEM',
            actorEmail: 'system@bci.ca',
            actorRole: 'system',
            success: true,
            message: `Booking for spot ${spot.spotNumber} on ${booking.bookingDate} automatically completed (System Action - booking date passed)`,
            before: { status: 'confirmed', paymentStatus: booking.paymentStatus },
            after: { status: 'completed', paymentStatus: 'received' },
            requestMeta: {
              method: 'SYSTEM',
              path: '/system/auto-complete',
              ip: '127.0.0.1'
            }
          });
        }
        
        console.log(`[BCI Auto-Complete] Marked ${bciBookingsToComplete.length} BCI booking(s) as completed`);
      }
      
      return bciBookingsToComplete.length;
    } catch (error) {
      console.error("[BCI Auto-Complete] Error auto-completing BCI bookings:", error);
      return 0;
    }
  }
  
  // Run BCI auto-complete once on startup
  log("Running initial BCI booking auto-complete...");
  await autoCompleteBciBookings();
  
  // Set up interval to run BCI auto-complete every hour (3600000 ms)
  setInterval(autoCompleteBciBookings, 3600000);
  log("BCI booking auto-complete job scheduled (runs hourly)");
  
  // Background cleanup job for expired sessions
  async function cleanupExpiredSessions() {
    try {
      const result = await db.execute(
        sql`DELETE FROM sessions WHERE expire < NOW()`
      );
      const deletedCount = (result as any).rowCount || 0;
      if (deletedCount > 0) {
        console.log(`[Session Cleanup] Removed ${deletedCount} expired session(s)`);
      }
    } catch (error) {
      console.error("[Session Cleanup] Error cleaning up expired sessions:", error);
    }
  }

  // Run session cleanup once on startup
  log("Running initial session cleanup...");
  await cleanupExpiredSessions();

  // Set up interval to run session cleanup every 6 hours (21600000 ms)
  setInterval(cleanupExpiredSessions, 21600000);
  log("Session cleanup job scheduled (runs every 6 hours)");

  // Refresh token cleanup (runs daily)
  const cleanupExpiredRefreshTokens = async () => {
    try {
      const result = await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
      log("Refresh token cleanup completed");
    } catch (error) {
      console.error("[Refresh Token Cleanup] Error:", error);
    }
  };
  await cleanupExpiredRefreshTokens();
  setInterval(cleanupExpiredRefreshTokens, 24 * 60 * 60 * 1000);
  log("Refresh token cleanup job scheduled (runs daily)");

  // Background job to apply scheduled spot assignments
  async function applyScheduledSpotAssignments() {
    try {
      const dueAssignments = await storage.getPendingScheduledAssignmentsDue();
      
      if (dueAssignments.length === 0) return 0;
      
      console.log(`[Scheduled Assignments] Found ${dueAssignments.length} due assignment(s) to apply`);
      
      let appliedCount = 0;
      
      for (const assignment of dueAssignments) {
        try {
          const spot = await storage.getParkingSpot(assignment.spotId);
          const user = await storage.getUser(assignment.userId);
          
          if (!spot || !user) {
            console.error(`[Scheduled Assignments] Spot or user not found for assignment ${assignment.id}, skipping`);
            continue;
          }
          
          // Validate department restriction before applying
          if (spot.spotTypeId && spot.reservedForDepartmentId) {
            const spotType = await storage.getSpotType(spot.spotTypeId);
            const isDepartmentReserved = spotType?.name === 'Department Reserved' || spotType?.slug === 'department-reserved';
            if (isDepartmentReserved && user.departmentId !== spot.reservedForDepartmentId) {
              console.error(`[Scheduled Assignments] Department restriction: user ${user.email} not in required department for spot ${spot.spotNumber}, cancelling assignment ${assignment.id}`);
              await storage.updateScheduledAssignment(assignment.id, { status: 'cancelled' });
              continue;
            }
          }
          
          // Check if user has an active waiting list entry and mark it as assigned
          const waitingListEntry = await storage.getWaitingListByUser(assignment.userId);
          if (waitingListEntry) {
            await storage.updateWaitingListEntry(waitingListEntry.id, {
              status: 'assigned',
              assignedDate: new Date(),
              assignedSpotId: assignment.spotId
            });
          }
          
          // Cancel bookings from scheduledDate onwards if cancelFutureBookings was set
          if (assignment.cancelFutureBookings) {
            try {
              const allBookings = await storage.getBookingsBySpot(assignment.spotId);
              const cutoffDate = new Date(assignment.scheduledDate + 'T00:00:00');
              cutoffDate.setHours(0, 0, 0, 0);
              
              const futureBookings = allBookings.filter(booking => {
                const bookingDate = new Date(booking.bookingDate);
                bookingDate.setHours(0, 0, 0, 0);
                return bookingDate >= cutoffDate && booking.status !== 'cancelled';
              });
              
              if (futureBookings.length > 0) {
                const location = await storage.getLocation(spot.locationId);
                const locationName = location ? `${location.office} - ${location.level}` : 'Unknown Location';
                const buildingName = location?.building || 'Unknown Building';
                
                const bookingsByRenter = new Map<string, typeof futureBookings>();
                
                for (const booking of futureBookings) {
                  await storage.updateBooking(booking.id, {
                    status: 'cancelled',
                    adminNotes: `Automatically cancelled due to scheduled spot assignment effective ${assignment.scheduledDate}`
                  });
                  
                  const renterBookings = bookingsByRenter.get(booking.renterId) || [];
                  renterBookings.push(booking);
                  bookingsByRenter.set(booking.renterId, renterBookings);
                }
                
                const { sendBookingsCancelledDueToUnassignmentNotification } = await import('./notification-service');
                
                for (const [renterId, renterBookings] of Array.from(bookingsByRenter.entries())) {
                  const renter = await storage.getUser(renterId);
                  if (renter) {
                    const renterName = `${renter.firstName || ''} ${renter.lastName || ''}`.trim() || 'User';
                    const cancelledBookingDetails = renterBookings.map((b: typeof renterBookings[0]) => ({
                      bookingDate: b.bookingDate,
                      spotNumber: spot.spotNumber,
                      location: locationName,
                      building: buildingName
                    }));
                    
                    const renterPrefs = await storage.getNotificationPreferences(renter.id);
                    await sendBookingsCancelledDueToUnassignmentNotification(
                      { name: renterName, email: renter.email || null, id: renter.id },
                      cancelledBookingDetails,
                      'Spot has been assigned to a new owner',
                      renterPrefs || {}
                    );
                  }
                }
                
                console.log(`[Scheduled Assignments] Cancelled ${futureBookings.length} bookings for spot ${spot.spotNumber}`);
              }
            } catch (cancelError) {
              console.error(`[Scheduled Assignments] Error cancelling bookings for assignment ${assignment.id}:`, cancelError);
            }
          }
          
          // Update spot ownership (preserve existing isBciManaged like immediate assign does)
          const updateData = {
            ownerId: assignment.userId,
            isBookable: false,
            isBciManaged: spot.isBciManaged ?? false
          };
          
          const updatedSpot = await storage.updateParkingSpot(assignment.spotId, updateData);
          
          if (!updatedSpot) {
            console.error(`[Scheduled Assignments] Failed to update spot ${assignment.spotId}`);
            continue;
          }
          
          // Record spot assignment history
          await storage.recordSpotAssignment({
            spotId: assignment.spotId,
            userId: assignment.userId,
            action: 'assigned',
            effectiveAt: new Date(),
            actorId: assignment.actorId || undefined,
            notes: `Applied scheduled assignment (scheduled for ${assignment.scheduledDate})`
          });
          
          // Add owner role if needed
          if (user && !user.roles.includes("owner")) {
            await storage.addUserRole(assignment.userId, "owner");
          }
          
          // Send spot assignment email
          try {
            if (user?.email) {
              const { createSpotAssignmentNotification, sendEmailNotification } = await import('./notification-service');
              const location = await storage.getLocation(updatedSpot.locationId);
              const locationName = location ? `${location.office} - ${location.level}` : 'Unknown';
              const buildingName = location?.building || 'Unknown';
              
              const notification = createSpotAssignmentNotification(
                { name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, email: user.email },
                { spotNumber: updatedSpot.spotNumber, location: locationName, building: buildingName }
              );
              await sendEmailNotification(notification);
              console.log(`[Scheduled Assignments] Assignment email sent to ${user.email}`);
            }
          } catch (emailError) {
            console.error(`[Scheduled Assignments] Failed to send email for assignment ${assignment.id}:`, emailError);
          }
          
          // Mark as applied
          await storage.updateScheduledAssignment(assignment.id, { status: 'applied' });
          
          // Audit
          await auditStorage.createAuditLog({
            correlationId: `scheduled-assign-${assignment.id}`,
            action: 'ASSIGN',
            entityType: 'parking_spot',
            entityId: assignment.spotId,
            actorId: 'SYSTEM',
            actorEmail: 'system@bci.ca',
            actorRole: 'system',
            success: true,
            message: `Applied scheduled assignment: spot ${spot.spotNumber} assigned to ${user.firstName} ${user.lastName} (${user.email}) - originally scheduled for ${assignment.scheduledDate}`,
            before: spot,
            after: updatedSpot,
            requestMeta: {
              method: 'SYSTEM',
              path: '/system/scheduled-assignment',
              ip: '127.0.0.1'
            }
          });
          
          appliedCount++;
          console.log(`[Scheduled Assignments] Applied assignment ${assignment.id}: spot ${spot.spotNumber} -> ${user.email}`);
        } catch (assignError) {
          console.error(`[Scheduled Assignments] Error applying assignment ${assignment.id}:`, assignError);
        }
      }
      
      if (appliedCount > 0) {
        console.log(`[Scheduled Assignments] Successfully applied ${appliedCount}/${dueAssignments.length} scheduled assignment(s)`);
      }
      
      return appliedCount;
    } catch (error) {
      console.error("[Scheduled Assignments] Error in scheduled assignment job:", error);
      return 0;
    }
  }
  
  // Run scheduled assignments check on startup
  log("Running initial scheduled assignment check...");
  await applyScheduledSpotAssignments();
  
  // Schedule via node-cron to run at midnight daily
  const cron = await import('node-cron');
  cron.default.schedule('0 0 * * *', async () => {
    console.log('[Scheduled Assignments] Running midnight scheduled assignment check...');
    await applyScheduledSpotAssignments();
  });
  log("Scheduled assignment job configured (runs at midnight daily + startup)");

  // Data fix: correctly set created_by_admin on single-day listings
  // Only single-day listings split from admin-created parent period/recurring listings should be true
  // Step 1: Reset any incorrectly set flags (from previous broad migration)
  // Step 2: Set created_by_admin=true only for singles matching admin parent by spot_id + date range
  try {
    const resetResult = await db.execute(sql`
      UPDATE spot_listings
      SET created_by_admin = false
      WHERE listing_type = 'single'
        AND created_by_admin = true
        AND NOT EXISTS (
          SELECT 1 FROM spot_listings parent
          WHERE parent.spot_id = spot_listings.spot_id
            AND parent.listing_type IN ('period', 'recurring')
            AND parent.created_by_admin = true
            AND spot_listings.single_date >= COALESCE(parent.period_start_date, parent.recurring_start_date)
            AND spot_listings.single_date <= COALESCE(parent.period_end_date, parent.recurring_end_date)
        )
    `);
    const resetCount = (resetResult as any)?.rowCount || 0;
    if (resetCount > 0) {
      log(`Reset ${resetCount} incorrectly flagged single-day listings back to created_by_admin=false`);
    }

    const fixResult = await db.execute(sql`
      UPDATE spot_listings sl
      SET created_by_admin = true
      WHERE sl.listing_type = 'single'
        AND sl.created_by_admin = false
        AND EXISTS (
          SELECT 1 FROM spot_listings parent
          WHERE parent.spot_id = sl.spot_id
            AND parent.listing_type IN ('period', 'recurring')
            AND parent.created_by_admin = true
            AND sl.single_date >= COALESCE(parent.period_start_date, parent.recurring_start_date)
            AND sl.single_date <= COALESCE(parent.period_end_date, parent.recurring_end_date)
        )
    `);
    const fixCount = (fixResult as any)?.rowCount || 0;
    if (fixCount > 0) {
      log(`Fixed ${fixCount} single-day listings: set created_by_admin=true (matched to admin parent listings)`);
    }
  } catch (fixErr) {
    console.error('Error fixing created_by_admin flag:', fixErr);
  }

  // Register MCP routes on the main Express app (same port)
  const { registerMcpRoutes } = await import("./mcp");
  registerMcpRoutes(app);

  const server = await registerRoutes(app);

  // Setup WebSocket server
  setupWebSocket(server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
