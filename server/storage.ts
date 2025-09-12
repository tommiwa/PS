import { 
  type User, 
  type InsertUser, 
  type ParkingSpot,
  type InsertParkingSpot,
  type SpotListing,
  type InsertSpotListing,
  type Booking,
  type InsertBooking,
  type UserRole,
  type SpotType,
  type ListingType,
  type ListingStatus,
  type BookingStatus
} from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface with comprehensive CRUD methods
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private parkingSpots: Map<string, ParkingSpot>;
  private spotListings: Map<string, SpotListing>;
  private bookings: Map<string, Booking>;

  constructor() {
    this.users = new Map();
    this.parkingSpots = new Map();
    this.spotListings = new Map();
    this.bookings = new Map();
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      role: insertUser.role as UserRole,
      phone: insertUser.phone ?? null,
      department: insertUser.department ?? null,
      memberSince: insertUser.memberSince ?? null,
      id, 
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
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
}

export const storage = new MemStorage();
