import { useState } from "react"
import { SearchFilters, SearchFilters as SearchFiltersType } from "@/components/search-filters"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { BookingForm } from "@/components/booking-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Filter, SortAsc } from "lucide-react"

export default function Search() {
  const [filters, setFilters] = useState<SearchFiltersType>({
    location: "",
    spotType: "",
    date: "",
    priceMin: "",
    priceMax: "",
    isInside: ""
  })
  
  const [selectedSpot, setSelectedSpot] = useState<any>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [sortBy, setSortBy] = useState("price")

  //todo: remove mock functionality
  const mockSpots = [
    {
      id: "P-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      type: "electric" as const,
      isInside: true,
      price: 25,
      availability: {
        date: "2024-01-15",
        startTime: "8:00 AM",
        endTime: "6:00 PM"
      },
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
      availability: {
        date: "2024-01-15",
        startTime: "7:00 AM",
        endTime: "7:00 PM"
      },
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
      availability: {
        date: "2024-01-15",
        startTime: "8:00 AM",
        endTime: "5:00 PM"
      },
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
        date: "2024-01-15",
        startTime: "9:00 AM",
        endTime: "6:00 PM"
      },
      owner: "David Park",
      isAvailable: false
    }
  ]

  const filteredSpots = mockSpots.filter(spot => {
    if (filters.location && !spot.location.toLowerCase().includes(filters.location.toLowerCase())) return false
    if (filters.spotType && spot.type !== filters.spotType) return false
    if (filters.priceMin && spot.price < parseInt(filters.priceMin)) return false
    if (filters.priceMax && spot.price > parseInt(filters.priceMax)) return false
    if (filters.isInside && spot.isInside !== (filters.isInside === "true")) return false
    return true
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

  const handleSearch = () => {
    console.log('Search triggered with filters:', filters)
    // In real app, this would trigger API call
  }

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== "").length
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-search">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Find Parking</h1>
          <p className="text-muted-foreground">
            Search for available parking spots across all BCI locations.
          </p>
        </div>
      </div>

      <SearchFilters 
        onFilterChange={setFilters}
        onSearch={handleSearch}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            Available Spots ({sortedSpots.length})
          </h2>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3 w-3" />
              {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
            </Badge>
          )}
        </div>
        
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
      </div>

      {sortedSpots.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No spots found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search filters to find more available parking spots.
            </p>
            <Button onClick={() => setFilters({
              location: "",
              spotType: "",
              date: "",
              priceMin: "",
              priceMax: "",
              isInside: ""
            })}>
              Clear All Filters
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