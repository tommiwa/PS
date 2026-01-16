import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { EnhancedSearch, ParsedSearch } from "@/components/enhanced-search"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { ParkingCalendar } from "@/components/parking-calendar"
import { BookingForm } from "@/components/booking-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MapPin, Filter, SortAsc, Calendar, Grid, Sparkles, Loader2, RefreshCw } from "lucide-react"
import { isPastDate } from "@/utils/date-utils"
import { apiRequest } from "@/lib/queryClient"
import { type ParkingSpot as DBParkingSpot, type SpotTypeTable } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"
import { useLock } from "@/contexts/LockContext"
import { useAuth } from "@/contexts/auth-context"
import { getErrorMessage } from "@/lib/error-utils"

// Location type from database
interface Location {
  id: number
  office: string
  building: string
  level: string
  address?: string
  timezone: string
  isActive: boolean
}

// API response type from /api/available-spots with enriched data
interface EnrichedSpotFromAPI extends DBParkingSpot {
  listingId?: string
  dailyRate?: string
  availabilityDates?: string[] // Array of all available dates
  expiredDates?: string[] // Array of past unbooked dates
  isExpired?: boolean // True if all dates are expired
  bookedDates?: string[] // Array of dates that are already booked
  isAvailable?: boolean // True if spot has future availability dates
  availability?: {
    date: string
  }
  owner?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  location?: {
    id: number
    name: string
  }
  spotType?: {
    id: number
    name: string
  }
  activeLock?: {
    lockId: string
    expiresAt: string
    remainingSeconds: number
    userId?: string
  } | null
}

// Convert database spot to display format
interface DisplaySpot extends DBParkingSpot {
  // Additional display properties for backwards compatibility 
  location: string
  type: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved"
  isInside: boolean
  price: number
  owner: string
  isAvailable: boolean
  availability?: {
    date: string
  }
  availabilityDates?: string[] // Array of all available dates
  expiredDates?: string[] // Array of past unbooked dates
  isExpired?: boolean // True if all dates are expired
  bookedDates?: string[] // Array of dates that are already booked
  activeLock?: {
    lockId: string
    expiresAt: string
    remainingSeconds: number
    userId?: string
  } | null
  listingId?: string
}

