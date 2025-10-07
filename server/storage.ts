import { 
  type User, 
  type InsertUser, 
  type UpsertUser,
  type ParkingSpot,
  type ParkingSpotWithUser,
  type ParkingSpotWithSafeUserData,
  type InsertParkingSpot,
  type SpotListing,
  type InsertSpotListing,
  type Booking,
  type InsertBooking,
  type WaitingList,
  type InsertWaitingList,
  type Vehicle,
  type InsertVehicle,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UpdateNotificationPreferences,
  type PaymentPreferences,
  type InsertPaymentPreferences,
  type UpdatePaymentPreferences,
  type PaymentType,
  type InAppNotification,
  type InsertInAppNotification,
  type NotificationType,
  type UserRole,
  type SpotType,
  type ListingType,
  type ListingStatus,
  type BookingStatus,
  type Dispute,
  type InsertDispute,
  type DisputeStatus,
  type AuditLog,
  type InsertAuditLog,
  type Department,
  type InsertDepartment,
  type Location,
  type InsertLocation,
  type SpotTypeTable,
  type InsertSpotType
} from "@shared/schema";
import { randomUUID } from "crypto";
import { auditDecorator } from "./audit-service";
import { type IAuditStorage } from "./audit-storage";
import { db } from "./db";
import { spotListings, parkingSpots, users, waitingList, departments, bookings, disputes, vehicles, inAppNotifications, notificationPreferences, paymentPreferences, locations, spotTypesTable } from "@shared/schema";
import { eq, or, ilike, asc, and, notExists, sql as sqlOp, count, desc } from "drizzle-orm";

