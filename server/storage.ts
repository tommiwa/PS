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
  type BookingAvailabilityData,
  type AdminBookingData,
  type PendingPaymentData,
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
  type BookingSubscription,
  type InsertBookingSubscription,
  type UpdateBookingSubscription,
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
  type InsertSpotType,
  type TermsVersion,
  type InsertTermsVersion,
  type SpotAssignmentHistory,
  type InsertSpotAssignmentHistory,
  type SpotAssignmentHistoryWithDetails,
  type Locker,
  type InsertLocker,
  type LockerWaitlist,
  type InsertLockerWaitlist,
  type LockerAssignmentHistory,
  type InsertLockerAssignmentHistory,
  type LockerType,
  type AppConfig,
  type InsertAppConfig,
  type ApiKey,
  type InsertApiKey,
  type ScheduledSpotAssignment,
  type InsertScheduledSpotAssignment,
  type ScheduledAssignmentStatus,
  type FeatureAnnouncement,
  type InsertFeatureAnnouncement,
  type UpdateFeatureAnnouncement,
  type SpotAlertSubscription,
  type UpdateSpotAlertSubscription,
  type SaleEvent,
  type InsertSaleEvent,
  type SaleEventStatus
} from "@shared/schema";
import { randomUUID } from "crypto";
import { auditDecorator } from "./audit-service";
import { type IAuditStorage } from "./audit-storage";
import { db } from "./db";
import { spotListings, parkingSpots, users, waitingList, departments, bookings, disputes, vehicles, inAppNotifications, notificationPreferences, paymentPreferences, bookingSubscriptions, locations, spotTypesTable, termsVersions, spotAssignmentHistory, spotLocks, lockers, lockerWaitlist, lockerAssignmentHistory, lockerTypesTable, appConfigs, apiKeys, scheduledSpotAssignments, featureAnnouncements, spotAlertSubscriptions, saleEvents, issues } from "@shared/schema";
import { eq, or, ilike, asc, and, notExists, sql as sqlOp, count, desc, inArray, isNull } from "drizzle-orm";

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
  searchUsers(query: string): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'departmentId'>[]>;

  // Parking Spot operations
  getParkingSpot(id: string): Promise<ParkingSpot | undefined>;
  getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]>;
  getAllParkingSpots(): Promise<ParkingSpot[]>;
  createParkingSpot(spot: InsertParkingSpot): Promise<ParkingSpot>;
  updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined>;
  deleteParkingSpot(id: string): Promise<boolean>;
  
  // Cleanup methods for parking spot deletion
  deleteSpotAssignmentHistoryBySpotId(spotId: string): Promise<number>;
  deleteSpotLocksBySpotId(spotId: string): Promise<number>;
  softDeleteListingsBySpotId(spotId: string): Promise<number>;
  
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
  bulkCreateSpotListings(spotIds: string[], listingData: Omit<InsertSpotListing, 'spotId' | 'ownerId'>, ownerId: string): Promise<SpotListing[]>;
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
  updateBooking(id: string, updates: Partial<typeof bookings.$inferInsert>): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<boolean>;
  // Payment marking functionality
  markPaymentReceived(id: string, paymentReceived: boolean): Promise<Booking | undefined>;
  updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Booking | undefined>;

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
  deleteAllUserNotifications(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Payment Preferences operations
  getPaymentPreferences(userId: string): Promise<PaymentPreferences | undefined>;
  createPaymentPreferences(userId: string, preferences: InsertPaymentPreferences): Promise<PaymentPreferences>;
  updatePaymentPreferences(userId: string, updates: UpdatePaymentPreferences): Promise<PaymentPreferences>;
  deletePaymentPreferences(userId: string): Promise<boolean>;
  
  // Booking Subscription operations
  getBookingSubscription(userId: string): Promise<BookingSubscription | undefined>;
  upsertBookingSubscription(userId: string, updates: UpdateBookingSubscription): Promise<BookingSubscription>;
  
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
  
  // Terms and Conditions operations
  getActiveTermsVersion(): Promise<TermsVersion | undefined>;
  getAllTermsVersions(): Promise<TermsVersion[]>;
  createTermsVersion(termsVersion: InsertTermsVersion): Promise<TermsVersion>;
  acceptTerms(userId: string, version: number): Promise<User | undefined>;
  
  // Audit storage operations (delegated to audit storage)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  queryAuditLogs(filters: any, pagination: any): Promise<any>;
  
  // Analytics query methods
  getAnalyticsOverview(scope?: 'bci' | 'all', fromDate?: string, toDate?: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    activeUsers: number;
    utilizationRate: number;
    averageBookingValue: number;
    monthlyGrowth: number;
  }>;
  getMonthlyRevenueData(monthsBack?: number, scope?: 'bci' | 'all'): Promise<{
    month: string;
    revenue: number;
    bookings: number;
    year: number;
  }[]>;
  getRevenueBreakdown(scope?: 'bci' | 'all'): Promise<{
    ownerEarnings: number;
    bciRevenue: number;
    ownerEarningsPercentage: number;
    bciRevenuePercentage: number;
  }>;
  getTopPerformingSpots(limit?: number, scope?: 'bci' | 'all'): Promise<{
    id: string;
    spotNumber: string;
    location: string;
    earnings: number;
    utilization: number;
    bookingsCount: number;
    ownerName: string;
  }[]>;
  getTopEarningOwners(limit?: number, scope?: 'bci' | 'all'): Promise<{
    id: string;
    name: string;
    earnings: number;
    spotsCount: number;
    bookingsCount: number;
    averageRating: number;
    email: string;
  }[]>;
  getActiveIssues(scope?: 'bci' | 'all'): Promise<{
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
  getBookingDurationData(scope?: 'bci' | 'all'): Promise<{
    duration: string;
    count: number;
    percentage: number;
  }[]>;
  getLocationPerformanceData(scope?: 'bci' | 'all'): Promise<{
    location: string;
    spotsCount: number;
    utilization: number;
    earnings: number;
    averageRate: number;
  }[]>;
  getWeeklyTrendsData(scope?: 'bci' | 'all'): Promise<{
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
  getBookingAvailability(isBciOnly?: boolean, page?: number, limit?: number, filters?: { search?: string; listingType?: string; location?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: BookingAvailabilityData[]; total: number; page: number; limit: number; totalPages: number }>;
  getPendingPaymentBookings(isBciOnly?: boolean, page?: number, limit?: number, filters?: { search?: string; location?: string; daysOverdue?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: PendingPaymentData[]; total: number; page: number; limit: number; totalPages: number }>;
  getActiveBookings(isBciOnly?: boolean, page?: number, limit?: number, filters?: { search?: string; status?: string; location?: string; dateFrom?: string; dateTo?: string; role?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: AdminBookingData[]; total: number; page: number; limit: number; totalPages: number }>;
  getPastBookings(isBciOnly?: boolean, page?: number, limit?: number, payrollPeriod?: string, filters?: { search?: string; status?: string; location?: string; dateFrom?: string; dateTo?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: AdminBookingData[]; total: number; page: number; limit: number; totalPages: number }>;
  
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
  
  // Spot Assignment History operations
  recordSpotAssignment(data: InsertSpotAssignmentHistory): Promise<void>;
  getSpotAssignmentHistory(filters: { from?: string; to?: string; action?: string; departmentId?: number; scope?: 'bci' | 'all' }): Promise<SpotAssignmentHistoryWithDetails[]>;
  
  // Locker Management operations
  getAllLockers(): Promise<Locker[]>;
  getLockerById(id: string): Promise<Locker | null>;
  getLockersByLocation(locationId: number): Promise<Locker[]>;
  createLocker(data: InsertLocker): Promise<Locker>;
  updateLocker(id: string, data: Partial<InsertLocker>): Promise<Locker | null>;
  deleteLocker(id: string): Promise<void>;
  assignLocker(lockerId: string, userId: string, actorId: string, effectiveDate: string, notes?: string): Promise<Locker | null>;
  unassignLocker(lockerId: string, actorId: string, effectiveDate: string, notes?: string): Promise<Locker | null>;
  
  // Locker Waitlist operations
  getLockerWaitlist(): Promise<LockerWaitlist[]>;
  addToLockerWaitlist(data: InsertLockerWaitlist): Promise<LockerWaitlist>;
  updateLockerWaitlistStatus(id: string, status: string, fulfilledAt?: Date): Promise<LockerWaitlist | null>;
  removeFromLockerWaitlist(id: string): Promise<void>;
  
  // Locker Assignment History operations
  getLockerAssignmentHistory(lockerId?: string, userId?: string): Promise<LockerAssignmentHistory[]>;
  recordLockerAssignment(data: InsertLockerAssignmentHistory): Promise<LockerAssignmentHistory>;
  
  // Locker Type operations
  getAllLockerTypes(): Promise<LockerType[]>;
  
  // App Configuration operations
  getAllAppConfigs(): Promise<AppConfig[]>;
  getAppConfig(key: string): Promise<AppConfig | undefined>;
  getAppConfigValue(key: string): Promise<string | undefined>;
  updateAppConfig(key: string, value: string, updatedBy?: string): Promise<AppConfig | undefined>;
  createAppConfig(config: InsertAppConfig): Promise<AppConfig>;
  deleteAppConfig(key: string): Promise<boolean>;
  
  // API Key operations (system-wide keys)
  createApiKey(data: { keyHash: string; keyPrefix: string; name: string }): Promise<ApiKey>;
  getAllApiKeys(): Promise<ApiKey[]>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  revokeApiKeyAdmin(id: string): Promise<boolean>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  
  // Scheduled Spot Assignment operations
  createScheduledAssignment(data: InsertScheduledSpotAssignment): Promise<ScheduledSpotAssignment>;
  getScheduledAssignments(spotId?: string): Promise<ScheduledSpotAssignment[]>;
  getScheduledAssignment(id: string): Promise<ScheduledSpotAssignment | undefined>;
  updateScheduledAssignment(id: string, updates: Partial<InsertScheduledSpotAssignment> & { status?: ScheduledAssignmentStatus }): Promise<ScheduledSpotAssignment | undefined>;
  getPendingScheduledAssignmentsDue(): Promise<ScheduledSpotAssignment[]>;
  cancelSpotPendingScheduledAssignments(spotId: string): Promise<number>;

  // Feature Announcements operations
  getAllAnnouncements(): Promise<FeatureAnnouncement[]>;
  getUnseenAnnouncements(userId: string): Promise<FeatureAnnouncement[]>;
  dismissAnnouncements(userId: string): Promise<void>;
  createAnnouncement(data: InsertFeatureAnnouncement): Promise<FeatureAnnouncement>;
  updateAnnouncement(id: number, updates: UpdateFeatureAnnouncement): Promise<FeatureAnnouncement | undefined>;
  deleteAnnouncement(id: number): Promise<boolean>;

  // Spot Alert Subscription operations
  getSpotAlertSubscription(userId: string): Promise<SpotAlertSubscription | undefined>;
  upsertSpotAlertSubscription(userId: string, data: UpdateSpotAlertSubscription): Promise<SpotAlertSubscription>;
  getActiveSpotAlertSubscribers(): Promise<SpotAlertSubscription[]>;

  // Sale Event operations
  getAllSaleEvents(): Promise<SaleEvent[]>;
  getSaleEvent(id: string): Promise<SaleEvent | undefined>;
  createSaleEvent(data: InsertSaleEvent & { createdBy?: string }): Promise<SaleEvent>;
  updateSaleEvent(id: string, updates: Partial<InsertSaleEvent> & { status?: SaleEventStatus; affectedListingCount?: number }): Promise<SaleEvent | undefined>;
  deleteSaleEvent(id: string): Promise<boolean>;
  // Preview how many BCI-managed listings would be affected by a sale event
  previewSaleEventListings(startDate: string, endDate: string): Promise<{ count: number; listingIds: string[] }>;
  // Activate sale: reprice affected WPS listings and return updated ones
  activateSaleEvent(id: string): Promise<{ updatedListings: Array<{ id: string; spotId: string; dailyRate: string; originalDailyRate: string | null }> }>;
  // Deactivate sale: restore original prices for affected listings
  deactivateSaleEvent(id: string): Promise<{ restoredCount: number }>;
}

export class MemStorage implements IStorage {
  private auditStorage: IAuditStorage;

  constructor(auditStorage?: IAuditStorage) {
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
      // One-time migration: clear any rating values stored against issue-mode submissions.
      // Issue-mode entries should never have a rating; nullify any legacy data.
      const staleCount = await db
        .select({ count: sqlOp<number>`count(*)` })
        .from(issues)
        .where(and(eq(issues.mode, "issue"), sqlOp`${issues.rating} IS NOT NULL`));
      const staleRatingCount = Number(staleCount[0]?.count ?? 0);
      if (staleRatingCount > 0) {
        await db
          .update(issues)
          .set({ rating: null })
          .where(and(eq(issues.mode, "issue"), sqlOp`${issues.rating} IS NOT NULL`));
        console.log(`[startup] Cleared stale ratings from ${staleRatingCount} issue-mode submission(s)`);
      }

      // In production, remove any seed-admin listings that may have been created by mistake
      if (process.env.NODE_ENV === 'production') {
        const removed = await db.delete(spotListings).where(eq(spotListings.ownerId, 'seed-admin')).returning({ id: spotListings.id });
        if (removed.length > 0) {
          console.log(`[startup] Removed ${removed.length} sample seed listing(s) from production database`);
        }
      }

      // Check if parking spots already exist in database
      const existingSpots = await db.select().from(parkingSpots).limit(1);
      
      if (existingSpots.length > 0) {
        // Database already has spots - check if we need to add sample deal-tier listings (dev only)
        if (process.env.NODE_ENV !== 'production') {
          const existingSeedListings = await db.select().from(spotListings)
            .where(eq(spotListings.ownerId, 'seed-admin')).limit(1);
          if (existingSeedListings.length === 0) {
            console.log('Adding sample deal-tier listings to existing spots...');
            await this.createSampleDealListings();
          } else {
            console.log('Database already contains parking spots and sample listings, skipping seed data');
          }
        } else {
          console.log('Database already contains parking spots, skipping seed data');
        }
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

      if (process.env.NODE_ENV !== 'production') {
        await this.createSampleDealListings();
      }
    } catch (error) {
      console.error('Error initializing seed data:', error);
      // Don't throw - let the application continue even if seed fails
    }
  }

  private async createSampleDealListings() {
    try {
      const sampleSpots = await db.select().from(parkingSpots).limit(10);
      if (sampleSpots.length < 10) {
        console.log('Not enough spots for sample deal listings');
        return;
      }

      const today = new Date();
      const sampleListings = [
        { spotId: sampleSpots[0].id, dailyRate: "0.00", notes: "Free spot" },
        { spotId: sampleSpots[1].id, dailyRate: "3.00", notes: "Steal deal" },
        { spotId: sampleSpots[2].id, dailyRate: "5.00", notes: "Steal deal" },
        { spotId: sampleSpots[3].id, dailyRate: "7.00", notes: "Hot deal" },
        { spotId: sampleSpots[4].id, dailyRate: "10.00", notes: "Hot deal" },
        { spotId: sampleSpots[5].id, dailyRate: "11.00", notes: "Top deal" },
        { spotId: sampleSpots[6].id, dailyRate: "12.00", notes: "Top deal" },
        { spotId: sampleSpots[7].id, dailyRate: "15.00", notes: "Regular price" },
        { spotId: sampleSpots[8].id, dailyRate: "4.00", notes: "Steal deal - charity", donateToCharity: true },
        { spotId: sampleSpots[9].id, dailyRate: "8.00", notes: "Hot deal - charity", donateToCharity: true },
      ];

      for (const listing of sampleListings) {
        for (let d = 0; d < 5; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() + d);
          const dateStr = date.toISOString().split('T')[0];
          await db.insert(spotListings).values({
            spotId: listing.spotId,
            ownerId: "seed-admin",
            listingType: "single" as any,
            singleDate: dateStr,
            dailyRate: listing.dailyRate,
            status: "available" as any,
            notes: listing.notes,
            donateToCharity: (listing as any).donateToCharity ?? false,
            createdByAdmin: true,
          });
        }
      }
      console.log('Successfully created sample deal-tier listings for 10 spots across 5 days');
    } catch (error) {
      console.error('Error creating sample deal listings:', error);
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
    
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) return undefined;
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
      
      return newUser;
    } else {
      // UPDATE existing user
      const existingUser = existing[0];
      
      const [updated] = await db.update(users)
        .set({
          email: userData.email ?? existingUser.email,
          firstName: userData.firstName || existingUser.firstName,
          lastName: userData.lastName || existingUser.lastName,
          profileImageUrl: userData.profileImageUrl ?? existingUser.profileImageUrl,
          lastLogin: now,
          updatedAt: now
        })
        .where(eq(users.id, userData.id))
        .returning();
      
      return updated;
    }
  }

  async getAllUsers(includeDeleted: boolean = false): Promise<User[]> {
    let query = db.select().from(users);
    
    // By default, exclude deleted users
    if (!includeDeleted) {
      query = query.where(sqlOp`${users.status} != 'deleted'`) as any;
    }
    
    return await query;
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
    
    return result[0];
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
    
    return result.length > 0;
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

  async searchUsers(query: string): Promise<Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'departmentId'>[]> {
    const lowerQuery = `%${query.toLowerCase()}%`;
    
    const results = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        departmentId: users.departmentId,
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
      departmentId: r.departmentId ?? null,
    }));
  }

  // Parking Spot operations
  async getParkingSpot(id: string): Promise<ParkingSpot | undefined> {
    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id));
    return spots[0];
  }

  async getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]> {
    return await db.select().from(parkingSpots).where(eq(parkingSpots.ownerId, ownerId));
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
    return await db.select().from(parkingSpots);
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
    const enrichedSpot: ParkingSpotWithUser = { 
      ...spot,
      // Always initialize user fields (will be null for unassigned spots, preserved in JSON)
      assignedUserName: null as any,
      assignedUserEmail: null as any,
      assignedUserDepartment: null as any
    };
    
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
    
    // Join reserved department name if set
    if (spot.reservedForDepartmentId) {
      const reservedDeptResult = await db
        .select({ name: departments.name })
        .from(departments)
        .where(eq(departments.id, spot.reservedForDepartmentId))
        .limit(1);
      
      if (reservedDeptResult.length > 0) {
        enrichedSpot.reservedForDepartmentName = reservedDeptResult[0].name;
      }
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
      }
    }
    
    return enrichedSpot;
  }

  // Safe enriched parking spot methods (without sensitive user data)
  async getParkingSpotWithSafeUserData(id: string): Promise<ParkingSpotWithSafeUserData | undefined> {
    // Query database first
    const result = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id)).limit(1);
    if (result.length === 0) return undefined;

    return this.enrichSpotWithSafeUserInfo(result[0]);
  }

  async getAllParkingSpotsWithSafeUserData(): Promise<ParkingSpotWithSafeUserData[]> {
    const spots = await db.select().from(parkingSpots);
    return Promise.all(spots.map(spot => this.enrichSpotWithSafeUserInfo(spot)));
  }

  // Helper method to safely enrich parking spot with minimal user information
  private async enrichSpotWithSafeUserInfo(spot: ParkingSpot): Promise<ParkingSpotWithSafeUserData> {
    const enrichedSpot: ParkingSpotWithSafeUserData = { ...spot };
    
    // Join location details to construct name and get floor plan URL
    const locationResult = await db
      .select({ 
        office: locations.office,
        building: locations.building,
        level: locations.level,
        floorPlanBaseUrl: locations.floorPlanBaseUrl
      })
      .from(locations)
      .where(eq(locations.id, spot.locationId))
      .limit(1);
    
    if (locationResult.length > 0) {
      const loc = locationResult[0];
      enrichedSpot.locationName = `${loc.office} - ${loc.building}, ${loc.level}`;
      enrichedSpot.floorPlanBaseUrl = loc.floorPlanBaseUrl;
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
    
    // Join reserved department name if set
    if (spot.reservedForDepartmentId) {
      const reservedDeptResult = await db
        .select({ name: departments.name })
        .from(departments)
        .where(eq(departments.id, spot.reservedForDepartmentId))
        .limit(1);
      
      if (reservedDeptResult.length > 0) {
        enrichedSpot.reservedForDepartmentName = reservedDeptResult[0].name;
      }
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
        enrichedSpot.assignedUserDepartment = department?.name || undefined;
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
      reservedForDepartmentId: insertSpot.reservedForDepartmentId ?? null,
      isActive: insertSpot.isActive ?? true,
      isBookable: insertSpot.isBookable ?? true,
      isBciManaged: insertSpot.isBciManaged ?? false,
      createdAt: new Date()
    }).returning();
    
    return createdSpot;
  }

  async updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined> {
    // First check if spot exists
    const existing = await db.select().from(parkingSpots).where(eq(parkingSpots.id, id));
    if (existing.length === 0) return undefined;
    
    console.log('[STORAGE UPDATE] Received updates:', JSON.stringify(updates, null, 2));
    console.log('[STORAGE UPDATE] Updating spot ID:', id);
    
    // Update in database
    const updated = await db.update(parkingSpots)
      .set(updates)
      .where(eq(parkingSpots.id, id))
      .returning();
    
    console.log('[STORAGE UPDATE] Drizzle returned:', JSON.stringify(updated[0], null, 2));
    
    return updated[0];
  }

  async deleteParkingSpot(id: string): Promise<boolean> {
    const deleted = await db.delete(parkingSpots)
      .where(eq(parkingSpots.id, id))
      .returning();
    return deleted.length > 0;
  }

  // Cleanup methods for parking spot deletion
  async deleteSpotAssignmentHistoryBySpotId(spotId: string): Promise<number> {
    const deleted = await db.delete(spotAssignmentHistory)
      .where(eq(spotAssignmentHistory.spotId, spotId))
      .returning();
    return deleted.length;
  }

  async deleteSpotLocksBySpotId(spotId: string): Promise<number> {
    const deleted = await db.delete(spotLocks)
      .where(eq(spotLocks.spotId, spotId))
      .returning();
    return deleted.length;
  }

  async softDeleteListingsBySpotId(spotId: string): Promise<number> {
    const updated = await db.update(spotListings)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(spotListings.spotId, spotId),
        isNull(spotListings.deletedAt)
      ))
      .returning();
    return updated.length;
  }

  // Spot Listing operations
  async getSpotListing(id: string): Promise<SpotListing | undefined> {
    const result = await db.select().from(spotListings).where(eq(spotListings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return result[0];
  }

  async getSpotListingsByOwner(ownerId: string): Promise<SpotListing[]> {
    return await db.select().from(spotListings)
      .where(and(eq(spotListings.ownerId, ownerId), isNull(spotListings.deletedAt)));
  }

  async getSpotListingsBySpot(spotId: string): Promise<SpotListing[]> {
    return await db.select().from(spotListings)
      .where(and(eq(spotListings.spotId, spotId), isNull(spotListings.deletedAt)));
  }

  async getAllSpotListings(): Promise<SpotListing[]> {
    return await db.select().from(spotListings).where(isNull(spotListings.deletedAt));
  }

  async getActiveSpotListings(): Promise<SpotListing[]> {
    return await db.select().from(spotListings)
      .where(and(eq(spotListings.status, "available"), isNull(spotListings.deletedAt)));
  }

  async createSpotListing(insertListing: InsertSpotListing): Promise<SpotListing> {
    // Validate status - only allow valid statuses, default to "available"
    const validStatuses = ["available", "booked", "used", "unused", "cancelled"];
    const status = validStatuses.includes(insertListing.status as string) 
      ? (insertListing.status as ListingStatus) 
      : "available";
    
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
      status: status,
      notes: insertListing.notes ?? null,
      donateToCharity: insertListing.donateToCharity ?? false,
      createdByAdmin: insertListing.createdByAdmin ?? false,
      originalListingType: (insertListing.originalListingType as ListingType) ?? null,
    }).returning();
    
    // Auto-enable bookability on the spot when a listing is created
    // This ensures spots become bookable when owners list them
    await db.update(parkingSpots)
      .set({ isBookable: true })
      .where(eq(parkingSpots.id, insertListing.spotId));
    
    return listing;
  }

  async bulkCreateSpotListings(spotIds: string[], listingData: Omit<InsertSpotListing, 'spotId' | 'ownerId'>, ownerId: string): Promise<SpotListing[]> {
    if (spotIds.length === 0) return [];

    // Validate status - only allow valid statuses, default to "available"
    const validStatuses = ["available", "booked", "used", "unused", "cancelled"];
    const status = validStatuses.includes(listingData.status as string) 
      ? (listingData.status as ListingStatus) 
      : "available";

    const createdListings: SpotListing[] = [];
    
    // Create listings for each spot using the provided ownerId (typically admin for BCI-managed spots)
    for (const spotId of spotIds) {
      const listing = await db.insert(spotListings).values({
        spotId: spotId,
        ownerId: ownerId,
        listingType: listingData.listingType as ListingType,
        singleDate: listingData.singleDate ?? null,
        periodStartDate: listingData.periodStartDate ?? null,
        periodEndDate: listingData.periodEndDate ?? null,
        recurringStartDate: listingData.recurringStartDate ?? null,
        recurringEndDate: listingData.recurringEndDate ?? null,
        daysOfWeek: listingData.daysOfWeek ?? null,
        dailyRate: listingData.dailyRate,
        status: status,
        notes: listingData.notes ?? null,
        donateToCharity: listingData.donateToCharity ?? false,
        createdByAdmin: true,
      }).returning();

      if (listing[0]) {
        createdListings.push(listing[0]);
        
        // Auto-enable bookability on the spot when a listing is created
        await db.update(parkingSpots)
          .set({ isBookable: true })
          .where(eq(parkingSpots.id, spotId));
      }
    }

    return createdListings;
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
    // Soft delete - set deletedAt timestamp instead of hard delete
    const updated = await db.update(spotListings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(spotListings.id, id))
      .returning();
    return updated.length > 0;
  }

  // Booking operations
  async getBooking(id: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return result[0];
  }

  async getBookingsByRenter(renterId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.renterId, renterId));
  }

  async getBookingsByUser(userId: string): Promise<Booking[]> {
    // Alias for getBookingsByRenter
    return this.getBookingsByRenter(userId);
  }

  async getBookingsByOwner(ownerId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.ownerId, ownerId));
  }

  async getBookingsBySpot(spotId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.spotId, spotId));
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.listingId, listingId));
  }

  async getAllBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
  }

  async createBooking(insertBooking: InsertBooking & { renterId: string; ownerId: string }): Promise<Booking> {
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
      paymentStatus: insertBooking.paymentStatus ?? 'pending',
      notes: insertBooking.notes ?? null,
      adminNotes: insertBooking.adminNotes ?? null,
      cancellationReason: insertBooking.cancellationReason ?? null,
      paymentRefundedAt: insertBooking.paymentRefundedAt ?? null,
      refundAmount: insertBooking.refundAmount ?? null,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return createdBooking;
  }

  async updateBooking(id: string, updates: Partial<typeof bookings.$inferInsert>): Promise<Booking | undefined> {
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

    return updatedBooking;
  }

  async deleteBooking(id: string): Promise<boolean> {
    const deleted = await db.delete(bookings).where(eq(bookings.id, id));
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

    return updatedBooking;
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<Booking | undefined> {
    // Query database first
    const existing = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (existing.length === 0) return undefined;

    const now = new Date();
    
    // Prepare updates: paymentStatus + sync paymentReceived for backward compatibility
    const updates: any = {
      paymentStatus,
      paymentReceived: paymentStatus === 'received',
      updatedAt: now
    };

    // If payment is marked as received, auto-complete the booking
    if (paymentStatus === 'received') {
      updates.status = 'completed';
    }
    
    // Update database
    const [updatedBooking] = await db.update(bookings)
      .set(updates)
      .where(eq(bookings.id, id))
      .returning();

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
    return db.select().from(bookings).where(eq(bookings.bookingDate, date));
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
    
    return result[0];
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
    
    return result[0];
  }

  async getAllWaitingList(): Promise<WaitingList[]> {
    return await db
      .select()
      .from(waitingList)
      .orderBy(asc(waitingList.priority));
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
      
      return result[0];
    } catch (error) {
      console.error("Error updating waiting list entry:", error);
      return undefined;
    }
  }

  async deleteWaitingListEntry(id: string): Promise<boolean> {
    try {
      // Soft delete by setting status to "cancelled" instead of removing record
      const result = await db
        .update(waitingList)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(waitingList.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting waiting list entry:", error);
      return false;
    }
  }

  async permanentDeleteWaitingListEntry(id: string): Promise<boolean> {
    try {
      // Check if the entry exists and is cancelled before permanent deletion
      const existing = await db.select().from(waitingList).where(eq(waitingList.id, id)).limit(1);
      if (existing.length === 0) {
        return false;
      }
      
      if (existing[0].status !== 'cancelled') {
        throw new Error("Only cancelled entries can be permanently deleted");
      }
      
      // Permanently delete from database
      const result = await db
        .delete(waitingList)
        .where(eq(waitingList.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error permanently deleting waiting list entry:", error);
      throw error;
    }
  }

  async getWaitingListById(id: string): Promise<WaitingList | undefined> {
    const result = await db.select().from(waitingList).where(eq(waitingList.id, id)).limit(1);
    if (result.length === 0) return undefined;
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

    return updated;
  }

  // Vehicle operations
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const result = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return result[0];
  }

  async getVehiclesByUser(userId: string): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.userId, userId));
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles);
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
      color: vehicle.color ?? null,
      isElectric: vehicle.isElectric ?? false,
      isDefault: vehicle.isDefault ?? false,
      createdAt: now,
      updatedAt: now
    }).returning();
    
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

    return updatedVehicle;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
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
    return result[0];
  }

  async createPaymentPreferences(userId: string, preferences: InsertPaymentPreferences): Promise<PaymentPreferences> {
    const insertData = {
      userId,
      paymentType: (preferences.paymentType ?? "interac_transfer") as PaymentType,
      paymentInstructions: preferences.paymentInstructions ?? null
    };
    
    const [newPreferences] = await db.insert(paymentPreferences).values(insertData).returning();
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
    
    return updatedPreferences;
  }

  async deletePaymentPreferences(userId: string): Promise<boolean> {
    const existing = await this.getPaymentPreferences(userId);
    if (!existing) return false;
    
    await db.delete(paymentPreferences).where(eq(paymentPreferences.id, existing.id));
    return true;
  }

  async getBookingSubscription(userId: string): Promise<BookingSubscription | undefined> {
    const result = await db.select()
      .from(bookingSubscriptions)
      .where(eq(bookingSubscriptions.userId, userId))
      .limit(1);
    
    return result[0];
  }

  async upsertBookingSubscription(userId: string, updates: UpdateBookingSubscription): Promise<BookingSubscription> {
    const existing = await this.getBookingSubscription(userId);
    
    if (!existing) {
      const insertData = {
        userId,
        isEnabled: updates.isEnabled ?? false,
        daysOfWeek: updates.daysOfWeek ?? [],
        maxPrice: updates.maxPrice ?? null,
      };
      const [created] = await db.insert(bookingSubscriptions).values(insertData).returning();
      return created;
    }
    
    const updateData: Partial<typeof bookingSubscriptions.$inferInsert> = {};
    if (updates.isEnabled !== undefined) updateData.isEnabled = updates.isEnabled;
    if (updates.daysOfWeek !== undefined) updateData.daysOfWeek = updates.daysOfWeek;
    if (updates.maxPrice !== undefined) updateData.maxPrice = updates.maxPrice;
    updateData.updatedAt = new Date();
    
    const [updated] = await db.update(bookingSubscriptions)
      .set(updateData)
      .where(eq(bookingSubscriptions.id, existing.id))
      .returning();
    
    return updated;
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

  // Terms and Conditions operations
  async getActiveTermsVersion(): Promise<TermsVersion | undefined> {
    const result = await db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.isActive, true))
      .limit(1);
    return result[0];
  }

  async getAllTermsVersions(): Promise<TermsVersion[]> {
    return await db
      .select()
      .from(termsVersions)
      .orderBy(desc(termsVersions.version));
  }

  async createTermsVersion(termsVersion: InsertTermsVersion): Promise<TermsVersion> {
    const result = await db
      .insert(termsVersions)
      .values(termsVersion)
      .returning();
    return result[0];
  }

  async acceptTerms(userId: string, version: number): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        acceptedTermsVersion: version,
        acceptedTermsAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
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

  // Helper methods for scope filtering
  private async getFilteredSpots(scope?: 'bci' | 'all'): Promise<ParkingSpot[]> {
    const allSpots = await db.select().from(parkingSpots);
    
    // Default to 'all' if scope is undefined
    if (!scope || scope === 'all') {
      return allSpots;
    }
    
    // Filter for BCI managed spots only
    return allSpots.filter(spot => spot.isBciManaged === true);
  }

  private async getFilteredBookings(scope?: 'bci' | 'all'): Promise<Booking[]> {
    const allBookings = await db.select().from(bookings);
    
    // Default to 'all' if scope is undefined
    if (!scope || scope === 'all') {
      return allBookings;
    }
    
    // Filter bookings for BCI managed spots only
    const allSpots = await db.select().from(parkingSpots);
    const bciSpotIds = new Set(
      allSpots.filter(spot => spot.isBciManaged === true).map(spot => spot.id)
    );
    
    return allBookings.filter(booking => bciSpotIds.has(booking.spotId));
  }

  private async getFilteredListings(scope?: 'bci' | 'all'): Promise<SpotListing[]> {
    const allListings = await db.select().from(spotListings);
    
    // Default to 'all' if scope is undefined
    if (!scope || scope === 'all') {
      return allListings;
    }
    
    // Filter listings for BCI managed spots only
    const allSpots = await db.select().from(parkingSpots);
    const bciSpotIds = new Set(
      allSpots.filter(spot => spot.isBciManaged === true).map(spot => spot.id)
    );
    
    return allListings.filter(listing => bciSpotIds.has(listing.spotId));
  }

  // Analytics methods implementation
  async getAnalyticsOverview(scope?: 'bci' | 'all', fromDate?: string, toDate?: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    activeUsers: number;
    utilizationRate: number;
    averageBookingValue: number;
    monthlyGrowth: number;
  }> {
    const allBookingsUnfiltered = await this.getFilteredBookings(scope);
    const allUsers = await db.select().from(users);
    const allSpots = await this.getFilteredSpots(scope);
    
    // Filter bookings by date range if provided
    let allBookings = allBookingsUnfiltered;
    if (fromDate && toDate) {
      allBookings = allBookingsUnfiltered.filter(booking => {
        const bookingDate = booking.bookingDate;
        return bookingDate >= fromDate && bookingDate <= toDate;
      });
    }
    
    // Calculate total revenue from date-filtered bookings
    const totalRevenue = allBookings
      .filter(b => b.paymentReceived)
      .reduce((sum, booking) => sum + parseFloat(booking.totalAmount.toString()), 0);
    
    // Calculate total bookings within date range
    const totalBookings = allBookings.length;
    
    // Active users (those with recent activity within selected date range or last 30 days)
    const activeUserDate = fromDate ? new Date(fromDate) : new Date();
    if (!fromDate) {
      activeUserDate.setDate(activeUserDate.getDate() - 30);
    }
    const activeUsers = allUsers.filter(user => 
      user.lastLogin && new Date(user.lastLogin) >= activeUserDate
    ).length;
    
    // Calculate utilization rate based on date range
    const totalSpots = allSpots.length;
    let utilizationRate = 0;
    if (fromDate && toDate && totalSpots > 0) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalPossibleBookings = totalSpots * daysDiff;
      utilizationRate = (allBookings.length / totalPossibleBookings) * 100;
    } else {
      // Fallback to today's utilization
      const today = new Date().toISOString().split('T')[0];
      const bookingsToday = allBookingsUnfiltered.filter(booking => booking.bookingDate === today).length;
      utilizationRate = totalSpots > 0 ? (bookingsToday / totalSpots) * 100 : 0;
    }
    
    // Calculate average booking value
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const averageBookingValue = paidBookings.length > 0 ? totalRevenue / paidBookings.length : 0;
    
    // Calculate monthly growth (compare current period to previous equivalent period)
    let monthlyGrowth = 0;
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1);
      
      const prevFromStr = prevStartDate.toISOString().split('T')[0];
      const prevToStr = prevEndDate.toISOString().split('T')[0];
      
      const prevPeriodBookings = allBookingsUnfiltered.filter(booking => {
        const bookingDate = booking.bookingDate;
        return bookingDate >= prevFromStr && bookingDate <= prevToStr;
      }).length;
      
      monthlyGrowth = prevPeriodBookings > 0 
        ? ((allBookings.length - prevPeriodBookings) / prevPeriodBookings) * 100 
        : 0;
    } else {
      const currentMonth = new Date().getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      
      const currentMonthBookings = allBookingsUnfiltered.filter(booking => 
        new Date(booking.createdAt).getMonth() === currentMonth
      ).length;
      const lastMonthBookings = allBookingsUnfiltered.filter(booking => 
        new Date(booking.createdAt).getMonth() === lastMonth
      ).length;
      
      monthlyGrowth = lastMonthBookings > 0 
        ? ((currentMonthBookings - lastMonthBookings) / lastMonthBookings) * 100 
        : 0;
    }
    
    return {
      totalRevenue: Math.round(totalRevenue),
      totalBookings,
      activeUsers,
      utilizationRate: Math.round(utilizationRate * 10) / 10,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10
    };
  }

  async getMonthlyRevenueData(monthsBack: number = 12, scope?: 'bci' | 'all'): Promise<{
    month: string;
    revenue: number;
    bookings: number;
    year: number;
  }[]> {
    const allBookings = await this.getFilteredBookings(scope);
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

  async getRevenueBreakdown(scope?: 'bci' | 'all'): Promise<{
    ownerEarnings: number;
    bciRevenue: number;
    ownerEarningsPercentage: number;
    bciRevenuePercentage: number;
  }> {
    const allBookings = await this.getFilteredBookings(scope);
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

  async getTopPerformingSpots(limit: number = 5, scope?: 'bci' | 'all'): Promise<{
    id: string;
    spotNumber: string;
    location: string;
    earnings: number;
    utilization: number;
    bookingsCount: number;
    ownerName: string;
  }[]> {
    const allBookings = await this.getFilteredBookings(scope);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const allSpots = await this.getFilteredSpots(scope);
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

  async getTopEarningOwners(limit: number = 5, scope?: 'bci' | 'all'): Promise<{
    id: string;
    name: string;
    earnings: number;
    spotsCount: number;
    bookingsCount: number;
    averageRating: number;
    email: string;
  }[]> {
    const allBookings = await this.getFilteredBookings(scope);
    const paidBookings = allBookings.filter(b => b.paymentReceived);
    const allSpots = await this.getFilteredSpots(scope);
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

  async getActiveIssues(scope?: 'bci' | 'all'): Promise<{
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
    const allBookings = await this.getFilteredBookings(scope);
    const allSpots = await this.getFilteredSpots(scope);
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

  async getBookingDurationData(scope?: 'bci' | 'all'): Promise<{
    duration: string;
    count: number;
    percentage: number;
  }[]> {
    // Get all spot listings and bookings from database
    const allListings = await this.getFilteredListings(scope);
    const allBookings = await this.getFilteredBookings(scope);
    
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

  async getLocationPerformanceData(scope?: 'bci' | 'all'): Promise<{
    location: string;
    spotsCount: number;
    utilization: number;
    earnings: number;
    averageRate: number;
  }[]> {
    const allSpots = await this.getFilteredSpots(scope);
    const allBookings = await this.getFilteredBookings(scope);
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

  async getWeeklyTrendsData(scope?: 'bci' | 'all'): Promise<{
    dayOfWeek: string;
    bookings: number;
    utilization: number;
  }[]> {
    const allBookings = await this.getFilteredBookings(scope);
    const allSpots = await this.getFilteredSpots(scope);
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
      
      return newPrefs;
    }
    
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
    
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(inAppNotifications)
      .set({ read: true })
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.read, false)
      ));
  }

  async deleteInAppNotification(notificationId: string): Promise<void> {
    await db.delete(inAppNotifications).where(eq(inAppNotifications.id, notificationId));
  }

  async deleteAllUserNotifications(userId: string): Promise<void> {
    await db.delete(inAppNotifications).where(eq(inAppNotifications.userId, userId));
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
  async getBookingAvailability(isBciOnly?: boolean, page: number = 1, limit: number = 9999, filters?: { search?: string; listingType?: string; location?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: BookingAvailabilityData[]; total: number; page: number; limit: number; totalPages: number }> {
    const today = new Date().toISOString().split('T')[0];

    // Single JOIN query — replaces the N+1 per-row lookups (spot, location, spotType, owner)
    const rows = await db
      .select({
        listing: spotListings,
        spotNumber: parkingSpots.spotNumber,
        spotIsBciManaged: parkingSpots.isBciManaged,
        spotOwnerId: parkingSpots.ownerId,
        locationBuilding: locations.building,
        locationLevel: locations.level,
        spotTypeName: spotTypesTable.name,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerEmail: users.email,
      })
      .from(spotListings)
      .innerJoin(parkingSpots, eq(spotListings.spotId, parkingSpots.id))
      .innerJoin(locations, eq(parkingSpots.locationId, locations.id))
      .innerJoin(spotTypesTable, eq(parkingSpots.spotTypeId, spotTypesTable.id))
      .leftJoin(users, eq(parkingSpots.ownerId, users.id))
      .where(
        and(
          eq(spotListings.status, 'available'),
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

    // Build enriched entries in memory — no additional DB calls inside the loop
    const allRawEntries: Array<{ enrichedData: BookingAvailabilityData; spotIsBciManaged: boolean; spotOwnerId: string | null }> = [];

    for (const row of rows) {
      const { listing, spotNumber, spotIsBciManaged, spotOwnerId, locationBuilding, locationLevel, spotTypeName, ownerFirstName, ownerLastName, ownerEmail } = row;

      const locationName = `${locationBuilding} - ${locationLevel}`;
      const ownerName = spotOwnerId
        ? `${ownerFirstName || ''} ${ownerLastName || ''}`.trim() || ownerEmail || 'Unknown'
        : (spotIsBciManaged ? 'BCI Workplace Services' : 'Unknown');

      const baseData = {
        ...listing,
        spotNumber,
        locationName,
        spotTypeName: spotTypeName || 'Unknown',
        ownerName,
      };

      if (listing.listingType === 'single' && listing.singleDate) {
        allRawEntries.push({
          enrichedData: {
            ...baseData,
            availableFrom: listing.singleDate,
            availableTo: listing.singleDate,
          } as BookingAvailabilityData,
          spotIsBciManaged,
          spotOwnerId,
        });
      } else if (listing.listingType === 'period' && listing.periodStartDate && listing.periodEndDate) {
        // Expand period listing into individual day entries
        const startDate = new Date(listing.periodStartDate + 'T00:00:00Z');
        const endDate = new Date(listing.periodEndDate + 'T00:00:00Z');

        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          // Only include dates from today onwards
          if (dateStr >= today) {
            allRawEntries.push({
              enrichedData: {
                ...baseData,
                id: `${listing.id}-${dateStr}`, // Unique ID for each day
                listingType: 'single', // Show as single day in the UI
                singleDate: dateStr,
                availableFrom: dateStr,
                availableTo: dateStr,
              } as BookingAvailabilityData,
              spotIsBciManaged,
              spotOwnerId,
            });
          }
        }
      } else if (listing.listingType === 'recurring') {
        allRawEntries.push({
          enrichedData: {
            ...baseData,
            availableFrom: listing.recurringStartDate || '',
            availableTo: listing.recurringEndDate || 'Ongoing',
          } as BookingAvailabilityData,
          spotIsBciManaged,
          spotOwnerId,
        });
      }
    }

    // Filter by scope:
    // - Shared Pool (isBciOnly=true): BCI-managed AND no owner assigned
    // - Assigned Spots (isBciOnly=false): everything NOT in shared pool (has owner OR is not BCI-managed)
    let filteredEntries: BookingAvailabilityData[];
    if (isBciOnly) {
      filteredEntries = allRawEntries
        .filter(e => e.spotIsBciManaged && !e.spotOwnerId)
        .map(e => e.enrichedData);
    } else {
      filteredEntries = allRawEntries
        .filter(e => e.spotOwnerId !== null || !e.spotIsBciManaged)
        .map(e => e.enrichedData);
    }

    // Apply search and filter params before pagination
    const search = filters?.search?.trim().toLowerCase() || '';
    const listingTypeFilter = filters?.listingType && filters.listingType !== 'all' ? filters.listingType : '';
    const locationFilter = filters?.location && filters.location !== 'all' ? filters.location.toLowerCase() : '';

    if (search || listingTypeFilter || locationFilter) {
      filteredEntries = filteredEntries.filter(entry => {
        if (search) {
          const matchesSearch =
            entry.spotNumber?.toLowerCase().includes(search) ||
            entry.locationName?.toLowerCase().includes(search) ||
            entry.spotTypeName?.toLowerCase().includes(search) ||
            entry.ownerName?.toLowerCase().includes(search);
          if (!matchesSearch) return false;
        }
        if (listingTypeFilter && entry.listingType !== listingTypeFilter) return false;
        if (locationFilter && !entry.locationName?.toLowerCase().includes(locationFilter)) return false;
        return true;
      });
    }

    // Apply sort before pagination
    const AVAILABILITY_SORT_COLUMNS: Record<string, keyof BookingAvailabilityData> = {
      spotNumber: 'spotNumber',
      locationName: 'locationName',
      spotTypeName: 'spotTypeName',
      ownerName: 'ownerName',
      dailyRate: 'dailyRate',
      availableFrom: 'availableFrom',
      availableTo: 'availableTo',
      listingType: 'listingType',
    };
    const sortKey = sort?.column && AVAILABILITY_SORT_COLUMNS[sort.column] ? AVAILABILITY_SORT_COLUMNS[sort.column] : 'availableFrom';
    const sortDir = sort?.direction === 'desc' ? -1 : 1;
    filteredEntries.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });

    const total = filteredEntries.length;
    const totalPages = limit >= 9999 ? 1 : Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = limit >= 9999 ? filteredEntries : filteredEntries.slice(offset, offset + limit);

    return { data, total, page, limit, totalPages };
  }

  async getPendingPaymentBookings(isBciOnly?: boolean, page: number = 1, limit: number = 9999, filters?: { search?: string; location?: string; daysOverdue?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: PendingPaymentData[]; total: number; page: number; limit: number; totalPages: number }> {
    // Use parameterized query with Drizzle sql template literals
    // Include spot_owner for the assigned-to field (parkingSpots.ownerId)

    const searchTerm = filters?.search?.trim() || '';
    const searchPattern = searchTerm ? `%${searchTerm}%` : '';
    const locationTerm = filters?.location && filters.location !== 'all' ? filters.location : '';
    const locationPattern = locationTerm ? `%${locationTerm}%` : '';
    const daysOverdueRange = filters?.daysOverdue && filters.daysOverdue !== 'all' ? filters.daysOverdue : '';

    const countQuery = sqlOp`
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      WHERE 
        b.payment_status = 'paid'
        AND b.status != 'cancelled'
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${searchPattern ? sqlOp`AND (ps.spot_number ILIKE ${searchPattern} OR COALESCE(renter.first_name || ' ' || renter.last_name, renter.email) ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, spot_owner.email, '') ILIKE ${searchPattern} OR COALESCE(spot_owner.email, '') ILIKE ${searchPattern})` : sqlOp``}
        ${locationPattern ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${locationPattern}` : sqlOp``}
        ${daysOverdueRange === '0-7' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) BETWEEN 0 AND 7` : sqlOp``}
        ${daysOverdueRange === '8-30' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) BETWEEN 8 AND 30` : sqlOp``}
        ${daysOverdueRange === '30+' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) > 30` : sqlOp``}
    `;
    const offset = (page - 1) * limit;
    const baseQuery = sqlOp`
      SELECT 
        b.*,
        ps.spot_number, ps.location_id, ps.is_bci_managed, ps.owner_id as spot_owner_id,
        l.building, l.level,
        renter.id as renter_id, renter.first_name as renter_first_name, 
        renter.last_name as renter_last_name, renter.email as renter_email,
        owner.id as owner_id, owner.first_name as owner_first_name, 
        owner.last_name as owner_last_name, owner.email as owner_email,
        spot_owner.first_name as spot_owner_first_name, 
        spot_owner.last_name as spot_owner_last_name, spot_owner.email as spot_owner_email
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users owner ON b.owner_id = owner.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      WHERE 
        b.payment_status = 'paid'
        AND b.status != 'cancelled'
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${searchPattern ? sqlOp`AND (ps.spot_number ILIKE ${searchPattern} OR COALESCE(renter.first_name || ' ' || renter.last_name, renter.email) ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, spot_owner.email, '') ILIKE ${searchPattern} OR COALESCE(spot_owner.email, '') ILIKE ${searchPattern})` : sqlOp``}
        ${locationPattern ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${locationPattern}` : sqlOp``}
        ${daysOverdueRange === '0-7' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) BETWEEN 0 AND 7` : sqlOp``}
        ${daysOverdueRange === '8-30' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) BETWEEN 8 AND 30` : sqlOp``}
        ${daysOverdueRange === '30+' ? sqlOp`AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer) > 30` : sqlOp``}
      ORDER BY ${sqlOp.raw((() => {
        const PENDING_SORT_COLUMNS: Record<string, string> = {
          spotNumber: 'ps.spot_number',
          renterName: "renter.first_name || ' ' || renter.last_name",
          ownerName: "COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, '')",
          bookingDate: 'b.booking_date',
          totalAmount: 'b.total_amount',
          daysOverdue: 'GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - b.booking_date::date))::integer)',
          status: 'b.status',
          createdAt: 'b.created_at',
        };
        const col = sort?.column && PENDING_SORT_COLUMNS[sort.column] ? PENDING_SORT_COLUMNS[sort.column] : 'b.created_at';
        const dir = sort?.direction === 'asc' ? 'ASC' : 'DESC';
        return `${col} ${dir}`;
      })())}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [countResults, results] = await Promise.all([
      db.execute(countQuery),
      db.execute(baseQuery),
    ]);
    const total = parseInt((countResults as any).rows?.[0]?.total || '0', 10);
    
    const data = ((results as any).rows || []).map((row: any) => {
      const renterName = row.renter_first_name && row.renter_last_name 
        ? `${row.renter_first_name} ${row.renter_last_name}`
        : row.renter_email || 'Unknown';
      // Show assigned owner name if spot has an owner, otherwise "BCI Workplace Services" for unassigned BCI-managed spots
      const ownerName = row.spot_owner_id
        ? (row.spot_owner_first_name && row.spot_owner_last_name 
            ? `${row.spot_owner_first_name} ${row.spot_owner_last_name}`
            : row.spot_owner_email || 'Unknown')
        : (row.is_bci_managed ? 'BCI Workplace Services' : 'Unknown');
      
      const spotLocation = row.building && row.level
        ? `${row.building} - ${row.level}`
        : 'Unknown Location';
      
      // Calculate days overdue
      const bookingDate = new Date(row.booking_date);
      const today = new Date();
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        id: row.id,
        spotNumber: row.spot_number || 'N/A',
        spotLocation,
        renterName,
        renterEmail: row.renter_email || '',
        ownerName,
        ownerEmail: row.spot_owner_id ? (row.spot_owner_email || '') : '',
        bookingDate: row.booking_date,
        totalAmount: Number(row.total_amount),
        daysOverdue,
        status: row.status,
        paymentStatus: row.payment_status || 'pending'
      };
    });

    const totalPages = limit >= 9999 ? 1 : Math.ceil(total / limit);
    return { data, total, page, limit, totalPages };
  }

  async getActiveBookings(isBciOnly?: boolean, page: number = 1, limit: number = 9999, filters?: { search?: string; status?: string; location?: string; dateFrom?: string; dateTo?: string; role?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: AdminBookingData[]; total: number; page: number; limit: number; totalPages: number }> {
    const today = new Date().toISOString().split('T')[0];
    const offset = (page - 1) * limit;

    const search = filters?.search?.trim() || '';
    const statusFilter = filters?.status && filters.status !== 'all' ? filters.status : '';
    const locationFilter = filters?.location && filters.location !== 'all' ? filters.location : '';
    const dateFrom = filters?.dateFrom || '';
    const dateTo = filters?.dateTo || '';
    const role = filters?.role && filters.role !== 'all' ? filters.role : '';
    const searchPattern = search ? `%${search}%` : '';

    const countQuery = sqlOp`
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      WHERE
        (b.status = 'confirmed' OR b.status = 'pending' OR b.status = 'completed')
        AND b.booking_date >= ${today}
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${statusFilter ? sqlOp`AND b.status = ${statusFilter}` : sqlOp``}
        ${locationFilter ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${`%${locationFilter}%`}` : sqlOp``}
        ${dateFrom ? sqlOp`AND b.booking_date >= ${dateFrom}` : sqlOp``}
        ${dateTo ? sqlOp`AND b.booking_date <= ${dateTo}` : sqlOp``}
        ${searchPattern && role === 'owner' ? sqlOp`AND (spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
        ${searchPattern && role === 'renter' ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
        ${searchPattern && !role ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
    `;
    // Use parameterized query with Drizzle sql template literals
    // Include spot_owner for the assigned-to field (parkingSpots.ownerId)
    const baseQuery = sqlOp`
      SELECT 
        b.*,
        ps.spot_number, ps.location_id, ps.is_bci_managed, ps.owner_id as spot_owner_id,
        l.building, l.level,
        renter.id as renter_id, renter.first_name as renter_first_name, 
        renter.last_name as renter_last_name, renter.email as renter_email,
        owner.id as owner_id, owner.first_name as owner_first_name, 
        owner.last_name as owner_last_name, owner.email as owner_email,
        renter_dept.name as renter_department,
        owner_dept.name as owner_department,
        spot_owner.first_name as spot_owner_first_name, 
        spot_owner.last_name as spot_owner_last_name, spot_owner.email as spot_owner_email,
        spot_owner_dept.name as spot_owner_department,
        pp.payment_type as owner_payment_type,
        pp.payment_instructions as owner_payment_instructions
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users owner ON b.owner_id = owner.id
      LEFT JOIN departments renter_dept ON renter.department_id = renter_dept.id
      LEFT JOIN departments owner_dept ON owner.department_id = owner_dept.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      LEFT JOIN departments spot_owner_dept ON spot_owner.department_id = spot_owner_dept.id
      LEFT JOIN payment_preferences pp ON ps.owner_id = pp.user_id
      WHERE 
        (b.status = 'confirmed' OR b.status = 'pending' OR b.status = 'completed')
        AND b.booking_date >= ${today}
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${statusFilter ? sqlOp`AND b.status = ${statusFilter}` : sqlOp``}
        ${locationFilter ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${`%${locationFilter}%`}` : sqlOp``}
        ${dateFrom ? sqlOp`AND b.booking_date >= ${dateFrom}` : sqlOp``}
        ${dateTo ? sqlOp`AND b.booking_date <= ${dateTo}` : sqlOp``}
        ${searchPattern && role === 'owner' ? sqlOp`AND (spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
        ${searchPattern && role === 'renter' ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
        ${searchPattern && !role ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
      ORDER BY ${sqlOp.raw((() => {
        const ACTIVE_SORT_COLUMNS: Record<string, string> = {
          spotNumber: 'ps.spot_number',
          renterName: "renter.first_name || ' ' || renter.last_name",
          ownerName: "COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, '')",
          bookingDate: 'b.booking_date',
          totalAmount: 'b.total_amount',
          status: 'b.status',
          paymentStatus: 'b.payment_status',
          createdAt: 'b.created_at',
        };
        const col = sort?.column && ACTIVE_SORT_COLUMNS[sort.column] ? ACTIVE_SORT_COLUMNS[sort.column] : 'b.booking_date';
        const dir = sort?.direction === 'desc' ? 'DESC' : 'ASC';
        return `${col} ${dir}`;
      })())}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [countResults, results] = await Promise.all([
      db.execute(countQuery),
      db.execute(baseQuery),
    ]);
    const total = parseInt((countResults as any).rows?.[0]?.total || '0', 10);
    
    const data = ((results as any).rows || []).map((row: any) => {
      const renterName = row.renter_first_name && row.renter_last_name 
        ? `${row.renter_first_name} ${row.renter_last_name}`
        : row.renter_email || 'Unknown';
      // Show assigned owner name if spot has an owner, otherwise "BCI Workplace Services" for unassigned BCI-managed spots
      const ownerName = row.spot_owner_id
        ? (row.spot_owner_first_name && row.spot_owner_last_name 
            ? `${row.spot_owner_first_name} ${row.spot_owner_last_name}`
            : row.spot_owner_email || 'Unknown')
        : (row.is_bci_managed ? 'BCI Workplace Services' : 'Unknown');
      
      const spotLocation = row.building && row.level
        ? `${row.building} - ${row.level}`
        : 'Unknown Location';
      
      return {
        id: row.id,
        spotNumber: row.spot_number || 'N/A',
        spotLocation,
        renterName,
        renterEmail: row.renter_email || '',
        renterDepartment: row.renter_department || '',
        ownerName,
        ownerEmail: row.spot_owner_id ? (row.spot_owner_email || '') : '',
        ownerDepartment: row.spot_owner_id ? (row.spot_owner_department || '') : '',
        bookingDate: row.booking_date,
        dailyRate: Number(row.daily_rate),
        totalAmount: Number(row.total_amount),
        status: row.status,
        paymentReceived: row.payment_received,
        paymentStatus: row.payment_status || 'pending',
        notes: row.notes || '',
        createdAt: new Date(row.created_at).toISOString(),
        lastActivity: new Date(row.updated_at).toISOString(),
        ownerPaymentType: row.owner_payment_type || '',
        ownerPaymentInstructions: row.owner_payment_instructions || '',
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getPastBookings(isBciOnly?: boolean, page: number = 1, limit: number = 20, payrollPeriod?: string, filters?: { search?: string; status?: string; location?: string; dateFrom?: string; dateTo?: string }, sort?: { column: string; direction: 'asc' | 'desc' }): Promise<{ data: AdminBookingData[]; total: number; page: number; limit: number; totalPages: number }> {
    const today = new Date().toISOString().split('T')[0];

    const search = filters?.search?.trim() || '';
    const statusFilter = filters?.status && filters.status !== 'all' ? filters.status : '';
    const locationFilter = filters?.location && filters.location !== 'all' ? filters.location : '';
    const dateFrom = filters?.dateFrom || '';
    const dateTo = filters?.dateTo || '';
    const searchPattern = search ? `%${search}%` : '';
    
    // Helper function to calculate deduction period for a booking date
    const getDeductionPeriod = (bookingDateStr: string): string => {
      const bookingDate = new Date(bookingDateStr + "T12:00:00");
      const dayOfMonth = bookingDate.getDate();
      const deductionMonth = dayOfMonth < 20 
        ? bookingDate.getMonth() 
        : (bookingDate.getMonth() + 1) % 12;
      const deductionYear = dayOfMonth < 20 
        ? bookingDate.getFullYear() 
        : (bookingDate.getMonth() === 11 ? bookingDate.getFullYear() + 1 : bookingDate.getFullYear());
      return `${deductionYear}-${String(deductionMonth + 1).padStart(2, '0')}`;
    };
    
    // When filtering by payroll period, we need to fetch all and filter in app layer
    // because the payroll period calculation is complex (depends on day of month)
    if (payrollPeriod && isBciOnly) {
      // Fetch all BCI past bookings (no pagination yet)
      const allQuery = sqlOp`
        SELECT 
          b.*,
          ps.spot_number, ps.location_id, ps.is_bci_managed, ps.owner_id as spot_owner_id,
          l.building, l.level,
          renter.id as renter_id, renter.first_name as renter_first_name, 
          renter.last_name as renter_last_name, renter.email as renter_email,
          owner.id as owner_id, owner.first_name as owner_first_name, 
          owner.last_name as owner_last_name, owner.email as owner_email,
          renter_dept.name as renter_department,
          owner_dept.name as owner_department,
          spot_owner.first_name as spot_owner_first_name, 
          spot_owner.last_name as spot_owner_last_name, spot_owner.email as spot_owner_email,
          spot_owner_dept.name as spot_owner_department,
          pp.payment_type as owner_payment_type,
          pp.payment_instructions as owner_payment_instructions
        FROM bookings b
        LEFT JOIN parking_spots ps ON b.spot_id = ps.id
        LEFT JOIN locations l ON ps.location_id = l.id
        LEFT JOIN users renter ON b.renter_id = renter.id
        LEFT JOIN users owner ON b.owner_id = owner.id
        LEFT JOIN departments renter_dept ON renter.department_id = renter_dept.id
        LEFT JOIN departments owner_dept ON owner.department_id = owner_dept.id
        LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
        LEFT JOIN departments spot_owner_dept ON spot_owner.department_id = spot_owner_dept.id
        LEFT JOIN payment_preferences pp ON ps.owner_id = pp.user_id
        WHERE 
          (b.booking_date < ${today} OR b.status = 'completed' OR b.status = 'cancelled')
          AND ps.is_bci_managed = true AND ps.owner_id IS NULL
          ${statusFilter ? sqlOp`AND b.status = ${statusFilter}` : sqlOp``}
          ${locationFilter ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${`%${locationFilter}%`}` : sqlOp``}
          ${dateFrom ? sqlOp`AND b.booking_date >= ${dateFrom}` : sqlOp``}
          ${dateTo ? sqlOp`AND b.booking_date <= ${dateTo}` : sqlOp``}
          ${searchPattern ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
        ORDER BY ${sqlOp.raw((() => {
          const PAST_SORT_COLUMNS: Record<string, string> = {
            spotNumber: 'ps.spot_number',
            renterName: "renter.first_name || ' ' || renter.last_name",
            ownerName: "COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, '')",
            bookingDate: 'b.booking_date',
            totalAmount: 'b.total_amount',
            status: 'b.status',
            createdAt: 'b.created_at',
          };
          const col = sort?.column && PAST_SORT_COLUMNS[sort.column] ? PAST_SORT_COLUMNS[sort.column] : 'b.booking_date';
          const dir = sort?.direction === 'asc' ? 'ASC' : 'DESC';
          return `${col} ${dir}`;
        })())}
      `;
      
      const allResults = await db.execute(allQuery);
      
      // Filter by payroll period and apply pagination
      const allRows = ((allResults as any).rows || []).filter((row: any) => {
        return getDeductionPeriod(row.booking_date) === payrollPeriod;
      });
      
      const total = allRows.length;
      const offset = (page - 1) * limit;
      const paginatedRows = allRows.slice(offset, offset + limit);
      
      const data = paginatedRows.map((row: any) => {
        const renterName = row.renter_first_name && row.renter_last_name 
          ? `${row.renter_first_name} ${row.renter_last_name}`
          : row.renter_email || 'Unknown';
        const ownerName = row.spot_owner_id
          ? (row.spot_owner_first_name && row.spot_owner_last_name 
              ? `${row.spot_owner_first_name} ${row.spot_owner_last_name}`
              : row.spot_owner_email || 'Unknown')
          : (row.is_bci_managed ? 'BCI Workplace Services' : 'Unknown');
        
        const spotLocation = row.building && row.level
          ? `${row.building} - ${row.level}`
          : 'Unknown Location';
        
        return {
          id: row.id,
          spotNumber: row.spot_number || 'N/A',
          spotLocation,
          renterName,
          renterEmail: row.renter_email || '',
          renterDepartment: row.renter_department || '',
          ownerName,
          ownerEmail: row.spot_owner_id ? (row.spot_owner_email || '') : '',
          ownerDepartment: row.spot_owner_id ? (row.spot_owner_department || '') : '',
          bookingDate: row.booking_date,
          dailyRate: Number(row.daily_rate),
          totalAmount: Number(row.total_amount),
          status: row.status,
          paymentReceived: row.payment_received,
          paymentStatus: row.payment_status || 'pending',
          notes: row.notes || '',
          createdAt: new Date(row.created_at).toISOString(),
          lastActivity: new Date(row.updated_at).toISOString(),
          ownerPaymentType: row.owner_payment_type || '',
          ownerPaymentInstructions: row.owner_payment_instructions || '',
        };
      });
      
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }
    
    // Standard pagination without payroll period filter
    const offset = (page - 1) * limit;
    
    // Use parameterized query with Drizzle sql template literals for count
    // Shared pool = BCI-managed AND no owner assigned
    const countQuery = sqlOp`
      SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      WHERE 
        (b.booking_date < ${today} OR b.status = 'completed' OR b.status = 'cancelled')
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${statusFilter ? sqlOp`AND b.status = ${statusFilter}` : sqlOp``}
        ${locationFilter ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${`%${locationFilter}%`}` : sqlOp``}
        ${dateFrom ? sqlOp`AND b.booking_date >= ${dateFrom}` : sqlOp``}
        ${dateTo ? sqlOp`AND b.booking_date <= ${dateTo}` : sqlOp``}
        ${searchPattern ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
    `;
    
    // Use parameterized query with Drizzle sql template literals
    // Include spot_owner for the assigned-to field (parkingSpots.ownerId)
    const baseQuery = sqlOp`
      SELECT 
        b.*,
        ps.spot_number, ps.location_id, ps.is_bci_managed, ps.owner_id as spot_owner_id,
        l.building, l.level,
        renter.id as renter_id, renter.first_name as renter_first_name, 
        renter.last_name as renter_last_name, renter.email as renter_email,
        owner.id as owner_id, owner.first_name as owner_first_name, 
        owner.last_name as owner_last_name, owner.email as owner_email,
        renter_dept.name as renter_department,
        owner_dept.name as owner_department,
        spot_owner.first_name as spot_owner_first_name, 
        spot_owner.last_name as spot_owner_last_name, spot_owner.email as spot_owner_email,
        spot_owner_dept.name as spot_owner_department,
        pp.payment_type as owner_payment_type,
        pp.payment_instructions as owner_payment_instructions
      FROM bookings b
      LEFT JOIN parking_spots ps ON b.spot_id = ps.id
      LEFT JOIN locations l ON ps.location_id = l.id
      LEFT JOIN users renter ON b.renter_id = renter.id
      LEFT JOIN users owner ON b.owner_id = owner.id
      LEFT JOIN departments renter_dept ON renter.department_id = renter_dept.id
      LEFT JOIN departments owner_dept ON owner.department_id = owner_dept.id
      LEFT JOIN users spot_owner ON ps.owner_id = spot_owner.id
      LEFT JOIN departments spot_owner_dept ON spot_owner.department_id = spot_owner_dept.id
      LEFT JOIN payment_preferences pp ON ps.owner_id = pp.user_id
      WHERE 
        (b.booking_date < ${today} OR b.status = 'completed' OR b.status = 'cancelled')
        ${isBciOnly ? sqlOp`AND ps.is_bci_managed = true AND ps.owner_id IS NULL` : sqlOp`AND (ps.owner_id IS NOT NULL OR ps.is_bci_managed = false)`}
        ${statusFilter ? sqlOp`AND b.status = ${statusFilter}` : sqlOp``}
        ${locationFilter ? sqlOp`AND (l.building || ' - ' || l.level) ILIKE ${`%${locationFilter}%`}` : sqlOp``}
        ${dateFrom ? sqlOp`AND b.booking_date >= ${dateFrom}` : sqlOp``}
        ${dateTo ? sqlOp`AND b.booking_date <= ${dateTo}` : sqlOp``}
        ${searchPattern ? sqlOp`AND (renter.first_name || ' ' || renter.last_name ILIKE ${searchPattern} OR renter.email ILIKE ${searchPattern} OR spot_owner.first_name || ' ' || spot_owner.last_name ILIKE ${searchPattern} OR spot_owner.email ILIKE ${searchPattern} OR ps.spot_number ILIKE ${searchPattern} OR (l.building || ' - ' || l.level) ILIKE ${searchPattern})` : sqlOp``}
      ORDER BY ${sqlOp.raw((() => {
        const PAST_SORT_COLUMNS: Record<string, string> = {
          spotNumber: 'ps.spot_number',
          renterName: "renter.first_name || ' ' || renter.last_name",
          ownerName: "COALESCE(spot_owner.first_name || ' ' || spot_owner.last_name, '')",
          bookingDate: 'b.booking_date',
          totalAmount: 'b.total_amount',
          status: 'b.status',
          createdAt: 'b.created_at',
        };
        const col = sort?.column && PAST_SORT_COLUMNS[sort.column] ? PAST_SORT_COLUMNS[sort.column] : 'b.booking_date';
        const dir = sort?.direction === 'asc' ? 'ASC' : 'DESC';
        return `${col} ${dir}`;
      })())}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const [countResults, results] = await Promise.all([
      db.execute(countQuery),
      db.execute(baseQuery),
    ]);
    const total = parseInt((countResults as any).rows?.[0]?.total || '0', 10);
    
    const data = ((results as any).rows || []).map((row: any) => {
      const renterName = row.renter_first_name && row.renter_last_name 
        ? `${row.renter_first_name} ${row.renter_last_name}`
        : row.renter_email || 'Unknown';
      // Show assigned owner name if spot has an owner, otherwise "BCI Workplace Services" for unassigned BCI-managed spots
      const ownerName = row.spot_owner_id
        ? (row.spot_owner_first_name && row.spot_owner_last_name 
            ? `${row.spot_owner_first_name} ${row.spot_owner_last_name}`
            : row.spot_owner_email || 'Unknown')
        : (row.is_bci_managed ? 'BCI Workplace Services' : 'Unknown');
      
      const spotLocation = row.building && row.level
        ? `${row.building} - ${row.level}`
        : 'Unknown Location';
      
      return {
        id: row.id,
        spotNumber: row.spot_number || 'N/A',
        spotLocation,
        renterName,
        renterEmail: row.renter_email || '',
        renterDepartment: row.renter_department || '',
        ownerName,
        ownerEmail: row.spot_owner_id ? (row.spot_owner_email || '') : '',
        ownerDepartment: row.spot_owner_id ? (row.spot_owner_department || '') : '',
        bookingDate: row.booking_date,
        dailyRate: Number(row.daily_rate),
        totalAmount: Number(row.total_amount),
        status: row.status,
        paymentReceived: row.payment_received,
        paymentStatus: row.payment_status || 'pending',
        notes: row.notes || '',
        createdAt: new Date(row.created_at).toISOString(),
        lastActivity: new Date(row.updated_at).toISOString(),
        ownerPaymentType: row.owner_payment_type || '',
        ownerPaymentInstructions: row.owner_payment_instructions || '',
      };
    });
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Dispute operations
  async createDispute(insertDispute: InsertDispute): Promise<Dispute> {
    const id = randomUUID();
    const now = new Date();
    
    const { status, ...disputeData } = insertDispute;
    
    const [dispute] = await db.insert(disputes).values({
      id,
      ...disputeData,
      status: (status || 'open') as DisputeStatus,
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
    
    const { status, ...otherUpdates } = updates;
    
    const updated = await db.update(disputes)
      .set({
        ...otherUpdates,
        ...(status ? { status: status as DisputeStatus } : {}),
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

  // Spot Assignment History operations
  async recordSpotAssignment(data: InsertSpotAssignmentHistory): Promise<void> {
    await db.insert(spotAssignmentHistory).values([{
      ...data,
      id: crypto.randomUUID()
    } as any]);
  }

  async getSpotAssignmentHistory(filters: { 
    from?: string; 
    to?: string; 
    action?: string; 
    departmentId?: number;
    scope?: 'bci' | 'all';
  }): Promise<SpotAssignmentHistoryWithDetails[]> {
    const { from, to, action, departmentId, scope = 'all' } = filters;
    
    // Build where conditions
    const conditions = [];
    
    if (from) {
      conditions.push(sqlOp`${spotAssignmentHistory.effectiveAt} >= ${from}`);
    }
    
    if (to) {
      conditions.push(sqlOp`${spotAssignmentHistory.effectiveAt} <= ${to}`);
    }
    
    if (action && action !== 'all') {
      conditions.push(eq(spotAssignmentHistory.action, action as "assigned" | "unassigned"));
    }
    
    if (departmentId) {
      conditions.push(eq(users.departmentId, departmentId));
    }
    
    if (scope === 'bci') {
      conditions.push(eq(parkingSpots.isBciManaged, true));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Query with joins
    const results = await db
      .select({
        id: spotAssignmentHistory.id,
        spotId: spotAssignmentHistory.spotId,
        userId: spotAssignmentHistory.userId,
        action: spotAssignmentHistory.action,
        effectiveAt: spotAssignmentHistory.effectiveAt,
        actorId: spotAssignmentHistory.actorId,
        notes: spotAssignmentHistory.notes,
        createdAt: spotAssignmentHistory.createdAt,
        // User details
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        // Department details
        userDepartment: departments.name,
        // Spot details
        spotNumber: parkingSpots.spotNumber,
        spotLocation: locations.office,
        spotType: spotTypesTable.name,
        spotMonthlyFee: spotTypesTable.bciChargingAmount,
        // Actor details (join separately)
        actorFirstName: sqlOp<string | null>`actor.first_name`,
        actorLastName: sqlOp<string | null>`actor.last_name`,
      })
      .from(spotAssignmentHistory)
      .innerJoin(users, eq(spotAssignmentHistory.userId, users.id))
      .innerJoin(parkingSpots, eq(spotAssignmentHistory.spotId, parkingSpots.id))
      .innerJoin(locations, eq(parkingSpots.locationId, locations.id))
      .innerJoin(spotTypesTable, eq(parkingSpots.spotTypeId, spotTypesTable.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(
        sqlOp`users AS actor`,
        sqlOp`${spotAssignmentHistory.actorId} = actor.id`
      )
      .where(whereClause)
      .orderBy(desc(spotAssignmentHistory.effectiveAt));
    
    // Transform to SpotAssignmentHistoryWithDetails
    return results.map(row => ({
      id: row.id,
      spotId: row.spotId,
      userId: row.userId,
      action: row.action,
      effectiveAt: row.effectiveAt,
      actorId: row.actorId,
      notes: row.notes,
      createdAt: row.createdAt,
      user: {
        id: row.userId,
        firstName: row.userFirstName || '',
        lastName: row.userLastName || '',
        email: row.userEmail || '',
        department: row.userDepartment || 'N/A',
      },
      spot: {
        spotNumber: row.spotNumber,
        location: row.spotLocation,
        spotType: row.spotType,
        monthlyFee: String(row.spotMonthlyFee ?? "0"),
      },
      actor: row.actorFirstName && row.actorLastName ? {
        firstName: row.actorFirstName,
        lastName: row.actorLastName,
      } : null,
    }));
  }

  // Locker Management operations
  async getAllLockers(): Promise<any[]> {
    const results = await db
      .select({
        id: lockers.id,
        lockerNumber: lockers.lockerNumber,
        locationId: lockers.locationId,
        locationName: sqlOp<string>`${locations.office} || ' - ' || ${locations.building}`,
        lockerTypeId: lockers.lockerTypeId,
        lockerTypeName: lockerTypesTable.name,
        status: lockers.status,
        isBciManaged: lockers.isBciManaged,
        assignedTo: lockers.userId,
        assignedUserName: sqlOp<string>`${users.firstName} || ' ' || ${users.lastName}`,
        assignedUserEmail: users.email,
        notes: lockers.notes
      })
      .from(lockers)
      .leftJoin(locations, eq(lockers.locationId, locations.id))
      .leftJoin(lockerTypesTable, eq(lockers.lockerTypeId, lockerTypesTable.id))
      .leftJoin(users, eq(lockers.userId, users.id))
      .orderBy(asc(lockers.lockerNumber));
    
    return results;
  }

  async getLockerById(id: string): Promise<Locker | null> {
    const results = await db.select().from(lockers).where(eq(lockers.id, id)).limit(1);
    return results.length > 0 ? results[0] : null;
  }

  async getLockersByLocation(locationId: number): Promise<Locker[]> {
    const results = await db
      .select()
      .from(lockers)
      .where(eq(lockers.locationId, locationId))
      .orderBy(asc(lockers.lockerNumber));
    return results;
  }

  async createLocker(data: InsertLocker): Promise<Locker> {
    const [newLocker] = await db.insert(lockers).values([data as any]).returning();
    return newLocker;
  }

  async updateLocker(id: string, data: Partial<InsertLocker>): Promise<Locker | null> {
    const existing = await db.select().from(lockers).where(eq(lockers.id, id)).limit(1);
    if (existing.length === 0) return null;

    const [updated] = await db
      .update(lockers)
      .set(data as any)
      .where(eq(lockers.id, id))
      .returning();
    
    return updated;
  }

  async deleteLocker(id: string): Promise<void> {
    await db.delete(lockers).where(eq(lockers.id, id));
  }

  async assignLocker(
    lockerId: string, 
    userId: string, 
    actorId: string, 
    effectiveDate: string, 
    notes?: string
  ): Promise<Locker | null> {
    const existing = await db.select().from(lockers).where(eq(lockers.id, lockerId)).limit(1);
    if (existing.length === 0) return null;

    // Use transaction to update locker and create history entry
    const result = await db.transaction(async (tx) => {
      // Update locker
      const [updatedLocker] = await tx
        .update(lockers)
        .set({
          status: 'assigned',
          userId,
          assignedAt: new Date(),
          notes
        })
        .where(eq(lockers.id, lockerId))
        .returning();

      // Create history entry
      await tx.insert(lockerAssignmentHistory).values({
        lockerId,
        userId,
        action: 'assigned',
        actorId,
        effectiveDate,
        notes
      });

      return updatedLocker;
    });

    return result;
  }

  async unassignLocker(
    lockerId: string, 
    actorId: string, 
    effectiveDate: string, 
    notes?: string
  ): Promise<Locker | null> {
    const existing = await db.select().from(lockers).where(eq(lockers.id, lockerId)).limit(1);
    if (existing.length === 0) return null;

    const previousUserId = existing[0].userId;

    // Use transaction to update locker and create history entry
    const result = await db.transaction(async (tx) => {
      // Update locker
      const [updatedLocker] = await tx
        .update(lockers)
        .set({
          status: 'available',
          userId: null,
          assignedAt: null,
          notes
        })
        .where(eq(lockers.id, lockerId))
        .returning();

      // Create history entry
      await tx.insert(lockerAssignmentHistory).values({
        lockerId,
        userId: previousUserId,
        action: 'unassigned',
        actorId,
        effectiveDate,
        notes
      });

      return updatedLocker;
    });

    return result;
  }

  // Locker Waitlist operations
  async getLockerWaitlist(): Promise<LockerWaitlist[]> {
    const results = await db
      .select()
      .from(lockerWaitlist)
      .orderBy(asc(lockerWaitlist.requestedAt));
    return results;
  }

  async addToLockerWaitlist(data: InsertLockerWaitlist): Promise<LockerWaitlist> {
    const [newEntry] = await db.insert(lockerWaitlist).values([data as any]).returning();
    return newEntry;
  }

  async updateLockerWaitlistStatus(
    id: string, 
    status: string, 
    fulfilledAt?: Date
  ): Promise<LockerWaitlist | null> {
    const existing = await db.select().from(lockerWaitlist).where(eq(lockerWaitlist.id, id)).limit(1);
    if (existing.length === 0) return null;

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (fulfilledAt) {
      updateData.fulfilledAt = fulfilledAt;
    }

    const [updated] = await db
      .update(lockerWaitlist)
      .set(updateData)
      .where(eq(lockerWaitlist.id, id))
      .returning();
    
    return updated;
  }

  async removeFromLockerWaitlist(id: string): Promise<void> {
    await db.delete(lockerWaitlist).where(eq(lockerWaitlist.id, id));
  }

  // Locker Assignment History operations
  async getLockerAssignmentHistory(lockerId?: string, userId?: string): Promise<LockerAssignmentHistory[]> {
    const conditions = [];
    
    if (lockerId) {
      conditions.push(eq(lockerAssignmentHistory.lockerId, lockerId));
    }
    
    if (userId) {
      conditions.push(eq(lockerAssignmentHistory.userId, userId));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const results = await db
      .select()
      .from(lockerAssignmentHistory)
      .where(whereClause)
      .orderBy(desc(lockerAssignmentHistory.effectiveDate));
    
    return results;
  }

  async recordLockerAssignment(data: InsertLockerAssignmentHistory): Promise<LockerAssignmentHistory> {
    const [newHistory] = await db.insert(lockerAssignmentHistory).values([data as any]).returning();
    return newHistory;
  }

  // Locker Type operations
  async getAllLockerTypes(): Promise<LockerType[]> {
    const results = await db.select().from(lockerTypesTable).orderBy(asc(lockerTypesTable.name));
    return results;
  }

  // App Configuration operations
  async getAllAppConfigs(): Promise<AppConfig[]> {
    const results = await db.select().from(appConfigs).orderBy(asc(appConfigs.category), asc(appConfigs.label));
    return results;
  }

  async getAppConfig(key: string): Promise<AppConfig | undefined> {
    const results = await db.select().from(appConfigs).where(eq(appConfigs.key, key)).limit(1);
    return results[0];
  }

  async getAppConfigValue(key: string): Promise<string | undefined> {
    const config = await this.getAppConfig(key);
    return config?.value;
  }

  async updateAppConfig(key: string, value: string, updatedBy?: string): Promise<AppConfig | undefined> {
    const updates: Partial<AppConfig> = {
      value,
      updatedAt: new Date(),
    };
    
    if (updatedBy) {
      updates.updatedBy = updatedBy;
    }

    const results = await db
      .update(appConfigs)
      .set(updates)
      .where(eq(appConfigs.key, key))
      .returning();
    
    return results[0];
  }

  async createAppConfig(config: InsertAppConfig): Promise<AppConfig> {
    const results = await db.insert(appConfigs).values(config).returning();
    return results[0];
  }

  async deleteAppConfig(key: string): Promise<boolean> {
    const result = await db.delete(appConfigs).where(eq(appConfigs.key, key));
    return (result.rowCount ?? 0) > 0;
  }

  // API Key operations (system-wide keys)
  async createApiKey(data: { keyHash: string; keyPrefix: string; name: string }): Promise<ApiKey> {
    const [result] = await db.insert(apiKeys).values(data).returning();
    return result;
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).where(isNull(apiKeys.revokedAt)).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [result] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt))).limit(1);
    return result;
  }

  async revokeApiKeyAdmin(id: string): Promise<boolean> {
    const [result] = await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)).returning();
    return !!result;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async createScheduledAssignment(data: InsertScheduledSpotAssignment): Promise<ScheduledSpotAssignment> {
    const [result] = await db.insert(scheduledSpotAssignments).values(data).returning();
    return result;
  }

  async getScheduledAssignments(spotId?: string): Promise<ScheduledSpotAssignment[]> {
    if (spotId) {
      return db.select().from(scheduledSpotAssignments)
        .where(and(eq(scheduledSpotAssignments.spotId, spotId), eq(scheduledSpotAssignments.status, 'pending')))
        .orderBy(desc(scheduledSpotAssignments.createdAt));
    }
    return db.select().from(scheduledSpotAssignments)
      .where(eq(scheduledSpotAssignments.status, 'pending'))
      .orderBy(desc(scheduledSpotAssignments.createdAt));
  }

  async getScheduledAssignment(id: string): Promise<ScheduledSpotAssignment | undefined> {
    const [result] = await db.select().from(scheduledSpotAssignments).where(eq(scheduledSpotAssignments.id, id)).limit(1);
    return result;
  }

  async updateScheduledAssignment(id: string, updates: Partial<InsertScheduledSpotAssignment> & { status?: ScheduledAssignmentStatus }): Promise<ScheduledSpotAssignment | undefined> {
    const [result] = await db.update(scheduledSpotAssignments).set(updates).where(eq(scheduledSpotAssignments.id, id)).returning();
    return result;
  }

  async getPendingScheduledAssignmentsDue(): Promise<ScheduledSpotAssignment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    return db.select().from(scheduledSpotAssignments)
      .where(and(
        eq(scheduledSpotAssignments.status, 'pending'),
        sqlOp`${scheduledSpotAssignments.scheduledDate} <= ${todayStr}`
      ))
      .orderBy(asc(scheduledSpotAssignments.scheduledDate));
  }

  async cancelSpotPendingScheduledAssignments(spotId: string): Promise<number> {
    const cancelledStatus: ScheduledAssignmentStatus = 'cancelled';
    const result = await db.update(scheduledSpotAssignments)
      .set({ status: cancelledStatus })
      .where(and(
        eq(scheduledSpotAssignments.spotId, spotId),
        eq(scheduledSpotAssignments.status, 'pending')
      ))
      .returning();
    return result.length;
  }

  // Feature Announcements operations
  async getAllAnnouncements(): Promise<FeatureAnnouncement[]> {
    return db.select().from(featureAnnouncements).orderBy(asc(featureAnnouncements.sortOrder), asc(featureAnnouncements.createdAt));
  }

  async getUnseenAnnouncements(userId: string): Promise<FeatureAnnouncement[]> {
    const user = await this.getUser(userId);
    const lastSeenId = user?.lastSeenAnnouncementId ?? 0;
    const results = await db.select().from(featureAnnouncements)
      .where(and(
        eq(featureAnnouncements.enabled, true),
        sqlOp`${featureAnnouncements.id} > ${lastSeenId}`
      ))
      .orderBy(asc(featureAnnouncements.sortOrder), asc(featureAnnouncements.createdAt));
    return results;
  }

  async dismissAnnouncements(userId: string): Promise<void> {
    const maxResult = await db.select({ maxId: sqlOp<number>`MAX(${featureAnnouncements.id})` }).from(featureAnnouncements).where(eq(featureAnnouncements.enabled, true));
    const maxId = maxResult[0]?.maxId ?? 0;
    if (maxId > 0) {
      await db.update(users).set({ lastSeenAnnouncementId: maxId }).where(eq(users.id, userId));
    }
  }

  async createAnnouncement(data: InsertFeatureAnnouncement): Promise<FeatureAnnouncement> {
    const [result] = await db.insert(featureAnnouncements).values(data).returning();
    return result;
  }

  async updateAnnouncement(id: number, updates: UpdateFeatureAnnouncement): Promise<FeatureAnnouncement | undefined> {
    const [result] = await db.update(featureAnnouncements).set(updates).where(eq(featureAnnouncements.id, id)).returning();
    return result;
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const result = await db.delete(featureAnnouncements).where(eq(featureAnnouncements.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Spot Alert Subscription operations
  async getSpotAlertSubscription(userId: string): Promise<SpotAlertSubscription | undefined> {
    const [result] = await db.select().from(spotAlertSubscriptions).where(eq(spotAlertSubscriptions.userId, userId));
    return result;
  }

  async upsertSpotAlertSubscription(userId: string, data: UpdateSpotAlertSubscription): Promise<SpotAlertSubscription> {
    const existing = await this.getSpotAlertSubscription(userId);
    if (existing) {
      const [result] = await db
        .update(spotAlertSubscriptions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(spotAlertSubscriptions.userId, userId))
        .returning();
      return result;
    } else {
      const [result] = await db
        .insert(spotAlertSubscriptions)
        .values({ userId, isActive: false, daysOfWeek: [], maxDailyPrice: null, ...data })
        .returning();
      return result;
    }
  }

  async getActiveSpotAlertSubscribers(): Promise<SpotAlertSubscription[]> {
    return db.select().from(spotAlertSubscriptions).where(eq(spotAlertSubscriptions.isActive, true));
  }

  // ===== Sale Event Operations =====

  async getAllSaleEvents(): Promise<SaleEvent[]> {
    return db.select().from(saleEvents).orderBy(desc(saleEvents.createdAt));
  }

  async getSaleEvent(id: string): Promise<SaleEvent | undefined> {
    const [result] = await db.select().from(saleEvents).where(eq(saleEvents.id, id));
    return result;
  }

  async createSaleEvent(data: InsertSaleEvent & { createdBy?: string }): Promise<SaleEvent> {
    const { discountValue, ...rest } = data;
    const [result] = await db.insert(saleEvents).values({
      ...rest,
      discountValue: String(discountValue),
      createdBy: data.createdBy || null,
    }).returning();
    return result;
  }

  async updateSaleEvent(id: string, updates: Partial<InsertSaleEvent> & { status?: SaleEventStatus; affectedListingCount?: number }): Promise<SaleEvent | undefined> {
    const { discountValue, ...restUpdates } = updates;
    const setData: Partial<typeof saleEvents.$inferInsert> & { updatedAt: Date } = {
      ...restUpdates,
      updatedAt: new Date(),
    };
    if (discountValue !== undefined) {
      setData.discountValue = String(discountValue);
    }
    const [result] = await db.update(saleEvents).set(setData).where(eq(saleEvents.id, id)).returning();
    return result;
  }

  async deleteSaleEvent(id: string): Promise<boolean> {
    // First deactivate if active (restore prices)
    const event = await this.getSaleEvent(id);
    if (event && event.status === 'active') {
      await this.deactivateSaleEvent(id);
    }
    const result = await db.delete(saleEvents).where(eq(saleEvents.id, id)).returning({ id: saleEvents.id });
    return result.length > 0;
  }

  async previewSaleEventListings(startDate: string, endDate: string): Promise<{ count: number; listingIds: string[] }> {
    // Find all WPS admin-created listings whose available dates overlap with [startDate, endDate].
    // We filter by createdByAdmin=true on the listing — this is the definitive guard that ensures
    // employee peer-to-peer listings are NEVER touched, even if the underlying spot is company-owned.
    // We do NOT filter by isBciManaged on the spot because all spots in this system are company-owned,
    // making that flag redundant and misleading as a filter.

    // Select extra fields needed for recurring daysOfWeek validation
    const candidates = await db.select({
      id: spotListings.id,
      listingType: spotListings.listingType,
      daysOfWeek: spotListings.daysOfWeek,
      recurringStartDate: spotListings.recurringStartDate,
      recurringEndDate: spotListings.recurringEndDate,
    })
      .from(spotListings)
      .where(
        and(
          eq(spotListings.createdByAdmin, true), // Only WPS/admin-created listings — never touch peer-to-peer employee listings
          eq(spotListings.status, 'available'),
          isNull(spotListings.deletedAt),
          isNull(spotListings.saleEventId), // Not already in a sale
          or(
            // single date within range
            and(
              eq(spotListings.listingType, 'single'),
              sqlOp`${spotListings.singleDate} >= ${startDate}`,
              sqlOp`${spotListings.singleDate} <= ${endDate}`
            ),
            // period overlaps range
            and(
              eq(spotListings.listingType, 'period'),
              sqlOp`${spotListings.periodStartDate} <= ${endDate}`,
              sqlOp`${spotListings.periodEndDate} >= ${startDate}`
            ),
            // recurring: date range overlaps (pre-filter; will verify daysOfWeek below)
            and(
              eq(spotListings.listingType, 'recurring'),
              sqlOp`${spotListings.recurringStartDate} <= ${endDate}`,
              or(
                isNull(spotListings.recurringEndDate),
                sqlOp`${spotListings.recurringEndDate} >= ${startDate}`
              )
            )
          )
        )
      );
    
    // Post-filter recurring listings: verify at least one occurrence falls within the sale window
    // daysOfWeek is stored as text names (e.g., "monday", "tuesday") matching codebase convention
    const dayNameToNumber: Record<string, number> = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };

    const saleStart = new Date(startDate + 'T00:00:00Z');
    const saleEnd = new Date(endDate + 'T00:00:00Z');

    const validListingIds = candidates
      .filter(listing => {
        if (listing.listingType !== 'recurring') return true; // Single/period already validated by SQL
        if (!listing.daysOfWeek || listing.daysOfWeek.length === 0) return false; // No days configured

        const windowStart = listing.recurringStartDate
          ? new Date(Math.max(new Date(listing.recurringStartDate + 'T00:00:00Z').getTime(), saleStart.getTime()))
          : saleStart;
        const windowEnd = listing.recurringEndDate
          ? new Date(Math.min(new Date(listing.recurringEndDate + 'T00:00:00Z').getTime(), saleEnd.getTime()))
          : saleEnd;

        if (windowStart > windowEnd) return false;

        // Convert text day names to numeric day indices (0=Sunday ... 6=Saturday)
        const allowedDays = new Set(
          (listing.daysOfWeek as string[])
            .map(day => dayNameToNumber[day.toLowerCase()])
            .filter(n => n !== undefined)
        );

        // Check each day in the overlap window to see if any configured day occurs
        for (let d = new Date(windowStart); d <= windowEnd; d.setUTCDate(d.getUTCDate() + 1)) {
          if (allowedDays.has(d.getUTCDay())) return true;
        }
        return false;
      })
      .map(l => l.id);
    
    return { count: validListingIds.length, listingIds: validListingIds };
  }

  async activateSaleEvent(id: string): Promise<{ updatedListings: Array<{ id: string; spotId: string; dailyRate: string; originalDailyRate: string | null }> }> {
    const event = await this.getSaleEvent(id);
    if (!event) throw new Error(`Sale event ${id} not found`);

    const { listingIds } = await this.previewSaleEventListings(event.startDate, event.endDate);
    if (listingIds.length === 0) {
      await db.update(saleEvents).set({ status: 'active', affectedListingCount: 0, updatedAt: new Date() }).where(eq(saleEvents.id, id));
      return { updatedListings: [] };
    }

    // Fetch current listings to compute discounted price
    const currentListings = await db.select({
      id: spotListings.id,
      spotId: spotListings.spotId,
      dailyRate: spotListings.dailyRate,
      originalDailyRate: spotListings.originalDailyRate,
    }).from(spotListings).where(inArray(spotListings.id, listingIds));

    const discountValue = parseFloat(event.discountValue);
    const updatedListings: Array<{ id: string; spotId: string; dailyRate: string; originalDailyRate: string | null }> = [];

    for (const listing of currentListings) {
      const currentRate = parseFloat(listing.dailyRate);
      let newRate: number;
      if (event.discountType === 'percentage') {
        newRate = Math.max(0, currentRate * (1 - discountValue / 100));
      } else {
        newRate = Math.max(0, discountValue);
      }
      const newRateStr = newRate.toFixed(2);
      
      await db.update(spotListings).set({
        dailyRate: newRateStr,
        originalDailyRate: listing.originalDailyRate || listing.dailyRate,
        saleEventId: id,
        saleCalendarLabel: event.calendarLabel,
        saleCalendarColor: event.labelColor || 'fuchsia',
        saleStartDate: event.startDate,
        saleEndDate: event.endDate,
        updatedAt: new Date(),
      }).where(eq(spotListings.id, listing.id));

      updatedListings.push({
        id: listing.id,
        spotId: listing.spotId,
        dailyRate: newRateStr,
        originalDailyRate: listing.originalDailyRate || listing.dailyRate,
      });
    }

    // Mark sale event as active
    await db.update(saleEvents).set({
      status: 'active',
      affectedListingCount: updatedListings.length,
      updatedAt: new Date(),
    }).where(eq(saleEvents.id, id));

    return { updatedListings };
  }

  async deactivateSaleEvent(id: string): Promise<{ restoredCount: number }> {
    // Find listings tied to this sale event
    const affectedListings = await db.select({
      id: spotListings.id,
      originalDailyRate: spotListings.originalDailyRate,
    }).from(spotListings).where(eq(spotListings.saleEventId, id));

    let restoredCount = 0;
    for (const listing of affectedListings) {
      if (listing.originalDailyRate) {
        await db.update(spotListings).set({
          dailyRate: listing.originalDailyRate,
          originalDailyRate: null,
          saleEventId: null,
          saleCalendarLabel: null,
          saleCalendarColor: null,
          saleStartDate: null,
          saleEndDate: null,
          updatedAt: new Date(),
        }).where(eq(spotListings.id, listing.id));
        restoredCount++;
      }
    }

    // Mark sale event as inactive
    await db.update(saleEvents).set({
      status: 'inactive',
      updatedAt: new Date(),
    }).where(eq(saleEvents.id, id));

    return { restoredCount };
  }

  // Audit decorators will be applied via server initialization
}

// Initialize storage and audit system 
import { dbAuditStorage as auditStorage } from "./audit-storage";
import { auditService } from "./audit-service";

const storage = new MemStorage();
storage.setAuditStorage(auditStorage);
auditService.setStorage(storage);

export { storage };