export default function Search() {
  const [searchCriteria, setSearchCriteria] = useState<ParsedSearch>({
    query: "",
    quickFilters: []
  })
  
  const [selectedSpot, setSelectedSpot] = useState<DisplaySpot | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [sortBy, setSortBy] = useState("price")
  const [activeTab, setActiveTab] = useState<string>("tiles")
  const [isAcquiringLock, setIsAcquiringLock] = useState(false)
  const { toast } = useToast()
  const { userActiveLock, lockedListings, acquireLock, releaseLock, clearUserLock } = useLock()
  const { user } = useAuth()

  // Fetch available parking spots from API - using enriched type that includes availabilityDates and bookedDates
  const { data: dbSpots = [], isLoading, isFetching, error, refetch } = useQuery<EnrichedSpotFromAPI[]>({
    queryKey: ['/api/available-spots']
  })

  // Fetch locations to map locationId to location strings
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations']
  })

  // Fetch spot types to map spotTypeId to type strings
  const { data: spotTypes = [] } = useQuery<SpotTypeTable[]>({
    queryKey: ['/api/spot-types']
  })

  // Helper function to format location from database
  const formatLocation = (locationId: number): string => {
    const location = locations.find(loc => loc.id === locationId)
    if (!location) return 'Unknown Location'
    return `${location.office} - ${location.building}, ${location.level}`
  }

  // Helper function to map spot type ID to type string
  const mapSpotType = (spotTypeId: number): DisplaySpot['type'] => {
    const spotType = spotTypes.find(type => type.id === spotTypeId)
    if (!spotType) return 'regular'
    
    // Map database slug to DisplaySpot type
    const typeMap: Record<string, DisplaySpot['type']> = {
      'regular': 'regular',
      'accessible': 'accessible',
      'electric': 'electric',
      'tesla-electric': 'tesla_ev',
      'reserved': 'reserved'
    }
    
    return typeMap[spotType.slug] || 'regular'
  }

  // Convert database spots to display format with mock owners
  const getSpotOwner = (ownerId: string | null) => {
    const ownerMap: Record<string, string> = {
      'user-admin-001': 'David Thompson',
      'user-owner-001': 'Sarah Chen', 
      'user-renter-001': 'Michael Rodriguez'
    }
    return ownerId ? ownerMap[ownerId] || 'Unknown Owner' : 'Unassigned'
  }

  // Expand spots by availability dates so each date becomes a separate entry
  // CRITICAL: Filter out expired spots AND booked dates during expansion to hide them from tiles view
  const spots: DisplaySpot[] = dbSpots
    .filter(spot => !spot.isExpired) // Filter out fully expired spots from tiles view
    .flatMap(spot => {
    const baseSpot = {
      ...spot,
      spotNumber: spot.spotNumber,
      location: formatLocation(spot.locationId),
      type: mapSpotType(spot.spotTypeId),
      isInside: spot.isIndoor,
      price: spot.dailyRate ? parseFloat(spot.dailyRate) : 25,
      owner: spot.owner ? `${spot.owner.firstName} ${spot.owner.lastName}` : getSpotOwner(spot.ownerId),
      // Use API's isAvailable field which checks if spot has future availability dates
      // Fallback to isActive only if isAvailable is not set (shouldn't happen with current API)
      isAvailable: spot.isAvailable ?? spot.isActive,
      isBookable: spot.isBookable,
      // Explicitly preserve enriched availability data from API
      availabilityDates: spot.availabilityDates,
      expiredDates: spot.expiredDates,
      isExpired: spot.isExpired,
      bookedDates: spot.bookedDates,
      // Preserve lock and listing info from API
      activeLock: spot.activeLock,
      listingId: spot.listingId,
    }
    
    // If spot has availability dates, create one entry per date
    if (spot.availabilityDates && spot.availabilityDates.length > 0) {
      // CRITICAL FIX: Filter out dates that are already booked OR locked by others BEFORE creating entries
      // This ensures booked/locked spots don't appear in tiles view
      return spot.availabilityDates
        .filter(date => {
          // Exclude booked dates
          if (spot.bookedDates?.includes(date)) return false;
          
          // Exclude dates locked by other users (check using composite key)
          // Get the date-specific listingId from dateToPrice if available
          const dateToPrice = (spot as any).dateToPrice;
          const dateListingId = dateToPrice?.[date]?.listingId || spot.listingId;
          
          if (dateListingId) {
            const compositeKey = `${dateListingId}|${date}`;
            const lock = lockedListings.get(compositeKey);
            
            if (lock) {
              // FIX: Also check if lock has expired by time to handle race conditions
              // This prevents spots from vanishing when userActiveLock is cleared
              // but lockedListings hasn't been updated yet
              const lockExpireTime = new Date(lock.expiresAt).getTime();
              const isLockExpired = lockExpireTime <= Date.now();
              
              if (isLockExpired) {
                // Lock has expired by time - don't filter out this date
                return true;
              }
              
              // Check if it's the current user's lock by comparing lockId
              const isMyLock = userActiveLock?.lockId === lock.lockId;
              // Filter out if locked by someone else
              if (!isMyLock) return false;
            }
          }
          
          return true;
        })
        .map(date => {
          // Get date-specific price AND listingId if available
          const dateToPrice = (spot as any).dateToPrice;
          let spotPrice = spot.dailyRate ? parseFloat(spot.dailyRate) : 25;
          let dateListing = spot.listingId; // Default to spot's listingId
          
          if (dateToPrice && dateToPrice[date]) {
            spotPrice = parseFloat(dateToPrice[date].dailyRate);
            dateListing = dateToPrice[date].listingId; // Use date-specific listingId
          }
          
          return {
            ...baseSpot,
            id: spot.id, // Keep original spot ID for booking
            listingId: dateListing, // Override with date-specific listingId
            price: spotPrice, // Override with date-specific price
            availability: { date }, // Set specific date for this entry
            availabilityDates: [date], // Each expanded entry only has its own date
            bookedDates: spot.bookedDates, // Preserve for calendar view
          };
        })
    }
    
    // Fallback for spots without availabilityDates
    return [{
      ...baseSpot,
      availability: spot.availability
    }]
  })

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      // Include lockId in request if user has an active lock
      const dataWithLock = {
        ...bookingData,
        lockId: userActiveLock?.lockId
      };
      return apiRequest('/api/bookings', { method: 'POST', body: dataWithLock })
    },
    onSuccess: () => {
      toast({
        title: "Booking Created",
        description: "Your parking spot has been successfully booked!"
      })
      
      // Clear user lock from context (lock auto-confirmed by backend)
      clearUserLock();
      
      setShowBookingForm(false)
      setSelectedSpot(null)
      
      // CRITICAL: Invalidate queries so My Bookings page shows the new booking
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] })
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error, "Failed to create booking. Please try again.");
      
      // Check if lock expired
      if (errorMessage.toLowerCase().includes('lock')) {
        toast({
          title: "Lock Expired",
          description: "Your reservation expired. Please try again.",
          variant: "destructive"
        })
        setShowBookingForm(false)
        setSelectedSpot(null)
      } else {
        toast({
          title: "Booking Failed",
          description: errorMessage,
          variant: "destructive"
        })
      }
    }
  })

  // Handle booking form submission
  const handleBookSpot = async (spotId: string, bookingData?: any) => {
    // Find the spot - prefer matching by BOTH id and date to get correct price
    let spot: DisplaySpot | undefined;
    
    const targetDate = bookingData?.date || bookingData?.bookingDate;
    
    if (targetDate) {
      // If we have a date, find the EXACT spot entry for that date (ensures correct price)
      spot = spots.find(s => s.id === spotId && s.availability?.date === targetDate);
      console.log('[handleBookSpot] Looking for spot with ID:', spotId, 'and date:', targetDate, 'found:', !!spot);
    }
    
    // Fallback: find any spot with this ID (should only happen if no date provided)
    if (!spot) {
      spot = spots.find(s => s.id === spotId);
      console.log('[handleBookSpot] Fallback: found spot without date match:', !!spot);
    }
    
    console.log('[handleBookSpot] Final selected spot price:', spot?.price);
    if (!spot) return;
    
    const listingId = (spot as any).listingId;
    console.log('[handleBookSpot] listingId:', listingId);
    if (!listingId) {
      console.error('[handleBookSpot] Missing listingId! Spot data:', spot);
      toast({
        title: "Booking Error",
        description: "This spot does not have an active listing.",
        variant: "destructive"
      });
      return;
    }
    
    if (bookingData) {
      // Booking data provided from calendar - submit immediately
      console.log('[handleBookSpot] bookingData provided, submitting immediately');
      handleBookingFormSubmit(spot, bookingData)
    } else {
      // Determine the booking date - prioritize search criteria date when user is filtering by date
      // This ensures when user filters by Jan 16 and clicks a spot, they book for Jan 16
      const bookingDate = 
        searchCriteria.date || // Prioritize the date user searched for
        spot.availability?.date || // Fallback to spot's first available date
        new Date().toISOString().split('T')[0]; // Last resort: today
      
      console.log('[handleBookSpot] Calculated bookingDate:', bookingDate);
      console.log('[handleBookSpot] userActiveLock:', userActiveLock);
      
      // Check if user already has a VALID lock on THIS specific spot AND date
      const hasValidLock = userActiveLock?.spotId === spotId && 
                           userActiveLock?.bookingDate === bookingDate &&
                           new Date(userActiveLock.expiresAt).getTime() > Date.now();
      
      console.log('[handleBookSpot] hasValidLock:', hasValidLock);
      
      if (hasValidLock) {
        // User already has valid lock on this spot+date, just reopen form without acquiring new lock
        console.log('[handleBookSpot] User has valid lock, reopening form');
        setSelectedSpot(spot);
        setShowBookingForm(true);
        return;
      }
      
      // If user had an expired lock, clear it first
      if (userActiveLock && new Date(userActiveLock.expiresAt).getTime() <= Date.now()) {
        console.log('[handleBookSpot] Clearing expired lock');
        clearUserLock();
      }
      
      // No lock yet - acquire lock BEFORE showing form
      console.log('[handleBookSpot] About to acquire lock...');
      setIsAcquiringLock(true);
      try {
        console.log('[handleBookSpot] Calling acquireLock with:', { spotId, listingId, bookingDate });
        await acquireLock(spotId, listingId, bookingDate);
        console.log('[handleBookSpot] Lock acquired successfully!');
        // Lock acquired successfully, show booking form
        setSelectedSpot(spot);
        setShowBookingForm(true);
      } catch (error: any) {
        console.error('[handleBookSpot] Lock acquisition failed:', error);
        // Lock acquisition failed - check error message for specific codes
        const rawMessage = error?.message || "";
        const friendlyMessage = getErrorMessage(error, "Could not reserve spot. Please try again.");
        
        if (rawMessage.includes('409') || rawMessage.includes('SPOT_ALREADY_LOCKED')) {
          toast({
            title: "Spot Already Reserved",
            description: "Another user is currently booking this spot. Please try again.",
            variant: "destructive"
          });
        } else if (rawMessage.includes('USER_HAS_ACTIVE_LOCK')) {
          toast({
            title: "Active Reservation",
            description: "You already have an active reservation on another spot. Please complete or cancel it first.",
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
  }

  // Handle actual booking submission from form
  const handleBookingFormSubmit = (spot: DisplaySpot, bookingData: any) => {
    // Get listing ID and daily rate from spot data (enriched by API)
    const listingId = (spot as any).listingId
    const dailyRate = (spot as any).dailyRate || spot.price
    
    // Note: Don't check listingId here - let backend handle validation
    // This allows backend to return proper error messages (lock expired, etc.)
    
    createBookingMutation.mutate({
      spotId: spot.id,
      listingId: listingId || '', // Provide empty string if missing, backend will validate
      bookingDate: bookingData.date,
      dailyRate: dailyRate,
      totalAmount: dailyRate,
      notes: bookingData.specialInstructions
    })
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Find Parking Spots</h1>
          <div className="grid gap-4">
            <Skeleton className="h-12 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Parking Spots</h1>
          <p className="text-muted-foreground mb-4">
            Unable to load available parking spots. Please try again.
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  // Base filtering without date constraints (for calendar view)
  const baseFilteredSpots = spots.filter(spot => {
    const { location, spotType, priceMin, priceMax, isInside, isBciManaged, query } = searchCriteria
    
    // Filter out spots with past availability dates
    if (spot.availability?.date && isPastDate(spot.availability.date)) {
      return false; // Don't show past spots to renters
    }
    
    // Basic availability filtering - only show generally available spots for calendar
    if (!spot.isAvailable) {
      return false // Don't show unavailable spots in calendar view
    }
    
    // Filter out non-bookable spots (taxable benefit) from search results
    if (spot.isBookable === false) {
      return false // Don't show non-bookable spots to renters
    }
    
    // BCI Managed filtering - only show BCI-managed spots
    if (isBciManaged !== undefined && isBciManaged) {
      // Filter to only BCI-managed spots using the database field
      if (!spot.isBciManaged) {
        return false
      }
    }
    
    // Text-based search across multiple fields
    if (query && query.trim()) {
      const queryLower = query.toLowerCase()
      const searchableText = [
        spot.spotNumber,
        spot.location,
        spot.type,
        spot.owner,
        spot.isInside ? 'inside' : 'outside'
      ].join(' ').toLowerCase()
      
      if (!searchableText.includes(queryLower) && 
          !queryLower.split(' ').some(term => searchableText.includes(term))) {
        return false
      }
    }
    
    // Location filtering
    if (location && !spot.location.toLowerCase().includes(location.toLowerCase())) return false
    
    // Spot type filtering
    if (spotType && spotType !== "all" && spot.type !== spotType) return false
    
    // Price filtering
    if (priceMin !== undefined && spot.price < priceMin) return false
    if (priceMax !== undefined && spot.price > priceMax) return false
    
    // Inside/outside filtering
    if (isInside !== undefined && spot.isInside !== isInside) return false
    
    return true
  })

  // Date-specific filtering for tiles view
  const filteredSpots = baseFilteredSpots.filter(spot => {
    const { date } = searchCriteria
    
    // If no date specified, show all base filtered spots
    if (!date) return true
    
    // Don't show spots for past search dates
    if (isPastDate(date)) {
      return false;
    }
    
    // Availability filtering with date constraints for tiles view
    if (spot.isAvailable) {
      // Check if spot has availabilityDates array (new format)
      if (spot.availabilityDates && spot.availabilityDates.length > 0) {
        // Check if search date is in the availability dates array
        const isAvailableOnDate = spot.availabilityDates.includes(date)
        return isAvailableOnDate
      }
      
      // Fallback: check old single date format for backward compatibility
      if (spot.availability?.date) {
        const spotDate = new Date(spot.availability.date).toISOString().split('T')[0]
        const searchDate = date
        if (spotDate !== searchDate) {
          return false
        }
        // Double-check the spot date is not in the past
        if (isPastDate(spotDate)) {
          return false;
        }
        return true
      }
      
      // If no availability dates at all, don't show in tiles for date search
      return false
    } else {
      // Spot is not generally available, only show if searching for its specific booking date
      if (!spot.availability?.date) {
        return false // Don't show unavailable spots unless they have a specific availability date
      }
      const spotDate = new Date(spot.availability.date).toISOString().split('T')[0]
      const searchDate = date
      // Don't show past bookings
      if (isPastDate(spotDate)) {
        return false;
      }
      return spotDate === searchDate
    }
  })

  // Helper to check if a spot is booked on its specific date
  const isSpotBooked = (spot: DisplaySpot): boolean => {
    if (!spot.availability?.date || !spot.bookedDates || spot.bookedDates.length === 0) {
      return false
    }
    const spotDate = spot.availability.date
    return spot.bookedDates.includes(spotDate)
  }

  // Use filteredSpots for tiles view when date is selected, otherwise use baseFilteredSpots
  // Also filter out booked spots to sync with calendar
  const spotsForTiles = (searchCriteria.date ? filteredSpots : baseFilteredSpots).filter(spot => !isSpotBooked(spot))
  const spotsForCalendar = searchCriteria.date ? filteredSpots : baseFilteredSpots
  
  const sortedSpots = [...spotsForTiles].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return a.price - b.price
      case "date":
        // Sort by earliest availability date
        const aDate = a.availabilityDates?.[0] || ''
        const bDate = b.availabilityDates?.[0] || ''
        return aDate.localeCompare(bDate)
      default:
        return 0
    }
  })

  const handleBookingSubmit = (bookingData: any) => {
    if (!selectedSpot) return
    console.log('Booking submitted:', bookingData)
    handleBookingFormSubmit(selectedSpot, bookingData)
  }

  const handleSearch = (parsed: ParsedSearch) => {
    console.log('Search triggered with criteria:', parsed)
    setSearchCriteria(parsed)
    // In real app, this would trigger API call
  }

  const getActiveFilterCount = () => {
    const { location, spotType, priceMin, priceMax, isInside, isBciManaged, date, query, quickFilters } = searchCriteria
    let count = 0
    if (location) count++
    if (spotType && spotType !== "all") count++
    if (priceMin !== undefined) count++
    if (priceMax !== undefined) count++
    if (isInside !== undefined) count++
    if (isBciManaged !== undefined) count++
    if (date) count++
    if (query && query.trim()) count++
    return count + (quickFilters?.length || 0)
  }

  const getResultsLabel = () => {
    const filterCount = getActiveFilterCount()
    const { date, query } = searchCriteria
    
    if (filterCount === 0) {
      return `Available Spots (${sortedSpots.length})`
    }
    
    let label = `Search Results (${sortedSpots.length})`
    
    if (date) {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      if (date === today) {
        label = `Spots Available Today (${sortedSpots.length})`
      } else if (date === tomorrow) {
        label = `Spots Available Tomorrow (${sortedSpots.length})`
      } else {
        const displayDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        label = `Spots Available ${displayDate} (${sortedSpots.length})`
      }
    } else if (query && query.trim()) {
      label = `Search Results for "${query.trim()}" (${sortedSpots.length})`
    }
    
    return label
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-search">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Smart Parking Search
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Find parking spots instantly with intelligent search at BCI Victoria.
          </p>
        </div>
      </div>

      <EnhancedSearch onSearch={handleSearch} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <TabsList className="hidden md:grid w-full md:w-[200px] grid-cols-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger 
                    value="tiles" 
                    className="flex items-center gap-2 data-[state=active]:!bg-blue-500 data-[state=active]:!text-white data-[state=active]:!shadow-none" 
                    data-testid="tab-tiles"
                  >
                    <Grid className="h-4 w-4" />
                    Tiles
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Grid view - Browse parking spots as individual cards with detailed information</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger 
                    value="calendar" 
                    className="flex items-center gap-2 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:!shadow-none" 
                    data-testid="tab-calendar"
                  >
                    <Calendar className="h-4 w-4" />
                    Calendar
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calendar view - See spot availability across dates and plan your bookings</p>
                </TooltipContent>
              </Tooltip>
            </TabsList>
            
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-semibold">
                {getResultsLabel()}
              </h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetch()}
                    disabled={isLoading || isFetching}
                    className="h-8 w-8"
                    data-testid="button-refresh-availability"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh available spots</p>
                </TooltipContent>
              </Tooltip>
              {getActiveFilterCount() > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 hover:bg-transparent"
                      data-testid="badge-active-filters"
                    >
                      <Badge variant="secondary" className="gap-1">
                        <Filter className="h-3 w-3" />
                        {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of active search filters - clear search to remove all filters and see all available spots</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          
          {activeTab === "tiles" && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm text-muted-foreground hidden md:inline">Sort by:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 md:flex-initial px-3 py-2 md:py-1 border rounded-md text-sm cursor-pointer min-h-11 md:min-h-0"
                    data-testid="select-sort"
                  >
                    <option value="price">Price (Low to High)</option>
                    <option value="date">Date (Earliest First)</option>
                  </select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sort parking spots by price (cheapest first) or by earliest availability date</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden md:flex" data-testid="button-sort-direction">
                    <SortAsc className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sort direction indicator - currently showing ascending order (low to high)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <TabsContent value="tiles" className="space-y-4">
          {sortedSpots.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No spots found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search filters to find more available parking spots.
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setSearchCriteria({
                      query: "",
                      quickFilters: []
                    })} data-testid="button-clear-search-results">
                      Clear Search
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove all search filters and see all available parking spots</p>
                  </TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedSpots.map((spot) => (
                <ParkingSpotCard 
                  key={`${spot.id}-${spot.availability?.date || 'no-date'}`}
                  spot={spot}
                  onBook={handleBookSpot}
                  onViewDetails={(spotId) => console.log('View details:', spotId)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="hidden md:block space-y-4">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <ParkingCalendar
                spots={spotsForCalendar}
                onBookSpot={handleBookSpot}
                selectedDate={searchCriteria.date ? new Date(searchCriteria.date) : new Date()}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog 
        open={showBookingForm} 
        onOpenChange={(open) => {
          setShowBookingForm(open);
          // Release lock when dialog closes
          if (!open && userActiveLock) {
            const lockIdToRelease = userActiveLock.lockId;
            // Clear lock immediately to prevent race condition
            clearUserLock();
            // Then release on backend
            releaseLock(lockIdToRelease);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <BookingForm
              spot={selectedSpot}
              onSubmit={(bookingData) => handleBookingFormSubmit(selectedSpot, bookingData)}
              onCancel={() => setShowBookingForm(false)}
              selectedDate={userActiveLock?.bookingDate || selectedSpot.availability?.date || searchCriteria.date}
              isDateLocked={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}