import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { getTodayInTimezone } from "./timezone";

// Compute milestone metrics: total confirmed/completed bookings + spend since a start date
export async function computeMilestoneMetrics(startDate: string): Promise<{
  totalBookings: number;
  totalSpend: number;
  p2pRevenue: number;
  participants: number;
}> {
  const [allBookings, allSpots] = await Promise.all([
    storage.getAllBookings(),
    storage.getAllParkingSpots()
  ]);

  const filteredBookings = allBookings.filter(b => {
    const dateStr = String(b.bookingDate).split('T')[0];
    return (b.status === 'confirmed' || b.status === 'completed') && dateStr >= startDate;
  });

  const spotMap = new Map(allSpots.map(s => [s.id, s]));

  const totalBookings = filteredBookings.length;
  const totalSpend = filteredBookings.reduce((sum, b) => sum + Number(b.totalAmount || b.dailyRate || 0), 0);

  const p2pRevenue = filteredBookings.reduce((sum, b) => {
    const spot = spotMap.get(b.spotId);
    return sum + (spot && !spot.isBciManaged ? Number(b.totalAmount || b.dailyRate || 0) : 0);
  }, 0);

  const participantSet = new Set<string>();
  filteredBookings.forEach(b => {
    participantSet.add(b.renterId);
    if (b.ownerId && b.ownerId !== 'unassigned') participantSet.add(b.ownerId);
  });

  return { totalBookings, totalSpend, p2pRevenue, participants: participantSet.size };
}
import type {
  ReportOverviewResponse,
  ReportUtilizationResponse,
  ReportRevenueResponse,
  ReportUserComplianceResponse,
  ReportWaitlistPerformanceResponse,
  ReportDateRange,
  SpotAssignmentReportResponse,
  SharedPoolUsageReportResponse
} from "@shared/schema";

// Zod schema for report query parameters
const reportQuerySchema = z.object({
  from: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid from date"),
  to: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid to date"),
  scope: z.enum(['all', 'bci']).optional().default('all')
});

// Helper function to calculate date ranges (PST-aware)
async function calculateDateRange(from?: string, to?: string): Promise<ReportDateRange> {
  const todayStr = await getTodayInTimezone();
  const toStr = to || todayStr;

  let fromStr: string;
  if (from) {
    fromStr = from;
  } else {
    // Default 30 days lookback from toStr
    const toDate = new Date(toStr + 'T12:00:00');
    toDate.setDate(toDate.getDate() - 30);
    const yyyy = toDate.getFullYear();
    const mm = String(toDate.getMonth() + 1).padStart(2, '0');
    const dd = String(toDate.getDate()).padStart(2, '0');
    fromStr = `${yyyy}-${mm}-${dd}`;
  }

  return { from: fromStr, to: toStr };
}

// Helper to filter by scope
function filterByScope<T extends { isBciManaged?: boolean }>(items: T[], scope: 'all' | 'bci'): T[] {
  if (scope === 'bci') {
    return items.filter(item => item.isBciManaged === true);
  }
  return items;
}

