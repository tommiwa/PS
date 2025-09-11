import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Car, Zap, Accessibility, Calendar, DollarSign } from "lucide-react"

export interface ParkingSpot {
  id: string
  spotNumber: string
  location: string
  type: "regular" | "accessible" | "electric"
  isInside: boolean
  price: number
  availability: {
    date: string
    startTime: string
    endTime: string
  }
  owner: string
  isAvailable: boolean
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
      case "accessible":
        return <Accessibility className="h-4 w-4" />
      default:
        return <Car className="h-4 w-4" />
    }
  }

  const getSpotTypeBadge = () => {
    const variants = {
      regular: "secondary" as const,
      accessible: "default" as const,
      electric: "default" as const
    }
    
    return (
      <Badge variant={variants[spot.type]} className="gap-1">
        {getSpotTypeIcon()}
        {spot.type === "electric" ? "EV Charging" : 
         spot.type === "accessible" ? "Accessible" : "Regular"}
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
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            {spot.availability.date}
          </div>
          <div className="text-sm text-muted-foreground">
            {spot.availability.startTime} - {spot.availability.endTime}
          </div>
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
            disabled={!spot.isAvailable}
            className="flex-1"
            data-testid={`button-book-${spot.id}`}
          >
            {spot.isAvailable ? "Book" : "Unavailable"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}