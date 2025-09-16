import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Car, Zap, Accessibility, Calendar, DollarSign, Building, Ban } from "lucide-react"

export interface ParkingSpot {
  id: string
  spotNumber: string
  location: string
  type: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved"
  isInside: boolean
  price: number
  availability?: {
    date: string
  }
  owner: string
  isAvailable: boolean
  isBookable?: boolean // Whether the spot can be booked (false for reserved)
}

interface ParkingSpotCardProps {
  spot: ParkingSpot
  onBook?: (spotId: string) => void
  onViewDetails?: (spotId: string) => void
  showBookButton?: boolean
}

export function ParkingSpotCard({ 
  spot, 
  onBook, 
  onViewDetails,
  showBookButton = true 
}: ParkingSpotCardProps) {
  const getSpotTypeIcon = () => {
    switch (spot.type) {
      case "electric":
        return <Zap className="h-4 w-4" />
      case "tesla_ev":
        return <Zap className="h-4 w-4 text-red-600" />
      case "accessible":
        return <Accessibility className="h-4 w-4" />
      case "reserved":
        return <Building className="h-4 w-4" />
      default:
        return <Car className="h-4 w-4" />
    }
  }

  const getSpotTypeBadge = () => {
    const variants = {
      regular: "secondary" as const,
      accessible: "default" as const,
      electric: "default" as const,
      tesla_ev: "default" as const,
      reserved: "outline" as const
    }
    
    const labels = {
      regular: "Regular",
      accessible: "Accessible", 
      electric: "EV Charger",
      tesla_ev: "Tesla EV Charger",
      reserved: "Reserved"
    }
    
    return (
      <Badge variant={variants[spot.type]} className="gap-1">
        {getSpotTypeIcon()}
        {labels[spot.type]}
      </Badge>
    )
  }

  const handleBook = () => {
    console.log(`Booking spot ${spot.id}`)
    onBook?.(spot.id)
  }

  const handleViewDetails = () => {
    console.log(`Viewing details for spot ${spot.id}`)
    onViewDetails?.(spot.id)
  }

  return (
    <Card 
      className={`hover-elevate ${!spot.isAvailable ? 'opacity-60' : ''}`}
      data-testid={`card-parking-spot-${spot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">
            Spot {spot.spotNumber}
          </CardTitle>
          {getSpotTypeBadge()}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {spot.location} {spot.isInside && "(Inside)"}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-4">
        <div className="space-y-2">
          {spot.availability?.date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              {spot.availability.date} - Full Day
            </div>
          )}
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            ${spot.price}/day
          </div>
          <div className="text-xs text-muted-foreground">
            Owner: {spot.owner}
          </div>
        </div>
      </CardContent>
      
      {showBookButton && (
        <CardFooter className="pt-0 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleViewDetails}
            className="flex-1"
            data-testid={`button-view-details-${spot.id}`}
          >
            Details
          </Button>
          <Button 
            size="sm" 
            onClick={handleBook}
            disabled={!spot.isAvailable || spot.isBookable === false}
            className="flex-1"
            data-testid={`button-book-${spot.id}`}
          >
            {spot.isBookable === false ? "Not Bookable" : 
             spot.isAvailable ? "Book" : "Unavailable"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}