// GET /api/admin/reports/overview - Summary metrics and quick links
export async function getReportOverview(req: Request, res: Response) {
  try {
    const { from, to, scope } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Fetch all required data
    const [allSpots, allBookings, allUsers, waitingList] = await Promise.all([
      storage.getAllParkingSpots(),
      storage.getAllBookings(),
      storage.getAllUsers(),
      storage.getAllWaitingList()
    ]);
    
    // Filter by scope
    const spots = filterByScope(allSpots, scope);
    const bookings = allBookings.filter((b: any) => {
      const spot = allSpots.find(s => s.id === b.spotId);
      if (scope === 'bci') {
        return spot?.isBciManaged === true;
      }
      return true; // 'all' scope includes all bookings
    });
    
    // Filter bookings by date range (string comparison avoids UTC timezone shift)
    const filteredBookings = bookings.filter((b: any) => {
      const bookingDateStr = String(b.bookingDate).split('T')[0];
      return bookingDateStr >= dateRange.from && bookingDateStr <= dateRange.to;
    });
    
    // Calculate metrics
    const activeBookings = filteredBookings.filter((b: any) => 
      b.status === 'confirmed' || b.status === 'pending'
    ).length;
    
    const totalRevenue = filteredBookings.reduce((sum: number, b: any) => 
      sum + (Number(b.dailyRate) || 0), 0
    );
    
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const waitlistCount = waitingList.filter(w => w.status === 'active').length;
    
    const bookableSpots = spots.filter(s => s.isBookable && s.isActive).length;
    const utilizationRate = bookableSpots > 0 
      ? (activeBookings / bookableSpots) * 100 
      : 0;
    
    // Quick stats (use PST today to avoid UTC date boundary issues)
    const today = await getTodayInTimezone();
    const todayBookings = filteredBookings.filter((b: any) => 
      String(b.bookingDate).split('T')[0] === today
    ).length;
    
    const oneWeekAgoDate = new Date(today + 'T12:00:00');
    oneWeekAgoDate.setDate(oneWeekAgoDate.getDate() - 7);
    const oneWeekAgo = `${oneWeekAgoDate.getFullYear()}-${String(oneWeekAgoDate.getMonth() + 1).padStart(2, '0')}-${String(oneWeekAgoDate.getDate()).padStart(2, '0')}`;
    const thisWeekRevenue = filteredBookings
      .filter((b: any) => String(b.bookingDate).split('T')[0] >= oneWeekAgo)
      .reduce((sum: number, b: any) => sum + (Number(b.dailyRate) || 0), 0);
    
    const pendingPayments = filteredBookings.filter((b: any) => 
      !b.paymentReceived && b.status === 'confirmed'
    ).length;
    
    const disputes = await storage.getAllDisputes?.() || [];
    const activeDisputes = disputes.filter((d: any) => d.status === 'open' || d.status === 'investigating').length;
    
    const response: ReportOverviewResponse = {
      summary: {
        totalSpots: spots.length,
        activeBookings,
        totalRevenue,
        activeUsers,
        waitlistCount,
        utilizationRate: Math.round(utilizationRate * 100) / 100
      },
      quickStats: {
        todayBookings,
        thisWeekRevenue,
        pendingPayments,
        activeDisputes
      },
      generatedAt: new Date().toISOString(),
      dateRange,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating overview report:", error);
    res.status(500).json({ error: "Failed to generate overview report" });
  }
}

// GET /api/admin/reports/utilization - Parking spot usage, occupancy rates, location analytics
export async function getReportUtilization(req: Request, res: Response) {
  try {
    const { from, to, scope } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Fetch required data
    const [allSpots, allBookings, locations, spotTypes, allListings] = await Promise.all([
      storage.getAllParkingSpots(),
      storage.getAllBookings(),
      storage.getAllLocations?.() || [],
      storage.getAllSpotTypes?.() || [],
      storage.getAllSpotListings?.() || []
    ]);
    
    // Filter by scope
    const spots = filterByScope(allSpots, scope);
    
    // Filter bookings by date range and scope (string comparison avoids UTC timezone shift)
    const bookings = allBookings.filter((b: any) => {
      const spot = allSpots.find(s => s.id === b.spotId);
      const bookingDateStr = String(b.bookingDate).split('T')[0];
      const scopeMatch = scope === 'all' || spot?.isBciManaged === true;
      const dateMatch = bookingDateStr >= dateRange.from && bookingDateStr <= dateRange.to;
      return scopeMatch && dateMatch;
    });
    
    // Calculate spot usage
    const allocatedSpots = spots.filter(s => s.ownerId).length;
    const unallocatedSpots = spots.filter(s => !s.ownerId).length;
    const bookableSpots = spots.filter(s => s.isBookable && s.isActive).length;
    const utilizationRate = bookableSpots > 0 
      ? (bookings.length / bookableSpots) * 100 
      : 0;
    
    // Location breakdown
    const locationBreakdown = locations.map((loc: any) => {
      const locationSpots = spots.filter(s => s.locationId === loc.id);
      const locationBookings = bookings.filter((b: any) => {
        const spot = spots.find(s => s.id === b.spotId);
        return spot?.locationId === loc.id;
      });
      
      const totalSpots = locationSpots.length;
      const occupiedSpots = locationBookings.length;
      const revenue = locationBookings.reduce((sum: number, b: any) => 
        sum + (Number(b.dailyRate) || 0), 0
      );
      
      return {
        location: `${loc.office} - ${loc.building}, ${loc.level}`,
        totalSpots,
        occupiedSpots,
        occupancyRate: totalSpots > 0 ? (occupiedSpots / totalSpots) * 100 : 0,
        revenue
      };
    });
    
    // Spot type breakdown
    const spotTypeBreakdown = spotTypes.map((type: any) => {
      const typeSpots = spots.filter(s => s.spotTypeId === type.id);
      const typeBookings = bookings.filter((b: any) => {
        const spot = spots.find(s => s.id === b.spotId);
        return spot?.spotTypeId === type.id;
      });
      
      return {
        type: type.name,
        count: typeSpots.length,
        bookedCount: typeBookings.length,
        utilizationRate: typeSpots.length > 0 ? (typeBookings.length / typeSpots.length) * 100 : 0
      };
    });
    
    // Filter listings by scope — also exclude orphaned listings (spot no longer exists)
    const listings = allListings.filter((l: any) => {
      const spot = allSpots.find(s => s.id === l.spotId);
      if (!spot) return false;
      if (scope === 'bci') {
        return spot.isBciManaged === true;
      }
      return true;
    });
    
    // Helper to normalize date to YYYY-MM-DD string
    const toDateStr = (d: any): string => {
      if (!d) return '';
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };
    
    // Helper to check if a listing is available on a specific date
    const isListingAvailableOnDate = (listing: any, dateStr: string): boolean => {
      const checkDate = new Date(dateStr + 'T12:00:00');
      
      // Exclude only cancelled listings — booked/used/unused spots were still available for sharing on that date
      if (listing.status === 'cancelled') return false;
      
      if (listing.listingType === 'single') {
        return toDateStr(listing.singleDate) === dateStr;
      }
      
      if (listing.listingType === 'period') {
        const start = new Date(toDateStr(listing.periodStartDate) + 'T00:00:00');
        const end = new Date(toDateStr(listing.periodEndDate) + 'T23:59:59');
        return checkDate >= start && checkDate <= end;
      }
      
      if (listing.listingType === 'recurring') {
        const start = new Date(toDateStr(listing.recurringStartDate) + 'T00:00:00');
        const endStr = toDateStr(listing.recurringEndDate);
        const end = endStr ? new Date(endStr + 'T23:59:59') : null;
        
        if (checkDate < start) return false;
        if (end && checkDate > end) return false;
        
        // Check day of week
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[checkDate.getDay()];
        return listing.daysOfWeek?.includes(dayOfWeek) || false;
      }
      
      return false;
    };
    
    // Daily occupancy trends with 4 data series
    const dailyOccupancy: any[] = [];
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Count confirmed/pending/completed bookings on this date
      const dayBookings = bookings.filter((b: any) => {
        const bDateStr = b.bookingDate instanceof Date 
          ? b.bookingDate.toISOString().split('T')[0]
          : String(b.bookingDate).split('T')[0];
        return bDateStr === dateStr && (b.status === 'confirmed' || b.status === 'pending' || b.status === 'completed');
      });
      const bookedSpots = dayBookings.length;
      const bciBookings = dayBookings.filter((b: any) => {
        const spot = allSpots.find((s: any) => s.id === b.spotId);
        return spot?.isBciManaged === true;
      }).length;
      const p2pBookings = bookedSpots - bciBookings;
      const bookedSpotIds = new Set(dayBookings.map((b: any) => String(b.spotId)));

      // Available for sharing = spots with listings on this date that have NOT been booked
      const availableSpots = new Set<string>();
      listings.forEach((l: any) => {
        if (isListingAvailableOnDate(l, dateStr) && !bookedSpotIds.has(String(l.spotId))) {
          availableSpots.add(String(l.spotId));
        }
      });
      const availableForSharing = availableSpots.size;
      
      dailyOccupancy.push({
        date: dateStr,
        totalSpots: bookableSpots,
        occupiedSpots: allocatedSpots,
        availableForSharing,
        bookedSpots,
        bciBookings,
        p2pBookings
      });
    }
    
    const response: ReportUtilizationResponse = {
      spotUsage: {
        totalSpots: spots.length,
        allocatedSpots,
        unallocatedSpots,
        bookableSpots,
        utilizationRate: Math.round(utilizationRate * 100) / 100
      },
      locationBreakdown,
      spotTypeBreakdown,
      dailyOccupancy,
      generatedAt: new Date().toISOString(),
      dateRange,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating utilization report:", error);
    res.status(500).json({ error: "Failed to generate utilization report" });
  }
}

// GET /api/admin/reports/revenue - Financial analytics, booking trends, revenue breakdown
export async function getReportRevenue(req: Request, res: Response) {
  try {
    const { from, to, scope } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Fetch required data
    const [allSpots, allBookings, locations, spotTypes, allUsers] = await Promise.all([
      storage.getAllParkingSpots(),
      storage.getAllBookings(),
      storage.getAllLocations?.() || [],
      storage.getAllSpotTypes?.() || [],
      storage.getAllUsers()
    ]);
    
    // Filter bookings by date range and scope (string comparison avoids UTC timezone shift)
    const bookings = allBookings.filter((b: any) => {
      const spot = allSpots.find(s => s.id === b.spotId);
      const bookingDateStr = String(b.bookingDate).split('T')[0];
      const scopeMatch = scope === 'all' || spot?.isBciManaged === true;
      const dateMatch = bookingDateStr >= dateRange.from && bookingDateStr <= dateRange.to;
      return scopeMatch && dateMatch;
    });
    
    // Calculate summary
    const totalRevenue = bookings.reduce((sum: number, b: any) => 
      sum + (Number(b.dailyRate) || 0), 0
    );
    
    const ownerEarnings = totalRevenue * 0.85; // 85% to owner
    const bciRevenue = totalRevenue * 0.15; // 15% to BCI
    const averageBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;
    
    // Monthly trends
    const monthlyMap = new Map<string, { revenue: number; bookings: number }>();
    bookings.forEach((b: any) => {
      const date = new Date(b.bookingDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { revenue: 0, bookings: 0 });
      }
      
      const data = monthlyMap.get(monthKey)!;
      data.revenue += Number(b.dailyRate) || 0;
      data.bookings += 1;
    });
    
    const monthlyTrends = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        bookings: data.bookings,
        averageValue: data.bookings > 0 ? data.revenue / data.bookings : 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // Revenue by location
    const revenueByLocation = locations.map((loc: any) => {
      const locationBookings = bookings.filter((b: any) => {
        const spot = allSpots.find(s => s.id === b.spotId);
        return spot?.locationId === loc.id;
      });
      
      const revenue = locationBookings.reduce((sum: number, b: any) => 
        sum + (Number(b.dailyRate) || 0), 0
      );
      
      const averageRate = locationBookings.length > 0 
        ? revenue / locationBookings.length 
        : 0;
      
      return {
        location: `${loc.office} - ${loc.building}, ${loc.level}`,
        revenue,
        bookings: locationBookings.length,
        averageRate
      };
    }).filter(r => r.bookings > 0);
    
    // Revenue by spot type
    const revenueBySpotType = spotTypes.map((type: any) => {
      const typeBookings = bookings.filter((b: any) => {
        const spot = allSpots.find(s => s.id === b.spotId);
        return spot?.spotTypeId === type.id;
      });
      
      const revenue = typeBookings.reduce((sum: number, b: any) => 
        sum + (Number(b.dailyRate) || 0), 0
      );
      
      return {
        type: type.name,
        revenue,
        bookings: typeBookings.length
      };
    }).filter(r => r.bookings > 0);
    
    // Top earners
    const ownerEarningsMap = new Map<string, { name: string; earnings: number; count: number }>();
    bookings.forEach((b: any) => {
      const spot = allSpots.find(s => s.id === b.spotId);
      if (spot?.ownerId) {
        const owner = allUsers.find(u => u.id === spot.ownerId);
        const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown';
        
        if (!ownerEarningsMap.has(spot.ownerId)) {
          ownerEarningsMap.set(spot.ownerId, { name: ownerName, earnings: 0, count: 0 });
        }
        
        const data = ownerEarningsMap.get(spot.ownerId)!;
        data.earnings += (Number(b.dailyRate) || 0) * 0.85; // Owner gets 85%
        data.count += 1;
      }
    });
    
    const topEarners = Array.from(ownerEarningsMap.entries())
      .map(([ownerId, data]) => ({
        ownerId,
        ownerName: data.name,
        totalEarnings: data.earnings,
        bookingsCount: data.count
      }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 10); // Top 10 earners
    
    const response: ReportRevenueResponse = {
      summary: {
        totalRevenue,
        ownerEarnings,
        bciRevenue,
        averageBookingValue,
        totalBookings: bookings.length
      },
      monthlyTrends,
      revenueByLocation,
      revenueBySpotType,
      topEarners,
      generatedAt: new Date().toISOString(),
      dateRange,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating revenue report:", error);
    res.status(500).json({ error: "Failed to generate revenue report" });
  }
}

// GET /api/admin/reports/user-compliance - User activity, compliance metrics
export async function getReportUserCompliance(req: Request, res: Response) {
  try {
    const { from, to, scope } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Fetch required data
    const [allUsers, allSpots, allBookings, departments, termsVersions] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllParkingSpots(),
      storage.getAllBookings(),
      storage.getAllDepartments?.() || [],
      storage.getAllTermsVersions?.() || []
    ]);
    
    // Filter users created in date range
    const usersInRange = allUsers.filter(u => {
      const createdDate = new Date(u.createdAt || '');
      return createdDate >= new Date(dateRange.from) && createdDate <= new Date(dateRange.to);
    });
    
    // User activity summary
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => u.status === 'active').length;
    const newRegistrations = usersInRange.length;
    const suspendedUsers = allUsers.filter(u => u.status === 'suspended').length;
    const deletedUsers = allUsers.filter(u => u.deletedAt).length;
    
    // Role distribution
    const roleMap = new Map<string, number>();
    allUsers.forEach(u => {
      u.roles?.forEach(role => {
        roleMap.set(role, (roleMap.get(role) || 0) + 1);
      });
    });
    
    const roleDistribution = Array.from(roleMap.entries()).map(([role, count]) => ({
      role,
      count,
      percentage: (count / totalUsers) * 100
    }));
    
    // Department breakdown
    const departmentBreakdown = departments.map((dept: any) => {
      const deptUsers = allUsers.filter(u => u.departmentId === dept.id);
      const deptActiveUsers = deptUsers.filter(u => u.status === 'active');
      const spotsOwned = allSpots.filter(s => 
        deptUsers.some(u => u.id === s.ownerId)
      ).length;
      
      const bookingsMade = allBookings.filter((b: any) => 
        deptUsers.some(u => u.id === b.renterId)
      ).length;
      
      return {
        department: dept.name,
        userCount: deptUsers.length,
        activeUsers: deptActiveUsers.length,
        spotsOwned,
        bookingsMade
      };
    });
    
    // User engagement trends
    const userEngagement: any[] = [];
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      const daySignups = allUsers.filter(u => {
        const createdDate = new Date(u.createdAt || '');
        return createdDate.toISOString().split('T')[0] === dateStr;
      }).length;
      
      const dayBookings = allBookings.filter((b: any) => b.bookingDate === dateStr).length;
      
      const dayActiveUsers = allUsers.filter(u => {
        const lastLogin = new Date(u.lastLogin || '');
        return lastLogin.toISOString().split('T')[0] === dateStr;
      }).length;
      
      userEngagement.push({
        date: dateStr,
        activeUsers: dayActiveUsers,
        newSignups: daySignups,
        bookingsMade: dayBookings
      });
    }
    
    // Terms compliance
    const activeTerms = termsVersions.find((t: any) => t.isActive);
    const acceptedLatestTerms = activeTerms 
      ? allUsers.filter(u => u.acceptedTermsVersion === activeTerms.version).length
      : 0;
    const pendingAcceptance = activeTerms 
      ? allUsers.filter(u => !u.acceptedTermsVersion || u.acceptedTermsVersion < activeTerms.version).length
      : 0;
    const complianceRate = totalUsers > 0 ? (acceptedLatestTerms / totalUsers) * 100 : 0;
    
    const response: ReportUserComplianceResponse = {
      userActivity: {
        totalUsers,
        activeUsers,
        newRegistrations,
        suspendedUsers,
        deletedUsers
      },
      roleDistribution,
      departmentBreakdown,
      userEngagement,
      termsCompliance: {
        acceptedLatestTerms,
        pendingAcceptance,
        complianceRate
      },
      generatedAt: new Date().toISOString(),
      dateRange,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating user compliance report:", error);
    res.status(500).json({ error: "Failed to generate user compliance report" });
  }
}

