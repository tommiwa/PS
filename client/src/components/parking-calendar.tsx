import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookingForm, type ParkingSpot as BookingFormSpot } from "@/components/booking-form"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock,
  MapPin,
  DollarSign,
  Zap,
  Car,
  Accessibility,
  Building,
  Heart,
  Flame,
  Tag,
  Sparkles
} from "lucide-react"
import { format, startOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns"
import { isPastDate } from "@/utils/date-utils"
import { useAuth } from "@/contexts/auth-context"
import { useLock } from "@/contexts/LockContext"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/queryClient"
import { getErrorMessage } from "@/lib/error-utils"

// Simple local date formatter for calendar date comparisons
// Uses local date components to avoid timezone shifts that cause day-off-by-one issues
const formatLocalDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
}

type CalendarView = "day" | "week" | "month"

interface ParkingSpot extends BookingFormSpot {
  isAvailable: boolean
  isOwned?: boolean
  availabilityDates?: string[] // Array of all available dates for this spot
  expiredDates?: string[] // Array of past unbooked dates
  isExpired?: boolean // True if all dates are expired
  bookedDates?: string[] // Array of dates that are already booked
  dateToPrice?: Record<string, {listingId: string, dailyRate: number}> // Map date -> price
  dateToCharity?: Record<string, boolean> // Map date -> charity status
  dateToSaleLabel?: Record<string, string> // Map date -> sale calendar label
  saleCalendarLabel?: string | null // Primary sale label
  donateToCharity?: boolean // Primary charity status
  activeLock?: {
    lockId: string
    expiresAt: string
    remainingSeconds: number
    userId?: string
  } | null
  listingId?: string
}

interface BookingFormData {
  date: string
  paymentMethod: string
  specialInstructions: string
  contactPhone: string
  vehicleLicense: string
  spotId: string
}

interface ParkingCalendarProps {
  spots: ParkingSpot[]
  onBookSpot: (spotId: string, bookingData?: any) => void
  selectedDate?: Date
  onDateChange?: (date: Date) => void
  isOwnerView?: boolean
}

