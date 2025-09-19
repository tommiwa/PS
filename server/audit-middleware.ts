import { Request, Response, NextFunction } from "express";
import { auditService, type RequestContext } from "./audit-service";
import { type UserRole } from "@shared/schema";

// Extend Express Request to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: RequestContext;
    }
  }
}

// Extract user information from authenticated request
function extractUserInfo(req: any): {
  actorId?: string;
  actorEmail?: string;
  actorRole?: UserRole;
} {
  // Handle demo authentication from headers
  const demoAuth = req.headers['x-demo-auth'];
  if (demoAuth) {
    try {
      const demoUser = JSON.parse(demoAuth as string);
      return {
        actorId: demoUser.id,
        actorEmail: demoUser.email,
        actorRole: demoUser.role,
      };
    } catch (error) {
      console.warn('[AuditMiddleware] Failed to parse demo auth:', error);
    }
  }

  // Handle real authentication (from Replit Auth)
  if (req.user?.claims) {
    return {
      actorId: req.user.claims.sub,
      actorEmail: req.user.claims.email,
      actorRole: req.user.role || 'renter', // Default role if not specified
    };
  }

  // Handle cases where user info is attached to request directly
  if (req.user) {
    return {
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
    };
  }

  return {}; // No authenticated user
}

// Extract request metadata for audit logging
function extractRequestMetadata(req: Request): {
  ip?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  contentType?: string;
  contentLength?: number;
} {
  return {
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent') || 'unknown',
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length') ? parseInt(req.get('Content-Length')!) : undefined,
  };
}

// Determine if a request path should be audited
function shouldAuditRequest(req: Request): boolean {
  const path = req.path;
  const method = req.method;

  // Skip common non-audit paths
  const skipPaths = [
    '/api/auth/user', // User info requests (too frequent)
    '/api/notifications', // Notification checks
    '/health', // Health checks
    '/favicon.ico', // Favicon requests
  ];

  // Skip if path is in skip list
  if (skipPaths.some(skipPath => path.startsWith(skipPath))) {
    return false;
  }

  // Skip GET requests to most endpoints (read operations) unless explicitly included
  if (method === 'GET') {
    const auditableGetPaths = [
      '/api/admin', // Admin operations
      '/api/export', // Data exports
      '/api/audit', // Audit log access
    ];
    return auditableGetPaths.some(auditPath => path.startsWith(auditPath));
  }

  // Skip HEAD and OPTIONS requests
  if (['HEAD', 'OPTIONS'].includes(method)) {
    return false;
  }

  // Audit all other API requests (POST, PUT, PATCH, DELETE)
  return path.startsWith('/api');
}

/**
 * Middleware to set up audit context for requests.
 * This must be installed AFTER authentication middleware but BEFORE route handlers.
 */
export function auditContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip non-auditable requests early
  if (!shouldAuditRequest(req)) {
    return next();
  }

  // Generate correlation ID for this request
  const correlationId = auditService.generateCorrelationId();
  
  // Extract user information
  const { actorId, actorEmail, actorRole } = extractUserInfo(req);
  
  // Extract request metadata
  const requestMeta = extractRequestMetadata(req);

  // Create audit context
  const auditContext: RequestContext = {
    correlationId,
    actorId,
    actorEmail,
    actorRole,
    requestMeta,
  };

  // Set context in AsyncLocalStorage and attach to request
  req.auditContext = auditContext;
  auditService.setRequestContext(auditContext);

  // Skip logging GET requests to reduce database bloat
  // Only meaningful operations like CREATE, UPDATE, DELETE will be logged in route handlers

  next();
}

/**
 * Response interceptor middleware to log response status.
 * This should be installed BEFORE auditContextMiddleware.
 */
export function auditResponseMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip non-auditable requests
  if (!shouldAuditRequest(req)) {
    return next();
  }

  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any = null;
  let responseCaptured = false;

  // Intercept res.send
  res.send = function(data) {
    if (!responseCaptured) {
      responseCaptured = true;
      responseBody = data;
      logResponse();
    }
    return originalSend.call(this, data);
  };

  // Intercept res.json
  res.json = function(data) {
    if (!responseCaptured) {
      responseCaptured = true;
      responseBody = data;
      logResponse();
    }
    return originalJson.call(this, data);
  };

  // Log response when response finishes
  function logResponse() {
    // Only log failed operations to reduce database bloat
    const shouldLogResponse = res.statusCode >= 400;
    
    if (shouldLogResponse && req.auditContext) {
      const message = `${req.method} ${req.path} failed with status ${res.statusCode}`;

      auditService.logAction('VIEW', 'system', {
        message,
        success: false,
        entityId: req.path,
        forceSync: true, // Log failures synchronously
      }).catch(error => {
        console.error('[AuditMiddleware] Failed to log response:', error);
      });
    }
  }

  next();
}

/**
 * Authentication change middleware - logs login/logout events.
 * This should be used in auth routes to capture authentication events.
 */
export function auditAuthMiddleware(action: 'LOGIN' | 'LOGOUT') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Intercept response to log authentication result
    const interceptResponse = function(data: any) {
      const success = res.statusCode < 400;
      const { actorId, actorEmail } = extractUserInfo(req);
      
      if (actorId && actorEmail) {
        auditService.auditAuth(action, actorId, actorEmail, success, 
          success ? undefined : `${action} failed with status ${res.statusCode}`
        ).catch(error => {
          console.error(`[AuditMiddleware] Failed to log ${action}:`, error);
        });
      }

      return data;
    };

    res.send = function(data) {
      const intercepted = interceptResponse(data);
      return originalSend.call(this, intercepted);
    };

    res.json = function(data) {
      const intercepted = interceptResponse(data);
      return originalJson.call(this, intercepted);
    };

    next();
  };
}

/**
 * Error handling middleware for audit failures.
 * This should be used as an error handler specifically for audit-related errors.
 */
export function auditErrorMiddleware(error: any, req: Request, res: Response, next: NextFunction): void {
  // Log audit system failures
  if (error.name === 'AuditError' || error.message?.includes('audit')) {
    console.error('[AuditMiddleware] Audit system error:', {
      error: error.message,
      stack: error.stack,
      correlationId: req.auditContext?.correlationId,
      path: req.path,
      method: req.method,
    });

    // Try to log this audit system failure using valid action type
    auditService.auditSystem('VIEW', `Audit system error: ${error.message}`, {
      error: error.message,
      path: req.path,
      method: req.method,
    }).catch(() => {
      // Ignore failures when logging audit system errors to prevent infinite loops
    });
  }

  next(error);
}

// Helper function to manually set audit context (for testing or special cases)
export function setAuditContext(context: Partial<RequestContext>): void {
  const fullContext: RequestContext = {
    correlationId: context.correlationId || auditService.generateCorrelationId(),
    actorId: context.actorId,
    actorEmail: context.actorEmail,
    actorRole: context.actorRole,
    requestMeta: context.requestMeta,
  };

  auditService.setRequestContext(fullContext);
}

// Helper function to get current correlation ID (for logging)
export function getCorrelationId(): string | undefined {
  return auditService.getRequestContext()?.correlationId;
}