// Storage interface with comprehensive CRUD methods
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(includeDeleted?: boolean): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  reactivateUser(id: string): Promise<User | undefined>;

  // Role management helpers
  addUserRole(userId: string, role: UserRole): Promise<User | undefined>;
  removeUserRole(userId: string, role: UserRole): Promise<User | undefined>;
  hasRole(userId: string, role: UserRole): Promise<boolean>;
  hasAnyRole(userId: string, roles: UserRole[]): Promise<boolean>;
  
  // User search operation
  searchUsers(query: string): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>[]>;

  // Parking Spot operations
  getParkingSpot(id: string): Promise<ParkingSpot | undefined>;
  getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]>;
  getAllParkingSpots(): Promise<ParkingSpot[]>;
  createParkingSpot(spot: InsertParkingSpot): Promise<ParkingSpot>;
  updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined>;
  deleteParkingSpot(id: string): Promise<boolean>;
  
  // Enriched parking spot operations (with user information)
  getParkingSpotWithUser(id: string): Promise<ParkingSpotWithUser | undefined>;
  getParkingSpotsByOwnerWithUser(ownerId: string): Promise<ParkingSpotWithUser[]>;
  getAllParkingSpotsWithUser(): Promise<ParkingSpotWithUser[]>;

  // Safe enriched parking spot operations (without sensitive user data)
  getParkingSpotWithSafeUserData(id: string): Promise<ParkingSpotWithSafeUserData | undefined>;
  getAllParkingSpotsWithSafeUserData(): Promise<ParkingSpotWithSafeUserData[]>;

  // Spot Listing operations
  getSpotListing(id: string): Promise<SpotListing | undefined>;
  getSpotListingsByOwner(ownerId: string): Promise<SpotListing[]>;
  getSpotListingsBySpot(spotId: string): Promise<SpotListing[]>;
  getAllSpotListings(): Promise<SpotListing[]>;
  getActiveSpotListings(): Promise<SpotListing[]>;
  createSpotListing(listing: InsertSpotListing): Promise<SpotListing>;
  updateSpotListing(id: string, updates: Partial<InsertSpotListing>): Promise<SpotListing | undefined>;
  deleteSpotListing(id: string): Promise<boolean>;
  // Alias methods for API endpoints
  updateListing(id: string, updates: Partial<InsertSpotListing>): Promise<SpotListing | undefined>;
  deleteListing(id: string): Promise<boolean>;

  // Booking operations
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByRenter(renterId: string): Promise<Booking[]>;
  getBookingsByUser(userId: string): Promise<Booking[]>; // Alias for getBookingsByRenter
  getBookingsByOwner(ownerId: string): Promise<Booking[]>;
  getBookingsBySpot(spotId: string): Promise<Booking[]>;
  getBookingsByListing(listingId: string): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<boolean>;
  // Payment marking functionality
  markPaymentReceived(id: string, paymentReceived: boolean): Promise<Booking | undefined>;

  // Availability checking
  checkSpotAvailability(spotId: string, date: string): Promise<boolean>;
  getBookingsForDate(date: string): Promise<Booking[]>;

  // Waiting List operations
  getWaitingListEntry(id: string): Promise<WaitingList | undefined>;
  getWaitingListByUser(userId: string): Promise<WaitingList | undefined>;
  getAllWaitingList(): Promise<WaitingList[]>;
  getActiveWaitingList(): Promise<WaitingList[]>;
  createWaitingListEntry(entry: InsertWaitingList): Promise<WaitingList>;
  updateWaitingListEntry(id: string, updates: Partial<InsertWaitingList>): Promise<WaitingList | undefined>;
  deleteWaitingListEntry(id: string): Promise<boolean>;
  assignWaitingListUser(waitingListId: string, spotId: string): Promise<WaitingList | undefined>;

  // Vehicle operations
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehiclesByUser(userId: string): Promise<Vehicle[]>;
  getAllVehicles(): Promise<Vehicle[]>;
  createVehicle(userId: string, vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;

  // Bookability control operations
  toggleSpotBookability(spotId: string, isBookable: boolean): Promise<ParkingSpot | undefined>;
  bulkToggleSpotBookability(spotIds: string[], isBookable: boolean): Promise<ParkingSpot[]>;
  
  // Recent assignments tracking
  getRecentAssignments(daysBack?: number): Promise<WaitingList[]>;
  
  // Notification Preferences operations
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  updateNotificationPreferences(userId: string, updates: UpdateNotificationPreferences): Promise<NotificationPreferences>;
  
  // In-App Notifications operations
  createInAppNotification(notification: InsertInAppNotification): Promise<InAppNotification>;
  getInAppNotifications(userId: string, includeRead?: boolean): Promise<InAppNotification[]>;
  markNotificationAsRead(notificationId: string): Promise<InAppNotification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteInAppNotification(notificationId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Payment Preferences operations
  getPaymentPreferences(userId: string): Promise<PaymentPreferences | undefined>;
  createPaymentPreferences(userId: string, preferences: InsertPaymentPreferences): Promise<PaymentPreferences>;
  updatePaymentPreferences(userId: string, updates: UpdatePaymentPreferences): Promise<PaymentPreferences>;
  deletePaymentPreferences(userId: string): Promise<boolean>;
  
  // Department operations
  getDepartments(): Promise<Department[]>;
  getDepartment(id: number): Promise<Department | undefined>;
  createDepartment(name: string): Promise<Department>;
  updateDepartment(id: number, name: string): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // Location operations
  getLocations(): Promise<Location[]>;
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, updates: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: number): Promise<boolean>;
  
  // Spot Type operations
  getSpotTypes(): Promise<SpotTypeTable[]>;
  getSpotType(id: number): Promise<SpotTypeTable | undefined>;
  createSpotType(spotType: InsertSpotType): Promise<SpotTypeTable>;
  updateSpotType(id: number, updates: Partial<InsertSpotType>): Promise<SpotTypeTable | undefined>;
  deleteSpotType(id: number): Promise<boolean>;
  
  // Audit storage operations (delegated to audit storage)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  queryAuditLogs(filters: any, pagination: any): Promise<any>;
  
  // Analytics query methods
  getAnalyticsOverview(): Promise<{
    totalRevenue: number;
    totalBookings: number;
    activeUsers: number;
    utilizationRate: number;
    averageBookingValue: number;
    monthlyGrowth: number;
  }>;
  getMonthlyRevenueData(monthsBack?: number): Promise<{
    month: string;
    revenue: number;
    bookings: number;
    year: number;
  }[]>;
  getRevenueBreakdown(): Promise<{
    ownerEarnings: number;
    bciRevenue: number;
    ownerEarningsPercentage: number;
    bciRevenuePercentage: number;
  }>;
  getTopPerformingSpots(limit?: number): Promise<{
    id: string;
    spotNumber: string;
    location: string;
    earnings: number;
    utilization: number;
    bookingsCount: number;
    ownerName: string;
  }[]>;
  getTopEarningOwners(limit?: number): Promise<{
    id: string;
    name: string;
    earnings: number;
    spotsCount: number;
    bookingsCount: number;
    averageRating: number;
    email: string;
  }[]>;
  getActiveIssues(): Promise<{
    id: string;
    type: string;
    priority: string;
    description: string;
    created: string;
    assignee: string;
    status: string;
    entityId?: string;
    entityType?: string;
  }[]>;
  getBookingDurationData(): Promise<{
    duration: string;
    count: number;
    percentage: number;
  }[]>;
  getLocationPerformanceData(): Promise<{
    location: string;
    spotsCount: number;
    utilization: number;
    earnings: number;
    averageRate: number;
  }[]>;
  getWeeklyTrendsData(): Promise<{
    dayOfWeek: string;
    bookings: number;
    utilization: number;
  }[]>;
  getUserAnalytics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    mostActiveDepartment: string;
  }>;
  
  // Admin Dashboard Metrics
  getAdminDashboardMetrics(): Promise<{
    todaysOccupancy: {
      occupiedSpots: number;
      totalBookableSpots: number;
      utilizationPercent: number;
    };
    pendingIssues: number;
    revenueToday: number;
    newRegistrations: number;
  }>;
  
  // Spot Booking Management methods
  getBookingAvailability(): Promise<Array<SpotListing & { spot: ParkingSpot }>>;
  getPendingPaymentBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>>;
  getActiveBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>>;
  getPastBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>>;
  
  // Dispute operations
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  getDisputes(filters?: { status?: DisputeStatus; bookingId?: string }): Promise<Dispute[]>;
  getDisputeById(id: string): Promise<Dispute | undefined>;
  updateDispute(id: string, updates: Partial<InsertDispute>): Promise<Dispute | undefined>;
  resolveDispute(id: string, resolvedBy: string, resolutionNotes: string, refundAmount?: string): Promise<Dispute | undefined>;
  
  // Spot Listing Admin operations
  updateSpotListingStatus(id: string, status: ListingStatus): Promise<SpotListing | undefined>;
  cancelSpotListing(id: string, reason: string): Promise<SpotListing | undefined>;
  addSpotListingAdminNotes(id: string, notes: string): Promise<SpotListing | undefined>;
  
  // Booking Admin operations
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking | undefined>;
  cancelBookingWithReason(id: string, reason: string): Promise<Booking | undefined>;
  markPaymentRefunded(id: string, refundAmount: string): Promise<Booking | undefined>;
  addBookingAdminNotes(id: string, notes: string): Promise<Booking | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private parkingSpots: Map<string, ParkingSpot>;
  private spotListings: Map<string, SpotListing>;
  private bookings: Map<string, Booking>;
  private waitingList: Map<string, WaitingList>;
  private vehicles: Map<string, Vehicle>;
  private notificationPreferences: Map<string, NotificationPreferences>;
  private paymentPreferences: Map<string, PaymentPreferences>;
  private inAppNotifications: Map<string, InAppNotification>;
  private auditStorage: IAuditStorage;

  constructor(auditStorage?: IAuditStorage) {
    this.users = new Map();
    this.parkingSpots = new Map();
    this.spotListings = new Map();
    this.bookings = new Map();
    this.waitingList = new Map();
    this.vehicles = new Map();
    this.notificationPreferences = new Map();
    this.paymentPreferences = new Map();
    this.inAppNotifications = new Map();
    
    // Inject audit storage (will be set externally)
    this.auditStorage = auditStorage as IAuditStorage;
    
    // Initialize seed data asynchronously
    this.initializeSeedData();
  }
  
  // Set audit storage after construction (dependency injection)
  setAuditStorage(auditStorage: IAuditStorage) {
    this.auditStorage = auditStorage;
  }

  private async initializeSeedData() {
    try {
      // Check if parking spots already exist in database
      const existingSpots = await db.select().from(parkingSpots).limit(1);
      
      if (existingSpots.length > 0) {
        // Database already has spots, no need to seed
        console.log('Database already contains parking spots, skipping seed data');
        return;
      }
      
      console.log('Initializing seed parking spot data...');
      
      // Get location IDs from database
      const level1Location = await db.select().from(locations).where(eq(locations.level, 'Parking Level 1')).limit(1);
      const level2Location = await db.select().from(locations).where(eq(locations.level, 'Parking Level 2')).limit(1);
      
      if (level1Location.length === 0 || level2Location.length === 0) {
        console.log('Required locations not found, skipping seed data');
        return;
      }
      
      const level1LocationId = level1Location[0].id;
      const level2LocationId = level2Location[0].id;
      
      // Get spot type IDs from database
      const regularType = await db.select().from(spotTypesTable).where(eq(spotTypesTable.slug, 'regular')).limit(1);
      const evChargersType = await db.select().from(spotTypesTable).where(eq(spotTypesTable.slug, 'ev-chargers')).limit(1);
      
      if (regularType.length === 0 || evChargersType.length === 0) {
        console.log('Required spot types not found, skipping seed data');
        return;
      }
      
      const regularTypeId = regularType[0].id;
      const evChargersTypeId = evChargersType[0].id;
      
      // Create all the spot definitions
      const level1Spots = Array.from({ length: 100 }, (_, i) => 101 + i); // 101-200
      const level2Spots = Array.from({ length: 95 }, (_, i) => 201 + i);  // 201-295
      const regularEvSpots = [215, 230, 245, 260, 275]; // 5 EV spots on Level 2
      
      const parkingSpotsData: InsertParkingSpot[] = [];
      
      // Create Level 1 spots (P1) - ALL UNALLOCATED
      level1Spots.forEach(spotNum => {
        parkingSpotsData.push({
          spotNumber: spotNum.toString(),
          locationId: level1LocationId,
          spotTypeId: regularTypeId,
          description: "General parking stall",
          isIndoor: true,
          isActive: true,
          isBookable: true,
          isBciManaged: true,
          ownerId: null
        });
      });
      
      // Create Level 2 spots (P2) - ALL UNALLOCATED
      level2Spots.forEach(spotNum => {
        let spotTypeId: number;
        let description: string;
        
        if (regularEvSpots.includes(spotNum)) {
          spotTypeId = evChargersTypeId;
          description = "Electric vehicle charging station";
        } else {
          spotTypeId = regularTypeId;
          description = "General parking stall";
        }
        
        parkingSpotsData.push({
          spotNumber: spotNum.toString(),
          locationId: level2LocationId,
          spotTypeId,
          description,
          isIndoor: true,
          isActive: true,
          isBookable: true,
          isBciManaged: true,
          ownerId: null
        });
      });
      
      // Insert all spots into database in batches (Drizzle supports batch insert)
      if (parkingSpotsData.length > 0) {
        await db.insert(parkingSpots).values(parkingSpotsData);
        console.log(`Successfully inserted ${parkingSpotsData.length} parking spots into database`);
      }
    } catch (error) {
      console.error('Error initializing seed data:', error);
      // Don't throw - let the application continue even if seed fails
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return undefined;
    }
    
    const user = result[0];
    // Update in-memory cache
    this.users.set(id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) return undefined;
    
    // Update memory cache
    this.users.set(result[0].id, result[0]);
    return result[0];
  }

  // (IMPORTANT) Required for Replit Auth
  async upsertUser(userData: UpsertUser): Promise<User> {
    // Ensure id is provided (required for User type)
    if (!userData.id) {
      throw new Error('User ID is required for upsert operation');
    }
    
    // Check if user exists in database
    const existing = await db.select().from(users).where(eq(users.id, userData.id)).limit(1);
    const now = new Date();
    
    if (existing.length === 0) {
      // INSERT new user
      // Dynamic role assignment based on spot ownership and admin list
      let assignedRoles: UserRole[];
      
      // Hardcoded admin emails
      const adminEmails = ['colleen.norcross@bci.ca', 'lijin.joseji@bci.ca', 'thuyan.nhung@bci.ca'];
      
      if (userData.email && adminEmails.includes(userData.email.toLowerCase())) {
        // Admin role for hardcoded emails
        assignedRoles = ["admin"] as UserRole[];
      } else {
        // Check if user owns any parking spot
        const ownedSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, userData.id));
        assignedRoles = ownedSpots.length > 0 ? ["owner"] as UserRole[] : ["renter"] as UserRole[];
      }
      
      const [newUser] = await db.insert(users).values({
        id: userData.id,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        roles: assignedRoles,
        phone: null,
        departmentId: null,
        memberSince: null,
        lastLogin: now,
        createdAt: now,
        updatedAt: now
      }).returning();
      
      // Update memory cache
      this.users.set(userData.id, newUser);
      return newUser;
    } else {
      // UPDATE existing user
      const existingUser = existing[0];
      
      const [updated] = await db.update(users)
        .set({
          email: userData.email ?? existingUser.email,
          firstName: userData.firstName ?? existingUser.firstName,
          lastName: userData.lastName ?? existingUser.lastName,
          profileImageUrl: userData.profileImageUrl ?? existingUser.profileImageUrl,
          lastLogin: now,
          updatedAt: now
        })
        .where(eq(users.id, userData.id))
        .returning();
      
      // Update memory cache
      this.users.set(userData.id, updated);
      return updated;
    }
  }

  async getAllUsers(includeDeleted: boolean = false): Promise<User[]> {
    let query = db.select().from(users);
    
    // By default, exclude deleted users
    if (!includeDeleted) {
      query = query.where(sqlOp`${users.status} != 'deleted'`) as any;
    }
    
    const allUsers = await query;
    
    // Update memory cache
    allUsers.forEach(user => this.users.set(user.id, user));
    return allUsers;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    
    // Insert user into database using departmentId
    const [createdUser] = await db.insert(users).values({
      id,
      email: insertUser.email ?? null,
      roles: insertUser.roles || ['renter'],
      phone: insertUser.phone ?? null,
      departmentId: insertUser.departmentId ?? null,
      memberSince: insertUser.memberSince ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: null,
      lastLogin: null,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    // Also update in-memory cache for backwards compatibility
    this.users.set(id, createdUser);
    
    return createdUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      return undefined;
    }
    
    const now = new Date();
    
    // Update in database
    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();
    
    if (result.length === 0) {
      return undefined;
    }
    
    const updatedUser = result[0];
    
    // Also update in-memory map for consistency
    this.users.set(id, updatedUser);
    
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Soft delete: set status to 'deleted' and record deletedAt timestamp
    const now = new Date();
    
    const result = await db
      .update(users)
      .set({
        status: "deleted",
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();
    
    if (result.length === 0) {
      return false;
    }
    
    // Update memory cache with the soft-deleted user
    this.users.set(id, result[0]);
    
    return true;
  }

  async reactivateUser(id: string): Promise<User | undefined> {
    // Reactivate user: set status to 'active' and clear deletedAt timestamp
    const now = new Date();
    
    const result = await db
      .update(users)
      .set({
        status: "active",
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();
    
    if (result.length === 0) {
      return undefined;
    }
    
    // Update memory cache with the reactivated user
    this.users.set(id, result[0]);
    
    return result[0];
  }

  // Role management helpers
  async addUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    // Add role if not already present
    if (!user.roles.includes(role)) {
      const updatedRoles = [...user.roles, role];
      return this.updateUser(userId, { roles: updatedRoles });
    }
    
    return user;
  }

  async removeUserRole(userId: string, role: UserRole): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    // Remove role if present, but ensure at least one role remains
    if (user.roles.includes(role)) {
      const updatedRoles = user.roles.filter(r => r !== role);
      // If no roles left, default to 'renter'
      if (updatedRoles.length === 0) {
        updatedRoles.push('renter');
      }
      return this.updateUser(userId, { roles: updatedRoles });
    }
    
    return user;
  }

  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    return user.roles.includes(role);
  }

  async hasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
  }

  async searchUsers(query: string): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>[]> {
    const lowerQuery = `%${query.toLowerCase()}%`;
    
    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(
        or(
          ilike(users.firstName, lowerQuery),
          ilike(users.lastName, lowerQuery),
          ilike(users.email, lowerQuery)
        )
      );
    
    return results.map(r => ({
      id: r.id!,
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      email: r.email ?? null,
    }));
  }

  // Parking Spot operations
  async getParkingSpot(id: string): Promise<ParkingSpot | undefined> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id));
    const spot = spots[0];
    
    // Update memory cache for performance
    if (spot) {
      this.parkingSpots.set(spot.id, spot);
    }
    
    return spot;
  }

  async getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, ownerId));
    
    // Update memory cache for performance
    spots.forEach(spot => this.parkingSpots.set(spot.id, spot));
    
    return spots;
  }

  // Enrich spot with location and spot type info (for user profile display)
  async getParkingSpotsByOwnerEnriched(ownerId: string): Promise<any[]> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, ownerId));
    
    return Promise.all(spots.map(async (spot) => {
      // Get location info
      const locationResult = await db
        .select({ 
          office: locations.office,
          building: locations.building,
          level: locations.level
        })
        .from(locations)
        .where(eq(locations.id, spot.locationId))
        .limit(1);
      
      // Get spot type info
      const spotTypeResult = await db
        .select({ 
          name: spotTypesTable.name,
          slug: spotTypesTable.slug
        })
        .from(spotTypesTable)
        .where(eq(spotTypesTable.id, spot.spotTypeId))
        .limit(1);
      
      return {
        ...spot,
        location: locationResult.length > 0 
          ? `${locationResult[0].office} - ${locationResult[0].building}, ${locationResult[0].level}`
          : undefined,
        spotType: spotTypeResult.length > 0 ? spotTypeResult[0].slug : undefined
      };
    }));
  }

  async getAllParkingSpots(): Promise<ParkingSpot[]> {
    const spots = await db.select().from(parkingSpots);
    
    // Update memory cache for performance
    spots.forEach(spot => this.parkingSpots.set(spot.id, spot));
    
    return spots;
  }

  // Enriched parking spot methods with user information
  async getParkingSpotWithUser(id: string): Promise<ParkingSpotWithUser | undefined> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id));
    const spot = spots[0];
    if (!spot) return undefined;

    return this.enrichSpotWithUserInfo(spot);
  }

  async getParkingSpotsByOwnerWithUser(ownerId: string): Promise<ParkingSpotWithUser[]> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, ownerId));
    
    return Promise.all(spots.map(spot => this.enrichSpotWithUserInfo(spot)));
  }

  async getAllParkingSpotsWithUser(): Promise<ParkingSpotWithUser[]> {
    const spots = await db.select().from(parkingSpots);
    return Promise.all(spots.map(spot => this.enrichSpotWithUserInfo(spot)));
  }

  // Helper method to enrich parking spot with user information
  private async enrichSpotWithUserInfo(spot: ParkingSpot): Promise<ParkingSpotWithUser> {
    const enrichedSpot: ParkingSpotWithUser = { ...spot };
    
    // Join location details to construct name
    const locationResult = await db
      .select({ 
        office: locations.office,
        building: locations.building,
        level: locations.level
      })
      .from(locations)
      .where(eq(locations.id, spot.locationId))
      .limit(1);
    
    if (locationResult.length > 0) {
      const loc = locationResult[0];
      enrichedSpot.locationName = `${loc.office} - ${loc.building}, ${loc.level}`;
    }
    
    // Join spot type name
    const spotTypeResult = await db
      .select({ name: spotTypesTable.name })
      .from(spotTypesTable)
      .where(eq(spotTypesTable.id, spot.spotTypeId))
      .limit(1);
    
    if (spotTypeResult.length > 0) {
      enrichedSpot.spotTypeName = spotTypeResult[0].name;
    }
    
    if (spot.ownerId) {
      // Query database for user with department join
      const userResult = await db
        .select({
          user: users,
          department: departments
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, spot.ownerId))
        .limit(1);
      
      if (userResult.length > 0) {
        const { user, department } = userResult[0];
        enrichedSpot.assignedUserName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.email || undefined;
        enrichedSpot.assignedUserEmail = user.email || undefined;
        enrichedSpot.assignedUserDepartment = department?.name || undefined;
        // Update user cache
        this.users.set(user.id, user);
      }
    }
    
    return enrichedSpot;
  }

  // Safe enriched parking spot methods (without sensitive user data)
  async getParkingSpotWithSafeUserData(id: string): Promise<ParkingSpotWithSafeUserData | undefined> {
    // Query database first
    const result = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id)).limit(1);
    if (result.length === 0) return undefined;

    const spot = result[0];
    
    // Update memory cache for performance
    this.parkingSpots.set(spot.id, spot);
    
    // Enrich with user data (also from database)
    return this.enrichSpotWithSafeUserInfo(spot);
  }

  async getAllParkingSpotsWithSafeUserData(): Promise<ParkingSpotWithSafeUserData[]> {
    const spots = await db.select().from(parkingSpots);
    return Promise.all(spots.map(spot => this.enrichSpotWithSafeUserInfo(spot)));
  }

  // Helper method to safely enrich parking spot with minimal user information
  private async enrichSpotWithSafeUserInfo(spot: ParkingSpot): Promise<ParkingSpotWithSafeUserData> {
    const enrichedSpot: ParkingSpotWithSafeUserData = { ...spot };
    
    if (spot.ownerId) {
      // Query database for user with department join
      const userResult = await db
        .select({
          user: users,
          department: departments
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, spot.ownerId))
        .limit(1);
      
      if (userResult.length > 0) {
        const { user, department } = userResult[0];
        enrichedSpot.assignedUserName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.firstName || user.lastName || user.email || undefined;
        enrichedSpot.assignedUserDepartment = department?.name || undefined;
        // Update user cache
        this.users.set(user.id, user);
        // Intentionally NOT including assignedUserEmail for data security
      }
    }
    
    return enrichedSpot;
  }

  async createParkingSpot(insertSpot: InsertParkingSpot): Promise<ParkingSpot> {
    const id = randomUUID();
    
    // Insert into database using FK IDs
    const [createdSpot] = await db.insert(parkingSpots).values({
      id,
      spotNumber: insertSpot.spotNumber,
      locationId: insertSpot.locationId,
      spotTypeId: insertSpot.spotTypeId,
      isIndoor: insertSpot.isIndoor ?? false,
      ownerId: insertSpot.ownerId ?? null,
      description: insertSpot.description ?? null,
      isActive: insertSpot.isActive ?? true,
      isBookable: insertSpot.isBookable ?? true,
      isBciManaged: insertSpot.isBciManaged ?? false,
      createdAt: new Date()
    }).returning();
    
    // Also update in-memory cache for backwards compatibility
    this.parkingSpots.set(id, createdSpot);
    
    return createdSpot;
  }

  async updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined> {
    // First check if spot exists
    const existing = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id));
    if (existing.length === 0) return undefined;
    
    // Update in database
    const updated = await db.update(parkingSpots)
      .set(updates)
      .where(eq(parkingSpots.id, id))
      .returning();
    
    return updated[0];
  }

  async deleteParkingSpot(id: string): Promise<boolean> {
    const deleted = await db.delete(parkingSpots)
      .where(eq(parkingSpots.id, id))
      .returning();
    return deleted.length > 0;
  }

  // Spot Listing operations
  async getSpotListing(id: string): Promise<SpotListing | undefined> {
    const result = await db.select().from(spotListings).where(eq(spotListings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    
    // Update memory cache for performance
    this.spotListings.set(result[0].id, result[0]);
    return result[0];
  }

  async getSpotListingsByOwner(ownerId: string): Promise<SpotListing[]> {
    const listings = await db.select().from(spotListings).where(eq(spotListings.ownerId, ownerId));
    
    // Update memory cache for performance
    listings.forEach(listing => this.spotListings.set(listing.id, listing));
    return listings;
  }

  async getSpotListingsBySpot(spotId: string): Promise<SpotListing[]> {
    const listings = await db.select().from(spotListings).where(eq(spotListings.spotId, spotId));
    
    // Update memory cache for performance
    listings.forEach(listing => this.spotListings.set(listing.id, listing));
    return listings;
  }

  async getAllSpotListings(): Promise<SpotListing[]> {
    return await db.select().from(spotListings);
  }

  async getActiveSpotListings(): Promise<SpotListing[]> {
    return await db.select().from(spotListings).where(eq(spotListings.status, "active"));
  }

  async createSpotListing(insertListing: InsertSpotListing): Promise<SpotListing> {
    const [listing] = await db.insert(spotListings).values({
      spotId: insertListing.spotId,
      ownerId: insertListing.ownerId!,
      listingType: insertListing.listingType as ListingType,
      singleDate: insertListing.singleDate ?? null,
      periodStartDate: insertListing.periodStartDate ?? null,
      periodEndDate: insertListing.periodEndDate ?? null,
      recurringStartDate: insertListing.recurringStartDate ?? null,
      recurringEndDate: insertListing.recurringEndDate ?? null,
      daysOfWeek: insertListing.daysOfWeek ?? null,
      dailyRate: insertListing.dailyRate,
      status: (insertListing.status as ListingStatus) ?? "active",
      notes: insertListing.notes ?? null,
    }).returning();
    
    return listing;
  }

  async updateSpotListing(id: string, updates: Partial<InsertSpotListing>): Promise<SpotListing | undefined> {
    const existing = await db.select().from(spotListings).where(eq(spotListings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(spotListings)
      .set({
        ...updates,
        listingType: updates.listingType ? (updates.listingType as ListingType) : undefined,
        status: updates.status ? (updates.status as ListingStatus) : undefined,
        updatedAt: new Date()
      })
      .where(eq(spotListings.id, id))
      .returning();
    
    return updated[0];
  }

  async deleteSpotListing(id: string): Promise<boolean> {
    const deleted = await db.delete(spotListings)
      .where(eq(spotListings.id, id))
      .returning();
    return deleted.length > 0;
  }

  // Booking operations
  async getBooking(id: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    
    // Update memory cache for performance
    this.bookings.set(result[0].id, result[0]);
    return result[0];
  }

  async getBookingsByRenter(renterId: string): Promise<Booking[]> {
    const renterBookings = await db.select().from(bookings).where(eq(bookings.renterId, renterId));
    
    // Update memory cache
    renterBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return renterBookings;
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    // Alias for getBookingsByRenter
    return this.getBookingsByRenter(userId);
  }

  async getBookingsByOwner(ownerId: string): Promise<Booking[]> {
    const ownerBookings = await db.select().from(bookings).where(eq(bookings.ownerId, ownerId));
    
    // Update memory cache
    ownerBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return ownerBookings;
  }

  async getBookingsBySpot(spotId: string): Promise<Booking[]> {
    const spotBookings = await db.select().from(bookings).where(eq(bookings.spotId, spotId));
    
    // Update memory cache
    spotBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return spotBookings;
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    const listingBookings = await db.select().from(bookings).where(eq(bookings.listingId, listingId));
    
    // Update memory cache
    listingBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return listingBookings;
  }

  async getAllBookings(): Promise<Booking[]> {
    const allBookings = await db.select().from(bookings);
    
    // Update memory cache
    allBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return allBookings;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const now = new Date();
    
    // Insert into database
    const [createdBooking] = await db.insert(bookings).values({
      id,
      listingId: insertBooking.listingId,
      spotId: insertBooking.spotId,
      renterId: insertBooking.renterId,
      ownerId: insertBooking.ownerId,
      bookingDate: insertBooking.bookingDate,
      dailyRate: insertBooking.dailyRate,
      totalAmount: insertBooking.totalAmount,
      status: (insertBooking.status as BookingStatus) ?? "confirmed",
      paymentReceived: insertBooking.paymentReceived ?? false,
      notes: insertBooking.notes ?? null,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    // Also update in-memory cache for backwards compatibility
    this.bookings.set(id, createdBooking);
    
    return createdBooking;
  }

  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    // Query database first
    const existing = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (existing.length === 0) return undefined;

    // Update database
    const [updatedBooking] = await db.update(bookings)
      .set({ 
        ...updates, 
        status: updates.status ? (updates.status as BookingStatus) : undefined,
        updatedAt: new Date() 
      })
      .where(eq(bookings.id, id))
      .returning();

    // Update memory cache for performance
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteBooking(id: string): Promise<boolean> {
    const deleted = await db.delete(bookings).where(eq(bookings.id, id));
    
    // Also delete from memory cache
    this.bookings.delete(id);
    
    return (deleted.rowCount ?? 0) > 0;
  }

  // Alias methods for API endpoints
  async updateListing(id: string, updates: Partial<InsertSpotListing>): Promise<SpotListing | undefined> {
    return this.updateSpotListing(id, updates);
  }

  async deleteListing(id: string): Promise<boolean> {
    return this.deleteSpotListing(id);
  }

  // Payment marking functionality
  async markPaymentReceived(id: string, paymentReceived: boolean): Promise<Booking | undefined> {
    // Query database first
    const existing = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (existing.length === 0) return undefined;

    const now = new Date();
    
    // Update database
    const [updatedBooking] = await db.update(bookings)
      .set({
        paymentReceived,
        updatedAt: now
      })
      .where(eq(bookings.id, id))
      .returning();

    // Update memory cache for performance
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Availability checking
  async checkSpotAvailability(spotId: string, date: string): Promise<boolean> {
    const bookingsForSpot = await this.getBookingsBySpot(spotId);
    return !bookingsForSpot.some(
      booking => booking.bookingDate === date && 
                booking.status === "confirmed"
    );
  }

  async getBookingsForDate(date: string): Promise<Booking[]> {
    const dateBookings = await db.select().from(bookings).where(eq(bookings.bookingDate, date));
    
    // Update memory cache
    dateBookings.forEach(booking => this.bookings.set(booking.id, booking));
    return dateBookings;
  }

  // Waiting List operations
  async getWaitingListEntry(id: string): Promise<WaitingList | undefined> {
    const result = await db
      .select()
      .from(waitingList)
      .where(eq(waitingList.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return undefined;
    }
    
    const entry = result[0];
    // Cache in memory
    this.waitingList.set(entry.id, entry);
    
    return entry;
  }

  async getWaitingListByUser(userId: string): Promise<WaitingList | undefined> {
    const result = await db
      .select()
      .from(waitingList)
      .where(and(
        eq(waitingList.userId, userId),
        eq(waitingList.status, 'active')
      ))
      .limit(1);
    
    if (result.length === 0) {
      return undefined;
    }
    
    const entry = result[0];
    // Cache in memory
    this.waitingList.set(entry.id, entry);
    
    return entry;
  }

  async getAllWaitingList(): Promise<WaitingList[]> {
    const entries = await db
      .select()
      .from(waitingList)
      .orderBy(asc(waitingList.priority));
    
    // Cache in memory
    entries.forEach(entry => this.waitingList.set(entry.id, entry));
    
    return entries;
  }

  async getActiveWaitingList(): Promise<WaitingList[]> {
    // Exclude users who already have BCI-managed spots
    const entries = await db
      .select()
      .from(waitingList)
      .where(and(
        eq(waitingList.status, 'active'),
        notExists(
          db.select({ id: parkingSpots.id })
            .from(parkingSpots)
            .where(and(
              eq(parkingSpots.ownerId, waitingList.userId),
              eq(parkingSpots.isBciManaged, true)
            ))
        )
      ))
      .orderBy(asc(waitingList.priority));
    
    // Cache in memory
    entries.forEach(entry => this.waitingList.set(entry.id, entry));
    
    return entries;
  }

  async createWaitingListEntry(insertEntry: InsertWaitingList): Promise<WaitingList> {
    const now = new Date();
    
    // Insert into database
    const [createdEntry] = await db.insert(waitingList).values({
      userId: insertEntry.userId,
      userName: insertEntry.userName,
      userEmail: insertEntry.userEmail,
      preferredSpotTypeId: insertEntry.preferredSpotTypeId ?? null,
      preferredLocationId: insertEntry.preferredLocationId ?? null,
      priority: insertEntry.priority ?? 1,
      status: insertEntry.status ?? 'active',
      reason: insertEntry.reason ?? null,
      assignedDate: insertEntry.assignedDate ?? null,
      assignedSpotId: insertEntry.assignedSpotId ?? null,
      enrolledBy: insertEntry.enrolledBy ?? 'user',
      adminNotes: insertEntry.adminNotes ?? null,
      updatedAt: now
    }).returning();
    
    // Also update in-memory cache for backwards compatibility
    this.waitingList.set(createdEntry.id, createdEntry);
    
    return createdEntry;
  }

  async updateWaitingListEntry(id: string, updates: Partial<InsertWaitingList>): Promise<WaitingList | undefined> {
    try {
      const result = await db
        .update(waitingList)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(waitingList.id, id))
        .returning();
      
      if (result.length === 0) {
        return undefined;
      }
      
      const updatedEntry = result[0];
      // Also update in memory
      this.waitingList.set(id, updatedEntry);
      
      return updatedEntry;
    } catch (error) {
      console.error("Error updating waiting list entry:", error);
      return undefined;
    }
  }

  async deleteWaitingListEntry(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(waitingList)
        .where(eq(waitingList.id, id))
        .returning();
      
      // Also delete from memory
      this.waitingList.delete(id);
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting waiting list entry:", error);
      return false;
    }
  }

  async getWaitingListById(id: string): Promise<WaitingList | undefined> {
    const result = await db.select().from(waitingList).where(eq(waitingList.id, id)).limit(1);
    if (result.length === 0) return undefined;
    
    // Update memory cache for performance
    this.waitingList.set(result[0].id, result[0]);
    return result[0];
  }

  async assignWaitingListUser(waitingListId: string, spotId: string): Promise<WaitingList | undefined> {
    // Query database first
    const existing = await db.select().from(waitingList).where(eq(waitingList.id, waitingListId)).limit(1);
    if (existing.length === 0) return undefined;

    const now = new Date();
    
    // Update database
    const [updated] = await db.update(waitingList)
      .set({
        status: 'assigned',
        assignedSpotId: spotId,
        assignedDate: now,
        updatedAt: now
      })
      .where(eq(waitingList.id, waitingListId))
      .returning();

    // Update memory cache for performance
    this.waitingList.set(waitingListId, updated);
    return updated;
  }

  // Vehicle operations
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (result.length === 0) return undefined;
    
    // Update memory cache for performance
    this.vehicles.set(result[0].id, result[0]);
    return result[0];
  }

  async getVehiclesByUser(userId: string): Promise<Vehicle[]> {
    const userVehicles = await db.select().from(vehicles).where(eq(vehicles.userId, userId));
    
    // Update memory cache
    userVehicles.forEach(vehicle => this.vehicles.set(vehicle.id, vehicle));
    return userVehicles;
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    const allVehicles = await db.select().from(vehicles);
    
    // Update memory cache
    allVehicles.forEach(vehicle => this.vehicles.set(vehicle.id, vehicle));
    return allVehicles;
  }

  async createVehicle(userId: string, vehicle: InsertVehicle): Promise<Vehicle> {
    const id = randomUUID();
    const now = new Date();
    
    // If this vehicle is being set as default, clear the default flag from all other vehicles for this user
    if (vehicle.isDefault) {
      await db.update(vehicles)
        .set({ isDefault: false })
        .where(eq(vehicles.userId, userId));
    }
    
    // Insert into database
    const [createdVehicle] = await db.insert(vehicles).values({
      id,
      userId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
      color: vehicle.color ?? null,
      isElectric: vehicle.isElectric ?? false,
      isDefault: vehicle.isDefault ?? false,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    // Also update in-memory cache for backwards compatibility
    this.vehicles.set(id, createdVehicle);
    
    return createdVehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    // Query database first
    const existing = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (existing.length === 0) return undefined;

    const vehicle = existing[0];
    
    // If this vehicle is being set as default, clear the default flag from all other vehicles for this user
    if (updates.isDefault === true) {
      await db.update(vehicles)
        .set({ isDefault: false })
        .where(eq(vehicles.userId, vehicle.userId));
    }

    // Update database
    const [updatedVehicle] = await db.update(vehicles)
      .set(updates)
      .where(eq(vehicles.id, id))
      .returning();

    // Update memory cache for performance
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    // Delete from database first
    await db.delete(vehicles).where(eq(vehicles.id, id));
    
    // Delete from memory cache
    this.vehicles.delete(id);
    return true;
  }

  // Bookability control operations
  async toggleSpotBookability(spotId: string, isBookable: boolean): Promise<ParkingSpot | undefined> {
    // Query database first
    const existing = await db.select().from(parkingSpots).where(eq(parkingSpots.id, spotId)).limit(1);
    if (existing.length === 0) return undefined;

    // Update database
    const [updatedSpot] = await db.update(parkingSpots)
      .set({ isBookable })
      .where(eq(parkingSpots.id, spotId))
      .returning();

    // Update memory cache for performance
    this.parkingSpots.set(spotId, updatedSpot);
    return updatedSpot;
  }

  async bulkToggleSpotBookability(spotIds: string[], isBookable: boolean): Promise<ParkingSpot[]> {
    if (spotIds.length === 0) return [];

    const updatedSpots: ParkingSpot[] = [];
    
    // Bulk update in database
    for (const spotId of spotIds) {
      const [updatedSpot] = await db.update(parkingSpots)
        .set({ isBookable })
        .where(eq(parkingSpots.id, spotId))
        .returning();
      
      if (updatedSpot) {
        // Update memory cache for performance
        this.parkingSpots.set(spotId, updatedSpot);
        updatedSpots.push(updatedSpot);
      }
    }
    
    return updatedSpots;
  }

  // Recent assignments tracking
  async getRecentAssignments(daysBack: number = 7): Promise<WaitingList[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const allEntries = await db.select().from(waitingList);
    
    return allEntries
      .filter(entry => entry.status === 'assigned' && entry.assignedDate && new Date(entry.assignedDate) >= cutoffDate)
      .sort((a, b) => {
        if (!a.assignedDate || !b.assignedDate) return 0;
        return new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime();
      });
  }

  // Payment Preferences operations
  async getPaymentPreferences(userId: string): Promise<PaymentPreferences | undefined> {
    const result = await db.select()
      .from(paymentPreferences)
      .where(eq(paymentPreferences.userId, userId))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    // Update memory cache
    this.paymentPreferences.set(result[0].id, result[0]);
    return result[0];
  }

  async createPaymentPreferences(userId: string, preferences: InsertPaymentPreferences): Promise<PaymentPreferences> {
    const insertData = {
      userId,
      paymentType: (preferences.paymentType ?? "interac_transfer") as PaymentType,
      paymentInstructions: preferences.paymentInstructions ?? null
    };
    
    const [newPreferences] = await db.insert(paymentPreferences).values(insertData).returning();
    
    // Update memory cache for performance
    this.paymentPreferences.set(newPreferences.id, newPreferences);
    return newPreferences;
  }

  async updatePaymentPreferences(userId: string, updates: UpdatePaymentPreferences): Promise<PaymentPreferences> {
    const existing = await this.getPaymentPreferences(userId);
    
    if (!existing) {
      // Create new preferences if none exist
      const defaultPreferences: InsertPaymentPreferences = {
        paymentType: (updates.paymentType as PaymentType | undefined) ?? "interac_transfer",
        paymentInstructions: updates.paymentInstructions,
      };
      return this.createPaymentPreferences(userId, defaultPreferences);
    }
    
    const updateData: Partial<typeof paymentPreferences.$inferInsert> = {};
    if (updates.paymentType !== undefined) {
      updateData.paymentType = updates.paymentType as PaymentType;
    }
    if (updates.paymentInstructions !== undefined) {
      updateData.paymentInstructions = updates.paymentInstructions;
    }
    updateData.updatedAt = new Date();
    
    const [updatedPreferences] = await db.update(paymentPreferences)
      .set(updateData)
      .where(eq(paymentPreferences.id, existing.id))
      .returning();
    
    // Update memory cache for performance
    this.paymentPreferences.set(existing.id, updatedPreferences);
    return updatedPreferences;
  }

  async deletePaymentPreferences(userId: string): Promise<boolean> {
    const existing = await this.getPaymentPreferences(userId);
    if (!existing) return false;
    
    await db.delete(paymentPreferences).where(eq(paymentPreferences.id, existing.id));
    this.paymentPreferences.delete(existing.id);
    return true;
  }

  // Department operations
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0];
  }

  async createDepartment(name: string): Promise<Department> {
    const result = await db.insert(departments).values({ name }).returning();
    return result[0];
  }

  async updateDepartment(id: number, name: string): Promise<Department | undefined> {
    const result = await db.update(departments)
      .set({ name, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return result[0];
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const usersWithDepartment = await db.select().from(users).where(eq(users.departmentId, id));
    if (usersWithDepartment.length > 0) {
      throw new Error("Cannot delete department that is in use by users");
    }
    
    const result = await db.delete(departments).where(eq(departments.id, id)).returning();
    return result.length > 0;
  }

  // Location operations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.isActive, true));
  }

  async getLocation(id: number): Promise<Location | undefined> {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const result = await db.insert(locations).values(location).returning();
    return result[0];
  }

  async updateLocation(id: number, updates: Partial<InsertLocation>): Promise<Location | undefined> {
    const result = await db.update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return result[0];
  }

  async deleteLocation(id: number): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id)).returning();
    return result.length > 0;
  }

  // Spot Type operations
  async getSpotTypes(): Promise<SpotTypeTable[]> {
    return await db.select().from(spotTypesTable).where(eq(spotTypesTable.isActive, true));
  }

  async getSpotType(id: number): Promise<SpotTypeTable | undefined> {
    const result = await db.select().from(spotTypesTable).where(eq(spotTypesTable.id, id));
    return result[0];
  }

  async createSpotType(spotType: InsertSpotType): Promise<SpotTypeTable> {
    const result = await db.insert(spotTypesTable).values(spotType).returning();
    return result[0];
  }

  async updateSpotType(id: number, updates: Partial<InsertSpotType>): Promise<SpotTypeTable | undefined> {
    const result = await db.update(spotTypesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(spotTypesTable.id, id))
      .returning();
    return result[0];
  }

  async deleteSpotType(id: number): Promise<boolean> {
    const result = await db.delete(spotTypesTable).where(eq(spotTypesTable.id, id)).returning();
    return result.length > 0;
  }

  // Audit storage delegation methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    return this.auditStorage.createAuditLog(log);
  }

  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    return this.auditStorage.getAuditLog(id);
  }

  async queryAuditLogs(filters: any, pagination: any): Promise<any> {
    return this.auditStorage.queryAuditLogs(filters, pagination);
  }

  // Analytics methods implementation
  async getAnalyticsOverview(): Promise<{
    totalRevenue: number;
    totalBookings: number;
    activeUsers: number;
    utilizationRate: number;
    averageBookingValue: number;
    monthlyGrowth: number;
  }> {
    const allBookings = await db.select().from(bookings);
    const allUsers = await db.select().from(users);
    const allSpots = await db.select().from(parkingSpots);
    
    // Calculate total revenue
    const totalRevenue = allBookings
      .filter(b => b.paymentReceived)
      .reduce((sum, booking) => sum + parseFloat(booking.totalAmount.toString()), 0);
    
    // Calculate total bookings
    const totalBookings = allBookings.length;
    
    // Active users (those with recent activity)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = allUsers.filter(user => 
      user.lastLogin && new Date(user.lastLogin) >= thirtyDaysAgo
    ).length;
    
    // Calculate utilization rate
    const totalSpots = allSpots.length;
    const bookingsToday = allBookings.filter(booking => {
      const today = new Date().toISOString().split('T')[0];
      return booking.bookingDate === today;
    }).length;
    const utilizationRate = totalSpots > 0 ? (bookingsToday / totalSpots) * 100 : 0;
    
    // Calculate average booking value
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    
    // Calculate monthly growth (simplified)
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    
    const currentMonthBookings = allBookings.filter(booking => 
      new Date(booking.createdAt).getMonth() === currentMonth
    ).length;
    const lastMonthBookings = allBookings.filter(booking => 
      new Date(booking.createdAt).getMonth() === lastMonth
    ).length;
    
    const monthlyGrowth = lastMonthBookings > 0 
      ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings) * 100 
      : 0;
    
    return {
      totalRevenue: Math.round(totalRevenue),
      totalBookings,
      activeUsers,
      utilizationRate: Math.round(utilizationRate * 10) / 10,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10
    };
  }

  async getMonthlyRevenueData(monthsBack: number = 12): Promise<{
    month: string;
    revenue: number;
    bookings: number;
    year: number;
  }[]> {
    const allBookings = await db.select().from(bookings);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = [];
    
    for (let i = monthsBack - 1; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - i);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const monthBookings = paidBookings.filter(booking => {
        const bookingDate = new Date(booking.createdAt);
        return bookingDate.getMonth() === month && bookingDate.getFullYear() === year;
      });
      
      const revenue = monthBookings.reduce((sum, booking) => 
        sum + parseFloat(booking.totalAmount.toString()), 0
      );
      
      result.push({
        month: monthNames[month],
        revenue: Math.round(revenue),
        bookings: monthBookings.length,
        year
      });
    }
    
    return result;
  }

  async getRevenueBreakdown(): Promise<{
    ownerEarnings: number;
    bciRevenue: number;
    ownerEarningsPercentage: number;
    bciRevenuePercentage: number;
  }> {
    const allBookings = await db.select().from(bookings);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    
    const totalRevenue = paidBookings.reduce((sum, booking) => 
      sum + parseFloat(booking.totalAmount.toString()), 0
    );
    
    // Calculate revenue split based on business model
    // Owner Earnings: 71% to spot owners
    // BCI Revenue: 29% platform revenue (includes platform fees, processing, and other revenue)
    const ownerEarnings = totalRevenue * 0.71;
    const bciRevenue = totalRevenue * 0.29;
    
    return {
      ownerEarnings: Math.round(ownerEarnings),
      bciRevenue: Math.round(bciRevenue),
      ownerEarningsPercentage: 71,
      bciRevenuePercentage: 29
    };
  }

  async getTopPerformingSpots(limit: number = 5): Promise<{
    id: string;
    spotNumber: string;
    location: string;
    earnings: number;
    utilization: number;
    bookingsCount: number;
    ownerName: string;
  }[]> {
    const allBookings = await db.select().from(bookings);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const allSpots = await db.select().from(parkingSpots);
    const allUsers = await db.select().from(users);
    const allLocations = await db.select().from(locations);
    
    // Create location map
    const locationMap = new Map(allLocations.map(loc => [loc.id, `${loc.office} - ${loc.building}, ${loc.level}`]));
    
    // Group bookings by spot
    const spotEarnings = new Map<string, { earnings: number; bookingsCount: number }>();
    
    paidBookings.forEach(booking => {
      const current = spotEarnings.get(booking.spotId) || { earnings: 0, bookingsCount: 0 };
      current.earnings += parseFloat(booking.totalAmount.toString());
      current.bookingsCount += 1;
      spotEarnings.set(booking.spotId, current);
    });
    
    // Calculate performance metrics for each spot
    const spotPerformance = allSpots.map(spot => {
      const earnings = spotEarnings.get(spot.id);
      const owner = allUsers.find(user => user.id === spot.ownerId);
      
      return {
        id: spot.id,
        spotNumber: spot.spotNumber,
        location: locationMap.get(spot.locationId) || 'Unknown',
        earnings: earnings ? Math.round(earnings.earnings) : 0,
        utilization: earnings ? Math.min(100, Math.round((earnings.bookingsCount / 30) * 100)) : 0, // Assume 30 days max
        bookingsCount: earnings ? earnings.bookingsCount : 0,
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown'
      };
    });
    
    // Sort by earnings and return top performers
    return spotPerformance
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
  }

  async getTopEarningOwners(limit: number = 5): Promise<{
    id: string;
    name: string;
    earnings: number;
    spotsCount: number;
    bookingsCount: number;
    averageRating: number;
    email: string;
  }[]> {
    const allBookings = await db.select().from(bookings);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const allSpots = await db.select().from(parkingSpots);
    const allUsers = await db.select().from(users);
    const owners = allUsers.filter(u => u.roles.includes('owner'));
    
    // Group bookings by owner
    const ownerEarnings = new Map<string, { earnings: number; bookingsCount: number }>();
    
    paidBookings.forEach(booking => {
      const current = ownerEarnings.get(booking.ownerId) || { earnings: 0, bookingsCount: 0 };
      current.earnings += parseFloat(booking.totalAmount.toString());
      current.bookingsCount += 1;
      ownerEarnings.set(booking.ownerId, current);
    });
    
    // Calculate performance metrics for each owner
    const ownerPerformance = owners.map(user => {
      const earnings = ownerEarnings.get(user.id);
      const userSpots = allSpots.filter(spot => spot.ownerId === user.id);
      
      // Simulate rating based on performance (simplified)
      const baseRating = 4.2;
      const performanceBonus = earnings ? Math.min(0.8, (earnings.bookingsCount / 50) * 0.5) : 0;
      
      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        earnings: earnings ? Math.round(earnings.earnings) : 0,
        spotsCount: userSpots.length,
        bookingsCount: earnings ? earnings.bookingsCount : 0,
        averageRating: Math.round((baseRating + performanceBonus) * 10) / 10,
        email: user.email || ''
      };
    });
    
    // Sort by earnings and return top performers
    return ownerPerformance
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
  }

  async getActiveIssues(): Promise<{
    id: string;
    type: string;
    priority: string;
    description: string;
    created: string;
    assignee: string;
    status: string;
    entityId?: string;
    entityType?: string;
  }[]> {
    // For now, return simulated issues based on actual data patterns
    // In a real implementation, this would come from an issues/tickets system
    const allBookings = await db.select().from(bookings);
    const allSpots = await db.select().from(parkingSpots);
    const issues = [];
    
    // Find potential payment disputes (unpaid bookings older than 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const unpaidOldBookings = allBookings.filter(booking => 
      !booking.paymentReceived && new Date(booking.createdAt) < weekAgo
    );
    
    unpaidOldBookings.slice(0, 3).forEach((booking, index) => {
      issues.push({
        id: `ISSUE-${String(Date.now() + index).slice(-6)}`,
        type: 'Payment Dispute',
        priority: 'high',
        description: `Booking ${booking.id.slice(-8)} payment overdue by ${Math.ceil((Date.now() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days`,
        created: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assignee: 'Finance Team',
        status: 'open',
        entityId: booking.id,
        entityType: 'booking'
      });
    });
    
    // Find potential double bookings (same spot, same date)
    const dateBookings = new Map<string, { spotId: string; bookings: any[] }>();
    allBookings.forEach(booking => {
      const key = `${booking.spotId}-${booking.bookingDate}`;
      if (!dateBookings.has(key)) {
        dateBookings.set(key, { spotId: booking.spotId, bookings: [] });
      }
      dateBookings.get(key)!.bookings.push(booking);
    });
    
    Array.from(dateBookings.values())
      .filter(item => item.bookings.length > 1)
      .slice(0, 2)
      .forEach((item, index) => {
        const spot = allSpots.find(s => s.id === item.spotId);
        issues.push({
          id: `ISSUE-${String(Date.now() + index + 100).slice(-6)}`,
          type: 'Spot Conflict',
          priority: 'critical',
          description: `Multiple bookings detected for spot ${spot?.spotNumber || item.spotId} on ${item.bookings[0].bookingDate}`,
          created: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          assignee: 'Operations Team',
          status: 'in_progress',
          entityId: item.spotId,
          entityType: 'spot'
        });
      });
    
    // Add a general system alert
    if (issues.length === 0) {
      issues.push({
        id: `ISSUE-${String(Date.now()).slice(-6)}`,
        type: 'System Alert',
        priority: 'low',
        description: 'All systems operating normally',
        created: new Date().toISOString().split('T')[0],
        assignee: 'System',
        status: 'resolved',
      });
    }
    
    return issues.slice(0, 10); // Limit to 10 most recent issues
  }

  async getBookingDurationData(): Promise<{
    duration: string;
    count: number;
    percentage: number;
  }[]> {
    // Get all spot listings and bookings from database
    const allListings = await db.select().from(spotListings);
    const allBookings = await db.select().from(bookings);
    
    // Initialize duration categories
    const durationCategories = {
      "1 Day": 0,
      "2-3 Days": 0,
      "4-7 Days": 0,
      "1-2 Weeks": 0,
      "2-4 Weeks": 0,
      "1+ Months": 0
    };
    
    // Track which bookings we've already processed to avoid double counting
    const processedBookings = new Set<string>();
    
    // Process bookings grouped by listing
    const bookingsByListing = new Map<string, typeof allBookings>();
    allBookings.forEach(booking => {
      const listingBookings = bookingsByListing.get(booking.listingId) || [];
      listingBookings.push(booking);
      bookingsByListing.set(booking.listingId, listingBookings);
    });
    
    // For each listing, calculate duration and categorize
    allListings.forEach(listing => {
      const listingBookings = bookingsByListing.get(listing.id) || [];
      
      // Skip if no bookings for this listing
      if (listingBookings.length === 0) {
        return;
      }
      
      let durationDays = 1; // Default to 1 day
      
      // Calculate duration based on listing type
      if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
        const startDate = new Date(listing.periodStartDate);
        const endDate = new Date(listing.periodEndDate);
        durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      } else if (listing.listingType === 'recurring' && listing.recurringStartDate && listing.recurringEndDate) {
        const startDate = new Date(listing.recurringStartDate);
        const endDate = new Date(listing.recurringEndDate);
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysOfWeek = listing.daysOfWeek?.length || 7;
        durationDays = Math.ceil((totalDays / 7) * daysOfWeek);
      }
      // For 'single' type or others, durationDays remains 1
      
      // Categorize based on duration
      let category: keyof typeof durationCategories;
      if (durationDays === 1) {
        category = "1 Day";
      } else if (durationDays >= 2 && durationDays <= 3) {
        category = "2-3 Days";
      } else if (durationDays >= 4 && durationDays <= 7) {
        category = "4-7 Days";
      } else if (durationDays >= 8 && durationDays <= 14) {
        category = "1-2 Weeks";
      } else if (durationDays >= 15 && durationDays <= 28) {
        category = "2-4 Weeks";
      } else {
        category = "1+ Months";
      }
      
      // Count each renter's booking in this listing once
      const uniqueRenters = new Set(listingBookings.map(b => b.renterId));
      durationCategories[category] += uniqueRenters.size;
    });
    
    // Calculate total count
    const totalCount = Object.values(durationCategories).reduce((sum, count) => sum + count, 0);
    
    // Convert to array with percentages
    return Object.entries(durationCategories).map(([duration, count]) => ({
      duration,
      count,
      percentage: totalCount > 0 ? Math.round((count / totalCount) * 100 * 10) / 10 : 0
    }));
  }

  async getLocationPerformanceData(): Promise<{
    location: string;
    spotsCount: number;
    utilization: number;
    earnings: number;
    averageRate: number;
  }[]> {
    const allSpots = await db.select().from(parkingSpots);
    const allBookings = await db.select().from(bookings);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const allLocations = await db.select().from(locations);
    
    // Create location map
    const locationMap = new Map(allLocations.map(loc => [loc.id, `${loc.office} - ${loc.building}, ${loc.level}`]));
    
    // Group by location
    const locationStats = new Map<string, {
      spots: number;
      bookings: number;
      earnings: number;
      totalRates: number;
    }>();
    
    // Count spots by location
    allSpots.forEach(spot => {
      const locationName = locationMap.get(spot.locationId) || 'Unknown';
      const current = locationStats.get(locationName) || {
        spots: 0, bookings: 0, earnings: 0, totalRates: 0
      };
      current.spots += 1;
      locationStats.set(locationName, current);
    });
    
    // Add booking data
    paidBookings.forEach(booking => {
      const spot = allSpots.find(s => s.id === booking.spotId);
      if (spot) {
        const locationName = locationMap.get(spot.locationId) || 'Unknown';
        const current = locationStats.get(locationName)!;
        current.bookings += 1;
        current.earnings += parseFloat(booking.totalAmount.toString());
        current.totalRates += parseFloat(booking.dailyRate.toString());
        locationStats.set(locationName, current);
      }
    });
    
    // Convert to array and calculate metrics
    return Array.from(locationStats.entries()).map(([location, stats]) => ({
      location,
      spotsCount: stats.spots,
      utilization: stats.spots > 0 ? Math.round((stats.bookings / (stats.spots * 30)) * 100) : 0,
      earnings: Math.round(stats.earnings),
      averageRate: stats.bookings > 0 ? Math.round((stats.totalRates / stats.bookings) * 100) / 100 : 0
    }))
    .sort((a, b) => b.earnings - a.earnings);
  }

  async getWeeklyTrendsData(): Promise<{
    dayOfWeek: string;
    bookings: number;
    utilization: number;
  }[]> {
    const allBookings = await db.select().from(bookings);
    const allSpots = await db.select().from(parkingSpots);
    const totalBookableSpots = allSpots.filter(spot => spot.isBookable).length;
    
    // Get bookings from the last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const recentBookings = allBookings.filter(booking => {
      const bookingDate = new Date(booking.bookingDate);
      return bookingDate >= fourWeeksAgo;
    });
    
    // Group bookings by day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = new Map<number, { bookings: number; count: number }>();
    
    // Initialize all days
    for (let i = 0; i < 7; i++) {
      dayStats.set(i, { bookings: 0, count: 0 });
    }
    
    // Count bookings per day of week
    recentBookings.forEach(booking => {
      const bookingDate = new Date(booking.bookingDate);
      const dayOfWeek = bookingDate.getDay();
      const stats = dayStats.get(dayOfWeek)!;
      stats.bookings += 1;
      stats.count += 1;
    });
    
    // Calculate averages and utilization for each day
    return dayNames.map((dayName, index) => {
      const stats = dayStats.get(index)!;
      const averageBookings = stats.count > 0 ? Math.round(stats.bookings / 4) : 0; // Average over 4 weeks
      const utilization = totalBookableSpots > 0 
        ? Math.round((averageBookings / totalBookableSpots) * 100)
        : 0;
      
      return {
        dayOfWeek: dayName,
        bookings: averageBookings,
        utilization: Math.min(100, utilization)
      };
    });
  }

  async getUserAnalytics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    mostActiveDepartment: string;
  }> {
    const allUsers = await db.select().from(users);
    const allDepartments = await db.select().from(departments);
    
    // Create department map
    const departmentMap = new Map(allDepartments.map(dept => [dept.id, dept.name]));
    
    // Calculate total users
    const totalUsers = allUsers.length;
    
    // Calculate active users (those with recent login within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = allUsers.filter(user => 
      user.lastLogin && new Date(user.lastLogin) >= thirtyDaysAgo
    ).length;
    
    // Calculate new users this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersThisWeek = allUsers.filter(user => 
      user.createdAt && new Date(user.createdAt) >= oneWeekAgo
    ).length;
    
    // Calculate most active department
    const departmentCounts = allUsers.reduce((acc, user) => {
      if (user.departmentId) {
        const deptName = departmentMap.get(user.departmentId) || 'Unknown';
        acc[deptName] = (acc[deptName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const mostActiveDepartment = Object.entries(departmentCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([dept]) => dept)[0] || "N/A";
    
    return {
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      mostActiveDepartment
    };
  }

  async getAdminDashboardMetrics(): Promise<{
    todaysOccupancy: {
      occupiedSpots: number;
      totalBookableSpots: number;
      utilizationPercent: number;
    };
    pendingIssues: number;
    revenueToday: number;
    newRegistrations: number;
  }> {
    // Import date-fns functions for date handling
    const { format, subDays } = await import('date-fns');
    
    // Get today's date in YYYY-MM-DD format
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // 1. Get today's bookings from database
    const allBookings = await db.select().from(bookings);
    const todaysBookings = allBookings.filter(
      booking => booking.bookingDate === today && booking.status === 'confirmed'
    );
    
    // Count unique spot IDs using Set
    const uniqueSpotIds = new Set(todaysBookings.map(booking => booking.spotId));
    const occupiedSpots = uniqueSpotIds.size;
    
    // 2. Get total bookable spots from database
    const allSpots = await db.select().from(parkingSpots);
    const totalBookableSpots = allSpots.filter(spot => spot.isBookable === true).length;
    
    // Calculate utilization percentage (clamped 0-100)
    let utilizationPercent = 0;
    if (totalBookableSpots > 0) {
      utilizationPercent = Math.round((occupiedSpots / totalBookableSpots) * 100);
      utilizationPercent = Math.max(0, Math.min(100, utilizationPercent)); // Clamp to 0-100
    }
    
    // 3. Get waiting list entries from database
    const waitingListEntries = await db.select().from(waitingList);
    const pendingIssues = waitingListEntries.filter(
      entry => entry.status === 'active' && entry.priority === 1
    ).length;
    
    // 4. Calculate Revenue Today (bookings with today's date AND paymentReceived === true)
    const revenueToday = todaysBookings
      .filter(booking => booking.paymentReceived === true)
      .reduce((sum, booking) => {
        const amount = parseFloat(booking.totalAmount.toString());
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
    
    // 5. Get new registrations from database
    const sevenDaysAgo = subDays(new Date(), 7);
    const allUsers = await db.select().from(users);
    const newRegistrations = allUsers.filter(user => {
      if (!user.createdAt) return false;
      const userCreatedDate = new Date(user.createdAt);
      return userCreatedDate >= sevenDaysAgo;
    }).length;
    
    return {
      todaysOccupancy: {
        occupiedSpots,
        totalBookableSpots,
        utilizationPercent
      },
      pendingIssues,
      revenueToday,
      newRegistrations
    };
  }

  // Notification Preferences operations
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const result = await db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    
    if (result.length === 0) {
      // Create default preferences for user
      const [newPrefs] = await db.insert(notificationPreferences).values({
        userId,
        emailNotifications: true,
        bookingConfirmations: true,
        paymentReminders: true,
        spotAvailability: true,
        weeklyReports: true,
        systemMaintenance: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Update memory cache
      this.notificationPreferences.set(userId, newPrefs);
      return newPrefs;
    }
    
    // Update memory cache
    this.notificationPreferences.set(userId, result[0]);
    return result[0];
  }

  async updateNotificationPreferences(userId: string, updates: UpdateNotificationPreferences): Promise<NotificationPreferences> {
    // Get existing preferences or create defaults (this will also create in database if not exists)
    const existingPreferences = await this.getNotificationPreferences(userId);
    
    if (!existingPreferences) {
      throw new Error('Failed to get or create notification preferences');
    }
    
    // Update in database
    const [updated] = await db.update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    
    // Update memory cache
    this.notificationPreferences.set(userId, updated);
    return updated;
  }

  // In-App Notifications operations
  async createInAppNotification(insertNotification: InsertInAppNotification): Promise<InAppNotification> {
    const insertData = {
      userId: insertNotification.userId,
      type: insertNotification.type as NotificationType,
      title: insertNotification.title,
      message: insertNotification.message,
      ...(insertNotification.data !== undefined && { data: insertNotification.data }),
      ...(insertNotification.read !== undefined && { read: insertNotification.read }),
      ...(insertNotification.expiresAt !== undefined && { expiresAt: insertNotification.expiresAt })
    };
    
    const [notification] = await db.insert(inAppNotifications).values(insertData).returning();
    
    // Update memory cache
    this.inAppNotifications.set(notification.id, notification);
    return notification;
  }

  async getInAppNotifications(userId: string, includeRead: boolean = false): Promise<InAppNotification[]> {
    let notifications;
    
    if (!includeRead) {
      notifications = await db.select()
        .from(inAppNotifications)
        .where(and(
          eq(inAppNotifications.userId, userId),
          eq(inAppNotifications.read, false)
        ))
        .orderBy(desc(inAppNotifications.createdAt));
    } else {
      notifications = await db.select()
        .from(inAppNotifications)
        .where(eq(inAppNotifications.userId, userId))
        .orderBy(desc(inAppNotifications.createdAt));
    }
    
    // Update memory cache
    notifications.forEach(notification => this.inAppNotifications.set(notification.id, notification));
    return notifications;
  }

  async markNotificationAsRead(notificationId: string): Promise<InAppNotification> {
    const existing = await db.select().from(inAppNotifications).where(eq(inAppNotifications.id, notificationId)).limit(1);
    if (existing.length === 0) {
      throw new Error(`Notification ${notificationId} not found`);
    }
    
    const [updated] = await db.update(inAppNotifications)
      .set({ read: true })
      .where(eq(inAppNotifications.id, notificationId))
      .returning();
    
    // Update memory cache
    this.inAppNotifications.set(notificationId, updated);
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(inAppNotifications)
      .set({ read: true })
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.read, false)
      ));
    
    // Clear memory cache for this user's notifications to force reload
    const userNotificationIds = Array.from(this.inAppNotifications.entries())
      .filter(([_, notif]) => notif.userId === userId)
      .map(([id]) => id);
    userNotificationIds.forEach(id => this.inAppNotifications.delete(id));
  }

  async deleteInAppNotification(notificationId: string): Promise<void> {
    await db.delete(inAppNotifications).where(eq(inAppNotifications.id, notificationId));
    
    // Also delete from memory cache
    this.inAppNotifications.delete(notificationId);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() })
      .from(inAppNotifications)
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.read, false)
      ));
    
    return Number(result[0]?.count ?? 0);
  }

  // Spot Booking Management methods
  async getBookingAvailability(): Promise<Array<SpotListing & { spot: ParkingSpot }>> {
    const today = new Date().toISOString().split('T')[0];
    
    const availableListings = await db
      .select()
      .from(spotListings)
      .where(
        and(
          eq(spotListings.status, 'active'),
          or(
            sqlOp`${spotListings.periodEndDate} >= ${today}`,
            sqlOp`${spotListings.recurringEndDate} >= ${today}`,
            sqlOp`${spotListings.singleDate} >= ${today}`
          )
        )
      )
      .orderBy(
        sqlOp`COALESCE(${spotListings.periodStartDate}, ${spotListings.recurringStartDate}, ${spotListings.singleDate})`
      );
    
    const enrichedListings = await Promise.all(
      availableListings.map(async (listing) => {
        const [spot] = await db.select().from(parkingSpots).where(eq(parkingSpots.id, listing.spotId)).limit(1);
        return { ...listing, spot: spot! };
      })
    );
    
    return enrichedListings;
  }

  async getPendingPaymentBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>> {
    const pendingBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.paymentReceived, false),
          sqlOp`${bookings.status} != 'cancelled'`
        )
      )
      .orderBy(desc(bookings.createdAt));
    
    const enrichedBookings = await Promise.all(
      pendingBookings.map(async (booking) => {
        const [spot] = await db.select().from(parkingSpots).where(eq(parkingSpots.id, booking.spotId)).limit(1);
        const [user] = await db.select().from(users).where(eq(users.id, booking.renterId)).limit(1);
        return { ...booking, spot: spot!, user: user! };
      })
    );
    
    return enrichedBookings;
  }

  async getActiveBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>> {
    const today = new Date().toISOString().split('T')[0];
    
    const activeBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          or(
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'pending')
          ),
          sqlOp`${bookings.bookingDate} >= ${today}`
        )
      )
      .orderBy(asc(bookings.bookingDate));
    
    const enrichedBookings = await Promise.all(
      activeBookings.map(async (booking) => {
        const [spot] = await db.select().from(parkingSpots).where(eq(parkingSpots.id, booking.spotId)).limit(1);
        const [user] = await db.select().from(users).where(eq(users.id, booking.renterId)).limit(1);
        return { ...booking, spot: spot!, user: user! };
      })
    );
    
    return enrichedBookings;
  }

  async getPastBookings(): Promise<Array<Booking & { spot: ParkingSpot; user: User }>> {
    const today = new Date().toISOString().split('T')[0];
    
    const pastBookings = await db
      .select()
      .from(bookings)
      .where(
        or(
          sqlOp`${bookings.bookingDate} < ${today}`,
          eq(bookings.status, 'completed'),
          eq(bookings.status, 'cancelled')
        )
      )
      .orderBy(desc(bookings.bookingDate));
    
    const enrichedBookings = await Promise.all(
      pastBookings.map(async (booking) => {
        const [spot] = await db.select().from(parkingSpots).where(eq(parkingSpots.id, booking.spotId)).limit(1);
        const [user] = await db.select().from(users).where(eq(users.id, booking.renterId)).limit(1);
        return { ...booking, spot: spot!, user: user! };
      })
    );
    
    return enrichedBookings;
  }

  // Dispute operations
  async createDispute(insertDispute: InsertDispute): Promise<Dispute> {
    const id = randomUUID();
    const now = new Date();
    
    const [dispute] = await db.insert(disputes).values({
      id,
      ...insertDispute,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return dispute;
  }

  async getDisputes(filters?: { status?: DisputeStatus; bookingId?: string }): Promise<Dispute[]> {
    let query = db.select().from(disputes);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(disputes.status, filters.status));
    }
    if (filters?.bookingId) {
      conditions.push(eq(disputes.bookingId, filters.bookingId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(disputes.createdAt));
  }

  async getDisputeById(id: string): Promise<Dispute | undefined> {
    const result = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    return result[0];
  }

  async updateDispute(id: string, updates: Partial<InsertDispute>): Promise<Dispute | undefined> {
    const existing = await db.select().from(disputes).where(eq(disputes.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(disputes)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(disputes.id, id))
      .returning();
    
    return updated[0];
  }

  async resolveDispute(id: string, resolvedBy: string, resolutionNotes: string, refundAmount?: string): Promise<Dispute | undefined> {
    const existing = await db.select().from(disputes).where(eq(disputes.id, id));
    if (existing.length === 0) return undefined;
    
    const now = new Date();
    
    const updated = await db.update(disputes)
      .set({
        status: 'resolved' as DisputeStatus,
        resolvedBy,
        resolutionNotes,
        refundAmount: refundAmount || null,
        resolvedAt: now,
        updatedAt: now
      })
      .where(eq(disputes.id, id))
      .returning();
    
    return updated[0];
  }

  // Spot Listing Admin operations
  async updateSpotListingStatus(id: string, status: ListingStatus): Promise<SpotListing | undefined> {
    const existing = await db.select().from(spotListings).where(eq(spotListings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(spotListings)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(spotListings.id, id))
      .returning();
    
    return updated[0];
  }

  async cancelSpotListing(id: string, reason: string): Promise<SpotListing | undefined> {
    const existing = await db.select().from(spotListings).where(eq(spotListings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(spotListings)
      .set({
        status: 'cancelled' as ListingStatus,
        adminNotes: reason,
        updatedAt: new Date()
      })
      .where(eq(spotListings.id, id))
      .returning();
    
    return updated[0];
  }

  async addSpotListingAdminNotes(id: string, notes: string): Promise<SpotListing | undefined> {
    const existing = await db.select().from(spotListings).where(eq(spotListings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(spotListings)
      .set({
        adminNotes: notes,
        updatedAt: new Date()
      })
      .where(eq(spotListings.id, id))
      .returning();
    
    return updated[0];
  }

  // Booking Admin operations
  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking | undefined> {
    const existing = await db.select().from(bookings).where(eq(bookings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(bookings)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated[0];
  }

  async cancelBookingWithReason(id: string, reason: string): Promise<Booking | undefined> {
    const existing = await db.select().from(bookings).where(eq(bookings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(bookings)
      .set({
        status: 'cancelled' as BookingStatus,
        cancellationReason: reason,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated[0];
  }

  async markPaymentRefunded(id: string, refundAmount: string): Promise<Booking | undefined> {
    const existing = await db.select().from(bookings).where(eq(bookings.id, id));
    if (existing.length === 0) return undefined;
    
    const now = new Date();
    
    const updated = await db.update(bookings)
      .set({
        paymentRefundedAt: now,
        refundAmount,
        updatedAt: now
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated[0];
  }

  async addBookingAdminNotes(id: string, notes: string): Promise<Booking | undefined> {
    const existing = await db.select().from(bookings).where(eq(bookings.id, id));
    if (existing.length === 0) return undefined;
    
    const updated = await db.update(bookings)
      .set({
        adminNotes: notes,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated[0];
  }

  // Audit decorators will be applied via server initialization
}

// Initialize storage and audit system 
import { auditStorage } from "./audit-storage";
import { auditService } from "./audit-service";

const storage = new MemStorage();
storage.setAuditStorage(auditStorage);
auditService.setStorage(storage);

export { storage };
