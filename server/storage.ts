import { 
  type User, 
  type InsertUser, 
  type UpsertUser,
  type ParkingSpot,
  type InsertParkingSpot,
  type SpotListing,
  type InsertSpotListing,
  type Booking,
  type InsertBooking,
  type WaitingList,
  type InsertWaitingList,
  type UserRole,
  type SpotType,
  type ListingType,
  type ListingStatus,
  type BookingStatus,
  type AuditLog,
  type InsertAuditLog
} from "@shared/schema";
import { randomUUID } from "crypto";
import { auditDecorator } from "./audit-service";
import { type IAuditStorage } from "./audit-storage";

// Storage interface with comprehensive CRUD methods
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Parking Spot operations
  getParkingSpot(id: string): Promise<ParkingSpot | undefined>;
  getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]>;
  getAllParkingSpots(): Promise<ParkingSpot[]>;
  createParkingSpot(spot: InsertParkingSpot): Promise<ParkingSpot>;
  updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined>;
  deleteParkingSpot(id: string): Promise<boolean>;

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

  // Bookability control operations
  toggleSpotBookability(spotId: string, isBookable: boolean): Promise<ParkingSpot | undefined>;
  bulkToggleSpotBookability(spotIds: string[], isBookable: boolean): Promise<ParkingSpot[]>;
  
  // Recent assignments tracking
  getRecentAssignments(daysBack?: number): Promise<WaitingList[]>;
  
  // Audit storage operations (delegated to audit storage)
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  queryAuditLogs(filters: any, pagination: any): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private parkingSpots: Map<string, ParkingSpot>;
  private spotListings: Map<string, SpotListing>;
  private bookings: Map<string, Booking>;
  private waitingList: Map<string, WaitingList>;
  private auditStorage: IAuditStorage;

  constructor(auditStorage?: IAuditStorage) {
    this.users = new Map();
    this.parkingSpots = new Map();
    this.spotListings = new Map();
    this.bookings = new Map();
    this.waitingList = new Map();
    
    // Inject audit storage (will be set externally)
    this.auditStorage = auditStorage as IAuditStorage;
    
    // Add sample data for testing
    this.seedTestData();
  }
  
  // Set audit storage after construction (dependency injection)
  setAuditStorage(auditStorage: IAuditStorage) {
    this.auditStorage = auditStorage;
  }

  private seedTestData() {
    // Create sample users for testing - using Replit Auth format
    const adminUser: User = {
      id: "user-admin-001",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      profileImageUrl: null,
      phone: "(555) 123-4567",
      department: "IT",
      role: "admin",
      memberSince: "January 2022",
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(adminUser.id, adminUser);

    const ownerUser: User = {
      id: "user-owner-001",
      email: "owner@example.com",
      firstName: "Owner",
      lastName: "User",
      profileImageUrl: null,
      phone: "(555) 234-5678",
      department: "Engineering",
      role: "owner",
      memberSince: "January 2023",
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(ownerUser.id, ownerUser);

    const renterUser: User = {
      id: "user-renter-001",
      email: "renter@example.com",
      firstName: "Renter",
      lastName: "User",
      profileImageUrl: null,
      phone: "(555) 345-6789",
      department: "Marketing",
      role: "renter",
      memberSince: "February 2023",
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(renterUser.id, renterUser);

    // Create additional test users for realistic parking spot assignments
    const additionalUsers: User[] = [
      {
        id: "user-emp-001", email: "j.smith@bci.ca", firstName: "John", lastName: "Smith",
        profileImageUrl: null, phone: "(250) 555-0101", department: "Engineering", role: "owner",
        memberSince: "March 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-002", email: "s.jones@bci.ca", firstName: "Sarah", lastName: "Jones", 
        profileImageUrl: null, phone: "(250) 555-0102", department: "Finance", role: "owner",
        memberSince: "June 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-003", email: "m.brown@bci.ca", firstName: "Michael", lastName: "Brown",
        profileImageUrl: null, phone: "(250) 555-0103", department: "Operations", role: "owner", 
        memberSince: "August 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-004", email: "l.wilson@bci.ca", firstName: "Lisa", lastName: "Wilson",
        profileImageUrl: null, phone: "(250) 555-0104", department: "HR", role: "owner",
        memberSince: "September 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-005", email: "d.taylor@bci.ca", firstName: "David", lastName: "Taylor",
        profileImageUrl: null, phone: "(250) 555-0105", department: "IT", role: "owner",
        memberSince: "October 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-006", email: "a.davis@bci.ca", firstName: "Amanda", lastName: "Davis",
        profileImageUrl: null, phone: "(250) 555-0106", department: "Marketing", role: "owner",
        memberSince: "November 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-007", email: "r.miller@bci.ca", firstName: "Robert", lastName: "Miller",
        profileImageUrl: null, phone: "(250) 555-0107", department: "Legal", role: "owner",
        memberSince: "December 2022", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-008", email: "k.anderson@bci.ca", firstName: "Karen", lastName: "Anderson",
        profileImageUrl: null, phone: "(250) 555-0108", department: "Claims", role: "owner",
        memberSince: "January 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-009", email: "t.thomas@bci.ca", firstName: "Thomas", lastName: "Thomas",
        profileImageUrl: null, phone: "(250) 555-0109", department: "Underwriting", role: "owner",
        memberSince: "February 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-010", email: "n.jackson@bci.ca", firstName: "Nancy", lastName: "Jackson",
        profileImageUrl: null, phone: "(250) 555-0110", department: "Customer Service", role: "owner",
        memberSince: "March 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-011", email: "p.white@bci.ca", firstName: "Paul", lastName: "White",
        profileImageUrl: null, phone: "(250) 555-0111", department: "Engineering", role: "owner",
        memberSince: "April 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-012", email: "j.harris@bci.ca", firstName: "Jennifer", lastName: "Harris",
        profileImageUrl: null, phone: "(250) 555-0112", department: "Finance", role: "owner",
        memberSince: "May 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-013", email: "c.martin@bci.ca", firstName: "Christopher", lastName: "Martin", 
        profileImageUrl: null, phone: "(250) 555-0113", department: "Operations", role: "owner",
        memberSince: "June 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-014", email: "b.thompson@bci.ca", firstName: "Barbara", lastName: "Thompson",
        profileImageUrl: null, phone: "(250) 555-0114", department: "HR", role: "owner",
        memberSince: "July 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-015", email: "s.garcia@bci.ca", firstName: "Steven", lastName: "Garcia",
        profileImageUrl: null, phone: "(250) 555-0115", department: "IT", role: "owner",
        memberSince: "August 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-016", email: "h.martinez@bci.ca", firstName: "Helen", lastName: "Martinez",
        profileImageUrl: null, phone: "(250) 555-0116", department: "Marketing", role: "owner",
        memberSince: "September 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-017", email: "j.robinson@bci.ca", firstName: "James", lastName: "Robinson",
        profileImageUrl: null, phone: "(250) 555-0117", department: "Legal", role: "owner",
        memberSince: "October 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-018", email: "m.clark@bci.ca", firstName: "Michelle", lastName: "Clark",
        profileImageUrl: null, phone: "(250) 555-0118", department: "Claims", role: "owner",
        memberSince: "November 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-019", email: "d.rodriguez@bci.ca", firstName: "Daniel", lastName: "Rodriguez",
        profileImageUrl: null, phone: "(250) 555-0119", department: "Underwriting", role: "owner",
        memberSince: "December 2023", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-020", email: "l.lewis@bci.ca", firstName: "Linda", lastName: "Lewis",
        profileImageUrl: null, phone: "(250) 555-0120", department: "Customer Service", role: "owner",
        memberSince: "January 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-021", email: "k.lee@bci.ca", firstName: "Kevin", lastName: "Lee",
        profileImageUrl: null, phone: "(250) 555-0121", department: "Engineering", role: "owner",
        memberSince: "February 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-022", email: "r.walker@bci.ca", firstName: "Rachel", lastName: "Walker",
        profileImageUrl: null, phone: "(250) 555-0122", department: "Finance", role: "owner",
        memberSince: "March 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-023", email: "g.hall@bci.ca", firstName: "Gregory", lastName: "Hall",
        profileImageUrl: null, phone: "(250) 555-0123", department: "Operations", role: "owner",
        memberSince: "April 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-024", email: "c.allen@bci.ca", firstName: "Carol", lastName: "Allen",
        profileImageUrl: null, phone: "(250) 555-0124", department: "HR", role: "owner",
        memberSince: "May 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "user-emp-025", email: "b.young@bci.ca", firstName: "Brian", lastName: "Young",
        profileImageUrl: null, phone: "(250) 555-0125", department: "IT", role: "owner",
        memberSince: "June 2024", lastLogin: new Date(), createdAt: new Date(), updatedAt: new Date()
      }
    ];

    // Add all additional users to storage
    additionalUsers.forEach(user => {
      this.users.set(user.id, user);
    });
    
    // Create all 121 BCI parking stalls for Victoria BC facility at 750 Pandora Ave
    // Underground parking with P1 (Level 1) and P2 (Level 2)
    const parkingSpots: ParkingSpot[] = [];

    // Define exact spot numbers for Victoria BCI location
    const level1Spots = [32, 33, 34, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102]; // 48 spots
    const level2Spots = [134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209]; // 73 spots
    
    // Get all user IDs for spot assignments
    const allUserIds = [
      adminUser.id, ownerUser.id, renterUser.id,
      ...additionalUsers.map(u => u.id)
    ];
    
    // Strategy: Assign 100 spots to users, keep 21 unassigned
    // Create assignment pool - randomly select 100 spots from 121 total
    const allSpotNumbers = [
      ...level1Spots, // 48 spots from Level 1
      ...level2Spots  // 73 spots from Level 2
    ];
    
    // Deterministically select 100 spots to assign, keeping 21 unassigned
    // Use a consistent pattern to ensure the same 100/21 split every time
    const shuffledSpots = [...allSpotNumbers].sort((a, b) => a - b); // Sort by spot number for consistency
    const assignedSpotNumbers = shuffledSpots.slice(0, 100); // First 100 spots (deterministic)
    const unassignedSpotNumbers = shuffledSpots.slice(100); // Last 21 spots (deterministic)
    
    // Function to get assigned owner for a spot
    const getAssignedOwner = (spotNum: number): string | null => {
      if (assignedSpotNumbers.includes(spotNum)) {
        // Ensure test spots are assigned to specific users
        if (spotNum === 41) return additionalUsers[0].id; // Tesla EV test spot
        if (spotNum === 136) return additionalUsers[1].id; // Test stall
        if (spotNum === 139) return additionalUsers[2].id; // Test stall  
        if (spotNum === 207) return additionalUsers[3].id; // Test stall
        
        // Reserved spots should be assigned to senior staff
        if (reservedSpots.includes(spotNum)) {
          const seniorStaff = [adminUser.id, ownerUser.id, ...additionalUsers.slice(0, 11)];
          return seniorStaff[spotNum % seniorStaff.length];
        }
        
        // Regular assignment - distribute among all users
        return allUserIds[spotNum % allUserIds.length];
      }
      return null; // Unassigned
    };

    // Define spot type assignments
    const reservedSpots = [32, 33, 34, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47]; // First 13 Level 1 spots (excluding P41)
    const accessibleSpots = [48]; // 1 accessible spot
    const teslaEvSpots = [41, 49, 50]; // 3 Tesla EV spots (P41 required as test stall)
    const regularEvSpots = [51, 52, 53, 54, 55, 56, 57, // Level 1 EV spots
                           134, 135, 137, 138, 140, 141, 142, 143]; // Level 2 EV spots (15 total)
    
    // All remaining spots are regular stalls (89 total, including test stalls P136, P139, P207)

    // Create Level 1 spots (P1)
    level1Spots.forEach(spotNum => {
      let spotType: SpotType;
      let description: string;
      let isBookable: boolean;

      if (reservedSpots.includes(spotNum)) {
        spotType = "reserved";
        description = "Reserved parking stall assigned by position";
        isBookable = false;
      } else if (accessibleSpots.includes(spotNum)) {
        spotType = "accessible";
        description = "Accessible parking with wheelchair access";
        isBookable = true;
      } else if (teslaEvSpots.includes(spotNum)) {
        spotType = "tesla_ev";
        description = spotNum === 41 ? "Tesla EV charging station (Test stall)" : "Tesla EV charging station";
        isBookable = true;
      } else if (regularEvSpots.includes(spotNum)) {
        spotType = "electric";
        description = "Electric vehicle charging station";
        isBookable = true;
      } else {
        spotType = "regular";
        description = "General parking stall";
        isBookable = true;
      }

      parkingSpots.push({
        id: `spot-${spotNum}`,
        spotNumber: spotNum.toString(),
        location: "Level 1",
        spotType,
        description,
        isIndoor: true,
        isActive: true,
        isBookable,
        ownerId: getAssignedOwner(spotNum),
        createdAt: new Date()
      });
    });

    // Create Level 2 spots (P2)
    level2Spots.forEach(spotNum => {
      let spotType: SpotType;
      let description: string;
      let isBookable: boolean;

      if (regularEvSpots.includes(spotNum)) {
        spotType = "electric";
        description = "Electric vehicle charging station";
        isBookable = true;
      } else {
        spotType = "regular";
        // Mark test stalls
        if ([136, 139, 207].includes(spotNum)) {
          description = `General parking stall (Test stall #${spotNum})`;
        } else {
          description = "General parking stall";
        }
        isBookable = true;
      }

      parkingSpots.push({
        id: `spot-${spotNum}`,
        spotNumber: spotNum.toString(),
        location: "Level 2",
        spotType,
        description,
        isIndoor: true,
        isActive: true,
        isBookable,
        ownerId: getAssignedOwner(spotNum),
        createdAt: new Date()
      });
    });

    // Add all parking spots to the storage
    parkingSpots.forEach(spot => {
      this.parkingSpots.set(spot.id, spot);
    });

    // Create sample listings with different statuses for testing 6-tab system
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Active listing (available)
    const listing1: SpotListing = {
      id: "listing-1",
      spotId: "spot-15", // Tesla EV stall
      ownerId: ownerUser.id,
      listingType: "single",
      status: "active",
      singleDate: tomorrow,
      dailyRate: "25.00",
      notes: "Electric charging available",
      periodStartDate: null,
      periodEndDate: null,
      recurringStartDate: null,
      recurringEndDate: null,
      daysOfWeek: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Booked listing (also active)
    const listing2: SpotListing = {
      id: "listing-2",
      spotId: "spot-32", // Regular stall
      ownerId: ownerUser.id,
      listingType: "single", 
      status: "active",
      singleDate: today,
      dailyRate: "20.00",
      notes: null,
      periodStartDate: null,
      periodEndDate: null,
      recurringStartDate: null,
      recurringEndDate: null,
      daysOfWeek: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Used listing without payment (payment pending)
    const listing3: SpotListing = {
      id: "listing-3",
      spotId: "spot-15", // Tesla EV stall
      ownerId: ownerUser.id,
      listingType: "single",
      status: "expired",
      singleDate: yesterday,
      dailyRate: "25.00", 
      notes: null,
      periodStartDate: null,
      periodEndDate: null,
      recurringStartDate: null,
      recurringEndDate: null,
      daysOfWeek: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Used listing with payment (completed)
    const listing4: SpotListing = {
      id: "listing-4",
      spotId: "spot-32", // Regular stall
      ownerId: ownerUser.id,
      listingType: "single",
      status: "expired",
      singleDate: yesterday,
      dailyRate: "20.00",
      notes: null,
      periodStartDate: null,
      periodEndDate: null,
      recurringStartDate: null,
      recurringEndDate: null,
      daysOfWeek: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Unused listing (past date, not booked)
    const listing5: SpotListing = {
      id: "listing-5",
      spotId: "spot-15", // Tesla EV stall
      ownerId: ownerUser.id,
      listingType: "single",
      status: "expired",
      singleDate: yesterday,
      dailyRate: "25.00",
      notes: null,
      periodStartDate: null,
      periodEndDate: null,
      recurringStartDate: null,
      recurringEndDate: null,
      daysOfWeek: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.spotListings.set(listing1.id, listing1);
    this.spotListings.set(listing2.id, listing2);
    this.spotListings.set(listing3.id, listing3);
    this.spotListings.set(listing4.id, listing4);
    this.spotListings.set(listing5.id, listing5);

    // Create sample bookings using the renter user

    // Active booking (confirmed for future)
    const booking1: Booking = {
      id: "booking-1",
      listingId: listing1.id,
      spotId: "spot-15", // Tesla EV stall
      renterId: renterUser.id,
      ownerId: ownerUser.id,
      bookingDate: tomorrow,
      status: "confirmed",
      paymentReceived: false,
      dailyRate: "25.00",
      totalAmount: "25.00",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Pending booking
    const booking2: Booking = {
      id: "booking-2",
      listingId: listing2.id,
      spotId: "spot-32", // Regular stall
      renterId: renterUser.id,
      ownerId: ownerUser.id,
      bookingDate: today,
      status: "pending",
      paymentReceived: false,
      dailyRate: "20.00",
      totalAmount: "20.00", 
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Completed booking (past with payment)
    const booking3: Booking = {
      id: "booking-3",
      listingId: listing4.id,
      spotId: "spot-32", // Regular stall
      renterId: renterUser.id,
      ownerId: ownerUser.id,
      bookingDate: yesterday,
      status: "confirmed",
      paymentReceived: true,
      dailyRate: "20.00",
      totalAmount: "20.00",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Payment pending booking (future without payment)
    const booking4: Booking = {
      id: "booking-4",
      listingId: listing3.id,
      spotId: "spot-15", // Tesla EV stall
      renterId: renterUser.id,
      ownerId: ownerUser.id,
      bookingDate: tomorrow,
      status: "confirmed",
      paymentReceived: false,
      dailyRate: "25.00",
      totalAmount: "25.00",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.bookings.set(booking1.id, booking1);
    this.bookings.set(booking2.id, booking2);
    this.bookings.set(booking3.id, booking3);
    this.bookings.set(booking4.id, booking4);

    // Create sample waiting list entries for admin dashboard testing
    const waitingEntry1: WaitingList = {
      id: "waiting-1",
      userId: "user-waiting-001",
      userName: "Jennifer Wilson",
      userEmail: "j.wilson@bci.ca",
      userDepartment: "Marketing",
      preferredSpotType: "regular",
      preferredBuilding: "Building A",
      priority: 1,
      status: "active",
      reason: "Pregnant employee requiring closer parking access",
      enrolledDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      assignedDate: null,
      assignedSpotId: null,
      enrolledBy: "user",
      adminNotes: null,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    };

    const waitingEntry2: WaitingList = {
      id: "waiting-2",
      userId: "user-waiting-002",
      userName: "Robert Chen",
      userEmail: "r.chen@bci.ca",
      userDepartment: "Engineering",
      preferredSpotType: "electric",
      preferredBuilding: "Building B",
      priority: 2,
      status: "active",
      reason: "Daily commuter, purchased electric vehicle",
      enrolledDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      assignedDate: null,
      assignedSpotId: null,
      enrolledBy: "user",
      adminNotes: null,
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    };

    const waitingEntry3: WaitingList = {
      id: "waiting-3",
      userId: "user-waiting-003",
      userName: "Maria Santos",
      userEmail: "m.santos@bci.ca",
      userDepartment: "Finance",
      preferredSpotType: "accessible",
      preferredBuilding: "Building A",
      priority: 1,
      status: "active",
      reason: "Accessibility needs due to mobility restrictions",
      enrolledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      assignedDate: null,
      assignedSpotId: null,
      enrolledBy: "admin",
      adminNotes: "Priority assignment required",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    };

    const waitingEntry4: WaitingList = {
      id: "waiting-4",
      userId: "user-waiting-004",
      userName: "Alex Johnson",
      userEmail: "a.johnson@bci.ca",
      userDepartment: "IT",
      preferredSpotType: "regular",
      preferredBuilding: "Building C",
      priority: 3,
      status: "active",
      reason: "Occasional parking needs for client meetings",
      enrolledDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      assignedDate: null,
      assignedSpotId: null,
      enrolledBy: "user",
      adminNotes: null,
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
    };

    const waitingEntry5: WaitingList = {
      id: "waiting-5",
      userId: "user-waiting-005",
      userName: "David Park",
      userEmail: "d.park@bci.ca",
      userDepartment: "Operations",
      preferredSpotType: "regular",
      preferredBuilding: "Building B",
      priority: 2,
      status: "assigned",
      reason: "Regular commuter with early shift",
      enrolledDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      assignedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      assignedSpotId: "spot-1",
      enrolledBy: "user",
      adminNotes: "Assigned to spot A-15",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    };

    this.waitingList.set(waitingEntry1.id, waitingEntry1);
    this.waitingList.set(waitingEntry2.id, waitingEntry2);
    this.waitingList.set(waitingEntry3.id, waitingEntry3);
    this.waitingList.set(waitingEntry4.id, waitingEntry4);
    this.waitingList.set(waitingEntry5.id, waitingEntry5);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  // (IMPORTANT) Required for Replit Auth
  async upsertUser(userData: UpsertUser): Promise<User> {
    // Ensure id is provided (required for User type)
    if (!userData.id) {
      throw new Error('User ID is required for upsert operation');
    }
    
    const existingUser = this.users.get(userData.id);
    const now = new Date();
    
    const user: User = {
      ...existingUser,
      ...userData,
      id: userData.id, // Ensure id is properly typed as string
      email: userData.email ?? null, // Convert undefined to null for schema compatibility
      firstName: userData.firstName ?? null, // Convert undefined to null for schema compatibility
      lastName: userData.lastName ?? null, // Convert undefined to null for schema compatibility
      profileImageUrl: userData.profileImageUrl ?? null, // Convert undefined to null for schema compatibility
      role: existingUser?.role || "renter", // Keep existing role or default to renter
      phone: existingUser?.phone || null,
      department: existingUser?.department || null,
      memberSince: existingUser?.memberSince || null,
      lastLogin: now,
      updatedAt: now,
      createdAt: existingUser?.createdAt || now,
    };
    
    this.users.set(userData.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      ...insertUser,
      email: insertUser.email ?? null, // Convert undefined to null for schema compatibility
      role: insertUser.role as UserRole,
      phone: insertUser.phone ?? null,
      department: insertUser.department ?? null,
      memberSince: insertUser.memberSince ?? null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
      id, 
      lastLogin: null,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }
    
    const now = new Date();
    const updatedUser: User = {
      ...existingUser,
      ...updates,
      id, // Keep original ID
      updatedAt: now
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Parking Spot operations
  async getParkingSpot(id: string): Promise<ParkingSpot | undefined> {
    return this.parkingSpots.get(id);
  }

  async getParkingSpotsByOwner(ownerId: string): Promise<ParkingSpot[]> {
    return Array.from(this.parkingSpots.values()).filter(
      (spot) => spot.ownerId === ownerId
    );
  }

  async getAllParkingSpots(): Promise<ParkingSpot[]> {
    return Array.from(this.parkingSpots.values());
  }

  async createParkingSpot(insertSpot: InsertParkingSpot): Promise<ParkingSpot> {
    const id = randomUUID();
    const spot: ParkingSpot = { 
      ...insertSpot,
      ownerId: insertSpot.ownerId ?? null, // Convert undefined to null for schema compatibility
      isBookable: insertSpot.isBookable ?? true, // Convert undefined to default true for schema compatibility
      spotType: insertSpot.spotType as SpotType,
      description: insertSpot.description ?? null,
      isIndoor: insertSpot.isIndoor ?? false,
      isActive: insertSpot.isActive ?? true,
      id,
      createdAt: new Date()
    };
    this.parkingSpots.set(id, spot);
    return spot;
  }

  async updateParkingSpot(id: string, updates: Partial<InsertParkingSpot>): Promise<ParkingSpot | undefined> {
    const existingSpot = this.parkingSpots.get(id);
    if (!existingSpot) return undefined;
    
    const updatedSpot: ParkingSpot = { 
      ...existingSpot, 
      ...updates,
      spotType: updates.spotType ? (updates.spotType as SpotType) : existingSpot.spotType,
      description: updates.description !== undefined ? updates.description : existingSpot.description,
      isIndoor: updates.isIndoor !== undefined ? updates.isIndoor : existingSpot.isIndoor,
      isActive: updates.isActive !== undefined ? updates.isActive : existingSpot.isActive
    };
    this.parkingSpots.set(id, updatedSpot);
    return updatedSpot;
  }

  async deleteParkingSpot(id: string): Promise<boolean> {
    return this.parkingSpots.delete(id);
  }

  // Spot Listing operations
  async getSpotListing(id: string): Promise<SpotListing | undefined> {
    return this.spotListings.get(id);
  }

  async getSpotListingsByOwner(ownerId: string): Promise<SpotListing[]> {
    return Array.from(this.spotListings.values()).filter(
      (listing) => listing.ownerId === ownerId
    );
  }

  async getSpotListingsBySpot(spotId: string): Promise<SpotListing[]> {
    return Array.from(this.spotListings.values()).filter(
      (listing) => listing.spotId === spotId
    );
  }

  async getAllSpotListings(): Promise<SpotListing[]> {
    return Array.from(this.spotListings.values());
  }

  async getActiveSpotListings(): Promise<SpotListing[]> {
    return Array.from(this.spotListings.values()).filter(
      (listing) => listing.status === "active"
    );
  }

  async createSpotListing(insertListing: InsertSpotListing): Promise<SpotListing> {
    const id = randomUUID();
    const listing: SpotListing = { 
      ...insertListing,
      listingType: insertListing.listingType as ListingType,
      status: (insertListing.status as ListingStatus) ?? "active",
      singleDate: insertListing.singleDate ?? null,
      periodStartDate: insertListing.periodStartDate ?? null,
      periodEndDate: insertListing.periodEndDate ?? null,
      recurringStartDate: insertListing.recurringStartDate ?? null,
      recurringEndDate: insertListing.recurringEndDate ?? null,
      daysOfWeek: insertListing.daysOfWeek ?? null,
      notes: insertListing.notes ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.spotListings.set(id, listing);
    return listing;
  }

  async updateSpotListing(id: string, updates: Partial<InsertSpotListing>): Promise<SpotListing | undefined> {
    const existingListing = this.spotListings.get(id);
    if (!existingListing) return undefined;
    
    const updatedListing: SpotListing = { 
      ...existingListing, 
      ...updates,
      listingType: updates.listingType ? (updates.listingType as ListingType) : existingListing.listingType,
      status: updates.status ? (updates.status as ListingStatus) : existingListing.status,
      updatedAt: new Date()
    };
    this.spotListings.set(id, updatedListing);
    return updatedListing;
  }

  async deleteSpotListing(id: string): Promise<boolean> {
    return this.spotListings.delete(id);
  }

  // Booking operations
  async getBooking(id: string): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByRenter(renterId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.renterId === renterId
    );
  }

  async getBookingsByOwner(ownerId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.ownerId === ownerId
    );
  }

  async getBookingsBySpot(spotId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.spotId === spotId
    );
  }

  async getBookingsByListing(listingId: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.listingId === listingId
    );
  }

  async getAllBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const booking: Booking = { 
      ...insertBooking,
      status: (insertBooking.status as BookingStatus) ?? "confirmed",
      paymentReceived: insertBooking.paymentReceived ?? false,
      notes: insertBooking.notes ?? null,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    const existingBooking = this.bookings.get(id);
    if (!existingBooking) return undefined;
    
    const updatedBooking: Booking = { 
      ...existingBooking, 
      ...updates,
      status: updates.status ? (updates.status as BookingStatus) : existingBooking.status,
      updatedAt: new Date()
    };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteBooking(id: string): Promise<boolean> {
    return this.bookings.delete(id);
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
    const existingBooking = this.bookings.get(id);
    if (!existingBooking) return undefined;
    
    // Update the booking with payment status - assuming we add this field to the schema
    const updatedBooking: Booking = { 
      ...existingBooking, 
      paymentReceived,
      updatedAt: new Date()
    };
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
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.bookingDate === date
    );
  }

  // Waiting List operations
  async getWaitingListEntry(id: string): Promise<WaitingList | undefined> {
    return this.waitingList.get(id);
  }

  async getWaitingListByUser(userId: string): Promise<WaitingList | undefined> {
    return Array.from(this.waitingList.values()).find(entry => entry.userId === userId && entry.status === 'active');
  }

  async getAllWaitingList(): Promise<WaitingList[]> {
    return Array.from(this.waitingList.values()).sort((a, b) => a.priority - b.priority);
  }

  async getActiveWaitingList(): Promise<WaitingList[]> {
    return Array.from(this.waitingList.values())
      .filter(entry => entry.status === 'active')
      .sort((a, b) => a.priority - b.priority);
  }

  async createWaitingListEntry(insertEntry: InsertWaitingList): Promise<WaitingList> {
    const id = randomUUID();
    const entry: WaitingList = {
      ...insertEntry,
      id,
      status: insertEntry.status || 'active',
      priority: insertEntry.priority || 1,
      enrolledBy: insertEntry.enrolledBy || 'user',
      enrolledDate: new Date(),
      assignedDate: insertEntry.assignedDate || null,
      assignedSpotId: insertEntry.assignedSpotId || null,
      adminNotes: insertEntry.adminNotes || null,
      reason: insertEntry.reason || null,
      preferredSpotType: (insertEntry.preferredSpotType as SpotType) || null,
      preferredBuilding: insertEntry.preferredBuilding || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.waitingList.set(id, entry);
    return entry;
  }

  async updateWaitingListEntry(id: string, updates: Partial<InsertWaitingList>): Promise<WaitingList | undefined> {
    const existingEntry = this.waitingList.get(id);
    if (!existingEntry) return undefined;

    const updatedEntry: WaitingList = {
      ...existingEntry,
      ...updates,
      preferredSpotType: updates.preferredSpotType ? (updates.preferredSpotType as SpotType) : existingEntry.preferredSpotType,
      updatedAt: new Date()
    };
    this.waitingList.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteWaitingListEntry(id: string): Promise<boolean> {
    return this.waitingList.delete(id);
  }

  async getWaitingListById(id: string): Promise<WaitingList | undefined> {
    return this.waitingList.get(id);
  }

  async assignWaitingListUser(waitingListId: string, spotId: string): Promise<WaitingList | undefined> {
    const entry = this.waitingList.get(waitingListId);
    if (!entry) return undefined;

    const updatedEntry: WaitingList = {
      ...entry,
      status: 'assigned',
      assignedDate: new Date(),
      assignedSpotId: spotId,
      updatedAt: new Date()
    };
    this.waitingList.set(waitingListId, updatedEntry);
    return updatedEntry;
  }

  // Bookability control operations
  async toggleSpotBookability(spotId: string, isBookable: boolean): Promise<ParkingSpot | undefined> {
    const spot = this.parkingSpots.get(spotId);
    if (!spot) return undefined;

    const updatedSpot: ParkingSpot = {
      ...spot,
      isBookable
    };
    this.parkingSpots.set(spotId, updatedSpot);
    return updatedSpot;
  }

  async bulkToggleSpotBookability(spotIds: string[], isBookable: boolean): Promise<ParkingSpot[]> {
    const updatedSpots: ParkingSpot[] = [];
    
    for (const spotId of spotIds) {
      const spot = this.parkingSpots.get(spotId);
      if (spot) {
        const updatedSpot: ParkingSpot = {
          ...spot,
          isBookable
        };
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
    
    return Array.from(this.waitingList.values())
      .filter(entry => entry.status === 'assigned' && entry.assignedDate && new Date(entry.assignedDate) >= cutoffDate)
      .sort((a, b) => {
        if (!a.assignedDate || !b.assignedDate) return 0;
        return new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime();
      });
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

  // Audit decorators will be applied via server initialization
}

// Initialize storage and audit system 
import { auditStorage } from "./audit-storage";
import { auditService } from "./audit-service";

const storage = new MemStorage();
storage.setAuditStorage(auditStorage);
auditService.setStorage(storage);

export { storage };
