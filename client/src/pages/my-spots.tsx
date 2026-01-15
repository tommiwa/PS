import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { ParkingSpot as DBParkingSpot, InsertParkingSpot, InsertSpotListing, Location, SpotTypeTable, PaymentPreferences } from "@shared/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Car, MapPin, DollarSign, Clock, Edit, Plus, Eye, Users, TrendingUp, Grid, Trash2, Info, CreditCard, Loader2, ExternalLink, Map } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete'
import '@geoapify/geocoder-autocomplete/styles/minimal.css'

// Use the database type directly since we're fetching real data now
// type ParkingSpot = DBParkingSpot

export default function MySpots() {
  const [showAddSpot, setShowAddSpot] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<DBParkingSpot | null>(null)
  const [showEditSpot, setShowEditSpot] = useState(false)
  const [showCreateListingDialog, setShowCreateListingDialog] = useState(false)
  const [selectedSpotForListing, setSelectedSpotForListing] = useState<DBParkingSpot | null>(null)
  const { confirm } = useConfirm()
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Removed activeTab state as calendar functionality moved to MyBookings
  const [newSpotData, setNewSpotData] = useState({
    spotNumber: "",
    locationId: undefined as number | undefined,
    spotTypeId: undefined as number | undefined,
    isIndoor: false,
    description: ""
  })

  // Custom location state
  const [isCreatingCustomLocation, setIsCreatingCustomLocation] = useState(false)
  const [customLocationData, setCustomLocationData] = useState({
    office: "",
    building: "",
    level: "",
    address: ""
  })

  // Geoapify autocomplete ref and API key
  const autocompleteContainerRef = useRef<HTMLDivElement>(null)
  const autocompleteInstanceRef = useRef<any>(null)

  // Fetch Geoapify API key from backend
  const { data: geoapifyConfig } = useQuery<{ apiKey: string }>({
    queryKey: ['/api/config/geoapify-key'],
  })

  // Initialize Geoapify autocomplete when custom location is shown and API key is available
  useEffect(() => {
    if (isCreatingCustomLocation && autocompleteContainerRef.current && geoapifyConfig?.apiKey) {
      // Clean up existing instance if any
      if (autocompleteInstanceRef.current) {
        autocompleteInstanceRef.current = null
      }

      // Clear the container
      autocompleteContainerRef.current.innerHTML = ''

      try {
        // Initialize Geoapify autocomplete
        const autocomplete = new GeocoderAutocomplete(
          autocompleteContainerRef.current,
          geoapifyConfig.apiKey,
          {
            placeholder: 'Enter a full address to auto-fill location details',
            type: 'street',
            lang: 'en'
          }
        )

        // Listen to select event
        autocomplete.on('select', (location: any) => {
          if (location) {
            // Extract address components
            const properties = location.properties
            
            // Auto-fill Office (city)
            const city = properties.city || properties.county || properties.state || ''
            
            // Auto-fill Building (street address)
            const street = properties.street || properties.address_line1 || ''
            const houseNumber = properties.housenumber || ''
            const building = houseNumber ? `${houseNumber} ${street}` : street
            
            // Auto-fill Full Address (formatted address)
            const fullAddress = properties.formatted || ''
            
            // Update custom location data
            setCustomLocationData(prev => ({
              ...prev,
              office: city,
              building: building,
              level: prev.level, // Keep existing level or leave empty
              address: fullAddress
            }))
          }
        })

        autocompleteInstanceRef.current = autocomplete
      } catch (error) {
        console.error('Error initializing Geoapify autocomplete:', error)
        toast({
          title: "Autocomplete Error",
          description: "Failed to load address autocomplete. Please enter address manually.",
          variant: "destructive",
        })
      }
    }

    // Cleanup on unmount or when custom location is closed
    return () => {
      if (autocompleteInstanceRef.current) {
        autocompleteInstanceRef.current = null
      }
      if (autocompleteContainerRef.current) {
        autocompleteContainerRef.current.innerHTML = ''
      }
    }
  }, [isCreatingCustomLocation, geoapifyConfig?.apiKey, toast])

  const [listingFormData, setListingFormData] = useState({
    listingType: "single" as "single" | "period" | "recurring",
    singleDate: "",
    periodStartDate: "",
    periodEndDate: "",
    recurringStartDate: "",
    recurringEndDate: "",
    daysOfWeek: [] as string[],
    dailyRate: "",
    notes: "",
    status: "active" as const
  })

  const [dateValidationErrors, setDateValidationErrors] = useState({
    periodDateRange: "",
    recurringDateRange: ""
  })

  // Fetch user's parking spots
  const { data: userSpots = [], isLoading, refetch } = useQuery<DBParkingSpot[]>({
    queryKey: ['/api/my-spots'],
    enabled: true
  })

  // Fetch locations for dropdown selection
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  })

  // Fetch spot types for dropdown selection
  const { data: spotTypes = [], isLoading: isLoadingSpotTypes } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  })

  // Fetch payment preferences for spot owners
  const { data: paymentPreferences, isLoading: isLoadingPaymentPreferences } = useQuery<PaymentPreferences | null>({
    queryKey: ["/api/users", user?.id, "payment-preferences"],
    enabled: !!user?.id
  })

  // Fetch max daily rate config for validation
  const { data: maxDailyRateConfig } = useQuery<{ key: string; value: string } | null>({
    queryKey: ["/api/app-configs", "max_daily_rate"],
  })
  const maxDailyRate = maxDailyRateConfig?.value ? parseFloat(maxDailyRateConfig.value) : null

  // Fetch default daily rate from system settings
  const { data: defaultDailyRateConfig } = useQuery<{ value: string } | null>({
    queryKey: ["/api/app-configs", "default_daily_rate"],
  })
  const systemDefaultRate = defaultDailyRateConfig?.value || "10"

  // Payment dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentFormData, setPaymentFormData] = useState({
    paymentType: "interac_transfer" as "interac_transfer" | "cash",
    paymentInstructions: ""
  })

  // Update payment form when preferences are loaded
  useEffect(() => {
    if (paymentPreferences) {
      setPaymentFormData({
        paymentType: paymentPreferences.paymentType as "interac_transfer" | "cash",
        paymentInstructions: paymentPreferences.paymentInstructions || ""
      })
    }
  }, [paymentPreferences])

  // Helper functions to lookup location and spot type data
  const getLocationById = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId)
    if (!location) return "Unknown Location"
    return `${location.office} - ${location.building} - ${location.level}`
  }

  const getSpotTypeById = (spotTypeId: number) => {
    const spotType = spotTypes.find(type => type.id === spotTypeId)
    return spotType?.name || "unknown"
  }

  // Mutation to create custom location (for Personal spots)
  const createLocationMutation = useMutation({
    mutationFn: async (locationData: typeof customLocationData): Promise<Location> => {
      const response = await apiRequest(`/api/locations`, {
        method: "POST",
        body: locationData,
      })
      return await response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] })
      toast({
        title: "Success",
        description: "Custom location created successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create custom location.",
        variant: "destructive",
      })
    },
  })

  // Create spot mutation
  const createSpotMutation = useMutation({
    mutationFn: async (spotData: InsertParkingSpot) => {
      const response = await fetch('/api/my-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spotData)
      })
      if (!response.ok) throw new Error('Failed to create spot')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
      setShowAddSpot(false)
      setNewSpotData({ 
        spotNumber: "", 
        locationId: undefined, 
        spotTypeId: undefined, 
        isIndoor: false, 
        description: "" 
      })
      setIsCreatingCustomLocation(false)
      setCustomLocationData({
        office: "",
        building: "",
        level: "",
        address: ""
      })
    }
  })

  // Update spot mutation
  const updateSpotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<InsertParkingSpot> }) => {
      const response = await fetch(`/api/my-spots/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to update spot')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
      setShowEditSpot(false)
    }
  })

  // Delete spot mutation
  const deleteSpotMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/my-spots/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete spot')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
    }
  })

  // Create listing mutation
  const createListingMutation = useMutation({
    mutationFn: async (listingData: InsertSpotListing) => {
      const response = await apiRequest('/api/spot-listings', {
        method: 'POST',
        body: listingData
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create listing')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
      queryClient.invalidateQueries({ queryKey: ['/api/spot-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] })
      toast({
        title: "Success",
        description: "Listing created successfully",
      })
      setShowCreateListingDialog(false)
      setSelectedSpotForListing(null)
      setListingFormData({
        listingType: "single",
        singleDate: "",
        periodStartDate: "",
        periodEndDate: "",
        recurringStartDate: "",
        recurringEndDate: "",
        daysOfWeek: [],
        dailyRate: "",
        notes: "",
        status: "active"
      })
      setDateValidationErrors({
        periodDateRange: "",
        recurringDateRange: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create listing",
        variant: "destructive",
      })
    }
  })

  const mockSpots = userSpots.length > 0 ? userSpots.map(spot => {
    const spotTypeName = getSpotTypeById(spot.spotTypeId)
    return {
      id: spot.id,
      spotNumber: spot.spotNumber,
      location: getLocationById(spot.locationId),
      type: spotTypeName,
      isInside: spot.isIndoor,
      basePrice: null, // Price is set when creating listings, not spots
      isActive: spot.isActive,
      monthlyEarnings: 0, // Will be calculated from bookings
      totalBookings: 0, // Will be calculated from bookings
      rating: 0, // Will be calculated from reviews
      description: spot.description || "",
      amenities: spotTypeName === "electric" ? ["EV Charging"] : spotTypeName === "accessible" ? ["Accessible"] : [],
      currentBooking: undefined // Will be populated from actual booking data
    }
  }) : []

  // Legacy mock data for empty state (keep some for demo)
  const defaultMockSpots = [
    {
      id: "spot-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      type: "electric",
      isInside: true,
      basePrice: 25,
      isActive: true,
      currentBooking: {
        id: "B-001",
        renterName: "Mike Johnson",
        date: "2024-01-20",
        startTime: "8:00 AM",
        endTime: "6:00 PM",
        status: "confirmed"
      },
      monthlyEarnings: 450,
      totalBookings: 18,
      rating: 4.9,
      description: "Close to elevator, EV charging station available",
      amenities: ["EV Charging", "Covered", "Security Camera"]
    },
    {
      id: "spot-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      type: "regular",
      isInside: false,
      basePrice: 20,
      isActive: true,
      monthlyEarnings: 380,
      totalBookings: 19,
      rating: 4.7,
      description: "Easy access, close to main entrance",
      amenities: ["Security Camera", "Well-lit"]
    },
    {
      id: "spot-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      type: "accessible",
      isInside: false,
      basePrice: 15,
      isActive: false,
      monthlyEarnings: 0,
      totalBookings: 0,
      rating: 0,
      description: "Accessible parking space with wide access",
      amenities: ["Accessible", "Wide Space"]
    }
  ]

  const activeSpots = userSpots.filter(spot => spot.isActive).length
  const totalSpots = userSpots.length

  const handleAddSpot = () => {
    setShowAddSpot(true)
  }

  // Handler to create spot with custom location if needed
  const handleCreateSpotWithCustomLocation = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a spot",
        variant: "destructive",
      })
      return
    }

    try {
      let locationIdToUse = newSpotData.locationId

      // If creating custom location for Personal spots, create it first
      if (isCreatingCustomLocation) {
        // Validate custom location fields
        if (!customLocationData.office || !customLocationData.building || !customLocationData.level) {
          toast({
            title: "Validation Error",
            description: "Office, building, and level are required for custom locations.",
            variant: "destructive",
          })
          return
        }

        // Create the custom location
        const locationResponse = await createLocationMutation.mutateAsync(customLocationData)
        locationIdToUse = locationResponse.id
      }

      // Now create the spot with the location ID
      if (locationIdToUse && newSpotData.spotTypeId) {
        await createSpotMutation.mutateAsync({
          spotNumber: newSpotData.spotNumber,
          locationId: locationIdToUse,
          spotTypeId: newSpotData.spotTypeId,
          isIndoor: newSpotData.isIndoor,
          description: newSpotData.description || undefined,
          ownerId: user.id,
          isBciManaged: false, // Personal spots are always non-BCI-managed
        })
      }
    } catch (error: any) {
      console.error("Error adding spot with custom location:", error)
    }
  }

  const handleEditSpot = (spot: DBParkingSpot) => {
    setSelectedSpot(spot)
    setShowEditSpot(true)
  }

  const handleDeleteSpot = async (spot: any) => {
    const confirmed = await confirm(confirmations.deleteSpot(spot.spotNumber))
    if (confirmed) {
      deleteSpotMutation.mutate(spot.id)
    }
  }

  const handleToggleSpotStatus = (spotId: string) => {
    console.log('Toggle spot status:', spotId)
    // Handle spot activation/deactivation
  }

  const [, setLocation] = useLocation()
  
  const handleViewBookingHistory = (spotId: string) => {
    // Navigate to My Spot Listings page
    setLocation('/my-listings')
  }

  // Mutation to update default price
  const updateDefaultPriceMutation = useMutation({
    mutationFn: async ({ spotId, price }: { spotId: string; price: number }) => {
      const response = await apiRequest(`/api/my-spots/${spotId}/default-price`, {
        method: "PATCH",
        body: { defaultPrice: price },
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
      toast({
        title: "Success",
        description: "Default price updated successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default price.",
        variant: "destructive",
      })
    },
  })

  const handleUpdateDefaultPrice = (spotId: string, price: number) => {
    updateDefaultPriceMutation.mutate({ spotId, price })
  }

  // Mutation to update payment preferences
  const updatePaymentPreferencesMutation = useMutation({
    mutationFn: async (data: typeof paymentFormData) => {
      const response = await apiRequest(`/api/users/${user?.id}/payment-preferences`, {
        method: "PATCH",
        body: data,
      })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "payment-preferences"] })
      setShowPaymentDialog(false)
      toast({
        title: "Success",
        description: "Payment preferences updated successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment preferences.",
        variant: "destructive",
      })
    },
  })

  const handleSavePaymentPreferences = () => {
    updatePaymentPreferencesMutation.mutate(paymentFormData)
  }

  const handleOpenCreateListing = (spot: DBParkingSpot) => {
    setSelectedSpotForListing(spot)
    // Pre-populate form: spot's default price > system default rate
    const defaultRate = spot.defaultPrice && parseFloat(spot.defaultPrice) > 0 
      ? spot.defaultPrice 
      : systemDefaultRate
    setListingFormData(prev => ({
      ...prev,
      dailyRate: defaultRate,
      // Reset other fields for new listing
      listingType: "single",
      singleDate: "",
      periodStartDate: "",
      periodEndDate: "",
      recurringStartDate: "",
      recurringEndDate: "",
      daysOfWeek: [],
      notes: "",
      status: "active"
    }))
    setShowCreateListingDialog(true)
  }

  const handleCreateListing = () => {
    if (!selectedSpotForListing || !user) return

    // Clear previous date validation errors
    setDateValidationErrors({
      periodDateRange: "",
      recurringDateRange: ""
    })

    // Validate required fields based on listing type
    const { listingType, dailyRate, singleDate, periodStartDate, periodEndDate, recurringStartDate, recurringEndDate, daysOfWeek } = listingFormData

    if (!dailyRate || parseFloat(dailyRate) <= 0) {
      toast({
        title: "Validation Error",
        description: "Daily rate must be greater than 0",
        variant: "destructive",
      })
      return
    }

    if (listingType === "single" && !singleDate) {
      toast({
        title: "Validation Error",
        description: "Please select a date for single day listing",
        variant: "destructive",
      })
      return
    }

    if (listingType === "period" && (!periodStartDate || !periodEndDate)) {
      toast({
        title: "Validation Error",
        description: "Please select start and end dates for period listing",
        variant: "destructive",
      })
      return
    }

    // Date range validation for period type
    if (listingType === "period" && periodStartDate && periodEndDate) {
      if (new Date(periodStartDate) > new Date(periodEndDate)) {
        setDateValidationErrors(prev => ({
          ...prev,
          periodDateRange: "Start date must be before or equal to end date"
        }))
        return
      }
    }

    if (listingType === "recurring" && !recurringStartDate) {
      toast({
        title: "Validation Error",
        description: "Please select a start date for recurring listing",
        variant: "destructive",
      })
      return
    }

    // Date range validation for recurring type (if end date is provided)
    if (listingType === "recurring" && recurringStartDate && recurringEndDate) {
      if (new Date(recurringStartDate) > new Date(recurringEndDate)) {
        setDateValidationErrors(prev => ({
          ...prev,
          recurringDateRange: "Start date must be before or equal to end date"
        }))
        return
      }
    }

    if (listingType === "recurring" && daysOfWeek.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one day of the week for recurring listing",
        variant: "destructive",
      })
      return
    }

    // Build the listing data (server will set ownerId from authenticated user)
    const listingData: InsertSpotListing = {
      spotId: selectedSpotForListing.id,
      listingType: listingType,
      dailyRate: dailyRate,
      status: listingFormData.status,
      notes: listingFormData.notes || undefined,
      // Conditional fields based on listing type
      ...(listingType === "single" && { singleDate: singleDate }),
      ...(listingType === "period" && { 
        periodStartDate: periodStartDate,
        periodEndDate: periodEndDate 
      }),
      ...(listingType === "recurring" && { 
        recurringStartDate: recurringStartDate,
        recurringEndDate: recurringEndDate || undefined,
        daysOfWeek: daysOfWeek
      })
    }

    createListingMutation.mutate(listingData)
  }

  const handleToggleDayOfWeek = (day: string) => {
    setListingFormData(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }))
  }

  const getSpotTypeIcon = (type: string) => {
    switch (type) {
      case "electric":
        return "⚡"
      case "accessible":
        return "♿"
      default:
        return "🚗"
    }
  }

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "electric":
        return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
      case "accessible":
        return "bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400"
      default:
        return "bg-slate-50 text-slate-600 dark:bg-slate-950/20 dark:text-slate-400"
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-my-spots">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Parking Spots</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your parking spaces and track your earnings.
          </p>
        </div>
      </div>

      {/* Spots List */}
      <div className="space-y-4">
          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading your parking spots...</div>
            </div>
          ) : userSpots.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">No parking spots assigned to you yet.</div>
              <p className="text-sm text-muted-foreground">Contact your administrator to get a spot assigned.</p>
            </div>
          ) : (
            /* Spots List */
            <div className="space-y-4">
              {userSpots.map((spot) => (
          <Card key={spot.id} className={`overflow-hidden ${!spot.isActive ? 'opacity-60' : ''}`}>
            {/* Header Section - Blue */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-blue-50/70 to-blue-50/20 border-b">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getSpotTypeIcon(getSpotTypeById(spot.spotTypeId))}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg md:text-xl font-semibold break-words">Spot {spot.spotNumber}</h3>
                      <Badge className={getSpotTypeColor(getSpotTypeById(spot.spotTypeId))}>
                        {getSpotTypeById(spot.spotTypeId)}
                      </Badge>
                      {spot.isIndoor && (
                        <Badge variant="outline">Indoor</Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {spot.isBciManaged ? (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200" data-testid={`badge-bci-managed-${spot.id}`}>
                              BCI Managed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" data-testid={`badge-personal-${spot.id}`}>
                              Personal
                            </Badge>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>
                          {spot.isBciManaged 
                            ? "This spot is managed by BCI administrators"
                            : "You can create listings for this spot"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 break-words">
                        <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        {getLocationById(spot.locationId)}
                      </p>
                      {(() => {
                        const seatNum = (spot as any).seatNumber;
                        const location = locations.find(loc => loc.id === spot.locationId);
                        const floorPlanBaseUrl = (location as any)?.floorPlanBaseUrl;
                        const mapUrl = seatNum && floorPlanBaseUrl
                          ? `${floorPlanBaseUrl}${seatNum}`
                          : null;
                        return mapUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a 
                                href={mapUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-blue-200 bg-white hover:bg-blue-50 transition-colors"
                                data-testid={`link-floor-plan-${spot.id}`}
                              >
                                <Map className="h-4 w-4 text-blue-600" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>View on floor plan (Seat {seatNum})</TooltipContent>
                          </Tooltip>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-between md:justify-end">
                  <div className="text-left md:text-right mr-4">
                    <p className="text-xs md:text-sm text-muted-foreground">Status</p>
                    <Badge variant={spot.isActive ? "default" : "secondary"}>
                      {spot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {/* Only show edit/delete for personal spots, not BCI-managed */}
                  {!spot.isBciManaged && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditSpot(spot)} data-testid={`button-edit-spot-${spot.id}`} className="min-h-11 bg-white">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteSpot(spot)} data-testid={`button-delete-spot-${spot.id}`} className="text-red-600 hover:text-red-700 hover:border-red-300 min-h-11 bg-white">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {spot.description && (
                <p className="text-sm text-muted-foreground mt-3 break-words">{spot.description}</p>
              )}
            </div>

            {/* Default Settings Section */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-blue-50/50 to-blue-50/20">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Default Settings</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Default Daily Rate */}
                  <div>
                    <p className="text-sm font-medium mb-2">Default Daily Rate {maxDailyRate && <span className="text-muted-foreground font-normal">(max ${maxDailyRate})</span>}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        placeholder="Set price"
                        defaultValue={spot.defaultPrice || ""}
                        max={maxDailyRate || undefined}
                        className="w-28 min-h-9"
                        data-testid={`input-default-price-${spot.id}`}
                        onBlur={(e) => {
                          const newPrice = parseFloat(e.target.value)
                          if (!isNaN(newPrice) && newPrice >= 0) {
                            if (maxDailyRate && newPrice > maxDailyRate) {
                              toast({
                                title: "Price Exceeds Limit",
                                description: `Daily rate cannot exceed $${maxDailyRate}. Please enter a lower amount.`,
                                variant: "destructive"
                              })
                              e.target.value = spot.defaultPrice || ""
                              return
                            }
                            handleUpdateDefaultPrice(spot.id, newPrice)
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">per day</span>
                    </div>
                  </div>
                  
                  {/* Default Payment Method */}
                  <div>
                    <p className="text-sm font-medium mb-2">Default Payment Method</p>
                    <div className="flex items-center gap-2">
                      {isLoadingPaymentPreferences ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : paymentPreferences ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {paymentPreferences.paymentType === "interac_transfer" ? "Interac" : "Cash"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPaymentDialog(true)}
                            className="text-xs h-8"
                            data-testid="button-edit-payment-method"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPaymentDialog(true)}
                          className="min-h-9"
                          data-testid="button-set-payment-method"
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Set Payment Method
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            {/* Footer Section */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-blue-50/40 to-transparent border-t">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Show info for BCI-managed spots */}
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {spot.isBciManaged ? "Assigned by BCI administrator" : "Personal spot"}
                  </span>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  {/* Create Listing button - always active */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleOpenCreateListing(spot)}
                    data-testid={`button-create-listing-${spot.id}`}
                    className="w-full md:w-auto min-h-11"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Listing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewBookingHistory(spot.id)}
                    data-testid={`button-history-${spot.id}`}
                    className="w-full md:w-auto min-h-11 bg-white"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View History
                  </Button>
                </div>
              </div>
            </div>
          </Card>
              ))}
            </div>
          )}
      </div>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpot} onOpenChange={setShowEditSpot}>
        <DialogContent className="max-w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-number">Spot Number</Label>
                  <Input id="edit-spot-number" defaultValue={selectedSpot.spotNumber} className="min-h-11" />
                </div>
                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" defaultValue={getLocationById(selectedSpot.locationId)} className="min-h-11" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-type">Spot Type</Label>
                  <Select defaultValue={String(selectedSpot.spotTypeId)}>
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="electric">Electric Vehicle</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="bg-sky-50 dark:bg-sky-950/20 p-3 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      💡 <strong>Note:</strong> Price is set when you create a listing for this spot, not at the spot level.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" defaultValue={selectedSpot.description || ""} className="min-h-11" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="edit-is-indoor" defaultChecked={selectedSpot.isIndoor} className="min-h-11" />
                <Label htmlFor="edit-is-indoor">Indoor parking</Label>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditSpot(false)} className="w-full sm:w-auto min-h-11">
                  Cancel
                </Button>
                <Button onClick={() => setShowEditSpot(false)} className="w-full sm:w-auto min-h-11">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Listing Dialog */}
      <Dialog open={showCreateListingDialog} onOpenChange={(open) => {
        setShowCreateListingDialog(open)
        if (!open) {
          setSelectedSpotForListing(null)
          setListingFormData({
            listingType: "single",
            singleDate: "",
            periodStartDate: "",
            periodEndDate: "",
            recurringStartDate: "",
            recurringEndDate: "",
            daysOfWeek: [],
            dailyRate: "",
            notes: "",
            status: "active"
          })
          setDateValidationErrors({
            periodDateRange: "",
            recurringDateRange: ""
          })
        }
      }}>
        <DialogContent className="max-w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Spot Listing</DialogTitle>
          </DialogHeader>
          {selectedSpotForListing && (
            <div className="space-y-4 py-4">
              {/* Spot Context */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-base md:text-lg mb-1">Spot {selectedSpotForListing.spotNumber}</h3>
                <p className="text-muted-foreground text-xs md:text-sm flex items-center gap-1 break-words">
                  <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  {getLocationById(selectedSpotForListing.locationId)}
                </p>
              </div>

              {/* Listing Type */}
              <div>
                <Label htmlFor="listing-type">Listing Type</Label>
                <Select 
                  value={listingFormData.listingType} 
                  onValueChange={(value) => {
                    setListingFormData(prev => ({ ...prev, listingType: value as any }))
                    setDateValidationErrors({ periodDateRange: "", recurringDateRange: "" })
                  }}
                >
                  <SelectTrigger id="listing-type" data-testid="select-listing-type" className="min-h-11">
                    <SelectValue placeholder="Select listing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Day</SelectItem>
                    <SelectItem value="period">Period</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Date Fields */}
              {listingFormData.listingType === "single" && (
                <div>
                  <Label htmlFor="single-date">Date</Label>
                  <Input 
                    id="single-date"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                    value={listingFormData.singleDate}
                    onChange={(e) => setListingFormData(prev => ({ ...prev, singleDate: e.target.value }))}
                    data-testid="input-single-date"
                    className="min-h-11"
                  />
                </div>
              )}

              {listingFormData.listingType === "period" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="period-start-date">Start Date</Label>
                      <Input 
                        id="period-start-date"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                        value={listingFormData.periodStartDate}
                        onChange={(e) => {
                          setListingFormData(prev => ({ ...prev, periodStartDate: e.target.value }))
                          setDateValidationErrors(prev => ({ ...prev, periodDateRange: "" }))
                        }}
                        data-testid="input-period-start-date"
                        className="min-h-11"
                      />
                    </div>
                    <div>
                      <Label htmlFor="period-end-date">End Date</Label>
                      <Input 
                        id="period-end-date"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                        value={listingFormData.periodEndDate}
                        onChange={(e) => {
                          setListingFormData(prev => ({ ...prev, periodEndDate: e.target.value }))
                          setDateValidationErrors(prev => ({ ...prev, periodDateRange: "" }))
                        }}
                        data-testid="input-period-end-date"
                        className="min-h-11"
                      />
                    </div>
                  </div>
                  {dateValidationErrors.periodDateRange && (
                    <p className="text-sm text-destructive" data-testid="error-period-date-range">
                      {dateValidationErrors.periodDateRange}
                    </p>
                  )}
                </div>
              )}

              {listingFormData.listingType === "recurring" && (
                <>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recurring-start-date">Start Date</Label>
                        <Input 
                          id="recurring-start-date"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                          value={listingFormData.recurringStartDate}
                          onChange={(e) => {
                            setListingFormData(prev => ({ ...prev, recurringStartDate: e.target.value }))
                            setDateValidationErrors(prev => ({ ...prev, recurringDateRange: "" }))
                          }}
                          data-testid="input-recurring-start-date"
                          className="min-h-11"
                        />
                      </div>
                      <div>
                        <Label htmlFor="recurring-end-date">End Date (Optional)</Label>
                        <Input 
                          id="recurring-end-date"
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          max={(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().split('T')[0]; })()}
                          value={listingFormData.recurringEndDate}
                          onChange={(e) => {
                            setListingFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))
                            setDateValidationErrors(prev => ({ ...prev, recurringDateRange: "" }))
                          }}
                          data-testid="input-recurring-end-date"
                          className="min-h-11"
                        />
                      </div>
                    </div>
                    {dateValidationErrors.recurringDateRange && (
                      <p className="text-sm text-destructive" data-testid="error-recurring-date-range">
                        {dateValidationErrors.recurringDateRange}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Days of Week</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                        <div key={day} className="flex items-center space-x-2 min-h-11">
                          <Checkbox
                            id={`day-${day}`}
                            checked={listingFormData.daysOfWeek.includes(day)}
                            onCheckedChange={() => handleToggleDayOfWeek(day)}
                            data-testid={`checkbox-day-${day}`}
                          />
                          <Label 
                            htmlFor={`day-${day}`} 
                            className="text-sm font-normal capitalize cursor-pointer"
                          >
                            {day}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Daily Rate */}
              <div>
                <Label htmlFor="daily-rate">Daily Rate {maxDailyRate && <span className="text-muted-foreground font-normal">(max ${maxDailyRate})</span>}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input 
                    id="daily-rate"
                    type="number"
                    min="0"
                    max={maxDailyRate || undefined}
                    step="0.01"
                    placeholder={`e.g. ${systemDefaultRate}`}
                    value={listingFormData.dailyRate}
                    onChange={(e) => {
                      const value = e.target.value
                      const numValue = parseFloat(value)
                      if (maxDailyRate && !isNaN(numValue) && numValue > maxDailyRate) {
                        toast({
                          title: "Price Exceeds Limit",
                          description: `Daily rate cannot exceed $${maxDailyRate}. Please enter a lower amount.`,
                          variant: "destructive"
                        })
                        return
                      }
                      setListingFormData(prev => ({ ...prev, dailyRate: value }))
                    }}
                    className="pl-7 min-h-11 placeholder:text-muted-foreground/50"
                    data-testid="input-daily-rate"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="listing-notes">Notes (Optional)</Label>
                <Textarea 
                  id="listing-notes"
                  placeholder="Add any additional notes about this listing..."
                  value={listingFormData.notes}
                  onChange={(e) => setListingFormData(prev => ({ ...prev, notes: e.target.value }))}
                  data-testid="textarea-listing-notes"
                  className="min-h-11"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateListingDialog(false)}
                  data-testid="button-cancel-listing"
                  className="w-full sm:w-auto min-h-11"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateListing}
                  disabled={createListingMutation.isPending}
                  data-testid="button-submit-listing"
                  className="w-full sm:w-auto min-h-11"
                >
                  {createListingMutation.isPending ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Preferences Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-full md:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Preferences
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set how you want to receive payment when others book your parking spots.
            </p>
            <div>
              <Label htmlFor="payment-type">Payment Type</Label>
              <Select
                value={paymentFormData.paymentType}
                onValueChange={(value: "interac_transfer" | "cash") => 
                  setPaymentFormData(prev => ({ ...prev, paymentType: value }))
                }
              >
                <SelectTrigger className="min-h-11" data-testid="select-payment-type">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interac_transfer">Interac Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment-instructions">Payment Instructions</Label>
              <Textarea
                id="payment-instructions"
                placeholder={paymentFormData.paymentType === "interac_transfer" 
                  ? "e.g., Send e-Transfer to john.doe@bci.ca (auto-deposit enabled)" 
                  : "e.g., Meet me at BCI main Building Lobby or message me on Teams"}
                value={paymentFormData.paymentInstructions}
                onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentInstructions: e.target.value }))}
                className="min-h-24"
                data-testid="textarea-payment-instructions"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be shown to renters when they book your spot.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              className="w-full sm:w-auto min-h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePaymentPreferences}
              disabled={updatePaymentPreferencesMutation.isPending}
              className="w-full sm:w-auto min-h-11"
              data-testid="button-save-payment-preferences"
            >
              {updatePaymentPreferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
