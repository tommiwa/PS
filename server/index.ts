import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { auditService } from "./audit-service";
import { dbAuditStorage as auditStorage } from "./audit-storage";
import { initTimezone } from "./timezone";
import { db } from "./db";
import { spotLocks, spotListings, bookings } from "@shared/schema";
import { and, eq, lt, inArray, notInArray, sql, isNull, or } from "drizzle-orm";
import { setupWebSocket, broadcastLockEvent } from "./websocket";

const app = express();
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
      
      if (!activeTerms) {
        const initialTermsContent = `# BCI ParkShare Platform - Terms and Conditions of Use

**Effective Date: October 7, 2025**

These Terms and Conditions ("Terms") govern your use of the BCI ParkShare platform ("Platform"). By accessing or using this Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms.

---

## 1. Platform Description and Purpose

The BCI ParkShare Platform is an internal corporate facility management tool designed to facilitate peer-to-peer parking spot sharing among BCI employees. The Platform serves solely as a connection mechanism between parking spot owners and prospective renters.

**Key Platform Characteristics:**
- **Facilitator Role**: BCI provides the technological infrastructure to enable employee-to-employee parking arrangements
- **Non-Intermediary Status**: BCI does not participate in, manage, or oversee individual parking transactions
- **Employee-Exclusive Access**: Platform usage is restricted to current BCI employees with valid credentials

---

## 2. Financial Transactions and Payment Disclaimer

### 2.1 Direct Payment Arrangements
All financial transactions, including payment terms, methods, amounts, and timing, are established and executed directly between the parking spot owner and the renter. BCI does not:
- Process, facilitate, or hold any payments
- Establish or recommend pricing structures
- Mediate payment disputes or disagreements
- Guarantee payment completion or fulfillment

### 2.2 Financial Liability Limitation
BCI expressly disclaims all liability and responsibility for any financial matters arising from parking spot arrangements, including but not limited to payment defaults, refund disputes, or pricing disagreements.

---

## 3. Parking Spot Availability and Access

### 3.1 Availability Management
Parking spot availability is managed exclusively by individual spot owners. BCI is not responsible for:
- Spot availability accuracy or real-time updates
- Booking cancellations or modifications
- Schedule conflicts or double-bookings
- Availability misrepresentations

### 3.2 Access Control and Coordination
**Current Access Infrastructure:**
- Physical access to parking facilities utilizes existing BCI employee access card systems
- The Platform does not integrate with or control automated access systems
- Users must coordinate physical access arrangements independently
- BCI does not manage, monitor, or guarantee parking facility access through this Platform

---

## 4. Liability Limitations and Risk Acknowledgment

### 4.1 Comprehensive Liability Disclaimer
BCI, its officers, directors, employees, and affiliated entities shall not be held liable for any losses, damages, claims, or expenses arising from Platform use, including but not limited to:
- Vehicle damage, theft, vandalism, or towing
- Personal injury or property damage
- Financial losses or disputes
- Access issues or facility-related incidents
- Data breaches or privacy concerns

### 4.2 User Risk Assumption
By using this Platform, you expressly acknowledge and accept that:
- All parking arrangements are undertaken at your sole risk
- You are responsible for your personal security and property protection
- BCI provides no warranties, guarantees, or assurances regarding Platform outcomes
- You waive any claims against BCI related to parking arrangements facilitated through this Platform

---

## 5. User Responsibilities and Conduct Standards

### 5.1 Spot Owner Obligations
As a parking spot owner, you agree to:
- Maintain accurate and current spot availability information
- Provide clear, complete location and access instructions
- Honor confirmed bookings or provide timely cancellation notice
- Communicate professionally and respond promptly to inquiries
- Comply with all applicable BCI policies and facility regulations

### 5.2 Renter Obligations
As a parking spot renter, you agree to:
- Verify all arrangement details directly with the spot owner
- Use parking facilities respectfully and in accordance with agreed terms
- Leave parking spots in their original condition
- Adhere to all posted regulations and time restrictions
- Report any issues or concerns promptly

### 5.3 Universal User Standards
All Platform users must:
- Provide accurate, current contact and account information
- Engage in professional, courteous communication
- Resolve disputes directly with the other party through good-faith negotiation
- Comply with all BCI corporate policies, facility rules, and applicable laws
- Refrain from fraudulent, abusive, or unauthorized Platform usage

---

## 6. Platform Access and Account Management

### 6.1 Eligibility Requirements
Platform access is restricted to current BCI employees with active employment status and valid corporate credentials.

### 6.2 Account Integrity
Users must:
- Maintain account information accuracy and currency
- Safeguard login credentials and prevent unauthorized access
- Utilize the Platform in good faith and for legitimate purposes only
- Immediately notify BCI of suspected security breaches

### 6.3 Suspension and Termination Rights
BCI reserves the right to suspend or terminate user accounts at its sole discretion, including but not limited to cases involving:
- Terms violations or policy breaches
- Fraudulent or abusive conduct
- Security concerns or unauthorized access
- Employment termination or status changes

---

## 7. Modifications and Platform Continuity

### 7.1 Terms Amendments
BCI reserves the right to modify, update, or revise these Terms at any time without prior notice. Material changes will be communicated through appropriate channels. Continued Platform use following Terms modifications constitutes acceptance of the updated Terms.

### 7.2 Platform Availability
BCI may, at its sole discretion:
- Suspend, discontinue, or terminate the Platform without notice or liability
- Modify Platform features, functionality, or access parameters
- Implement maintenance periods or service interruptions
- Alter operational procedures or technical requirements

---

## 8. Dispute Resolution

All disputes arising from parking arrangements must be resolved directly between the involved parties. BCI:
- Does not mediate, arbitrate, or adjudicate user disputes
- Provides no dispute resolution services or mechanisms
- Bears no responsibility for conflict outcomes or resolutions
- Recommends professional legal counsel for unresolved disputes

---

## 9. Data Privacy and Information Security

User data collection, processing, and protection are governed by BCI's Corporate Privacy Policy and Information Security Standards. By using this Platform, you acknowledge and consent to data handling practices as outlined in applicable corporate policies.

---

## 10. Governing Law and Jurisdiction

These Terms shall be governed by and construed in accordance with applicable federal and state laws. Any legal actions or proceedings arising from these Terms or Platform use shall be subject to the exclusive jurisdiction of courts in BCI's principal place of business.

---

## 11. Severability and Entire Agreement

If any provision of these Terms is found to be unenforceable or invalid, such provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect. These Terms constitute the entire agreement between users and BCI regarding Platform use and supersede all prior agreements or understandings.

---

## 12. Acknowledgment and Acceptance

By using the BCI ParkShare Platform, you acknowledge that:

✓ You have read and understood these Terms in their entirety
✓ You accept all risks associated with peer-to-peer parking arrangements
✓ You agree to resolve all matters directly with other Platform users
✓ You release BCI from all liability related to Platform use and parking arrangements
✓ You commit to conducting all activities in accordance with these Terms and applicable policies
✓ You understand that BCI acts solely as a platform provider without involvement in individual transactions

---

## Contact Information

For technical support, account issues, or Terms-related inquiries, please contact:

**BCI WorkPlace Services**  
Email: workplaceservices@bci.ca  
Phone: (778) 410-7100

---

*Terms Version 1.0 | Last Updated: October 7, 2025 | © 2025 BCI Corporation*`;

        await storage.createTermsVersion({
          version: 1,
          content: initialTermsContent,
          isActive: true,
          publishedAt: new Date()
        });
        
        log("Seeded initial Terms and Conditions (Version 1.0)");
      }
    } catch (error) {
      console.error("Error seeding terms and conditions:", error);
    }
  };
  
  // Seed terms and conditions on startup
  await seedTermsAndConditions();
  
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
