import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MapPin, Car, Zap, Accessibility, Building, User, Clock, Calendar, ExternalLink } from "lucide-react"
import type { ParkingSpot, ParkingSpotWithUser } from "@shared/schema"
import { useAuth } from "@/contexts/auth-context"
import { useLock } from "@/contexts/LockContext"
import { formatDateFromDB } from "@/lib/date-utils"

// Extend spot types to include activeLock and availability from API enrichment
type SpotWithLock = (ParkingSpot | ParkingSpotWithUser) & {
  activeLock?: {
    lockId: string
    expiresAt: string
    remainingSeconds: number
    userId?: string
  } | null
  availability?: {
    date: string
  }
  listingId?: string
  dailyRate?: number
  price?: number
  assignedUserName?: string
  locationName?: string
  spotTypeName?: string
  dateToPrice?: Record<string, { listingId: string; dailyRate: number }>
  floorPlanBaseUrl?: string | null
}

interface ParkingSpotCardProps {
  spot: SpotWithLock
  onBook?: (spotId: string, bookingData?: any) => void
  onViewDetails?: (spotId: string) => void
  showBookButton?: boolean
}

export function ParkingSpotCard({ 
  spot, 
  onBook, 
  showBookButton = true 
}: ParkingSpotCardProps) {
  const { user } = useAuth();
  const { lockedListings, userActiveLock } = useLock();

  // Check if spot is locked (and by another user) using composite key if date is available
  let isLockedByOther = false;
  
  if (spot.listingId && spot.availability?.date) {
    // Use composite key to check date-specific lock
    const compositeKey = `${spot.listingId}|${spot.availability.date}`;
    const lock = lockedListings.get(compositeKey);
    
    if (lock) {
      // Check if it's the current user's lock by comparing lockId
      const isMyLock = userActiveLock?.lockId === lock.lockId;
      isLockedByOther = !isMyLock;
    }
  } else {
    // Fallback to old method if no date available (backward compatibility)
    const activeLock = spot.activeLock;
    if (activeLock) {
      const isMyLock = userActiveLock?.lockId === activeLock.lockId;
      isLockedByOther = !isMyLock;
    }
  }

  // Get spot type color classes - matching calendar colors for consistency
  const getSpotTypeColors = (spotTypeName?: string): { badge: string; iconColor: string } => {
    if (!spotTypeName) {
      return { 
        badge: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600", 
        iconColor: "text-gray-600 dark:text-gray-400" 
      };
    }
    
    const lowerType = spotTypeName.toLowerCase();
    
    if (lowerType.includes('tesla')) {
      return { 
        badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700", 
        iconColor: "text-red-600 dark:text-red-400" 
      };
    }
    if (lowerType.includes('electric') || lowerType.includes('ev')) {
      return { 
        badge: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700", 
        iconColor: "text-green-600 dark:text-green-400" 
      };
    }
    if (lowerType.includes('accessible')) {
      return { 
        badge: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700", 
        iconColor: "text-purple-600 dark:text-purple-400" 
      };
    }
    if (lowerType.includes('reserved')) {
      return { 
        badge: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700", 
        iconColor: "text-orange-600 dark:text-orange-400" 
      };
    }
    
    // Regular spots - gray
    return { 
      badge: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600", 
      iconColor: "text-gray-600 dark:text-gray-400" 
    };
  }

  // Map spot type name to icon with color
  const getSpotTypeIcon = (spotTypeName?: string) => {
    const { iconColor } = getSpotTypeColors(spotTypeName);
    
    if (!spotTypeName) return <Car className={`h-4 w-4 ${iconColor}`} />
    
    const lowerType = spotTypeName.toLowerCase();
    if (lowerType.includes('tesla')) {
      return <Zap className={`h-4 w-4 ${iconColor}`} />
    }
    if (lowerType.includes('electric') || lowerType.includes('ev')) {
      return <Zap className={`h-4 w-4 ${iconColor}`} />
    }
    if (lowerType.includes('accessible')) {
      return <Accessibility className={`h-4 w-4 ${iconColor}`} />
    }
    if (lowerType.includes('reserved')) {
      return <Building className={`h-4 w-4 ${iconColor}`} />
    }
    return <Car className={`h-4 w-4 ${iconColor}`} />
  }

  const getSpotTypeBadge = () => {
    const spotTypeName = spot.spotTypeName;
    const displayName = spotTypeName || "Regular";
    const { badge: badgeColors } = getSpotTypeColors(spotTypeName);
    
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
          <div data-testid={`badge-spot-type-${spotTypeName || 'regular'}-${spot.id}`}>
            <Badge variant="outline" className={`gap-1 ${badgeColors}`}>
              {getSpotTypeIcon(spotTypeName)}
              {displayName}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const handleBook = () => {
    console.log(`Booking spot ${spot.id} for date ${spot.availability?.date}`)
    // Pass only spot ID to trigger lock acquisition flow (not immediate booking)
    onBook?.(spot.id)
  }

  const locationName = spot.locationName;
  
  // Get date-specific price if available - ensure we always return a number
  const getDisplayPrice = (): number => {
    let price: any;
    
    // If we have a specific date and dateToPrice mapping, use that
    if (spot.availability?.date && spot.dateToPrice?.[spot.availability.date]) {
      price = spot.dateToPrice[spot.availability.date].dailyRate;
    } else {
      // Fall back to dailyRate or price
      price = spot.dailyRate || spot.price;
    }
    
    // Convert to number regardless of type
    if (typeof price === 'string') {
      return parseFloat(price) || 0;
    }
    if (typeof price === 'number') {
      return price;
    }
    return 0;
  };
  
  const displayPrice = getDisplayPrice();

  return (
    <Card 
      className={`relative overflow-hidden hover-elevate transition-all ${
        !spot.isActive ? 'opacity-60' : ''
      } ${
        isLockedByOther ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' : ''
      }`}
      data-testid={`card-parking-spot-${spot.id}`}
    >
      {/* Header Section with Spot Number and Type */}
      <div className="p-4 pb-3 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-bold text-foreground">
                Spot {spot.spotNumber}
              </h3>
              {isLockedByOther && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-600">
                  <Clock className="h-3 w-3 mr-1" />
                  PENDING
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate" data-testid={`text-location-${spot.id}`}>
                {locationName || `Location ID: ${spot.locationId}`}
                {spot.isIndoor && " • Indoor"}
              </span>
              {spot.floorPlanBaseUrl && spot.seatNumber && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`${spot.floorPlanBaseUrl}${spot.seatNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
                      data-testid={`link-floor-plan-${spot.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View on floor plan</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {getSpotTypeBadge()}
        </div>
      </div>

      {/* Price and Date Section */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Daily Rate</div>
            <div className="text-3xl font-bold text-primary" data-testid={`text-price-${spot.id}`}>
              ${displayPrice.toFixed(2)}
            </div>
          </div>
          {spot.availability?.date && (
            <div className="text-right px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
              <div className="text-xs text-muted-foreground mb-0.5">Available</div>
              <div className="flex items-center justify-end gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-base font-bold text-foreground" data-testid={`text-date-${spot.id}`}>
                  {formatDateFromDB(spot.availability.date)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Owner Section */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
          <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Owned By</div>
            <div className="text-sm font-medium truncate" data-testid={`text-assigned-user-${spot.id}`}>
              {spot.assignedUserName || "BCI Managed"}
            </div>
          </div>
        </div>
      </div>

      {/* Book Button */}
      {showBookButton && (
        <div className="p-4 pt-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="default"
                onClick={handleBook}
                disabled={spot.isActive === false || spot.isBookable === false || spot.isBookable === null || isLockedByOther}
                className="w-full"
                data-testid={`button-book-${spot.id}`}
              >
                {isLockedByOther ? "Currently Pending" :
                 spot.isBookable === false ? "Not Available" : 
                 (spot.isActive !== false) ? "Book This Spot" : "Unavailable"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isLockedByOther
                ? "This spot is currently being booked by another user. Please try again in a moment."
                : spot.isBookable === false 
                ? "This spot is currently not available for booking" 
                : (spot.isActive !== false) 
                  ? "Click to book this parking spot" 
                  : "This spot is currently unavailable or inactive"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </Card>
  )
}
