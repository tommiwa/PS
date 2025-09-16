import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { 
  type AuditLog, 
  type InsertAuditLog, 
  type AuditAction, 
  type EntityType, 
  type UserRole,
  type RequestMetadata 
} from "@shared/schema";

// Request context interface for AsyncLocalStorage
export interface RequestContext {
  correlationId: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: UserRole;
  requestMeta?: RequestMetadata;
}

// Queue entry for asynchronous processing
interface AuditQueueEntry {
  auditLog: InsertAuditLog;
  timestamp: number;
  retries: number;
}

// Configuration for the audit service
interface AuditConfig {
  maxQueueSize: number;
  queueFlushInterval: number;
  maxRetries: number;
  syncActions: AuditAction[]; // Actions that should be logged synchronously
}

// Default configuration
const DEFAULT_CONFIG: AuditConfig = {
  maxQueueSize: 1000,
  queueFlushInterval: 5000, // 5 seconds
  maxRetries: 3,
  syncActions: ["LOGIN", "LOGOUT", "DELETE"] // Critical actions logged synchronously
};

// AsyncLocalStorage for request context propagation
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export class AuditService {
  private config: AuditConfig;
  private auditQueue: AuditQueueEntry[];
  private isProcessing: boolean;
  private flushTimer?: NodeJS.Timeout;
  private storage?: any; // Will be injected later

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.auditQueue = [];
    this.isProcessing = false;
    this.startQueueProcessor();
  }

  // Inject the audit storage dependency
  setStorage(storage: any) {
    this.storage = storage;
  }

  // Set request context (called by middleware)
  setRequestContext(context: RequestContext): void {
    requestContextStorage.enterWith(context);
  }

  // Get current request context
  getRequestContext(): RequestContext | undefined {
    return requestContextStorage.getStore();
  }

  // Generate a new correlation ID for a request
  generateCorrelationId(): string {
    return randomUUID();
  }

  // Main audit logging method
  async logAction(
    action: AuditAction,
    entityType: EntityType,
    options: {
      entityId?: string;
      message?: string;
      success?: boolean;
      before?: any;
      after?: any;
      forceSync?: boolean;
    } = {}
  ): Promise<void> {
    const context = this.getRequestContext();
    const correlationId = context?.correlationId || this.generateCorrelationId();

    const auditLog: InsertAuditLog = {
      correlationId,
      actorId: context?.actorId || null,
      actorEmail: context?.actorEmail || null,
      actorRole: context?.actorRole || null,
      action,
      entityType,
      entityId: options.entityId || null,
      success: options.success ?? true,
      message: options.message || null,
      requestMeta: context?.requestMeta || null,
      before: this.sanitizeData(options.before) || null,
      after: this.sanitizeData(options.after) || null,
      prevHash: null, // Will be set by storage if hash chaining is enabled
      hash: null, // Will be set by storage if hash chaining is enabled
    };

    // Determine if this should be logged synchronously
    const shouldLogSync = options.forceSync || 
      this.config.syncActions.includes(action) ||
      !options.success; // Always log failures synchronously

    if (shouldLogSync) {
      await this.logAuditSync(auditLog);
    } else {
      this.queueAuditLog(auditLog);
    }
  }

  // Specialized method for CRUD operations (used by decorators)
  async auditCrud(
    action: Extract<AuditAction, "CREATE" | "UPDATE" | "DELETE">,
    entityType: EntityType,
    entityId: string,
    before?: any,
    after?: any,
    message?: string
  ): Promise<void> {
    await this.logAction(action, entityType, {
      entityId,
      message,
      before,
      after,
    });
  }

  // Log authentication events
  async auditAuth(
    action: Extract<AuditAction, "LOGIN" | "LOGOUT">,
    userId: string,
    userEmail: string,
    success: boolean = true,
    message?: string
  ): Promise<void> {
    await this.logAction(action, "user", {
      entityId: userId,
      message: message || `${action} ${success ? 'successful' : 'failed'}`,
      success,
      forceSync: true, // Auth events are always sync
      after: success ? { userId, userEmail } : null,
    });
  }

  // Log system-wide actions (no specific entity)
  async auditSystem(
    action: AuditAction,
    message: string,
    metadata?: any
  ): Promise<void> {
    await this.logAction(action, "system", {
      message,
      after: metadata,
    });
  }

  // Private method to sanitize sensitive data
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'credential',
      'ssn', 'sin', 'credit_card', 'card_number'
    ];

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }

  // Queue an audit log for asynchronous processing
  private queueAuditLog(auditLog: InsertAuditLog): void {
    if (this.auditQueue.length >= this.config.maxQueueSize) {
      console.warn('[AuditService] Queue full, dropping oldest audit log');
      this.auditQueue.shift();
    }

    this.auditQueue.push({
      auditLog,
      timestamp: Date.now(),
      retries: 0
    });

    // Ensure the processor is running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Log audit entry synchronously
  private async logAuditSync(auditLog: InsertAuditLog): Promise<void> {
    if (!this.storage) {
      console.error('[AuditService] Storage not initialized');
      return;
    }

    try {
      await this.storage.createAuditLog(auditLog);
    } catch (error) {
      console.error('[AuditService] Failed to log audit synchronously:', error);
      // Optionally queue for retry
      this.queueAuditLog(auditLog);
    }
  }

  // Start the queue processor
  private startQueueProcessor(): void {
    this.flushTimer = setInterval(() => {
      if (!this.isProcessing && this.auditQueue.length > 0) {
        this.processQueue();
      }
    }, this.config.queueFlushInterval);
  }

  // Process the audit queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.auditQueue.length === 0 || !this.storage) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.auditQueue.splice(0, Math.min(10, this.auditQueue.length));
      
      for (const entry of batch) {
        try {
          await this.storage.createAuditLog(entry.auditLog);
        } catch (error) {
          console.error('[AuditService] Failed to process audit log:', error);
          
          // Retry logic
          if (entry.retries < this.config.maxRetries) {
            entry.retries++;
            this.auditQueue.push(entry);
          } else {
            console.error('[AuditService] Max retries exceeded, dropping audit log:', entry.auditLog.correlationId);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Cleanup method to stop timers
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Process remaining queue items synchronously
    this.processRemainingQueue();
  }

  // Process any remaining items in the queue (for graceful shutdown)
  private async processRemainingQueue(): Promise<void> {
    while (this.auditQueue.length > 0) {
      const entry = this.auditQueue.shift()!;
      try {
        await this.logAuditSync(entry.auditLog);
      } catch (error) {
        console.error('[AuditService] Failed to flush audit log during shutdown:', error);
      }
    }
  }

  // Get queue statistics (for monitoring)
  getQueueStats() {
    return {
      queueSize: this.auditQueue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.config.maxQueueSize,
    };
  }
}

// Singleton instance
export const auditService = new AuditService();

// Storage Decorator Factory - creates decorators that wrap storage methods with audit logging
export function auditDecorator<T extends (...args: any[]) => Promise<any>>(
  action: AuditAction,
  entityType: EntityType,
  options: {
    getEntityId?: (...args: Parameters<T>) => string;
    getMessage?: (...args: Parameters<T>) => string;
    captureArgs?: boolean;
    captureResult?: boolean;
  } = {}
) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: Parameters<T>) {
      const entityId = options.getEntityId ? options.getEntityId(...args) : undefined;
      const message = options.getMessage ? options.getMessage(...args) : 
        `${action} ${entityType}${entityId ? ` ${entityId}` : ''}`;

      let before: any = undefined;
      let after: any = undefined;
      let success = true;
      let error: any = null;

      // Capture before state for UPDATE and DELETE operations
      if ((action === "UPDATE" || action === "DELETE") && entityId) {
        try {
          // Try to get the entity before the operation
          const getMethod = `get${entityType.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)).join('')}`;
          
          if (typeof (this as any)[getMethod] === 'function') {
            before = await (this as any)[getMethod](entityId);
          }
        } catch (e) {
          // Ignore errors when fetching before state
        }
      }

      try {
        // Execute the original method
        const result = await originalMethod.apply(this, args);
        
        // Capture after state
        if (options.captureResult && result) {
          after = result;
        } else if ((action === "CREATE" || action === "UPDATE") && result) {
          after = result;
        }

        // Log the successful operation
        if (action === "CREATE" || action === "UPDATE" || action === "DELETE") {
          await auditService.auditCrud(action, entityType, entityId || '', before, after, message);
        } else {
          await auditService.logAction(action, entityType, {
            entityId: entityId || undefined,
            message,
            before,
            after
          });
        }
        
        return result;
      } catch (e) {
        error = e;
        success = false;
        
        // Log the failed operation
        if (action === "CREATE" || action === "UPDATE" || action === "DELETE") {
          await auditService.auditCrud(action, entityType, entityId || '', before, null, 
            `${message} failed: ${error.message}`);
        } else {
          await auditService.logAction(action, entityType, {
            entityId: entityId || undefined,
            message: `${message} failed: ${error.message}`,
            before,
            after: null,
            success: false
          });
        }
        
        throw e;
      }
    };

    return descriptor;
  };
}

// Helper function to run code within a specific audit context
export function withAuditContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requestContextStorage.run(context, async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}