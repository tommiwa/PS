import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MapPin, Car, Zap, Accessibility, Calendar, DollarSign, Building, Ban, User } from "lucide-react"
import type { ParkingSpot, ParkingSpotWithUser } from "@shared/schema"

interface ParkingSpotCardProps {
  spot: ParkingSpot | ParkingSpotWithUser
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
  // Type guard to check if spot has enriched user data
  const hasUserData = (spot: ParkingSpot | ParkingSpotWithUser): spot is ParkingSpotWithUser => {
    return 'assignedUserName' in spot;
  };

  const getSpotTypeIcon = () => {
    switch (spot.spotType) {
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
    const spotType = spot.spotType;
    const variants = {
      regular: "secondary" as const,
      accessible: "default" as const,
      electric: "default" as const,
      tesla_ev: "default" as const,
      reserved: "secondary" as const
    }
    
    const labels = {
      regular: "Regular",
      accessible: "Accessible", 
      electric: "EV Charger",
      tesla_ev: "Tesla Charger",
      reserved: "Reserved"
    }

    const tooltips = {
      regular: "Standard parking spot - suitable for all vehicle types",
      accessible: "Accessible parking spot - designed for vehicles with mobility accommodations",
      electric: "Electric vehicle charging station - includes standard EV connector",
      tesla_ev: "Tesla charging station - optimized for Tesla vehicles with Tesla connector",
      reserved: "Reserved parking spot - restricted access for specific users or purposes"
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 hover:bg-transparent"
            data-testid={`badge-spot-type-${spotType}-${spot.id}`}
          >
            <Badge variant={variants[spotType]} className="gap-1">
              {getSpotTypeIcon()}
              {labels[spotType]}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltips[spotType]}</p>
        </TooltipContent>
      </Tooltip>
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
      className={`hover-elevate ${!spot.isActive ? 'opacity-60' : ''}`}
      data-testid={`card-parking-spot-${spot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">
            Spot {spot.spotNumber}
          </CardTitle>
          {getSpotTypeBadge()}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 justify-start text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              data-testid={`text-location-${spot.id}`}
            >
              <MapPin className="h-4 w-4 mr-1" />
              {spot.location} {spot.isIndoor && "(Indoor)"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Location: {spot.location}{spot.isIndoor ? " - Indoor parking (covered and protected from weather)" : " - Outdoor parking"}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      
      <CardContent className="pt-0 pb-4">
        <div className="space-y-3">
          {/* Prominent Assigned User Display */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-2 w-full justify-start bg-muted/50 rounded-md hover:bg-muted/70"
                data-testid={`container-assigned-user-${spot.id}`}
              >
                <User className="h-4 w-4 text-muted-foreground mr-2" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium" data-testid={`text-assigned-user-${spot.id}`}>
                    {hasUserData(spot) && spot.assignedUserName 
                      ? spot.assignedUserName 
                      : spot.ownerId 
                        ? "Assigned User" 
                        : "Unassigned"}
                  </div>
                  {hasUserData(spot) && spot.assignedUserDepartment && (
                    <div className="text-xs text-muted-foreground">
                      {spot.assignedUserDepartment}
                    </div>
                  )}
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{hasUserData(spot) && spot.assignedUserName 
                ? `This spot is primarily assigned to ${spot.assignedUserName}${spot.assignedUserDepartment ? ` from ${spot.assignedUserDepartment}` : ''} but may be available when not in use` 
                : spot.ownerId 
                  ? "This spot has an assigned primary user but may be available for booking when not in use" 
                  : "This spot is currently unassigned and available for booking"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Availability information would come from spot listings table in real implementation */}
          {/* Pricing information would come from spot listings table in real implementation */}
        </div>
      </CardContent>
      
      {showBookButton && (
        <CardFooter className="pt-0 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewDetails}
                className="flex-1"
                data-testid={`button-view-details-${spot.id}`}
              >
                Details
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View detailed information about this parking spot including amenities, photos, and exact location</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                onClick={handleBook}
                disabled={!(spot.isActive !== false) || spot.isBookable === false}
                className="flex-1"
                data-testid={`button-book-${spot.id}`}
              >
                {spot.isBookable === false ? "Not Bookable" : 
                 (spot.isActive !== false) ? "Book" : "Unavailable"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{spot.isBookable === false 
                ? "This spot is currently not available for booking" 
                : (spot.isActive !== false) 
                  ? "Click to book this parking spot - you'll be guided through the reservation process" 
                  : "This spot is currently unavailable or inactive"}</p>
            </TooltipContent>
          </Tooltip>
        </CardFooter>
      )}
    </Card>
  )
}