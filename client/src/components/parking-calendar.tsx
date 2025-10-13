import { useState } from "react"
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
  Building
} from "lucide-react"
import { format, startOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns"
import { isPastDate } from "@/utils/date-utils"
import { useAuth } from "@/contexts/auth-context"
import { useLock } from "@/contexts/LockContext"

type CalendarView = "day" | "week" | "month"

interface ParkingSpot extends BookingFormSpot {
  isAvailable: boolean
  isOwned?: boolean
  availabilityDates?: string[] // Array of all available dates for this spot
  bookedDates?: string[] // Array of dates that are already booked
  dateToPrice?: Record<string, {listingId: string, dailyRate: number}> // Map date -> price
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
  const { lockedListings, userActiveLock } = useLock();
  const [currentDate, setCurrentDate] = useState(selectedDate)
  const [view, setView] = useState<CalendarView>("week")
  const [bookingDate, setBookingDate] = useState<Date | null>(null)

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
      case "week":
        const weekStart = startOfWeek(currentDate)
        const weekEnd = addDays(weekStart, 6)
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
      case "month":
        return format(currentDate, "MMMM yyyy")
    }
  }

  const getVisibleDates = () => {
    switch (view) {
      case "day":
        return [currentDate]
      case "week":
        const weekStart = startOfWeek(currentDate)
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      case "month":
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const calendarStart = startOfWeek(monthStart)
        const calendarEnd = addDays(startOfWeek(monthEnd), 6)
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }
  }

  // Get the correct price for a spot on a specific date
  const getPriceForDate = (spot: ParkingSpot, date: Date): number => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Use dateToPrice mapping if available
    if (spot.dateToPrice && spot.dateToPrice[dateStr]) {
      return spot.dateToPrice[dateStr].dailyRate;
    }
    
    // Fallback to spot.price for backward compatibility
    return spot.price;
  }

  const getSpotsForDate = (date: Date) => {
    return spots.filter(spot => {
      // Hide past spots for renters - they can't book past dates
      if (isPastDate(date)) {
        return false;
      }

      // Filter out non-bookable spots (reserved) unless in owner view
      if (!isOwnerView && spot.isBookable === false) {
        return false;
      }

      // Show available spots only on their specific availability dates
      if (spot.isAvailable) {
        const checkDate = date.toISOString().split('T')[0] // Format: YYYY-MM-DD
        
        // Check if spot has availabilityDates array (new format)
        if (spot.availabilityDates && spot.availabilityDates.length > 0) {
          // Check if the date is in the availability dates array
          const isAvailableOnDate = spot.availabilityDates.includes(checkDate)
          
          // Don't show past dates
          if (isPastDate(checkDate)) {
            return false
          }
          
          return isAvailableOnDate
        }
        
        // Fallback to old single date format for backward compatibility
        if (spot.availability?.date) {
          const spotDate = new Date(spot.availability.date)
          // Don't show if the spot's availability date is in the past
          if (isPastDate(spotDate)) {
            return false;
          }
          return isSameDay(spotDate, date)
        }
        
        // If no specific availability date, don't show the spot
        return false
      }
      // For unavailable spots, only show on their specific booking date if available
      if (spot.availability?.date) {
        const spotDate = new Date(spot.availability.date)
        // Don't show past bookings in the calendar for renters
        if (isPastDate(spotDate)) {
          return false;
        }
        return isSameDay(spotDate, date)
      }
      return false
    })
  }

  const getSpotTypeIcon = (type: string) => {
    switch (type) {
      case "electric":
        return <Zap className="h-3 w-3 text-green-600" />
      case "tesla_ev":
        return <Zap className="h-3 w-3 text-red-600" />
      case "accessible":
        return <Accessibility className="h-3 w-3 text-blue-600" />
      case "reserved":
        return <Building className="h-3 w-3 text-orange-600" />
      default:
        return <Car className="h-3 w-3 text-gray-600" />
    }
  }

  // Get ownership-based styling with dark mode support
  const getOwnershipColor = (isOwned: boolean) => {
    if (isOwned) {
      // Owner's listings - warm gold/amber color
      return "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
    } else {
      // Others' listings - neutral gray
      return "bg-gray-50 text-gray-900 border-gray-200 dark:bg-gray-800/50 dark:text-gray-100 dark:border-gray-600"
    }
  }

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "electric":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
      case "tesla_ev":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200"
      case "accessible":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200"
      case "reserved":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200"
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
    const checkDate = date.toISOString().split('T')[0] // Format: YYYY-MM-DD
    return spot.bookedDates.includes(checkDate)
  }

  // Helper to check if a spot is locked by another user on a specific date
  const isSpotLockedByOther = (spot: ParkingSpot, date: Date): boolean => {
    // Check if spot has listingId (required for composite key)
    if (!spot.listingId) {
      return false;
    }
    
    // Create composite key: listingId|date
    const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
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

  const handleSpotClick = (spot: ParkingSpot, clickedDate?: Date) => {
    const dateToCheck = clickedDate || currentDate
    
    // Prevent booking spots that are already booked on this date
    if (isSpotBookedOnDate(spot, dateToCheck)) {
      return; // Don't allow booking already booked spots
    }
    
    // Prevent clicking spots locked by another user on this specific date
    if (isSpotLockedByOther(spot, dateToCheck)) {
      return; // Don't allow booking locked spots
    }
    
    // Prevent booking spots with past availability dates
    if (spot.availability?.date && isPastDate(spot.availability.date)) {
      return; // Don't allow booking past spots
    }
    
    // Prevent booking non-bookable spots (reserved)
    if (spot.isBookable === false && !isOwnerView) {
      return; // Don't allow booking non-bookable spots
    }
    
    // Store the booking date for this spot
    setBookingDate(dateToCheck)
    
    // Call parent handler with spot ID and date info (same as tiles view)
    // This will trigger lock acquisition in search.tsx
    const dateStr = dateToCheck.toISOString().split('T')[0];
    onBookSpot(spot.id, { spotId: spot.id, date: dateStr })
  }

  const renderDayView = () => {
    const daySpots = getSpotsForDate(currentDate)
    
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
                const isBooked = isSpotBookedOnDate(spot, currentDate)
                const isLocked = isSpotLockedByOther(spot, currentDate)
                return (
                  <Card 
                    key={`${spot.id}-${spot.availability?.date || currentDate.toISOString().split('T')[0]}`}
                    className={`transition-all border-l-4 ${
                      isBooked 
                        ? 'opacity-60 cursor-not-allowed bg-muted border-muted'
                        : isLocked
                        ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
                        : `cursor-pointer hover-elevate ${
                            isOwnerView 
                              ? getOwnershipColor(spot.isOwned || false)
                              : getSpotTypeColor(spot.type)
                          }`
                    }`}
                    onClick={() => !isBooked && !isLocked && handleSpotClick(spot, currentDate)}
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
                          {isLocked ? (
                            <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                              <Clock className="h-3 w-3" />
                              <span className="font-semibold text-sm">PENDING</span>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-sm">${getPriceForDate(spot, currentDate)}</div>
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
                        ) : isLocked ? (
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            PENDING
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {spot.type}
                            </Badge>
                            {spot.isInside && (
                              <Badge variant="outline" className="text-xs">
                                Indoor
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
            const daySpots = getSpotsForDate(day)
            return (
              <div key={day.toISOString()} className="border-r last:border-r-0 p-1 min-h-[200px]">
                <div className="space-y-1">
                  {daySpots.slice(0, 3).map((spot) => {
                    const isBooked = isSpotBookedOnDate(spot, day)
                    const isLocked = isSpotLockedByOther(spot, day)
                    return (
                      <div
                        key={`${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                        className={`p-1.5 rounded text-xs transition-all ${
                          isBooked
                            ? 'opacity-60 cursor-not-allowed bg-muted'
                            : isLocked
                            ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                            : `cursor-pointer hover-elevate ${
                                isOwnerView 
                                  ? getOwnershipColor(spot.isOwned || false)
                                  : getSpotTypeColor(spot.type)
                              }`
                        }`}
                        onClick={() => !isBooked && !isLocked && handleSpotClick(spot, day)}
                        data-testid={`calendar-spot-${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                      >
                        <div className="font-medium">#{spot.spotNumber}</div>
                        <div className="flex items-center gap-1 justify-between">
                          <div className="flex items-center gap-1">
                            {getSpotTypeIcon(spot.type)}
                          </div>
                          {isLocked ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-semibold flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              PENDING
                            </span>
                          ) : (
                            <span className="font-semibold">${getPriceForDate(spot, day)}</span>
                          )}
                        </div>
                        {isBooked && (
                          <Badge variant="secondary" className="text-xs bg-gray-500 text-white mt-1">
                            Booked
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                  {daySpots.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{daySpots.length - 3}
                    </div>
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
            const daySpots = getSpotsForDate(day)
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
                    const isBooked = isSpotBookedOnDate(spot, day)
                    const isLocked = isSpotLockedByOther(spot, day)
                    return (
                      <div
                        key={`${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                        className={`p-0.5 rounded text-xs transition-all ${
                          isBooked
                            ? 'opacity-60 cursor-not-allowed bg-muted'
                            : isLocked
                            ? 'opacity-90 cursor-not-allowed bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
                            : `cursor-pointer hover-elevate ${
                                isOwnerView 
                                  ? getOwnershipColor(spot.isOwned || false)
                                  : getSpotTypeColor(spot.type)
                              }`
                        }`}
                        onClick={() => !isBooked && !isLocked && handleSpotClick(spot, day)}
                        data-testid={`calendar-spot-${spot.id}-${spot.availability?.date || day.toISOString().split('T')[0]}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-0.5">
                            {getSpotTypeIcon(spot.type)}
                            <span className="font-medium">#{spot.spotNumber}</span>
                          </div>
                          {isLocked ? (
                            <span className="text-yellow-700 dark:text-yellow-300 font-semibold flex items-center gap-0.5">
                              <Clock className="h-2 w-2" />
                              PENDING
                            </span>
                          ) : (
                            <span className="font-semibold">${getPriceForDate(spot, day)}</span>
                          )}
                        </div>
                        {isBooked && (
                          <div className="text-xs text-gray-600 dark:text-gray-400">Booked</div>
                        )}
                      </div>
                    )
                  })}
                  {daySpots.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{daySpots.length - 2}
                    </div>
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

    </div>
  )
}