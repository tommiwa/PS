import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MapPin, Car, Zap, Accessibility, Building, User, Clock } from "lucide-react"
import type { ParkingSpot, ParkingSpotWithUser } from "@shared/schema"
import { useAuth } from "@/contexts/auth-context"

// Extend spot types to include activeLock from API enrichment
type SpotWithLock = (ParkingSpot | ParkingSpotWithUser) & {
  activeLock?: {
    lockId: string
    expiresAt: string
    remainingSeconds: number
    userId?: string
  } | null
}

interface ParkingSpotCardProps {
  spot: SpotWithLock
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
  const { user } = useAuth();
  
  // Type guard to check if spot has enriched user data
  const hasUserData = (spot: SpotWithLock): spot is ParkingSpotWithUser => {
    return 'assignedUserName' in spot;
  };

  // Check if spot is locked (and by another user)
  const activeLock = spot.activeLock;
  const isLockedByMe = activeLock && activeLock.userId === user?.id;
  // If activeLock exists but is not locked by me, it's locked by someone else
  // (backend omits userId for privacy when locked by others)
  const isLockedByOther = Boolean(activeLock && !isLockedByMe);

  // Map spot type name to icon
  const getSpotTypeIcon = (spotTypeName?: string) => {
    if (!spotTypeName) return <Car className="h-4 w-4" />
    
    const lowerType = spotTypeName.toLowerCase();
    if (lowerType.includes('electric') || lowerType.includes('ev')) {
      return <Zap className="h-4 w-4" />
    }
    if (lowerType.includes('tesla')) {
      return <Zap className="h-4 w-4 text-red-600" />
    }
    if (lowerType.includes('accessible')) {
      return <Accessibility className="h-4 w-4" />
    }
    if (lowerType.includes('reserved')) {
      return <Building className="h-4 w-4" />
    }
    return <Car className="h-4 w-4" />
  }

  const getSpotTypeBadge = () => {
    const spotTypeName = hasUserData(spot) ? spot.spotTypeName : undefined;
    const displayName = spotTypeName || "Regular";
    
    // Determine variant based on type name
    let variant: "default" | "secondary" = "secondary";
    if (spotTypeName) {
      const lowerType = spotTypeName.toLowerCase();
      if (lowerType.includes('electric') || lowerType.includes('tesla') || lowerType.includes('accessible')) {
        variant = "default";
      }
    }
    
    // Determine tooltip text
    let tooltipText = "Standard parking spot - suitable for all vehicle types";
    if (spotTypeName) {
      const lowerType = spotTypeName.toLowerCase();
      if (lowerType.includes('accessible')) {
        tooltipText = "Accessible parking spot - designed for vehicles with mobility accommodations";
      } else if (lowerType.includes('tesla')) {
        tooltipText = "Tesla charging station - optimized for Tesla vehicles with Tesla connector";
      } else if (lowerType.includes('electric') || lowerType.includes('ev')) {
        tooltipText = "Electric vehicle charging station - includes standard EV connector";
      } else if (lowerType.includes('reserved')) {
        tooltipText = "Reserved parking spot - restricted access for specific users or purposes";
      }
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto p-0 hover:bg-transparent"
            data-testid={`badge-spot-type-${spotTypeName || 'regular'}-${spot.id}`}
          >
            <Badge variant={variant} className="gap-1">
              {getSpotTypeIcon(spotTypeName)}
              {displayName}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
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

  const locationName = hasUserData(spot) ? spot.locationName : undefined;

  return (
    <Card 
      className={`hover-elevate ${!spot.isActive ? 'opacity-60' : ''} ${
        isLockedByOther ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' : ''
      }`}
      data-testid={`card-parking-spot-${spot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg font-semibold">
              Spot {spot.spotNumber}
            </CardTitle>
            {isLockedByOther && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-600">
                <Clock className="h-3 w-3 mr-1" />
                PENDING
              </Badge>
            )}
          </div>
          {getSpotTypeBadge()}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 justify-start text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground break-words"
              data-testid={`text-location-${spot.id}`}
            >
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span className="break-words">
                {locationName || `Location ID: ${spot.locationId}`} {spot.isIndoor && "(Indoor)"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Location: {locationName || `Location ID: ${spot.locationId}`}{spot.isIndoor ? " - Indoor parking (covered and protected from weather)" : " - Outdoor parking"}</p>
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
                <User className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium break-words" data-testid={`text-assigned-user-${spot.id}`}>
                    {hasUserData(spot) && spot.assignedUserName 
                      ? spot.assignedUserName 
                      : spot.ownerId 
                        ? "Assigned User" 
                        : "Unassigned"}
                  </div>
                  {hasUserData(spot) && spot.assignedUserDepartment && (
                    <div className="text-xs text-muted-foreground break-words">
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
        <CardFooter className="pt-0 flex-col md:flex-row gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewDetails}
                className="w-full md:w-auto md:flex-1 min-h-11"
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
                disabled={spot.isActive === false || spot.isBookable === false || spot.isBookable === null || isLockedByOther}
                className="w-full md:w-auto md:flex-1 min-h-11"
                data-testid={`button-book-${spot.id}`}
              >
                {isLockedByOther ? "Pending" :
                 spot.isBookable === false ? "Not Bookable" : 
                 (spot.isActive !== false) ? "Book" : "Unavailable"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isLockedByOther
                ? "This spot is currently being booked by another user. Please try again in a moment."
                : spot.isBookable === false 
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
