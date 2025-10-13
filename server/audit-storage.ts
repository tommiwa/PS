import { 
  type AuditLog, 
  type InsertAuditLog, 
  type AuditAction, 
  type EntityType,
  type UserRole
} from "@shared/schema";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

// Query filters for audit log retrieval
export interface AuditQueryFilters {
  // Time range filters
  startDate?: Date;
  endDate?: Date;
  
  // Actor filters
  actorId?: string;
  actorEmail?: string;
  actorRole?: UserRole;
  
  // Entity filters
  entityType?: EntityType;
  entityId?: string;
  
  // Action filters
  action?: AuditAction;
  actions?: AuditAction[];
  
  // Correlation filters
  correlationId?: string;
  
  // Status filters
  success?: boolean;
  
  // Full text search
  searchTerm?: string;
}

// Pagination parameters
export interface AuditPagination {
  page?: number;
  limit?: number;
  sortBy?: keyof AuditLog;
  sortOrder?: 'asc' | 'desc';
}

// Query result with metadata
export interface AuditQueryResult {
  logs: AuditLog[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Audit statistics for admin dashboard
export interface AuditStatistics {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  topActors: Array<{
    actorId: string;
    actorEmail: string;
    count: number;
  }>;
  topActions: Array<{
    action: AuditAction;
    count: number;
  }>;
  entityBreakdown: Array<{
    entityType: EntityType;
    count: number;
  }>;
  failureRate: number;
}

// Hash chaining options
export interface HashChainOptions {
  enabled: boolean;
  algorithm: 'sha256' | 'sha512';
}

// Interface for audit storage operations
export interface IAuditStorage {
  // Core operations (append-only, no update/delete)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  
  // Query operations
  queryAuditLogs(
    filters: AuditQueryFilters, 
    pagination: AuditPagination
  ): Promise<AuditQueryResult>;
  
  // Specialized queries
  getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]>;
  getAuditLogsByActor(actorId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]>;
  
  // Statistics and monitoring
  getAuditStatistics(daysBack?: number): Promise<AuditStatistics>;
  getFailureRate(daysBack?: number): Promise<number>;
  
  // Hash chain validation (if enabled)
  validateHashChain(startId?: string, endId?: string): Promise<boolean>;
  
  // Administrative operations
  getLogCount(): Promise<number>;
  getOldestLog(): Promise<AuditLog | undefined>;
  getLatestLog(): Promise<AuditLog | undefined>;
  
  // Cleanup operations (for development/testing only)
  clearAllLogs?(): Promise<void>;
  
  // Data retention operations
  cleanupOldLogs(retentionDays: number): Promise<number>;
}

// In-memory implementation of audit storage
export class MemAuditStorage implements IAuditStorage {
  private logs: Map<string, AuditLog>;
  private chronologicalOrder: string[]; // For maintaining insertion order
  private hashChainOptions: HashChainOptions;
  private lastHash: string | null;
  private isSeeded: boolean; // Flag to prevent repeated seeding

  constructor(hashChainOptions: HashChainOptions = { enabled: false, algorithm: 'sha256' }) {
    this.logs = new Map();
    this.chronologicalOrder = [];
    this.hashChainOptions = hashChainOptions;
    this.lastHash = null;
    this.isSeeded = false;
  }

  // Create a new audit log entry
  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const occurredAt = new Date();

    // Handle hash chaining if enabled
    let prevHash: string | null = null;
    let hash: string | null = null;
    
    if (this.hashChainOptions.enabled) {
      prevHash = this.lastHash;
      hash = this.calculateHash(insertLog, prevHash);
      this.lastHash = hash;
    }

    const auditLog: AuditLog = {
      ...insertLog,
      id,
      occurredAt,
      prevHash,
      hash,
      message: insertLog.message ?? null, // Convert undefined to null for type compatibility
      actorId: insertLog.actorId ?? null, // Convert undefined to null for type compatibility
      actorEmail: insertLog.actorEmail ?? null, // Convert undefined to null for type compatibility
      actorRole: (insertLog.actorRole as UserRole) ?? null, // Convert undefined to null and ensure proper type
      action: insertLog.action as AuditAction, // Cast to proper AuditAction enum type
      entityType: insertLog.entityType as EntityType, // Cast to proper EntityType enum type
      entityId: insertLog.entityId ?? null, // Convert undefined to null for type compatibility
      success: insertLog.success ?? true, // Convert undefined to default true for type compatibility
      requestMeta: insertLog.requestMeta ?? null, // Convert undefined to null for type compatibility
      before: insertLog.before ?? null, // Convert undefined to null for type compatibility
      after: insertLog.after ?? null, // Convert undefined to null for type compatibility
    };

