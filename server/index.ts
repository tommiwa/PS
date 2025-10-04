import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { auditService } from "./audit-service";
import { auditStorage } from "./audit-storage";

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
  // Initialize audit service with storage
  auditService.setStorage(auditStorage);
  
  // Add some sample booking activity audit logs for testing (development only)
  // Only seed if not already done to prevent repeated seeding on server restarts
  if (app.get("env") === "development" && !auditStorage.hasBeenSeeded()) {
    await auditService.logAction("CREATE", "booking", {
      entityId: "booking-test-1",
      message: "Test booking created for spot 101 by John Doe",
      success: true
    });
    
    await auditService.logAction("CREATE", "spot_listing", {
      entityId: "listing-test-1", 
      message: "Parking spot listing created for spot 102",
      success: true
    });
    
    await auditService.logAction("UPDATE", "booking", {
      entityId: "booking-test-2",
      message: "Payment received for booking",
      success: true
    });
    
    await auditService.logAction("CANCEL", "booking", {
      entityId: "booking-test-3", 
      message: "Booking cancelled by user request",
      success: true
    });

    // Mark as seeded to prevent future seeding
    auditStorage.markAsSeeded();
  }
  
  // Seed departments if table is empty
  const seedDepartments = async () => {
    try {
      const { storage } = await import("./storage");
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
  
  const server = await registerRoutes(app);

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
