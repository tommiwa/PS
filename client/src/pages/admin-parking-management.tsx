import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays, UserPlus, ArrowRight,
  Timer, Target, CheckCircle2, Search, Filter,
  Zap, Accessibility, Building, MoreHorizontal, Info, RefreshCw
} from "lucide-react"
import type { WaitingList, ParkingSpot, SpotType } from "@shared/schema"

export default function AdminParkingManagement() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAddSpotDialog, setShowAddSpotDialog] = useState(false)
  const [showEditSpotDialog, setShowEditSpotDialog] = useState(false)
  const [showAddToWaitingDialog, setShowAddToWaitingDialog] = useState(false)
  const [showDirectAssignDialog, setShowDirectAssignDialog] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null)
  const [selectedSpotForAssign, setSelectedSpotForAssign] = useState<ParkingSpot | null>(null)
  const [selectedUserForWaiting, setSelectedUserForWaiting] = useState("")
  const [selectedUserForAssign, setSelectedUserForAssign] = useState("")
  const [activeSpotTab, setActiveSpotTab] = useState("all")
  
  // Form state for add to waiting list dialog
  const [waitingListFormData, setWaitingListFormData] = useState({
    userId: "",
    preferredSpotType: "regular" as SpotType,
    priority: 2, // 1=high, 2=medium, 3=low
    reason: ""
  })
  
  // Form state for direct assignment dialog
  const [directAssignFormData, setDirectAssignFormData] = useState({
    userId: "",
    duration: "permanent",
    notes: ""
  })
  
  // Bookability control state
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set())
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false)
  
  // Form state for edit dialog
  const [editFormData, setEditFormData] = useState({
    spotNumber: "",
    location: "",
    spotType: "regular" as SpotType,
    isIndoor: false,
    isActive: true,
    isBookable: true,
    description: "",
    ownerId: null as string | null
  })
  
  // Form state for add spot dialog
  const [addSpotFormData, setAddSpotFormData] = useState({
    spotNumber: "",
    location: "",
    spotType: "regular" as SpotType,
    isIndoor: false,
    description: ""
  })
  
  // Fetch waiting list data for metrics
  const { data: allWaitingList, isLoading: isLoadingWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  });

  const { data: activeWaitingList, isLoading: isLoadingActiveWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list/active"],
  });

  // Fetch unallocated spots
  const { data: unallocatedSpots = [] } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  });

  // Fetch all spots (allocated + unallocated) for comprehensive admin view
  const { data: allSpots = [] } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/admin/all-spots"],
  });

  // Fetch all users for dropdown selection
  const { data: allUsers = [], isLoading: isLoadingUsers, error: usersError } = useQuery({
    queryKey: ["/api/admin/users"],
  });


  // Calculate waiting list metrics
  const waitingListMetrics = {
    total: allWaitingList?.length || 0,
    active: activeWaitingList?.length || 0,
    assigned: allWaitingList?.filter(entry => entry.status === "assigned").length || 0,
    // Priority is numeric: 1=high, 2=medium, 3=low
    highPriority: activeWaitingList?.filter(entry => entry.priority === 1).length || 0,
    mediumPriority: activeWaitingList?.filter(entry => entry.priority === 2).length || 0,
    lowPriority: activeWaitingList?.filter(entry => entry.priority === 3).length || 0,
    averageWaitTime: activeWaitingList && activeWaitingList.length > 0 
      ? Math.round(activeWaitingList.reduce((sum, entry) => {
          const daysSinceEnrollment = Math.floor((Date.now() - new Date(entry.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysSinceEnrollment;
        }, 0) / activeWaitingList.length)
      : 0
  };

  // Filter waiting list - show all waiting list entries, not just active
  const filteredWaitingList = allWaitingList?.filter(item => {
    const matchesSearch = item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || item.preferredSpotType === filterType
    return matchesSearch && matchesType
  }) || []

  // Mutation to assign a spot from the waiting list
  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ waitingListId, spotId }: { waitingListId: string; spotId: string }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: JSON.stringify({ waitingListId, spotId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      toast({
        title: "Success",
        description: "Spot assigned successfully from waiting list.",
        variant: "success",
      });
      setShowAssignDialog(false);
      setSelectedWaitingListItem(null);
      setSelectedSpotForAssign(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign spot.",
        variant: "error",
      });
    },
  });

  // Mutation to toggle spot bookability
  const toggleSpotBookabilityMutation = useMutation({
    mutationFn: async ({ spotIds, isBookable }: { spotIds: string[]; isBookable: boolean }) => {
      return await apiRequest(`/api/admin/toggle-spot-bookability`, {
        method: "PATCH",
        body: JSON.stringify({ spotIds, isBookable }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Info",
        description: `${variables.spotIds.length} spot(s) ${variables.isBookable ? 'enabled' : 'disabled'} for booking.`,
        variant: "info",
      });
      setSelectedSpots(new Set());
      setIsSelectAllChecked(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update spot bookability.",
        variant: "error",
      });
    },
  });

  // Mutation to add a new spot
  const addSpotMutation = useMutation({
    mutationFn: async (spotData: typeof addSpotFormData) => {
      return await apiRequest(`/api/admin/spots`, {
        method: "POST",
        body: JSON.stringify(spotData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: "Parking spot added successfully.",
        variant: "success",
      });
      setShowAddSpotDialog(false);
      setAddSpotFormData({
        spotNumber: "",
        location: "",
        spotType: "regular",
        isIndoor: false,
        description: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add parking spot.",
        variant: "error",
      });
    },
  });

  // Mutation to edit a spot
  const editSpotMutation = useMutation({
    mutationFn: async ({ spotId, spotData }: { spotId: string; spotData: typeof editFormData }) => {
      return await apiRequest(`/api/admin/spots/${spotId}`, {
        method: "PATCH",
        body: JSON.stringify(spotData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: "Parking spot updated successfully.",
        variant: "success",
      });
      setShowEditSpotDialog(false);
      setSelectedSpot(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update parking spot.",
        variant: "error",
      });
    },
  });

  // Mutation to delete a spot
  const deleteSpotMutation = useMutation({
    mutationFn: async (spotId: string) => {
      return await apiRequest(`/api/admin/spots/${spotId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: "Parking spot deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete parking spot.",
        variant: "destructive",
      });
    },
  });

  // Mutation to add user to waiting list
  const addToWaitingListMutation = useMutation({
    mutationFn: async (waitingData: typeof waitingListFormData) => {
      return await apiRequest(`/api/admin/waiting-list`, {
        method: "POST",
        body: JSON.stringify(waitingData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      toast({
        title: "Success",
        description: "User added to waiting list successfully.",
        variant: "success",
      });
      setShowAddToWaitingDialog(false);
      setWaitingListFormData({
        userId: "",
        preferredSpotType: "regular",
        priority: 2,
        reason: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user to waiting list.",
        variant: "error",
      });
    },
  });

  // Mutation for direct assignment
  const directAssignMutation = useMutation({
    mutationFn: async ({ spotId, assignmentData }: { spotId: string; assignmentData: typeof directAssignFormData }) => {
      return await apiRequest(`/api/admin/direct-assign`, {
        method: "POST",
        body: JSON.stringify({ spotId, ...assignmentData }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: "Spot assigned directly to user successfully.",
        variant: "success",
      });
      setShowDirectAssignDialog(false);
      setSelectedSpotForAssign(null);
      setDirectAssignFormData({
        userId: "",
        duration: "permanent",
        notes: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign spot directly.",
        variant: "error",
      });
    },
  });

  // Helper functions
  const handleEditSpot = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setEditFormData({
      spotNumber: spot.spotNumber,
      location: spot.location,
      spotType: spot.spotType,
      isIndoor: spot.isIndoor || false,
      isActive: spot.isActive !== false,
      isBookable: spot.isBookable !== false,
      description: spot.description || "",
      ownerId: spot.ownerId || null
    });
    setShowEditSpotDialog(true);
  };

  const handleDeleteSpot = async (spotId: string) => {
    const confirmed = await confirm(confirmations.deleteSpot);
    if (confirmed) {
      deleteSpotMutation.mutate(spotId);
    }
  };

  const handleAssignFromWaitingList = (waitingListItem: WaitingList) => {
    setSelectedWaitingListItem(waitingListItem.id);
    setShowAssignDialog(true);
  };

  const handleDirectAssign = (spot: ParkingSpot) => {
    setSelectedSpotForAssign(spot);
    setShowDirectAssignDialog(true);
  };

  const handleToggleSpotSelection = (spotId: string) => {
    const newSelectedSpots = new Set(selectedSpots);
    if (newSelectedSpots.has(spotId)) {
      newSelectedSpots.delete(spotId);
    } else {
      newSelectedSpots.add(spotId);
    }
    setSelectedSpots(newSelectedSpots);
    setIsSelectAllChecked(newSelectedSpots.size === allSpots.length);
  };

  const handleSelectAllSpots = () => {
    if (isSelectAllChecked) {
      setSelectedSpots(new Set());
      setIsSelectAllChecked(false);
    } else {
      setSelectedSpots(new Set(allSpots.map(spot => spot.id)));
      setIsSelectAllChecked(true);
    }
  };

  const filteredSpots = allSpots.filter(spot => {
    const matchesTab = activeSpotTab === "all" || 
                     (activeSpotTab === "unallocated" && !spot.ownerId) ||
                     (activeSpotTab === "allocated" && spot.ownerId);
    const matchesSearch = spot.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         spot.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || spot.spotType === filterType;
    return matchesTab && matchesSearch && matchesType;
  });

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="destructive" data-testid={`badge-priority-high`}>High</Badge>;
      case 2:
        return <Badge variant="secondary" data-testid={`badge-priority-medium`}>Medium</Badge>;
      case 3:
        return <Badge variant="outline" data-testid={`badge-priority-low`}>Low</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-priority-unknown`}>Unknown</Badge>;
    }
  };

  const getSpotTypeBadge = (spotType: SpotType) => {
    const variants: Record<SpotType, string> = {
      regular: "outline",
      electric: "secondary",
      tesla_ev: "secondary",
      accessible: "default",
      reserved: "destructive"
    };
    
    const labels: Record<SpotType, string> = {
      regular: "Regular",
      electric: "EV",
      tesla_ev: "Tesla EV",
      accessible: "Accessible",
      reserved: "Reserved"
    };
    
    return (
      <Badge variant={variants[spotType] as any} data-testid={`badge-spot-type-${spotType}`}>
        {labels[spotType]}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-8" data-testid="page-admin-parking-management">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Parking Management</h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive management of parking spots and waiting list assignments.
        </p>
      </div>

      {/* Enhanced Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-total-spots" className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{unallocatedSpots.length}</div>
                <div className="text-sm text-muted-foreground">Available Spots</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-waiting-users" className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{waitingListMetrics.active}</div>
                <div className="text-sm text-muted-foreground">Users Waiting</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-wait" className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg">
                <Timer className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{waitingListMetrics.averageWaitTime}</div>
                <div className="text-sm text-muted-foreground">Avg Wait Days</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-assignments" className="hover-elevate">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{waitingListMetrics.assigned}</div>
                <div className="text-sm text-muted-foreground">Total Assigned</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a detailed parking management interface. For the main admin overview, visit the admin dashboard.
        </AlertDescription>
      </Alert>

      {/* Main Management Tabs */}
      <Tabs defaultValue="parking-spots" className="space-y-4" data-testid="tabs-parking-management">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parking-spots" data-testid="tab-trigger-parking-spots" className="flex items-center gap-2 px-6 py-3">
            <Car className="w-4 h-4" />
            Parking Spots
          </TabsTrigger>
          <TabsTrigger value="waiting-list" data-testid="tab-trigger-waiting-list" className="flex items-center gap-2 px-6 py-3">
            <Users className="w-4 h-4" />
            Waiting List
          </TabsTrigger>
        </TabsList>

        {/* Parking Spots Tab */}
        <TabsContent value="parking-spots" className="space-y-4">
          <Card data-testid="card-parking-spots">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Parking Spots Management</span>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowAddSpotDialog(true)}
                    data-testid="button-add-spot"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Spot
                  </Button>
                  {selectedSpots.size > 0 && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => toggleSpotBookabilityMutation.mutate({ 
                          spotIds: Array.from(selectedSpots), 
                          isBookable: true 
                        })}
                        disabled={toggleSpotBookabilityMutation.isPending}
                        data-testid="button-enable-spots"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Enable ({selectedSpots.size})
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => toggleSpotBookabilityMutation.mutate({ 
                          spotIds: Array.from(selectedSpots), 
                          isBookable: false 
                        })}
                        disabled={toggleSpotBookabilityMutation.isPending}
                        data-testid="button-disable-spots"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Disable ({selectedSpots.size})
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <Input
                    placeholder="Search spots..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-spots"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40" data-testid="select-filter-type">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="ev">EV</SelectItem>
                      <SelectItem value="tesla_ev">Tesla EV</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Spot Sub-tabs */}
              <Tabs value={activeSpotTab} onValueChange={setActiveSpotTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all" data-testid="tab-trigger-all-spots">
                    All Spots ({allSpots.length})
                  </TabsTrigger>
                  <TabsTrigger value="unallocated" data-testid="tab-trigger-unallocated-spots">
                    Unallocated ({allSpots.filter(s => !s.ownerId).length})
                  </TabsTrigger>
                  <TabsTrigger value="allocated" data-testid="tab-trigger-allocated-spots">
                    Allocated ({allSpots.filter(s => s.ownerId).length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeSpotTab} className="mt-4">
                  {filteredSpots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="text-no-spots">
                      No parking spots found matching your criteria.
                    </div>
                  ) : (
                    <Table data-testid="table-parking-spots">
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Checkbox
                              checked={isSelectAllChecked}
                              onCheckedChange={handleSelectAllSpots}
                              data-testid="checkbox-select-all-spots"
                            />
                          </TableHead>
                          <TableHead>Spot Number</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSpots.map((spot) => (
                          <TableRow key={spot.id} data-testid={`row-spot-${spot.id}`}>
                            <TableCell>
                              <Checkbox
                                checked={selectedSpots.has(spot.id)}
                                onCheckedChange={() => handleToggleSpotSelection(spot.id)}
                                data-testid={`checkbox-spot-${spot.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`text-spot-number-${spot.id}`}>
                              {spot.spotNumber}
                            </TableCell>
                            <TableCell data-testid={`text-spot-location-${spot.id}`}>
                              {spot.location}
                              {spot.isIndoor && <Badge variant="outline" className="ml-2">Indoor</Badge>}
                            </TableCell>
                            <TableCell data-testid={`text-spot-type-${spot.id}`}>
                              {getSpotTypeBadge(spot.spotType)}
                            </TableCell>
                            <TableCell data-testid={`text-spot-status-${spot.id}`}>
                              <div className="flex gap-2">
                                {spot.isActive !== false ? (
                                  <Badge variant="secondary">Active</Badge>
                                ) : (
                                  <Badge variant="destructive">Inactive</Badge>
                                )}
                                {spot.isBookable !== false ? (
                                  <Badge variant="outline">Bookable</Badge>
                                ) : (
                                  <Badge variant="destructive">Disabled</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-spot-owner-${spot.id}`}>
                              {spot.ownerId ? (
                                <Badge variant="default">Assigned</Badge>
                              ) : (
                                <Badge variant="outline">Available</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditSpot(spot)}
                                  data-testid={`button-edit-spot-${spot.id}`}
                                >
                                  Edit
                                </Button>
                                {!spot.ownerId && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleDirectAssign(spot)}
                                    data-testid={`button-assign-spot-${spot.id}`}
                                  >
                                    Assign
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteSpot(spot.id)}
                                  data-testid={`button-delete-spot-${spot.id}`}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waiting List Tab */}
        <TabsContent value="waiting-list" className="space-y-4">
          <Card data-testid="card-waiting-list">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Waiting List Management</span>
                <Button 
                  onClick={() => setShowAddToWaitingDialog(true)}
                  data-testid="button-add-to-waiting"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Waiting List
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <Input
                    placeholder="Search waiting list..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-waiting"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40" data-testid="select-filter-waiting-type">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="ev">EV</SelectItem>
                      <SelectItem value="tesla_ev">Tesla EV</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Waiting List Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{waitingListMetrics.highPriority}</div>
                  <div className="text-sm text-muted-foreground">High Priority</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{waitingListMetrics.mediumPriority}</div>
                  <div className="text-sm text-muted-foreground">Medium Priority</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{waitingListMetrics.lowPriority}</div>
                  <div className="text-sm text-muted-foreground">Low Priority</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{waitingListMetrics.averageWaitTime}</div>
                  <div className="text-sm text-muted-foreground">Avg Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{waitingListMetrics.assigned}</div>
                  <div className="text-sm text-muted-foreground">Assigned</div>
                </div>
              </div>

              {isLoadingWaitingList ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredWaitingList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-waiting">
                  No waiting list entries found.
                </div>
              ) : (
                <Table data-testid="table-waiting-list">
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Preferred Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Waiting Days</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWaitingList.map((item) => {
                      const waitingDays = Math.floor((Date.now() - new Date(item.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <TableRow key={item.id} data-testid={`row-waiting-${item.id}`}>
                          <TableCell data-testid={`text-waiting-user-${item.id}`}>
                            <div>
                              <div className="font-medium">{item.userName}</div>
                              <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-waiting-priority-${item.id}`}>
                            {getPriorityBadge(item.priority)}
                          </TableCell>
                          <TableCell data-testid={`text-waiting-type-${item.id}`}>
                            {getSpotTypeBadge(item.preferredSpotType)}
                          </TableCell>
                          <TableCell data-testid={`text-waiting-status-${item.id}`}>
                            <Badge 
                              variant={item.status === "waiting" ? "secondary" : 
                                     item.status === "assigned" ? "default" : "destructive"}
                            >
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-waiting-enrolled-${item.id}`}>
                            {new Date(item.enrolledDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell data-testid={`text-waiting-days-${item.id}`}>
                            <Badge variant="outline">{waitingDays} days</Badge>
                          </TableCell>
                          <TableCell>
                            {item.status === "waiting" && (
                              <Button
                                size="sm"
                                onClick={() => handleAssignFromWaitingList(item)}
                                data-testid={`button-assign-waiting-${item.id}`}
                              >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Assign Spot
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Add Spot Dialog */}
      <Dialog open={showAddSpotDialog} onOpenChange={setShowAddSpotDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-add-spot">
          <DialogHeader>
            <DialogTitle>Add New Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Spot Number</label>
              <Input
                value={addSpotFormData.spotNumber}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, spotNumber: e.target.value }))}
                placeholder="e.g., A-101"
                data-testid="input-add-spot-number"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={addSpotFormData.location}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Level 1, Section A"
                data-testid="input-add-spot-location"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Spot Type</label>
              <Select 
                value={addSpotFormData.spotType} 
                onValueChange={(value: SpotType) => setAddSpotFormData(prev => ({ ...prev, spotType: value }))}
              >
                <SelectTrigger data-testid="select-add-spot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ev">EV</SelectItem>
                  <SelectItem value="tesla_ev">Tesla EV</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="indoor"
                checked={addSpotFormData.isIndoor}
                onCheckedChange={(checked) => setAddSpotFormData(prev => ({ ...prev, isIndoor: checked as boolean }))}
                data-testid="checkbox-add-spot-indoor"
              />
              <label htmlFor="indoor" className="text-sm font-medium">Indoor Spot</label>
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                value={addSpotFormData.description}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details..."
                data-testid="input-add-spot-description"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => addSpotMutation.mutate(addSpotFormData)}
                disabled={addSpotMutation.isPending || !addSpotFormData.spotNumber || !addSpotFormData.location}
                className="flex-1"
                data-testid="button-confirm-add-spot"
              >
                {addSpotMutation.isPending ? "Adding..." : "Add Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddSpotDialog(false)}
                className="flex-1"
                data-testid="button-cancel-add-spot"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpotDialog} onOpenChange={setShowEditSpotDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-spot">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Spot Number</label>
              <Input
                value={editFormData.spotNumber}
                onChange={(e) => setEditFormData(prev => ({ ...prev, spotNumber: e.target.value }))}
                data-testid="input-edit-spot-number"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={editFormData.location}
                onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                data-testid="input-edit-spot-location"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Spot Type</label>
              <Select 
                value={editFormData.spotType} 
                onValueChange={(value: SpotType) => setEditFormData(prev => ({ ...prev, spotType: value }))}
              >
                <SelectTrigger data-testid="select-edit-spot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ev">EV</SelectItem>
                  <SelectItem value="tesla_ev">Tesla EV</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-indoor"
                  checked={editFormData.isIndoor}
                  onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isIndoor: checked as boolean }))}
                  data-testid="checkbox-edit-spot-indoor"
                />
                <label htmlFor="edit-indoor" className="text-sm font-medium">Indoor</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-active"
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isActive: checked as boolean }))}
                  data-testid="checkbox-edit-spot-active"
                />
                <label htmlFor="edit-active" className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-bookable"
                checked={editFormData.isBookable}
                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isBookable: checked as boolean }))}
                data-testid="checkbox-edit-spot-bookable"
              />
              <label htmlFor="edit-bookable" className="text-sm font-medium">Bookable</label>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-edit-spot-description"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => selectedSpot && editSpotMutation.mutate({ 
                  spotId: selectedSpot.id, 
                  spotData: editFormData 
                })}
                disabled={editSpotMutation.isPending || !editFormData.spotNumber || !editFormData.location}
                className="flex-1"
                data-testid="button-confirm-edit-spot"
              >
                {editSpotMutation.isPending ? "Updating..." : "Update Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEditSpotDialog(false)}
                className="flex-1"
                data-testid="button-cancel-edit-spot"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Spot Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-assign-spot">
          <DialogHeader>
            <DialogTitle>Assign Spot from Waiting List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Available Spot</label>
              <Select 
                value={selectedSpotForAssign?.id || ""} 
                onValueChange={(spotId) => {
                  const spot = unallocatedSpots.find(s => s.id === spotId);
                  setSelectedSpotForAssign(spot || null);
                }}
              >
                <SelectTrigger data-testid="select-assign-spot">
                  <SelectValue placeholder="Choose a spot..." />
                </SelectTrigger>
                <SelectContent>
                  {unallocatedSpots.map((spot) => (
                    <SelectItem key={spot.id} value={spot.id}>
                      {spot.spotNumber} - {spot.location} ({getSpotTypeBadge(spot.spotType)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedWaitingListItem && selectedSpotForAssign && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Assignment Summary</h4>
                <div className="text-sm space-y-1">
                  <div>User: {filteredWaitingList.find(w => w.id === selectedWaitingListItem)?.userName}</div>
                  <div>Spot: {selectedSpotForAssign.spotNumber} - {selectedSpotForAssign.location}</div>
                  <div>Type: {getSpotTypeBadge(selectedSpotForAssign.spotType)}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  if (selectedWaitingListItem && selectedSpotForAssign) {
                    assignFromWaitingListMutation.mutate({
                      waitingListId: selectedWaitingListItem,
                      spotId: selectedSpotForAssign.id
                    });
                  }
                }}
                disabled={!selectedWaitingListItem || !selectedSpotForAssign || assignFromWaitingListMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-assign-spot"
              >
                {assignFromWaitingListMutation.isPending ? "Assigning..." : "Assign Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
                className="flex-1"
                data-testid="button-cancel-assign-spot"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Waiting List Dialog */}
      <Dialog open={showAddToWaitingDialog} onOpenChange={setShowAddToWaitingDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-add-waiting">
          <DialogHeader>
            <DialogTitle>Add User to Waiting List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select User</label>
              {usersError ? (
                <div className="text-sm text-red-600">Error loading users. Please try again.</div>
              ) : isLoadingUsers ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select 
                  value={waitingListFormData.userId} 
                  onValueChange={(userId) => setWaitingListFormData(prev => ({ ...prev, userId }))}
                >
                  <SelectTrigger data-testid="select-waiting-user">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Preferred Spot Type</label>
              <Select 
                value={waitingListFormData.preferredSpotType} 
                onValueChange={(value: SpotType) => setWaitingListFormData(prev => ({ ...prev, preferredSpotType: value }))}
              >
                <SelectTrigger data-testid="select-waiting-spot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ev">EV</SelectItem>
                  <SelectItem value="tesla_ev">Tesla EV</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select 
                value={waitingListFormData.priority.toString()} 
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, priority: parseInt(value) }))}
              >
                <SelectTrigger data-testid="select-waiting-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">High Priority</SelectItem>
                  <SelectItem value="2">Medium Priority</SelectItem>
                  <SelectItem value="3">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason (Optional)</label>
              <Input
                value={waitingListFormData.reason}
                onChange={(e) => setWaitingListFormData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for waiting list placement..."
                data-testid="input-waiting-reason"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => addToWaitingListMutation.mutate(waitingListFormData)}
                disabled={addToWaitingListMutation.isPending || !waitingListFormData.userId}
                className="flex-1"
                data-testid="button-confirm-add-waiting"
              >
                {addToWaitingListMutation.isPending ? "Adding..." : "Add to Waiting List"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddToWaitingDialog(false)}
                className="flex-1"
                data-testid="button-cancel-add-waiting"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Assignment Dialog */}
      <Dialog open={showDirectAssignDialog} onOpenChange={setShowDirectAssignDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-direct-assign">
          <DialogHeader>
            <DialogTitle>Direct Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSpotForAssign && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Spot Details</h4>
                <div className="text-sm space-y-1">
                  <div>Spot: {selectedSpotForAssign.spotNumber}</div>
                  <div>Location: {selectedSpotForAssign.location}</div>
                  <div>Type: {getSpotTypeBadge(selectedSpotForAssign.spotType)}</div>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Select User</label>
              {usersError ? (
                <div className="text-sm text-red-600">Error loading users. Please try again.</div>
              ) : isLoadingUsers ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select 
                  value={directAssignFormData.userId} 
                  onValueChange={(userId) => setDirectAssignFormData(prev => ({ ...prev, userId }))}
                >
                  <SelectTrigger data-testid="select-direct-assign-user">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Duration</label>
              <Select 
                value={directAssignFormData.duration} 
                onValueChange={(value) => setDirectAssignFormData(prev => ({ ...prev, duration: value }))}
              >
                <SelectTrigger data-testid="select-direct-assign-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="1_month">1 Month</SelectItem>
                  <SelectItem value="3_months">3 Months</SelectItem>
                  <SelectItem value="6_months">6 Months</SelectItem>
                  <SelectItem value="1_year">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Input
                value={directAssignFormData.notes}
                onChange={(e) => setDirectAssignFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Assignment notes..."
                data-testid="input-direct-assign-notes"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  if (selectedSpotForAssign) {
                    directAssignMutation.mutate({
                      spotId: selectedSpotForAssign.id,
                      assignmentData: directAssignFormData
                    });
                  }
                }}
                disabled={directAssignMutation.isPending || !directAssignFormData.userId || !selectedSpotForAssign}
                className="flex-1"
                data-testid="button-confirm-direct-assign"
              >
                {directAssignMutation.isPending ? "Assigning..." : "Assign Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDirectAssignDialog(false)}
                className="flex-1"
                data-testid="button-cancel-direct-assign"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}