    // Store the log
    this.logs.set(id, auditLog);
    this.chronologicalOrder.push(id);

    return auditLog;
  }

  // Get audit log by ID
  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    return this.logs.get(id);
  }

  // Query audit logs with filters and pagination
  async queryAuditLogs(
    filters: AuditQueryFilters = {},
    pagination: AuditPagination = {}
  ): Promise<AuditQueryResult> {
    const { page = 1, limit = 50, sortBy = 'occurredAt', sortOrder = 'desc' } = pagination;

    // Filter logs
    let filteredLogs = Array.from(this.logs.values()).filter(log => {
      // Date range filter
      if (filters.startDate && log.occurredAt < filters.startDate) return false;
      if (filters.endDate && log.occurredAt > filters.endDate) return false;

      // Actor filters
      if (filters.actorId && log.actorId !== filters.actorId) return false;
      if (filters.actorEmail && log.actorEmail !== filters.actorEmail) return false;
      if (filters.actorRole && log.actorRole !== filters.actorRole) return false;

      // Entity filters
      if (filters.entityType && log.entityType !== filters.entityType) return false;
      if (filters.entityId && log.entityId !== filters.entityId) return false;

      // Action filters
      if (filters.action && log.action !== filters.action) return false;
      if (filters.actions && !filters.actions.includes(log.action)) return false;

      // Correlation filter
      if (filters.correlationId && log.correlationId !== filters.correlationId) return false;

      // Success filter
      if (filters.success !== undefined && log.success !== filters.success) return false;

      // Full text search
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const searchableText = [
          log.message,
          log.actorEmail,
          log.entityId,
          log.action,
          log.entityType,
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) return false;
      }

      return true;
    });

    // Sort logs
    filteredLogs.sort((a, b) => {
      const aValue = a[sortBy as keyof AuditLog];
      const bValue = b[sortBy as keyof AuditLog];
      
      let comparison = 0;
      // Handle different data types safely
      if (aValue != null && bValue != null) {
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
      } else if (aValue == null && bValue != null) {
        comparison = -1;
      } else if (aValue != null && bValue == null) {
        comparison = 1;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const totalCount = filteredLogs.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limit);

    return {
      logs: paginatedLogs,
      totalCount,
      page,
      limit,
      totalPages,
    };
  }

  // Get audit logs by correlation ID
  async getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]> {
    return Array.from(this.logs.values())
      .filter(log => log.correlationId === correlationId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  // Get audit logs by actor
  async getAuditLogsByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    return Array.from(this.logs.values())
      .filter(log => log.actorId === actorId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  // Get audit logs by entity
  async getAuditLogsByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]> {
    return Array.from(this.logs.values())
      .filter(log => log.entityType === entityType && log.entityId === entityId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  // Get audit statistics
  async getAuditStatistics(daysBack = 30): Promise<AuditStatistics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const allLogs = Array.from(this.logs.values());
    const recentLogs = allLogs.filter(log => log.occurredAt >= cutoffDate);

    // Calculate date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Count logs by time periods
    const logsToday = allLogs.filter(log => log.occurredAt >= today).length;
    const logsThisWeek = allLogs.filter(log => log.occurredAt >= weekAgo).length;
    const logsThisMonth = allLogs.filter(log => log.occurredAt >= monthAgo).length;

    // Calculate top actors
    const actorCounts = new Map<string, { email: string; count: number }>();
    recentLogs.forEach(log => {
      if (log.actorId && log.actorEmail) {
        const current = actorCounts.get(log.actorId) || { email: log.actorEmail, count: 0 };
        actorCounts.set(log.actorId, { ...current, count: current.count + 1 });
      }
    });

    const topActors = Array.from(actorCounts.entries())
      .map(([actorId, { email, count }]) => ({ actorId, actorEmail: email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate top actions
    const actionCounts = new Map<AuditAction, number>();
    recentLogs.forEach(log => {
      actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
    });

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate entity breakdown
    const entityCounts = new Map<EntityType, number>();
    recentLogs.forEach(log => {
      entityCounts.set(log.entityType, (entityCounts.get(log.entityType) || 0) + 1);
    });

    const entityBreakdown = Array.from(entityCounts.entries())
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate failure rate
    const failures = recentLogs.filter(log => !log.success).length;
    const failureRate = recentLogs.length > 0 ? (failures / recentLogs.length) * 100 : 0;

    return {
      totalLogs: allLogs.length,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      topActors,
      topActions,
      entityBreakdown,
      failureRate,
    };
  }

  // Get failure rate
  async getFailureRate(daysBack = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentLogs = Array.from(this.logs.values())
      .filter(log => log.occurredAt >= cutoffDate);

    if (recentLogs.length === 0) return 0;

    const failures = recentLogs.filter(log => !log.success).length;
    return (failures / recentLogs.length) * 100;
  }

  // Validate hash chain integrity
  async validateHashChain(startId?: string, endId?: string): Promise<boolean> {
    if (!this.hashChainOptions.enabled) {
      return true; // Hash chain not enabled, so it's valid by default
    }

    const logs = this.chronologicalOrder
      .map(id => this.logs.get(id)!)
      .filter(log => {
        if (startId && log.id === startId) return true;
        if (endId && log.id === endId) return true;
        return !startId && !endId; // Include all if no bounds specified
      });

    for (let i = 1; i < logs.length; i++) {
      const currentLog = logs[i];
      const previousLog = logs[i - 1];

      if (currentLog.prevHash !== previousLog.hash) {
        console.error(`Hash chain validation failed at log ${currentLog.id}`);
        return false;
      }

      // Recalculate hash to verify integrity
      const expectedHash = this.calculateHash({
        correlationId: currentLog.correlationId,
        actorId: currentLog.actorId,
        actorEmail: currentLog.actorEmail,
        actorRole: currentLog.actorRole,
        action: currentLog.action,
        entityType: currentLog.entityType,
        entityId: currentLog.entityId,
        success: currentLog.success,
        message: currentLog.message,
        requestMeta: currentLog.requestMeta as any, // Type assertion for Json compatibility
        before: currentLog.before as any, // Type assertion for Json compatibility
        after: currentLog.after as any, // Type assertion for Json compatibility
        prevHash: currentLog.prevHash,
        hash: null
      }, currentLog.prevHash);

      if (currentLog.hash !== expectedHash) {
        console.error(`Hash verification failed at log ${currentLog.id}`);
        return false;
      }
    }

    return true;
  }

  // Administrative operations
  async getLogCount(): Promise<number> {
    return this.logs.size;
  }

  async getOldestLog(): Promise<AuditLog | undefined> {
    if (this.chronologicalOrder.length === 0) return undefined;
    return this.logs.get(this.chronologicalOrder[0]);
  }

  async getLatestLog(): Promise<AuditLog | undefined> {
    if (this.chronologicalOrder.length === 0) return undefined;
    return this.logs.get(this.chronologicalOrder[this.chronologicalOrder.length - 1]);
  }

  // Development/testing only - clear all logs
  async clearAllLogs(): Promise<void> {
    this.logs.clear();
    this.chronologicalOrder = [];
    this.lastHash = null;
    this.isSeeded = false; // Reset seeding flag when clearing
  }

  // Check if development seeding has been done
  hasBeenSeeded(): boolean {
    return this.isSeeded;
  }

  // Mark as seeded to prevent repeated seeding
  markAsSeeded(): void {
    this.isSeeded = true;
  }

  // Private helper to calculate hash for hash chaining
  private calculateHash(log: InsertAuditLog, prevHash: string | null): string {
    const hashInput = JSON.stringify({
      ...log,
      prevHash,
    });

    return createHash(this.hashChainOptions.algorithm)
      .update(hashInput)
      .digest('hex');
  }

  // Cleanup old logs (retention policy)
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    const idsToDelete: string[] = [];

    // Find logs older than cutoff date
    for (const [id, log] of Array.from(this.logs.entries())) {
      if (log.occurredAt < cutoffDate) {
        idsToDelete.push(id);
      }
    }

    // Delete the old logs
    for (const id of idsToDelete) {
      this.logs.delete(id);
      const index = this.chronologicalOrder.indexOf(id);
      if (index > -1) {
        this.chronologicalOrder.splice(index, 1);
      }
      deletedCount++;
    }

    return deletedCount;
  }
}

// Database-backed implementation of audit storage
import { db } from "./db";
import { auditLogs } from "@shared/schema";
import { desc, asc, and, or, gte, lte, eq, ilike, lt, sql as drizzleSql } from "drizzle-orm";

export class DbAuditStorage implements IAuditStorage {
  private hashChainOptions: HashChainOptions;

  constructor(hashChainOptions: HashChainOptions = { enabled: false, algorithm: 'sha256' }) {
    this.hashChainOptions = hashChainOptions;
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [createdLog] = await db
      .insert(auditLogs)
      .values({
        correlationId: insertLog.correlationId,
        actorId: insertLog.actorId,
        actorEmail: insertLog.actorEmail,
        actorRole: insertLog.actorRole,
        action: insertLog.action,
        entityType: insertLog.entityType,
        entityId: insertLog.entityId,
        success: insertLog.success,
        message: insertLog.message,
        requestMeta: insertLog.requestMeta,
        before: insertLog.before,
        after: insertLog.after,
        prevHash: insertLog.prevHash,
        hash: insertLog.hash
      })
      .returning();
    
    return createdLog;
  }

  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    const results = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);
    
    return results[0];
  }

  async queryAuditLogs(
    filters: AuditQueryFilters,
    pagination: AuditPagination
  ): Promise<AuditQueryResult> {
    const { page = 1, limit = 50, sortBy = 'occurredAt', sortOrder = 'desc' } = pagination;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    
    if (filters.startDate) {
      conditions.push(gte(auditLogs.occurredAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(auditLogs.occurredAt, filters.endDate));
    }
    if (filters.actorId) {
      conditions.push(eq(auditLogs.actorId, filters.actorId));
    }
    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.success !== undefined) {
      conditions.push(eq(auditLogs.success, filters.success));
    }
    if (filters.correlationId) {
      conditions.push(eq(auditLogs.correlationId, filters.correlationId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause);
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const orderByClause = sortOrder === 'desc' 
      ? desc(auditLogs[sortBy]) 
      : asc(auditLogs[sortBy]);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      logs,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async getAuditLogsByCorrelation(correlationId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.correlationId, correlationId))
      .orderBy(asc(auditLogs.occurredAt));
  }

  async getAuditLogsByActor(actorId: string, limit?: number): Promise<AuditLog[]> {
    let query = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorId, actorId))
      .orderBy(desc(auditLogs.occurredAt));
    
    if (limit) {
      query = query.limit(limit) as any;
    }

    return await query;
  }

  async getAuditLogsByEntity(entityType: EntityType, entityId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId)
      ))
      .orderBy(asc(auditLogs.occurredAt));
  }

  async getAuditStatistics(daysBack?: number): Promise<AuditStatistics> {
    // Simplified implementation - can be enhanced
    const countResult = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(auditLogs);
    
    return {
      totalLogs: countResult[0]?.count || 0,
      logsToday: 0,
      logsThisWeek: 0,
      logsThisMonth: 0,
      topActors: [],
      topActions: [],
      entityBreakdown: [],
      failureRate: 0
    };
  }

  async getFailureRate(daysBack?: number): Promise<number> {
    return 0; // Simplified
  }

  async validateHashChain(startId?: string, endId?: string): Promise<boolean> {
    return true; // Simplified
  }

  async getLogCount(): Promise<number> {
    const result = await db
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(auditLogs);
    
    return result[0]?.count || 0;
  }

  async getOldestLog(): Promise<AuditLog | undefined> {
    const results = await db
      .select()
      .from(auditLogs)
      .orderBy(asc(auditLogs.occurredAt))
      .limit(1);
    
    return results[0];
  }

  async getLatestLog(): Promise<AuditLog | undefined> {
    const results = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.occurredAt))
      .limit(1);
    
    return results[0];
  }

  // Cleanup old logs (retention policy) - deletes logs older than retentionDays
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.occurredAt, cutoffDate));
    
    return result.rowCount || 0;
  }
}

// Export database-backed singleton instance for production use
export const dbAuditStorage = new DbAuditStorage({ enabled: false, algorithm: 'sha256' });

// Export singleton instance
export const auditStorage = new MemAuditStorage({ enabled: true, algorithm: 'sha256' });