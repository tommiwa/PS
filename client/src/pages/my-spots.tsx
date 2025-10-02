import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { ParkingSpot as DBParkingSpot, InsertParkingSpot, InsertSpotListing } from "@shared/schema"
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
import { Car, MapPin, DollarSign, Clock, Edit, Plus, Eye, Users, TrendingUp, Grid, Trash2, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

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
    location: "",
    spotType: "regular" as const,
    isIndoor: false,
    description: ""
  })

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
      setNewSpotData({ spotNumber: "", location: "", spotType: "regular", isIndoor: false, description: "" })
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
      if (!response.ok) throw new Error('Failed to create listing')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-spots'] })
      queryClient.invalidateQueries({ queryKey: ['/api/spot-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/listings'] })
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

  const mockSpots = userSpots.length > 0 ? userSpots.map(spot => ({
    id: spot.id,
    spotNumber: spot.spotNumber,
    location: spot.location,
    type: spot.spotType,
    isInside: spot.isIndoor,
    basePrice: null, // Price is set when creating listings, not spots
    isActive: spot.isActive,
    monthlyEarnings: 0, // Will be calculated from bookings
    totalBookings: 0, // Will be calculated from bookings
    rating: 0, // Will be calculated from reviews
    description: spot.description || "",
    amenities: spot.spotType === "electric" ? ["EV Charging"] : spot.spotType === "accessible" ? ["Accessible"] : [],
    currentBooking: undefined // Will be populated from actual booking data
  })) : []

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

  const handleCreateSpot = () => {
    if (!newSpotData.spotNumber || !newSpotData.location) return
    
    createSpotMutation.mutate({
      spotNumber: newSpotData.spotNumber,
      location: newSpotData.location,
      spotType: newSpotData.spotType,
      isIndoor: newSpotData.isIndoor,
      description: newSpotData.description || undefined,
      ownerId: "mock-user-id" // This would come from auth context in real app
    })
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

  const handleViewBookingHistory = (spotId: string) => {
    console.log('View booking history for spot:', spotId)
    // Navigate to spot booking history
  }

  const handleOpenCreateListing = (spot: DBParkingSpot) => {
    setSelectedSpotForListing(spot)
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
    <div className="p-6 space-y-6" data-testid="page-my-spots">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Parking Spots</h1>
          <p className="text-muted-foreground">
            Manage your parking spaces and track your earnings.
          </p>
        </div>
        <Button onClick={handleAddSpot} data-testid="button-add-new-spot">
          <Plus className="h-4 w-4 mr-2" />
          Add New Spot
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Active Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSpots}</div>
            <p className="text-xs text-muted-foreground">Out of {totalSpots} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpots}</div>
            <p className="text-xs text-muted-foreground">Registered spots</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Inactive Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpots - activeSpots}</div>
            <p className="text-xs text-muted-foreground">Need activation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpots > 0 ? Math.round((activeSpots / totalSpots) * 100) : 0}%</div>
            <p className="text-xs text-muted-foreground">Active spots</p>
          </CardContent>
        </Card>
      </div>

      {/* Spot Management */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Grid className="h-5 w-5" />
            Spot Management
          </h2>
        </div>

        <div className="space-y-4">
          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading your parking spots...</div>
            </div>
          ) : userSpots.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">No parking spots yet.</div>
              <Button onClick={handleAddSpot} data-testid="button-add-first-spot">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Spot
              </Button>
            </div>
          ) : (
            /* Spots List */
            <div className="space-y-4">
              {userSpots.map((spot) => (
          <Card key={spot.id} className={`${!spot.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getSpotTypeIcon(spot.spotType)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">Spot {spot.spotNumber}</h3>
                      <Badge className={getSpotTypeColor(spot.spotType)}>
                        {spot.spotType}
                      </Badge>
                      {spot.isIndoor && (
                        <Badge variant="outline">Indoor</Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {spot.isBciManaged ? (
                            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" data-testid={`badge-bci-managed-${spot.id}`}>
                              BCI Managed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" data-testid={`badge-personal-${spot.id}`}>
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
                    <p className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {spot.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={spot.isActive ? "default" : "secondary"}>
                      {spot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditSpot(spot)} data-testid={`button-edit-spot-${spot.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSpot(spot)} data-testid={`button-delete-spot-${spot.id}`} className="text-red-600 hover:text-red-700 hover:border-red-300">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {spot.description && (
                <p className="text-sm text-muted-foreground mb-4">{spot.description}</p>
              )}

              <div className="mb-4">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="text-lg font-semibold">Set when creating listings</p>
              </div>


              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`spot-toggle-${spot.id}`} className="text-sm">
                    {spot.isActive ? 'Active' : 'Inactive'}
                  </Label>
                  <Switch
                    id={`spot-toggle-${spot.id}`}
                    checked={spot.isActive}
                    onCheckedChange={() => handleToggleSpotStatus(spot.id)}
                    data-testid={`switch-spot-${spot.id}`}
                  />
                </div>
                <div className="flex gap-2">
                  {spot.isBciManaged ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            data-testid={`button-create-listing-${spot.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Listing
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        BCI-managed spots cannot be listed. Contact administrator.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenCreateListing(spot)}
                      data-testid={`button-create-listing-${spot.id}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Listing
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewBookingHistory(spot.id)}
                    data-testid={`button-history-${spot.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSpot(spot)}
                    data-testid={`button-edit-${spot.id}`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Spot
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add New Spot Dialog */}
      <Dialog open={showAddSpot} onOpenChange={setShowAddSpot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="spot-number">Spot Number</Label>
                <Input 
                  id="spot-number" 
                  placeholder="e.g., A-15" 
                  value={newSpotData.spotNumber}
                  onChange={(e) => setNewSpotData(prev => ({ ...prev, spotNumber: e.target.value }))}
                  data-testid="input-new-spot-number"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Select value={newSpotData.location} onValueChange={(value) => setNewSpotData(prev => ({ ...prev, location: value }))}>
                  <SelectTrigger data-testid="select-new-spot-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Building - Level 1">Main Building - Level 1</SelectItem>
                    <SelectItem value="Main Building - Level 2">Main Building - Level 2</SelectItem>
                    <SelectItem value="Main Building - Level 3">Main Building - Level 3</SelectItem>
                    <SelectItem value="North Parking Lot">North Parking Lot</SelectItem>
                    <SelectItem value="South Parking Lot">South Parking Lot</SelectItem>
                    <SelectItem value="West Parking Lot">West Parking Lot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="spot-type">Spot Type</Label>
                <Select value={newSpotData.spotType} onValueChange={(value) => setNewSpotData(prev => ({ ...prev, spotType: value as any }))}>
                  <SelectTrigger data-testid="select-new-spot-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="electric">Electric Vehicle</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="Describe your parking spot..."
                value={newSpotData.description}
                onChange={(e) => setNewSpotData(prev => ({ ...prev, description: e.target.value }))}
                data-testid="textarea-new-spot-description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="is-indoor" 
                checked={newSpotData.isIndoor}
                onCheckedChange={(checked) => setNewSpotData(prev => ({ ...prev, isIndoor: !!checked }))}
                data-testid="switch-new-spot-indoor"
              />
              <Label htmlFor="is-indoor">Indoor parking</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddSpot(false)} data-testid="button-cancel-new-spot">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSpot}
                disabled={createSpotMutation.isPending || !newSpotData.spotNumber || !newSpotData.location}
                data-testid="button-create-spot"
              >
                {createSpotMutation.isPending ? "Creating..." : "Add Spot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpot} onOpenChange={setShowEditSpot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-number">Spot Number</Label>
                  <Input id="edit-spot-number" defaultValue={selectedSpot.spotNumber} />
                </div>
                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" defaultValue={selectedSpot.location} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-type">Spot Type</Label>
                  <Select defaultValue={selectedSpot.spotType}>
                    <SelectTrigger>
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
                <Textarea id="edit-description" defaultValue={selectedSpot.description || ""} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="edit-is-indoor" defaultChecked={selectedSpot.isIndoor} />
                <Label htmlFor="edit-is-indoor">Indoor parking</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditSpot(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowEditSpot(false)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Spot Listing</DialogTitle>
          </DialogHeader>
          {selectedSpotForListing && (
            <div className="space-y-4 py-4">
              {/* Spot Context */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-1">Spot {selectedSpotForListing.spotNumber}</h3>
                <p className="text-muted-foreground text-sm flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {selectedSpotForListing.location}
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
                  <SelectTrigger id="listing-type" data-testid="select-listing-type">
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
                    value={listingFormData.singleDate}
                    onChange={(e) => setListingFormData(prev => ({ ...prev, singleDate: e.target.value }))}
                    data-testid="input-single-date"
                  />
                </div>
              )}

              {listingFormData.listingType === "period" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="period-start-date">Start Date</Label>
                      <Input 
                        id="period-start-date"
                        type="date"
                        value={listingFormData.periodStartDate}
                        onChange={(e) => {
                          setListingFormData(prev => ({ ...prev, periodStartDate: e.target.value }))
                          setDateValidationErrors(prev => ({ ...prev, periodDateRange: "" }))
                        }}
                        data-testid="input-period-start-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="period-end-date">End Date</Label>
                      <Input 
                        id="period-end-date"
                        type="date"
                        value={listingFormData.periodEndDate}
                        onChange={(e) => {
                          setListingFormData(prev => ({ ...prev, periodEndDate: e.target.value }))
                          setDateValidationErrors(prev => ({ ...prev, periodDateRange: "" }))
                        }}
                        data-testid="input-period-end-date"
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recurring-start-date">Start Date</Label>
                        <Input 
                          id="recurring-start-date"
                          type="date"
                          value={listingFormData.recurringStartDate}
                          onChange={(e) => {
                            setListingFormData(prev => ({ ...prev, recurringStartDate: e.target.value }))
                            setDateValidationErrors(prev => ({ ...prev, recurringDateRange: "" }))
                          }}
                          data-testid="input-recurring-start-date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="recurring-end-date">End Date (Optional)</Label>
                        <Input 
                          id="recurring-end-date"
                          type="date"
                          value={listingFormData.recurringEndDate}
                          onChange={(e) => {
                            setListingFormData(prev => ({ ...prev, recurringEndDate: e.target.value }))
                            setDateValidationErrors(prev => ({ ...prev, recurringDateRange: "" }))
                          }}
                          data-testid="input-recurring-end-date"
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
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
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
                <Label htmlFor="daily-rate">Daily Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input 
                    id="daily-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={listingFormData.dailyRate}
                    onChange={(e) => setListingFormData(prev => ({ ...prev, dailyRate: e.target.value }))}
                    className="pl-7"
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
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateListingDialog(false)}
                  data-testid="button-cancel-listing"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateListing}
                  disabled={createListingMutation.isPending}
                  data-testid="button-submit-listing"
                >
                  {createListingMutation.isPending ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}