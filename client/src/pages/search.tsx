import { useState } from "react"
import { EnhancedSearch, ParsedSearch } from "@/components/enhanced-search"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { ParkingCalendar } from "@/components/parking-calendar"
import { BookingForm } from "@/components/booking-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Filter, SortAsc, Calendar, Grid, Sparkles } from "lucide-react"

export default function Search() {
  const [searchCriteria, setSearchCriteria] = useState<ParsedSearch>({
    query: "",
    quickFilters: []
  })
  
  const [selectedSpot, setSelectedSpot] = useState<any>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [sortBy, setSortBy] = useState("price")
  const [activeTab, setActiveTab] = useState("tiles")

  //todo: remove mock functionality
  const mockSpots = [
    {
      id: "P-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      type: "electric" as const,
      isInside: true,
      price: 25,
      // Available spots don't have specific dates - they're available every day
      owner: "Sarah Chen",
      isAvailable: true
    },
    {
      id: "P-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      type: "regular" as const,
      isInside: false,
      price: 20,
      // Available spots don't have specific dates - they're available every day
      owner: "Mike Johnson",
      isAvailable: true
    },
    {
      id: "P-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      type: "accessible" as const,
      isInside: false,
      price: 15,
      // Available spots don't have specific dates - they're available every day
      owner: "Lisa Anderson",
      isAvailable: true
    },
    {
      id: "P-004",
      spotNumber: "A-22",
      location: "Main Building - Level 1",
      type: "regular" as const,
      isInside: true,
      price: 30,
      availability: {
        date: new Date().toISOString().split('T')[0], // Today's date for booked spot
        startTime: "9:00 AM",
        endTime: "6:00 PM"
      },
      owner: "David Park",
      isAvailable: false
    }
  ]

  // Base filtering without date constraints (for calendar view)
  const baseFilteredSpots = mockSpots.filter(spot => {
    const { location, spotType, priceMin, priceMax, isInside, query } = searchCriteria
    
    // Basic availability filtering - only show generally available spots for calendar
    if (!spot.isAvailable) {
      return false // Don't show unavailable spots in calendar view
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
    
    // Availability filtering with date constraints for tiles view
    if (spot.isAvailable) {
      // Spot is generally available, but if searching for a specific date and spot has availability constraints, check them
      if (spot.availability?.date) {
        const spotDate = new Date(spot.availability.date).toISOString().split('T')[0]
        const searchDate = date
        if (spotDate !== searchDate) {
          return false
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

  const handleBookSpot = (spotId: string) => {
    const spot = mockSpots.find(s => s.id === spotId)
    if (spot) {
      setSelectedSpot(spot)
      setShowBookingForm(true)
    }
  }

  const handleBookingSubmit = (bookingData: any) => {
    console.log('Booking submitted:', bookingData)
    setShowBookingForm(false)
    setSelectedSpot(null)
    // Show success message, redirect, etc.
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
    <div className="p-6 space-y-6" data-testid="page-search">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Smart Parking Search
          </h1>
          <p className="text-muted-foreground">
            Find parking spots instantly with intelligent search across all BCI locations.
          </p>
        </div>
      </div>

      <EnhancedSearch onSearch={handleSearch} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <TabsList className="grid w-[200px] grid-cols-2">
              <TabsTrigger value="tiles" className="flex items-center gap-2" data-testid="tab-tiles">
                <Grid className="h-4 w-4" />
                Tiles
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                {getResultsLabel()}
              </h2>
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3 w-3" />
                  {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                </Badge>
              )}
            </div>
          </div>
          
          {activeTab === "tiles" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
                data-testid="select-sort"
              >
                <option value="price">Price (Low to High)</option>
                <option value="location">Location</option>
                <option value="distance">Distance</option>
              </select>
              <Button variant="ghost" size="sm">
                <SortAsc className="h-4 w-4" />
              </Button>
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
                <Button onClick={() => setSearchCriteria({
                  query: "",
                  quickFilters: []
                })}>
                  Clear Search
                </Button>
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
                spots={baseFilteredSpots}
                onBookSpot={handleBookSpot}
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