export function ParkingCalendar({ spots, onBookSpot, selectedDate = new Date(), onDateChange, isOwnerView = false }: ParkingCalendarProps) {
  const { user } = useAuth();
  const { lockedListings, userActiveLock, acquireLock, clearUserLock } = useLock();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(selectedDate)
  const [view, setView] = useState<CalendarView>("week")
  const [isAcquiringLock, setIsAcquiringLock] = useState(false)
  const [expandedDay, setExpandedDay] = useState<{date: Date, spots: ParkingSpot[]} | null>(null)
  
  // State to store pre-computed data for visible dates
  interface DateSpotData {
    spots: ParkingSpot[];
    spotData: Map<string, {
      price: number;
      isExpired: boolean;
      isBooked: boolean;
      isLocked: boolean;
    }>;
  }
  const [dateSpotMap, setDateSpotMap] = useState<Map<string, DateSpotData>>(new Map())

  // Pre-compute spot data for visible dates using local date formatting
  useEffect(() => {
    const visibleDates = getVisibleDates();
    const newMap = new Map<string, DateSpotData>();

    for (const date of visibleDates) {
      const spotsForDate = getSpotsForDate(date);
      const spotData = new Map<string, {
        price: number;
        isExpired: boolean;
        isBooked: boolean;
        isLocked: boolean;
      }>();

      for (const spot of spotsForDate) {
        const price = getPriceForDate(spot, date);
        const isExpired = isSpotExpiredOnDate(spot, date);
        const isBooked = isSpotBookedOnDate(spot, date);
        const isLocked = isSpotLockedByOther(spot, date);
        
        spotData.set(spot.id, { price, isExpired, isBooked, isLocked });
      }

      const getStatusOrder = (id: string): number => {
        const data = spotData.get(id);
        if (!data) return 0;
        if (data.isExpired) return 3;
        if (data.isBooked) return 2;
        if (data.isLocked) return 1;
        return 0;
      };

      const sortedSpots = [...spotsForDate].sort((a, b) => {
        const statusA = getStatusOrder(a.id);
        const statusB = getStatusOrder(b.id);
        if (statusA !== statusB) return statusA - statusB;
        const priceA = spotData.get(a.id)?.price ?? 0;
        const priceB = spotData.get(b.id)?.price ?? 0;
        return priceA - priceB;
      });

      newMap.set(date.toISOString(), {
        spots: sortedSpots,
        spotData
      });
    }

    setDateSpotMap(newMap);
  }, [currentDate, view, spots, lockedListings, userActiveLock, isOwnerView])

  const navigateDate = (direction: "prev" | "next") => {
    let newDate: Date
    switch (view) {
      case "day":
        newDate = direction === "next" ? addDays(currentDate, 1) : addDays(currentDate, -1)
        break
      case "week":
        newDate = direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
        break
      case "month":
        newDate = direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
        break
    }
    setCurrentDate(newDate)
    onDateChange?.(newDate)
  }

  const getDateTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy")
      case "week": {
        const weekStart = startOfWeek(currentDate)
        const weekEnd = addDays(weekStart, 6)
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
      }
      case "month":
        return format(currentDate, "MMMM yyyy")
    }
  }

  const getVisibleDates = () => {
    switch (view) {
      case "day":
        return [currentDate]
      case "week": {
        const weekStart = startOfWeek(currentDate)
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      }
      case "month": {
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const calendarStart = startOfWeek(monthStart)
        const calendarEnd = addDays(startOfWeek(monthEnd), 6)
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
      }
    }
  }

  // Get the correct price for a spot on a specific date
  const getPriceForDate = (spot: ParkingSpot, date: Date): number => {
    const dateStr = formatLocalDate(date);
    
    // Use dateToPrice mapping if available
    if (spot.dateToPrice && spot.dateToPrice[dateStr]) {
      return spot.dateToPrice[dateStr].dailyRate;
    }
    
    // Fallback to spot.price for backward compatibility
    return spot.price;
  }

  // Helper to check if a spot is expired on a specific date
  const isSpotExpiredOnDate = (spot: ParkingSpot, date: Date): boolean => {
    if (!spot.expiredDates || spot.expiredDates.length === 0) {
      return false;
    }
    const checkDate = formatLocalDate(date);
    return spot.expiredDates.includes(checkDate);
  }

  // Helper to check if a spot is for charity on a specific date
  const isCharityOnDate = (spot: ParkingSpot, date: Date): boolean => {
    const dateStr = formatLocalDate(date);
    // Use dateToCharity mapping if available
    if (spot.dateToCharity && spot.dateToCharity[dateStr] !== undefined) {
      return spot.dateToCharity[dateStr];
    }
    // Fallback to primary donateToCharity
    return spot.donateToCharity || false;
  }

  // Helper to get sale label for a spot on a specific date — only shows when the date is within the sale window
  const getSaleLabelOnDate = (spot: ParkingSpot, date: Date): string | null => {
    if (!spot.isBciManaged) return null;
    const dateStr = formatLocalDate(date);
    if (spot.dateToSaleLabel && spot.dateToSaleLabel[dateStr]) {
      return spot.dateToSaleLabel[dateStr];
    }
    return null;
  }

  const getDealIcon = (price: number, size: string = "h-3 w-3") => {
    if (price <= 0) return null;
    if (price <= 5) return <Zap className={`${size} text-violet-500`} />;
    if (price <= 10) return <Flame className={`${size} text-orange-500`} />;
    if (price <= 12) return <Tag className={`${size} text-teal-500`} />;
    return null;
  }

  const getSpotsForDate = (date: Date): ParkingSpot[] => {
    const checkDate = formatLocalDate(date);
    
    return spots.filter((spot) => {
      // Filter out non-bookable spots (reserved) unless in owner view
      if (!isOwnerView && spot.isBookable === false) {
        return false;
      }

      // Show available spots on their specific availability OR expired dates
      if (spot.isAvailable) {
        // Check if date is in availability dates (future/today)
        const isAvailableOnDate = spot.availabilityDates?.includes(checkDate) || false;
        
        // Check if date is in expired dates (past unbooked)
        const isExpiredOnDate = spot.expiredDates?.includes(checkDate) || false;
        
        // Show if available OR expired (expired will be greyed out in rendering)
        if (isAvailableOnDate || isExpiredOnDate) {
          return true;
        }
        
        // Fallback to old single date format for backward compatibility
        // Use string comparison to avoid timezone issues (new Date("YYYY-MM-DD") creates midnight UTC)
        if (spot.availability?.date) {
          return spot.availability.date === checkDate;
        }
        
        // If no specific availability date, don't show the spot
        return false;
      }
      
      // For unavailable spots, only show on their specific booking date if available
      // Use string comparison to avoid timezone issues
      if (spot.availability?.date) {
        return spot.availability.date === checkDate;
      }
      return false;
    });
  }

  const getSpotTypeIcon = (type: string) => {
    switch (type) {
      case "electric":
        return <Zap className="h-3 w-3 text-green-600 dark:text-green-400" />
      case "tesla_ev":
        return <Zap className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
      case "accessible":
        return <Accessibility className="h-3 w-3 text-purple-600 dark:text-purple-400" />
      case "reserved":
        return <Building className="h-3 w-3 text-orange-600 dark:text-orange-400" />
      default:
        return <Car className="h-3 w-3 text-gray-600 dark:text-gray-400" />
    }
  }

  const getSpotTypeLabel = (type: string) => {
    switch (type) {
      case "electric":
        return "Electric"
      case "tesla_ev":
        return "Tesla"
      case "accessible":
        return "Accessible"
      case "reserved":
        return "Reserved"
      case "regular":
      default:
        return "Regular"
    }
  }

  // Get ownership-based styling with dark mode support
  const getOwnershipColor = (isOwned: boolean) => {
    if (isOwned) {
      // Owner's listings - warm gold/amber color
      return "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
    } else {
      // Others' available listings - light blue color
      return "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-100 dark:border-sky-700"
    }
  }

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "electric":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700"
      case "tesla_ev":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700"
      case "accessible":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700"
      case "reserved":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700"
      default:
        // Regular available spots - gray color matching spot cards
        return "bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
    }
  }

  const getOwnershipBadge = (isOwned: boolean) => {
    if (isOwned && isOwnerView) {
      return (
        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-600">
          Your Listing
        </Badge>
      )
    } else if (!isOwned && isOwnerView) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
          Other Owner
        </Badge>
      )
    }
    return null
  }

  // Helper to check if a spot is booked on a specific date
  const isSpotBookedOnDate = (spot: ParkingSpot, date: Date): boolean => {
    if (!spot.bookedDates || spot.bookedDates.length === 0) {
      return false
    }
    const checkDate = formatLocalDate(date);
    return spot.bookedDates.includes(checkDate)
  }

  // Helper to check if a spot is locked by another user on a specific date
  const isSpotLockedByOther = (spot: ParkingSpot, date: Date): boolean => {
    // Check if spot has listingId (required for composite key)
    if (!spot.listingId) {
      return false;
    }
    
    // Create composite key: listingId|date  
    const dateStr = formatLocalDate(date);
    const compositeKey = `${spot.listingId}|${dateStr}`;
    
    // Check if this specific listing+date is locked
    const lock = lockedListings.get(compositeKey);
    
    if (!lock) {
      return false; // Not locked at all
    }
    
    // Check if it's the current user's lock by comparing lockId
    const isMyLock = userActiveLock?.lockId === lock.lockId;
    
    // Return true if locked by someone else
    return !isMyLock;
  }

  const handleSpotClick = async (spot: ParkingSpot, clickedDate?: Date) => {
    const dateToCheck = clickedDate || currentDate
    
    // Prevent booking spots that are already booked on this date
    if (isSpotBookedOnDate(spot, dateToCheck)) {
      return; // Don't allow booking already booked spots
    }
    
    // Prevent clicking spots locked by another user on this specific date
    if (isSpotLockedByOther(spot, dateToCheck)) {
      return; // Don't allow booking locked spots
    }
    
    // Prevent booking expired spots (past unbooked dates)
    if (isSpotExpiredOnDate(spot, dateToCheck)) {
      return; // Don't allow booking expired spots
    }
    
    // Prevent booking spots with past availability dates
    if (spot.availability?.date && isPastDate(spot.availability.date)) {
      return; // Don't allow booking past spots
    }
    
    // Prevent booking non-bookable spots (reserved)
    if (spot.isBookable === false && !isOwnerView) {
      return; // Don't allow booking non-bookable spots
    }
    
    // First, acquire lock for this spot on this date
    setIsAcquiringLock(true);
    try {
      const dateStr = formatLocalDate(dateToCheck);
      
      // Get the listingId for this specific date from the spot's dateToPrice map
      const priceInfo = spot.dateToPrice?.[dateStr];
      if (!priceInfo) {
        toast({
          title: "Booking Error",
          description: "Unable to determine pricing for this date.",
          variant: "destructive"
        });
        return;
      }
      
      const { listingId } = priceInfo;

      // Use the centralized acquireLock from LockContext — it handles auto-release
      // and retry transparently when USER_HAS_ACTIVE_LOCK is returned.
      await acquireLock(spot.id, listingId, dateStr);
      
      // Lock acquired successfully, call parent to show booking form
      // Pass the clicked date so the form shows the correct date
      onBookSpot(spot.id, { date: dateStr })
    } catch (error: any) {
      console.error('[Calendar] Lock acquisition failed:', error);
      const rawMessage = error?.message || "";
      const friendlyMessage = getErrorMessage(error, "Could not reserve spot. Please try again.");
      
      if (rawMessage.includes('409') || rawMessage.includes('SPOT_ALREADY_LOCKED')) {
        toast({
          title: "Spot Already Reserved",
          description: "Another user is currently booking this spot. Please try again.",
          variant: "destructive"
        });
      } else if (rawMessage.includes('USER_HAS_ACTIVE_LOCK')) {
        // Fallback if auto-release retry also failed
        clearUserLock();
        toast({
          title: "Booking In Progress",
          description: "You have an active booking session on another spot. Please wait a moment and try again.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Lock Failed",
          description: friendlyMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsAcquiringLock(false);
    }
  }


  const renderDayView = () => {
    const dateKey = currentDate.toISOString();
    const dateData = dateSpotMap.get(dateKey);
    const daySpots = dateData?.spots || [];
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-1 gap-2 p-4">
          <div className="text-lg font-semibold mb-4">
            {format(currentDate, "EEEE, MMMM d, yyyy")} - {daySpots.length} spots available
          </div>
          {daySpots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No parking spots available for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {daySpots.map((spot) => {
                const spotInfo = dateData?.spotData.get(spot.id);
                const isBooked = spotInfo?.isBooked || false;
                const isLocked = spotInfo?.isLocked || false;
                const isExpired = spotInfo?.isExpired || false;
                return (
                  <Card 
                    key={`${spot.id}-${spot.availability?.date || currentDate.toISOString().split('T')[0]}`}
                    className={`transition-all border-l-4 ${
                      isBooked 
                        ? 'opacity-60 cursor-not-allowed bg-muted border-muted'
                        : isExpired
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                        : isLocked
                        ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
                        : `cursor-pointer hover-elevate ${
                            isOwnerView 
                              ? getOwnershipColor(spot.isOwned || false)
                              : getSpotTypeColor(spot.type)
                          }`
                    }`}
                    onClick={() => !isBooked && !isLocked && !isExpired && handleSpotClick(spot, currentDate)}
                    data-testid={`calendar-spot-${spot.id}-${spot.availability?.date || currentDate.toISOString().split('T')[0]}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getSpotTypeIcon(spot.type)}
                          <div className="min-w-0">
                            <div className="font-medium text-sm">#{spot.spotNumber}</div>
                            <div className="text-xs text-muted-foreground truncate">{spot.location}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isExpired ? (
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <span className="font-semibold text-sm">EXPIRED</span>
                            </div>
                          ) : isLocked ? (
                            <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                              <Clock className="h-3 w-3" />
                              <span className="font-semibold text-sm">PENDING</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 font-semibold text-sm">
                                {isCharityOnDate(spot, currentDate) && (
                                  <Heart className="h-3 w-3 text-pink-500 fill-pink-500" />
                                )}
                                {getDealIcon(spotInfo?.price || spot.price)}
                                ${spotInfo?.price || spot.price}
                              </div>
                              <div className="text-xs text-muted-foreground">per day</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {isBooked ? (
                          <Badge variant="secondary" className="text-xs bg-gray-500 text-white">
                            Booked
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="text-xs bg-gray-200 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300">
                            Expired
                          </Badge>
                        ) : isLocked ? (
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            PENDING
                          </Badge>
                        ) : (
                          <>
                            {getSpotTypeLabel(spot.type) && (
                              <Badge variant="outline" className="text-xs">
                                {getSpotTypeLabel(spot.type)}
                              </Badge>
                            )}
                            {spot.isInside && (
                              <Badge variant="outline" className="text-xs">
                                Indoor
                              </Badge>
                            )}
                            {getSaleLabelOnDate(spot, currentDate) && (
                              <Badge className="text-xs gap-1 bg-fuchsia-600 text-white border-fuchsia-700">
                                <Sparkles className="h-3 w-3" />
                                {getSaleLabelOnDate(spot, currentDate)}
                              </Badge>
                            )}
                          </>
                        )}
                        {getOwnershipBadge(spot.isOwned || false)}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = getVisibleDates()
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-7 gap-1 border-b">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="p-2 text-center border-r last:border-r-0">
              <div className="font-medium text-sm">{format(day, "EEE")}</div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-primary font-bold' : ''}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDays.map((day) => {
            const dateKey = day.toISOString();
            const dateData = dateSpotMap.get(dateKey);
            const daySpots = dateData?.spots || [];
            return (
              <div key={day.toISOString()} className="border-r last:border-r-0 p-1 min-h-[200px]">
                <div className="space-y-1">
                  {daySpots.slice(0, 3).map((spot) => {
                    const spotInfo = dateData?.spotData.get(spot.id);
                    const isBooked = spotInfo?.isBooked || false;
                    const isLocked = spotInfo?.isLocked || false;
                    const isExpired = spotInfo?.isExpired || false;
                    return (
                      <div
                        key={`${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                        className={`p-1.5 rounded text-xs transition-all ${
                          isBooked
                            ? 'opacity-60 cursor-not-allowed bg-muted'
                            : isExpired
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
                            : isLocked
                            ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                            : `cursor-pointer hover-elevate ${
                                isOwnerView 
                                  ? getOwnershipColor(spot.isOwned || false)
                                  : getSpotTypeColor(spot.type)
                              }`
                        }`}
                        onClick={() => !isBooked && !isLocked && !isExpired && handleSpotClick(spot, day)}
                        data-testid={`calendar-spot-${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                      >
                        <div className="font-medium">#{spot.spotNumber}</div>
                        <div className="flex items-center gap-1 justify-between">
                          <div className="flex items-center gap-1">
                            {getSpotTypeIcon(spot.type)}
                            {getSpotTypeLabel(spot.type) && (
                              <span className="text-[10px] font-medium">{getSpotTypeLabel(spot.type)}</span>
                            )}
                          </div>
                          {isExpired ? (
                            <span className="text-gray-500 dark:text-gray-400 font-semibold text-[10px]">
                              EXPIRED
                            </span>
                          ) : isLocked ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-semibold flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              PENDING
                            </span>
                          ) : (
                            <span className="font-semibold flex items-center gap-0.5">
                              {isCharityOnDate(spot, day) && (
                                <Heart className="h-2.5 w-2.5 text-pink-500 fill-pink-500" />
                              )}
                              {getDealIcon(spotInfo?.price || spot.price, "h-2.5 w-2.5")}
                              ${spotInfo?.price || spot.price}
                            </span>
                          )}
                        </div>
                        {isBooked && (
                          <Badge variant="secondary" className="text-xs bg-gray-500 text-white mt-1">
                            Booked
                          </Badge>
                        )}
                        {!isBooked && !isExpired && !isLocked && getSaleLabelOnDate(spot, day) && (
                          <div className="flex items-center gap-0.5 mt-0.5 text-fuchsia-600 dark:text-fuchsia-400 font-semibold text-[10px]">
                            <Sparkles className="h-2.5 w-2.5" />
                            {getSaleLabelOnDate(spot, day)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {daySpots.length > 3 && (
                    <button
                      onClick={() => setExpandedDay({date: day, spots: daySpots})}
                      className="text-xs text-primary hover:text-primary/80 hover:underline text-center py-1 w-full cursor-pointer font-medium"
                    >
                      +{daySpots.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDays = getVisibleDates()
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-7 gap-1 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center font-medium text-sm border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {monthDays.map((day) => {
            const dateKey = day.toISOString();
            const dateData = dateSpotMap.get(dateKey);
            const daySpots = dateData?.spots || [];
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = isSameDay(day, new Date())
            
            return (
              <div 
                key={day.toISOString()} 
                className={`border-r border-b last:border-r-0 p-1 min-h-[80px] ${!isCurrentMonth ? 'opacity-50 bg-muted/20' : ''}`}
              >
                <div className={`text-xs mb-1 ${isToday ? 'text-primary font-bold' : ''}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {daySpots.slice(0, 2).map((spot) => {
                    const spotInfo = dateData?.spotData.get(spot.id);
                    const isBooked = spotInfo?.isBooked || false;
                    const isLocked = spotInfo?.isLocked || false;
                    const isExpired = spotInfo?.isExpired || false;
                    return (
                      <div
                        key={`${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                        className={`p-0.5 rounded text-xs transition-all ${
                          isBooked
                            ? 'opacity-60 cursor-not-allowed bg-muted'
                            : isExpired
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
                            : isLocked
                            ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                            : `cursor-pointer hover-elevate ${
                                isOwnerView 
                                  ? getOwnershipColor(spot.isOwned || false)
                                  : getSpotTypeColor(spot.type)
                              }`
                        }`}
                        onClick={() => !isBooked && !isLocked && !isExpired && handleSpotClick(spot, day)}
                        data-testid={`calendar-spot-${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-0.5">
                            {getSpotTypeIcon(spot.type)}
                            {getSpotTypeLabel(spot.type) && (
                              <span className="text-[9px] font-medium">{getSpotTypeLabel(spot.type)}</span>
                            )}
                            <span className="font-medium">#{spot.spotNumber}</span>
                          </div>
                          {isExpired ? (
                            <span className="text-gray-500 dark:text-gray-400 font-semibold text-[9px]">
                              EXP
                            </span>
                          ) : isLocked ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-semibold flex items-center gap-0.5">
                              <Clock className="h-2 w-2" />
                              PENDING
                            </span>
                          ) : (
                            <span className="font-semibold flex items-center gap-0.5">
                              {isCharityOnDate(spot, day) && (
                                <Heart className="h-2 w-2 text-pink-500 fill-pink-500" />
                              )}
                              {getDealIcon(spotInfo?.price || spot.price, "h-2 w-2")}
                              ${spotInfo?.price || spot.price}
                            </span>
                          )}
                        </div>
                        {isBooked && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">Booked</div>
                        )}
                        {!isBooked && !isExpired && !isLocked && getSaleLabelOnDate(spot, day) && (
                          <div className="flex items-center gap-0.5 mt-0.5 text-fuchsia-600 dark:text-fuchsia-400 font-semibold text-[9px] truncate">
                            <Sparkles className="h-2 w-2 shrink-0" />
                            <span className="truncate">{getSaleLabelOnDate(spot, day)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {daySpots.length > 2 && (
                    <button
                      onClick={() => setExpandedDay({date: day, spots: daySpots})}
                      className="text-xs text-primary hover:text-primary/80 hover:underline cursor-pointer font-medium"
                    >
                      +{daySpots.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCalendarContent = () => {
    switch (view) {
      case "day":
        return renderDayView()
      case "week":
        return renderWeekView()
      case "month":
        return renderMonthView()
    }
  }

  return (
    <div className="h-full flex flex-col" data-testid="parking-calendar">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentDate(new Date())}
              data-testid="calendar-today-button"
            >
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-lg font-semibold">{getDateTitle()}</div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("day")}
            data-testid="calendar-view-day"
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            data-testid="calendar-view-week"
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
            data-testid="calendar-view-month"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto">
        {renderCalendarContent()}
      </div>
      
      {/* Expanded Day Dialog */}
      <Dialog open={!!expandedDay} onOpenChange={(open) => !open && setExpandedDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Available Spots for {expandedDay && format(expandedDay.date, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {expandedDay?.spots.map((spot) => {
              const dateKey = expandedDay.date.toISOString();
              const dateData = dateSpotMap.get(dateKey);
              const spotInfo = dateData?.spotData.get(spot.id);
              const isBooked = spotInfo?.isBooked || false;
              const isLocked = spotInfo?.isLocked || false;
              const isExpired = spotInfo?.isExpired || false;
              
              return (
                <div
                  key={spot.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isBooked
                      ? 'opacity-60 cursor-not-allowed bg-muted border-muted'
                      : isExpired
                      ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                      : isLocked
                      ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
                      : `cursor-pointer hover-elevate ${
                          isOwnerView 
                            ? getOwnershipColor(spot.isOwned || false)
                            : getSpotTypeColor(spot.type)
                        } border-current/20`
                  }`}
                  onClick={() => {
                    if (!isBooked && !isLocked && !isExpired) {
                      setExpandedDay(null);
                      handleSpotClick(spot, expandedDay.date);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getSpotTypeIcon(spot.type)}
                        <span className="font-semibold">#{spot.spotNumber}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {getSpotTypeLabel(spot.type) || 'Regular'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpired ? (
                        <Badge variant="secondary" className="bg-gray-200 text-gray-600">
                          Expired
                        </Badge>
                      ) : isBooked ? (
                        <Badge variant="secondary" className="bg-gray-500 text-white">
                          Booked
                        </Badge>
                      ) : isLocked ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border border-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-lg text-primary flex items-center gap-1">
                            {isCharityOnDate(spot, expandedDay.date) && (
                              <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
                            )}
                            {getDealIcon(spotInfo?.price || spot.price, "h-4 w-4")}
                            ${spotInfo?.price || spot.price}
                          </span>
                          {getSaleLabelOnDate(spot, expandedDay.date) && (
                            <Badge className="gap-1 bg-fuchsia-600 text-white border-fuchsia-700 text-xs">
                              <Sparkles className="h-3 w-3" />
                              {getSaleLabelOnDate(spot, expandedDay.date)}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {spot.location && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {spot.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}