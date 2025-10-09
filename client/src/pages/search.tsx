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
import { MapPin, Filter, SortAsc, Calendar, Grid, Sparkles } from "lucide-react"
import { isPastDate } from "@/utils/date-utils"
import { apiRequest } from "@/lib/queryClient"
import { type ParkingSpot as DBParkingSpot, type SpotTypeTable } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"

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
}

export default function Search() {
  const [searchCriteria, setSearchCriteria] = useState<ParsedSearch>({
    query: "",
    quickFilters: []
  })
  
  const [selectedSpot, setSelectedSpot] = useState<DisplaySpot | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [sortBy, setSortBy] = useState("price")
  const [activeTab, setActiveTab] = useState<string>("calendar")
  const { toast } = useToast()
  
  // Set default tab based on screen size after mount: mobile shows tiles, desktop shows calendar
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    setActiveTab(isMobile ? "tiles" : "calendar")
  }, [])

  // Fetch available parking spots from API
  const { data: dbSpots = [], isLoading, error } = useQuery<DBParkingSpot[]>({
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
      'ev-chargers': 'electric',
      'tesla-chargers': 'tesla_ev',
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

  const spots: DisplaySpot[] = dbSpots.map(spot => ({
    ...spot,
    spotNumber: spot.spotNumber,
    location: formatLocation(spot.locationId),
    type: mapSpotType(spot.spotTypeId),
    isInside: spot.isIndoor,
    price: 25, // Default price since MemStorage doesn't have spot pricing
    owner: getSpotOwner(spot.ownerId),
    isAvailable: spot.isActive,
    isBookable: spot.isBookable
  }))

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      return apiRequest('/api/bookings', { method: 'POST', body: bookingData })
    },
    onSuccess: () => {
      toast({
        title: "Booking Created",
        description: "Your parking spot has been successfully booked!"
      })
      setShowBookingForm(false)
      setSelectedSpot(null)
      
      // CRITICAL: Invalidate queries so My Bookings page shows the new booking
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive"
      })
    }
  })

  // Handle booking form submission
  const handleBookSpot = (spotId: string, bookingData?: any) => {
    const spot = spots.find(s => s.id === spotId)
    if (spot) {
      if (bookingData) {
        // Booking data provided from calendar - submit immediately
        handleBookingFormSubmit(spot, bookingData)
      } else {
        // No booking data - show booking form
        setSelectedSpot(spot)
        setShowBookingForm(true)
      }
    }
  }

  // Handle actual booking submission from form
  const handleBookingFormSubmit = (spot: DisplaySpot, bookingData: any) => {
    // Get listing ID and daily rate from spot data (enriched by API)
    const listingId = (spot as any).listingId
    const dailyRate = (spot as any).dailyRate || spot.price
    
    if (!listingId) {
      toast({
        title: "Booking Error",
        description: "This spot does not have an active listing. Please try another spot.",
        variant: "destructive"
      })
      return
    }
    
    createBookingMutation.mutate({
      spotId: spot.id,
      listingId: listingId,
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
    const { location, spotType, priceMin, priceMax, isInside, query } = searchCriteria
    
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
      // Spot is generally available, but if searching for a specific date and spot has availability constraints, check them
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
      }
      // If no specific availability constraint, spot is available for the search date
      return true
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

  const sortedSpots = [...filteredSpots].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return a.price - b.price
      case "location":
        return a.location.localeCompare(b.location)
      case "distance":
        return a.isInside === b.isInside ? 0 : a.isInside ? -1 : 1
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
    const { location, spotType, priceMin, priceMax, isInside, date, query, quickFilters } = searchCriteria
    let count = 0
    if (location) count++
    if (spotType && spotType !== "all") count++
    if (priceMin !== undefined) count++
    if (priceMax !== undefined) count++
    if (isInside !== undefined) count++
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
            Find parking spots instantly with intelligent search across all BCI locations.
          </p>
        </div>
      </div>

      <EnhancedSearch onSearch={handleSearch} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <TabsList className="grid w-full md:w-[200px] grid-cols-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="tiles" className="flex items-center gap-2" data-testid="tab-tiles">
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
                  <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
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
                    <option value="location">Location</option>
                    <option value="distance">Distance</option>
                  </select>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sort parking spots by price (cheapest first), location (alphabetical), or distance (indoor spots first)</p>
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
                  key={spot.id} 
                  spot={spot}
                  onBook={handleBookSpot}
                  onViewDetails={(spotId) => console.log('View details:', spotId)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <ParkingCalendar
                spots={searchCriteria.date ? filteredSpots : baseFilteredSpots}
                onBookSpot={handleBookSpot}
                selectedDate={searchCriteria.date ? new Date(searchCriteria.date) : new Date()}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <BookingForm
              spot={selectedSpot}
              onSubmit={handleBookingSubmit}
              onCancel={() => setShowBookingForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}