// GET /api/admin/reports/waitlist-performance - Waiting list analytics, performance metrics
export async function getReportWaitlistPerformance(req: Request, res: Response) {
  try {
    const { from, to, scope } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Fetch required data
    const [waitingList, allUsers, spotTypes, departments] = await Promise.all([
      storage.getAllWaitingList(),
      storage.getAllUsers(),
      storage.getAllSpotTypes?.() || [],
      storage.getAllDepartments?.() || []
    ]);
    
    // Filter waitlist by date range
    const filteredWaitlist = waitingList.filter(w => {
      const enrolledDate = new Date(w.enrolledDate);
      return enrolledDate >= new Date(dateRange.from) && enrolledDate <= new Date(dateRange.to);
    });
    
    // Calculate summary
    const totalRequests = filteredWaitlist.length;
    const activeRequests = filteredWaitlist.filter(w => w.status === 'active').length;
    const assignedRequests = filteredWaitlist.filter(w => w.status === 'assigned').length;
    const cancelledRequests = filteredWaitlist.filter(w => w.status === 'cancelled').length;
    
    // Calculate average wait time
    const assignedItems = filteredWaitlist.filter(w => w.status === 'assigned' && w.assignedDate);
    const totalWaitDays = assignedItems.reduce((sum, w) => {
      const enrolled = new Date(w.enrolledDate);
      const assigned = new Date(w.assignedDate!);
      const days = Math.floor((assigned.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    const averageWaitTime = assignedItems.length > 0 ? totalWaitDays / assignedItems.length : 0;
    
    const fulfillmentRate = totalRequests > 0 ? (assignedRequests / totalRequests) * 100 : 0;
    
    // Priority breakdown
    const priorityBreakdown = [1, 2, 3].map(priority => {
      const priorityItems = filteredWaitlist.filter(w => w.priority === priority);
      const priorityAssigned = priorityItems.filter(w => w.status === 'assigned' && w.assignedDate);
      
      const priorityWaitDays = priorityAssigned.reduce((sum, w) => {
        const enrolled = new Date(w.enrolledDate);
        const assigned = new Date(w.assignedDate!);
        const days = Math.floor((assigned.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      
      const avgWaitDays = priorityAssigned.length > 0 ? priorityWaitDays / priorityAssigned.length : 0;
      const priorityFulfillment = priorityItems.length > 0 
        ? (priorityAssigned.length / priorityItems.length) * 100 
        : 0;
      
      return {
        priority,
        priorityLabel: priority === 1 ? 'High' : priority === 2 ? 'Medium' : 'Low',
        count: priorityItems.length,
        averageWaitDays: Math.round(avgWaitDays),
        fulfillmentRate: Math.round(priorityFulfillment * 100) / 100
      };
    });
    
    // Spot type preferences
    const spotTypeMap = new Map<number, { name: string; requests: number; fulfilled: number }>();
    filteredWaitlist.forEach(w => {
      if (w.preferredSpotTypeId) {
        const type = spotTypes.find((t: any) => t.id === w.preferredSpotTypeId);
        const typeName = type?.name || 'Unknown';
        
        if (!spotTypeMap.has(w.preferredSpotTypeId)) {
          spotTypeMap.set(w.preferredSpotTypeId, { name: typeName, requests: 0, fulfilled: 0 });
        }
        
        const data = spotTypeMap.get(w.preferredSpotTypeId)!;
        data.requests += 1;
        if (w.status === 'assigned') data.fulfilled += 1;
      }
    });
    
    const spotTypePreferences = Array.from(spotTypeMap.entries()).map(([_, data]) => ({
      spotType: data.name,
      requestCount: data.requests,
      fulfilledCount: data.fulfilled,
      fulfillmentRate: data.requests > 0 ? (data.fulfilled / data.requests) * 100 : 0
    }));
    
    // Department requests
    const departmentRequests = departments.map((dept: any) => {
      const deptWaitlist = filteredWaitlist.filter(w => {
        const user = allUsers.find(u => u.id === w.userId);
        return user?.departmentId === dept.id;
      });
      
      const activeReqs = deptWaitlist.filter(w => w.status === 'active').length;
      const assignedReqs = deptWaitlist.filter(w => w.status === 'assigned' && w.assignedDate);
      
      const deptWaitDays = assignedReqs.reduce((sum, w) => {
        const enrolled = new Date(w.enrolledDate);
        const assigned = new Date(w.assignedDate!);
        const days = Math.floor((assigned.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      
      const avgWaitDays = assignedReqs.length > 0 ? deptWaitDays / assignedReqs.length : 0;
      
      return {
        department: dept.name,
        activeRequests: activeReqs,
        assignedRequests: assignedReqs.length,
        averageWaitDays: Math.round(avgWaitDays)
      };
    }).filter(d => d.activeRequests > 0 || d.assignedRequests > 0);
    
    // Wait time trends
    const waitTimeTrends: any[] = [];
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      const newReqs = filteredWaitlist.filter(w => {
        const enrolled = new Date(w.enrolledDate);
        return enrolled.toISOString().split('T')[0] === dateStr;
      }).length;
      
      const fulfilled = filteredWaitlist.filter(w => {
        const assigned = w.assignedDate ? new Date(w.assignedDate) : null;
        return assigned && assigned.toISOString().split('T')[0] === dateStr;
      }).length;
      
      const dayAssigned = filteredWaitlist.filter(w => {
        const assigned = w.assignedDate ? new Date(w.assignedDate) : null;
        return assigned && assigned.toISOString().split('T')[0] === dateStr;
      });
      
      const dayWaitDays = dayAssigned.reduce((sum, w) => {
        const enrolled = new Date(w.enrolledDate);
        const assigned = new Date(w.assignedDate!);
        const days = Math.floor((assigned.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      
      const avgWaitDays = dayAssigned.length > 0 ? dayWaitDays / dayAssigned.length : 0;
      
      waitTimeTrends.push({
        date: dateStr,
        newRequests: newReqs,
        fulfilled,
        averageWaitDays: Math.round(avgWaitDays)
      });
    }
    
    const response: ReportWaitlistPerformanceResponse = {
      summary: {
        totalRequests,
        activeRequests,
        assignedRequests,
        cancelledRequests,
        averageWaitTime: Math.round(averageWaitTime),
        fulfillmentRate: Math.round(fulfillmentRate * 100) / 100
      },
      priorityBreakdown,
      spotTypePreferences,
      departmentRequests,
      waitTimeTrends,
      generatedAt: new Date().toISOString(),
      dateRange,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating waitlist performance report:", error);
    res.status(500).json({ error: "Failed to generate waitlist performance report" });
  }
}

// GET /api/admin/reports/spot-assignments - Spot Assignment/Unassignment Report
export async function getSpotAssignmentReport(req: Request, res: Response) {
  try {
    const spotAssignmentQuerySchema = z.object({
      from: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid from date"),
      to: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), "Invalid to date"),
      action: z.enum(['assigned', 'unassigned', 'all']).optional().default('all'),
      departmentId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
      scope: z.enum(['all', 'bci']).optional().default('all')
    });
    
    const { from, to, action, departmentId, scope } = spotAssignmentQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);
    
    // Get spot assignment history with filters
    const history = await storage.getSpotAssignmentHistory({
      from: dateRange.from,
      to: dateRange.to,
      action: action !== 'all' ? action : undefined,
      departmentId,
      scope
    });
    
    // Transform to response format
    const assignments = history.map(h => ({
      id: h.id,
      action: h.action,
      effectiveAt: h.effectiveAt.toISOString(),
      user: h.user,
      spot: h.spot,
      actor: h.actor
    }));
    
    const response: SpotAssignmentReportResponse = {
      assignments,
      dateRange,
      totalCount: assignments.length,
      scope
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating spot assignment report:", error);
    res.status(500).json({ error: "Failed to generate spot assignment report" });
  }
}

// GET /api/admin/reports/shared-pool-usage - Shared Pool Usage Report for salary deductions
export async function getSharedPoolUsageReport(req: Request, res: Response) {
  try {
    const sharedPoolQuerySchema = z.object({
      from: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid from date"),
      to: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid to date")
    });
    
    const { from, to } = sharedPoolQuerySchema.parse(req.query);
    const today = await getTodayInTimezone();
    
    const dateRange = {
      from,
      to: to > today ? today : to
    };
    
    const [allSpots, allBookings, allUsers, locations, departments, allListings] = await Promise.all([
      storage.getAllParkingSpots(),
      storage.getAllBookings(),
      storage.getAllUsers(),
      storage.getLocations(),
      storage.getDepartments(),
      storage.getAllSpotListings()
    ]);
    
    // True Workplace Services spots: BCI-managed AND no owner (ownerId is null)
    const workplaceServicesSpotIds = new Set(
      allSpots.filter(s => s.isBciManaged === true && s.ownerId === null).map(s => s.id)
    );
    
    // Get listing IDs for Workplace Services spots only
    const workplaceServicesListingIds = new Set(
      allListings.filter(l => workplaceServicesSpotIds.has(l.spotId)).map(l => l.id)
    );
    
    const listingsMap = new Map(allListings.map(l => [l.id, l]));
    
    // Filter bookings for Workplace Services spots only (BCI-managed with no owner)
    const filteredBookings = allBookings.filter((b: any) => {
      const bookingDate = b.bookingDate;
      const isInDateRange = bookingDate >= dateRange.from && bookingDate <= dateRange.to;
      const isPastOrToday = bookingDate <= today; // Include today's completed bookings
      const isWorkplaceServicesListing = workplaceServicesListingIds.has(b.listingId);
      const isValidStatus = b.status === 'confirmed' || b.status === 'completed';
      
      return isInDateRange && isPastOrToday && isWorkplaceServicesListing && isValidStatus;
    });
    
    const userBookingsMap = new Map<string, {
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      department: string;
      bookings: Array<{
        bookingId: string;
        spotNumber: string;
        location: string;
        bookingDate: string;
        amount: number;
        donateToCharity: boolean;
      }>;
      totalAmount: number;
    }>();
    
    filteredBookings.forEach((booking: any) => {
      const user = allUsers.find(u => u.id === booking.renterId);
      const spot = allSpots.find(s => s.id === booking.spotId);
      const location = locations.find((l: any) => l.id === spot?.locationId);
      const department = departments.find((d: any) => d.id === user?.departmentId);
      const listing = listingsMap.get(booking.listingId);
      
      if (!user || !spot) return;
      
      const locationName = location 
        ? `${location.office} - ${location.building}, ${location.level}`
        : 'Unknown';
      
      if (!userBookingsMap.has(user.id)) {
        userBookingsMap.set(user.id, {
          userId: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          department: department?.name || 'Unknown',
          bookings: [],
          totalAmount: 0
        });
      }
      
      const userData = userBookingsMap.get(user.id)!;
      const amount = Number(booking.dailyRate) || 0;
      
      const isExcluded = booking.excludedFromPayroll || false;
      
      userData.bookings.push({
        bookingId: booking.id,
        spotNumber: spot.spotNumber,
        location: locationName,
        bookingDate: booking.bookingDate,
        amount,
        donateToCharity: listing?.donateToCharity || false,
        excludedFromPayroll: isExcluded
      });
      // Only add to total if not excluded
      if (!isExcluded) {
        userData.totalAmount += amount;
      }
    });
    
    const usageByUser = Array.from(userBookingsMap.values()).map(userData => {
      // Count only active bookings
      const activeBookings = userData.bookings.filter(b => !b.excludedFromPayroll);
      return {
        ...userData,
        bookingCount: activeBookings.length
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
    
    // Summary should only count active bookings
    const activeBookingsCount = usageByUser.reduce((sum, u) => sum + u.bookingCount, 0);
    const totalBookings = activeBookingsCount;
    const totalAmount = usageByUser.reduce((sum, u) => sum + u.totalAmount, 0);
    const uniqueUsers = usageByUser.length;
    
    const response: SharedPoolUsageReportResponse = {
      usageByUser,
      summary: {
        totalBookings,
        totalAmount,
        uniqueUsers
      },
      dateRange
    };
    
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating shared pool usage report:", error);
    res.status(500).json({ error: "Failed to generate shared pool usage report" });
  }
}

// GET /api/admin/reports/active-users - Who logged in, listed spots, booked spots
export async function getActiveUsersReport(req: Request, res: Response) {
  try {
    const { from, to } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);

    const fromDate = new Date(dateRange.from + 'T00:00:00');
    const toDate = new Date(dateRange.to + 'T23:59:59');
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [allUsers, allListings, allBookings, allDepartments] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllSpotListings(),
      storage.getAllBookings(),
      storage.getDepartments?.() || []
    ]);

    const deptMap = new Map<number, string>();
    allDepartments.forEach((d: any) => deptMap.set(d.id, d.name));

    const getDeptName = (user: any) => {
      if (user.departmentId) return deptMap.get(user.departmentId) || 'Unknown';
      return 'N/A';
    };

    // Logged in users within range
    const loggedInUsers = allUsers
      .filter(u => {
        if (!u.lastLogin) return false;
        const loginDate = new Date(u.lastLogin);
        return loginDate >= fromDate && loginDate <= toDate;
      })
      .map(u => ({
        userId: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
        department: getDeptName(u),
        role: (u.roles?.[0] || 'renter') as string,
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toISOString() : null
      }));

    // Today's logins
    const loginsToday = allUsers.filter(u => {
      if (!u.lastLogin) return false;
      const loginDate = new Date(u.lastLogin);
      return loginDate >= todayStart && loginDate <= todayEnd;
    }).length;

    // Users who listed spots in the range (using createdAt on listings)
    const listingsInRange = allListings.filter((l: any) => {
      const created = new Date(l.createdAt);
      return created >= fromDate && created <= toDate && !l.deletedAt;
    });

    const listerMap = new Map<string, { listingCount: number }>();
    listingsInRange.forEach((l: any) => {
      const ownerId = l.ownerId;
      if (!ownerId) return;
      const existing = listerMap.get(ownerId) || { listingCount: 0 };
      existing.listingCount++;
      listerMap.set(ownerId, existing);
    });

    const listedSpotUsers = Array.from(listerMap.entries()).map(([userId, data]) => {
      const user = allUsers.find(u => u.id === userId);
      return {
        userId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown',
        department: user ? getDeptName(user) : 'N/A',
        listingCount: data.listingCount
      };
    });

    // Users who booked spots in the range — filter by when the booking was created (action date)
    const bookingsInRange = allBookings.filter((b: any) => {
      const createdAt = new Date(b.createdAt);
      return createdAt >= fromDate && createdAt <= toDate && b.status === 'confirmed';
    });

    const bookerMap = new Map<string, { bookingCount: number; totalAmount: number }>();
    bookingsInRange.forEach((b: any) => {
      const renterId = b.renterId;
      const existing = bookerMap.get(renterId) || { bookingCount: 0, totalAmount: 0 };
      existing.bookingCount++;
      existing.totalAmount += Number(b.dailyRate) || 0;
      bookerMap.set(renterId, existing);
    });

    const bookedSpotUsers = Array.from(bookerMap.entries()).map(([userId, data]) => {
      const user = allUsers.find(u => u.id === userId);
      return {
        userId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown',
        department: user ? getDeptName(user) : 'N/A',
        bookingCount: data.bookingCount,
        totalAmount: data.totalAmount
      };
    });

    const response = {
      summary: {
        loginsToday,
        loginsInPeriod: loggedInUsers.length,
        uniqueListers: listedSpotUsers.length,
        uniqueBookers: bookedSpotUsers.length,
        totalListings: listingsInRange.length,
        totalBookings: bookingsInRange.length
      },
      loggedInUsers,
      listedSpotUsers,
      bookedSpotUsers,
      dateRange,
      generatedAt: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating active users report:", error);
    res.status(500).json({ error: "Failed to generate active users report" });
  }
}

// GET /api/admin/rankings/renters - Renter leaderboard ranked by booking count and spend
export async function getRenterRankings(req: Request, res: Response) {
  try {
    const { from, to } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);

    const fromDate = new Date(dateRange.from + 'T00:00:00');
    const toDate = new Date(dateRange.to + 'T23:59:59');

    const [allUsers, allBookings, allDepartments] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllBookings(),
      storage.getDepartments?.() || []
    ]);

    const deptMap = new Map<number, string>();
    (allDepartments as any[]).forEach((d: any) => deptMap.set(d.id, d.name));

    const getDeptName = (user: any) => {
      if (user.departmentId) return deptMap.get(user.departmentId) || 'Unknown';
      return 'N/A';
    };

    // Filter bookings: confirmed or completed, within date range (by bookingDate)
    const eligibleBookings = (allBookings as any[]).filter((b: any) => {
      if (b.status !== 'confirmed' && b.status !== 'completed') return false;
      const bDate = new Date(b.bookingDate + 'T12:00:00');
      return bDate >= fromDate && bDate <= toDate;
    });

    // Aggregate per renter
    const renterMap = new Map<string, { bookingCount: number; totalAmount: number }>();
    eligibleBookings.forEach((b: any) => {
      const existing = renterMap.get(b.renterId) || { bookingCount: 0, totalAmount: 0 };
      existing.bookingCount++;
      const rTotal = b.totalAmount != null ? parseFloat(String(b.totalAmount)) : NaN;
      const rDaily = b.dailyRate != null ? parseFloat(String(b.dailyRate)) : NaN;
      existing.totalAmount += Number.isFinite(rTotal) ? rTotal : (Number.isFinite(rDaily) ? rDaily : 0);
      renterMap.set(b.renterId, existing);
    });

    // Build ranked list, sorted by booking count desc then total amount desc
    const unsorted = Array.from(renterMap.entries()).map(([userId, data]) => {
      const user = (allUsers as any[]).find((u: any) => u.id === userId);
      return {
        userId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown',
        email: user?.email || '',
        department: user ? getDeptName(user) : 'N/A',
        bookingCount: data.bookingCount,
        totalAmount: data.totalAmount
      };
    });

    unsorted.sort((a, b) => b.bookingCount - a.bookingCount || b.totalAmount - a.totalAmount);

    // Assign tied ranks
    let rank = 1;
    const ranked = unsorted.map((entry, idx) => {
      if (idx > 0) {
        const prev = unsorted[idx - 1];
        if (entry.bookingCount !== prev.bookingCount || entry.totalAmount !== prev.totalAmount) {
          rank = idx + 1;
        }
      }
      return { ...entry, rank };
    });

    res.json({ rankings: ranked, dateRange, generatedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating renter rankings:", error);
    res.status(500).json({ error: "Failed to generate renter rankings" });
  }
}

// GET /api/admin/rankings/owners - Owner leaderboard ranked by peer-to-peer booking count and earnings
export async function getOwnerRankings(req: Request, res: Response) {
  try {
    const { from, to } = reportQuerySchema.parse(req.query);
    const dateRange = await calculateDateRange(from, to);

    const fromDate = new Date(dateRange.from + 'T00:00:00');
    const toDate = new Date(dateRange.to + 'T23:59:59');

    const [allUsers, allBookings, allListings, allDepartments] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllBookings(),
      storage.getAllSpotListings(),
      storage.getDepartments?.() || []
    ]);

    const deptMap = new Map<number, string>();
    (allDepartments as any[]).forEach((d: any) => deptMap.set(d.id, d.name));

    const getDeptName = (user: any) => {
      if (user.departmentId) return deptMap.get(user.departmentId) || 'Unknown';
      return 'N/A';
    };

    // Build lookup maps
    const listingMap = new Map<string, any>();
    (allListings as any[]).forEach((l: any) => listingMap.set(l.id, l));

    // Filter bookings: confirmed or completed, within date range, peer-to-peer only
    const eligibleBookings = (allBookings as any[]).filter((b: any) => {
      if (b.status !== 'confirmed' && b.status !== 'completed') return false;
      const bDate = new Date(b.bookingDate + 'T12:00:00');
      if (bDate < fromDate || bDate > toDate) return false;
      // Exclude admin-created listings (P2P only)
      const listing = listingMap.get(b.listingId);
      if (listing?.createdByAdmin === true) return false;
      return true;
    });

    // Aggregate per owner
    const ownerMap = new Map<string, { bookingCount: number; totalEarnings: number }>();
    eligibleBookings.forEach((b: any) => {
      const existing = ownerMap.get(b.ownerId) || { bookingCount: 0, totalEarnings: 0 };
      existing.bookingCount++;
      const oTotal = b.totalAmount != null ? parseFloat(String(b.totalAmount)) : NaN;
      const oDaily = b.dailyRate != null ? parseFloat(String(b.dailyRate)) : NaN;
      existing.totalEarnings += Number.isFinite(oTotal) ? oTotal : (Number.isFinite(oDaily) ? oDaily : 0);
      ownerMap.set(b.ownerId, existing);
    });

    // Build ranked list, sorted by booking count desc then earnings desc
    const unsorted = Array.from(ownerMap.entries()).map(([userId, data]) => {
      const user = (allUsers as any[]).find((u: any) => u.id === userId);
      return {
        userId,
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown',
        email: user?.email || '',
        department: user ? getDeptName(user) : 'N/A',
        bookingCount: data.bookingCount,
        totalEarnings: data.totalEarnings
      };
    });

    unsorted.sort((a, b) => b.bookingCount - a.bookingCount || b.totalEarnings - a.totalEarnings);

    // Assign tied ranks
    let rank = 1;
    const ranked = unsorted.map((entry, idx) => {
      if (idx > 0) {
        const prev = unsorted[idx - 1];
        if (entry.bookingCount !== prev.bookingCount || entry.totalEarnings !== prev.totalEarnings) {
          rank = idx + 1;
        }
      }
      return { ...entry, rank };
    });

    res.json({ rankings: ranked, dateRange, generatedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
    }
    console.error("Error generating owner rankings:", error);
    res.status(500).json({ error: "Failed to generate owner rankings" });
  }
}
