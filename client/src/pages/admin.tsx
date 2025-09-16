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

// Use ParkingSpot from schema directly

export default function Admin() {
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

  // Fetch recent assignments for the new tab
  const { data: recentAssignments = [], isLoading: isLoadingRecentAssignments } = useQuery({
    queryKey: ["/api/admin/recent-assignments"],
  });

  // Remove all mock data - use server data only

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
      : 0,
    recentAssignments: allWaitingList?.filter(entry => {
      if (!entry.assignedDate) return false;
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return new Date(entry.assignedDate).getTime() > thirtyDaysAgo;
    }).length || 0
  };

  // Filter waiting list - show all waiting list entries, not just active
  const filteredWaitingList = allWaitingList?.filter(item => {
    const matchesSearch = item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || item.preferredSpotType === filterType
    return matchesSearch && matchesType
  }) || []

  // Assignment mutation
  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ waitingListId, spotId, spotDetails }: { 
      waitingListId: string; 
      spotId: string; 
      spotDetails: { spotNumber: string; location: string; building: string }
    }) => {
      const response = await apiRequest("POST", `/api/waiting-list/${waitingListId}/assign`, {
        spotId,
        spotDetails
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      
      toast({
        title: "Assignment Successful",
        description: `User has been assigned to the parking spot. ${data.notificationsSent?.emailSent ? 'Email notification sent.' : ''} Please remember to notify HR/Payroll to set up automatic salary deduction for parking fees.`,
        variant: "default"
      });
      
      setShowAssignDialog(false);
      setSelectedWaitingListItem(null);
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign user. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAssignSpot = (waitingListId: string, spotId: string) => {
    const spot = unallocatedSpots.find(s => s.id === spotId);
    if (!spot) return;
    
    assignFromWaitingListMutation.mutate({
      waitingListId,
      spotId,
      spotDetails: {
        spotNumber: spot.spotNumber,
        location: spot.location,
        building: spot.location
      }
    });
  }

  // Admin spot deletion mutation
  const deleteSpotMutation = useMutation({
    mutationFn: async (spotId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/spots/${spotId}`);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      
      toast({
        title: "Spot Deleted",
        description: "Parking spot has been removed from the system.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete parking spot. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDeleteSpot = async (spotId: string) => {
    const spot = allSpots.find(s => s.id === spotId);
    const confirmed = await confirm(confirmations.deleteSpot(spot?.spotNumber || 'Unknown'));
    if (confirmed) {
      deleteSpotMutation.mutate(spotId);
    }
  }

  // Admin spot creation mutation
  const addSpotMutation = useMutation({
    mutationFn: async (data: typeof addSpotFormData) => {
      const response = await apiRequest("POST", "/api/admin/spots", {
        ...data,
        isActive: true,
        isBookable: true,
        ownerId: null // Admin creates unallocated spots
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      
      setShowAddSpotDialog(false);
      // Reset form
      setAddSpotFormData({
        spotNumber: "",
        location: "",
        spotType: "regular" as SpotType,
        isIndoor: false,
        description: ""
      });
      
      toast({
        title: "Spot Created",
        description: `Parking spot ${data.spotNumber} has been successfully added to the system.`,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create parking spot. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAddSpot = () => {
    // Validate form
    if (!addSpotFormData.spotNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Spot number is required.",
        variant: "destructive"
      });
      return;
    }
    
    if (!addSpotFormData.location.trim()) {
      toast({
        title: "Validation Error",
        description: "Building/location is required.",
        variant: "destructive"
      });
      return;
    }
    
    addSpotMutation.mutate(addSpotFormData);
  }

  // Admin spot edit mutation
  const editSpotMutation = useMutation({
    mutationFn: async ({ spotId, data }: { spotId: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/spots/${spotId}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      
      setShowEditSpotDialog(false);
      setSelectedSpot(null);
      toast({
        title: "Spot Updated",
        description: "Parking spot details have been updated.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update parking spot. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleEditSpot = () => {
    if (!selectedSpot) return;
    
    // Use the actual form data from the edit dialog
    editSpotMutation.mutate({ 
      spotId: selectedSpot.id, 
      data: editFormData 
    });
  }

  // Bookability toggle mutations
  const toggleBookabilityMutation = useMutation({
    mutationFn: async ({ spotId, isBookable }: { spotId: string; isBookable: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/spots/toggle-bookability", {
        spotId,
        isBookable
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      
      toast({
        title: "Bookability Updated",
        description: data.message || "Spot bookability has been updated.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update spot bookability.",
        variant: "destructive"
      });
    }
  });

  const bulkToggleBookabilityMutation = useMutation({
    mutationFn: async ({ spotIds, isBookable }: { spotIds: string[]; isBookable: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/spots/bulk-toggle-bookability", {
        spotIds,
        isBookable
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      
      // Clear selection after successful bulk operation
      setSelectedSpots(new Set());
      setIsSelectAllChecked(false);
      
      toast({
        title: "Bulk Update Successful",
        description: data.message || `Updated ${data.count} spots.`,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Bulk Update Failed",
        description: error instanceof Error ? error.message : "Failed to update spot bookability.",
        variant: "destructive"
      });
    }
  });

  // Bookability control handlers
  const handleToggleSpotBookability = async (spotId: string, currentBookable: boolean) => {
    const spot = unallocatedSpots.find(s => s.id === spotId);
    const newBookableState = !currentBookable;
    
    const confirmed = await confirm({
      title: `${newBookableState ? 'Enable' : 'Disable'} Bookability`,
      description: `Are you sure you want to ${newBookableState ? 'enable' : 'disable'} bookability for spot ${spot?.spotNumber}? ${newBookableState ? 'Users will be able to book this spot.' : 'Users will no longer be able to book this spot.'}`,
      confirmText: newBookableState ? 'Enable' : 'Disable',
    });
    
    if (confirmed) {
      toggleBookabilityMutation.mutate({ spotId, isBookable: newBookableState });
    }
  }

  const handleBulkToggleBookability = async (isBookable: boolean) => {
    const selectedSpotIds = Array.from(selectedSpots);
    if (selectedSpotIds.length === 0) {
      toast({
        title: "No Spots Selected",
        description: "Please select spots to update.",
        variant: "destructive"
      });
      return;
    }

    const confirmed = await confirm({
      title: `${isBookable ? 'Enable' : 'Disable'} Bookability for ${selectedSpotIds.length} Spots`,
      description: `Are you sure you want to ${isBookable ? 'enable' : 'disable'} bookability for ${selectedSpotIds.length} selected spots?`,
      confirmText: `${isBookable ? 'Enable' : 'Disable'} All`,
    });
    
    if (confirmed) {
      bulkToggleBookabilityMutation.mutate({ spotIds: selectedSpotIds, isBookable });
    }
  }

  const handleSpotSelection = (spotId: string, checked: boolean) => {
    const newSelectedSpots = new Set(selectedSpots);
    if (checked) {
      newSelectedSpots.add(spotId);
    } else {
      newSelectedSpots.delete(spotId);
    }
    setSelectedSpots(newSelectedSpots);
    
    // Update select all checkbox state
    setIsSelectAllChecked(newSelectedSpots.size === unallocatedSpots.length);
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSpots(new Set(unallocatedSpots.map(spot => spot.id)));
    } else {
      setSelectedSpots(new Set());
    }
    setIsSelectAllChecked(checked);
  }
  
  // Initialize form data when spot is selected for editing
  const handleOpenEditDialog = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
    setEditFormData({
      spotNumber: spot.spotNumber,
      location: spot.location,
      spotType: spot.spotType,
      isIndoor: spot.isIndoor,
      isActive: spot.isActive,
      isBookable: spot.isBookable,
      description: spot.description || "",
      ownerId: spot.ownerId
    });
    setShowEditSpotDialog(true);
  }

  // Add to waiting list mutation
  const addToWaitingListMutation = useMutation({
    mutationFn: async (data: typeof waitingListFormData) => {
      const response = await apiRequest("POST", "/api/waiting-list", {
        userId: data.userId,
        preferredSpotType: data.preferredSpotType,
        priority: data.priority,
        reason: data.reason,
        enrolledBy: "admin"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      
      setShowAddToWaitingDialog(false);
      setWaitingListFormData({
        userId: "",
        preferredSpotType: "regular" as SpotType,
        priority: 2,
        reason: ""
      });
      
      toast({
        title: "User Added to Waiting List",
        description: "User has been successfully added to the waiting list.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add User",
        description: error instanceof Error ? error.message : "Failed to add user to waiting list.",
        variant: "destructive"
      });
    }
  });

  const handleAddToWaitingList = () => {
    if (!waitingListFormData.userId) {
      toast({
        title: "No User Selected",
        description: "Please select a user from the dropdown.",
        variant: "destructive"
      });
      return;
    }
    
    if (!waitingListFormData.reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the waiting list request.",
        variant: "destructive"
      });
      return;
    }
    
    addToWaitingListMutation.mutate(waitingListFormData);
  }

  const handleDirectAssign = () => {
    if (!selectedUserForAssign) {
      toast({
        title: "No User Selected",
        description: "Please select a user from the dropdown.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('Direct assign spot:', selectedSpotForAssign, 'to user:', selectedUserForAssign);
    setShowDirectAssignDialog(false);
    setSelectedSpotForAssign(null);
    setSelectedUserForAssign("");
    toast({
      title: "Spot Assigned",
      description: "Parking spot has been assigned to the user. Please remember to notify HR/Payroll to set up automatic salary deduction for parking fees.",
      variant: "default"
    });
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin">
      <div>
        <h1 className="text-3xl font-bold">Parking Management</h1>
        <p className="text-muted-foreground">
          Manage parking spots, waiting list, and system settings.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-spots">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{unallocatedSpots.length}</div>
            <div className="text-sm text-muted-foreground">Available Spots</div>
          </CardContent>
        </Card>
        <Card data-testid="card-waiting-users">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{waitingListMetrics.active}</div>
            <div className="text-sm text-muted-foreground">Users Waiting</div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-wait">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{waitingListMetrics.averageWaitTime}</div>
            <div className="text-sm text-muted-foreground">Avg Wait Days</div>
          </CardContent>
        </Card>
        <Card data-testid="card-assignments">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{waitingListMetrics.recentAssignments}</div>
            <div className="text-sm text-muted-foreground">Recent Assignments</div>
          </CardContent>
        </Card>
      </div>

      {/* Parking Management */}
      <Tabs defaultValue="all-spots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-spots" data-testid="tab-all-spots">
            <Building className="h-4 w-4 mr-2" />
            All Spots ({allSpots.length})
          </TabsTrigger>
          <TabsTrigger value="waiting-list" data-testid="tab-waiting-list">
            <ListOrdered className="h-4 w-4 mr-2" />
            Waiting List ({waitingListMetrics.active})
          </TabsTrigger>
          <TabsTrigger value="spots" data-testid="tab-spots">
            <Car className="h-4 w-4 mr-2" />
            Available Spots ({unallocatedSpots.length})
          </TabsTrigger>
          <TabsTrigger value="recent-assignments" data-testid="tab-recent-assignments">
            <CalendarDays className="h-4 w-4 mr-2" />
            Recent Assignments ({recentAssignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting-list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Waiting List Management</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
                      toast({ title: "Refreshed", description: "Waiting list data updated." });
                    }}
                    data-testid="button-refresh-waiting-list"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={() => setShowAddToWaitingDialog(true)}
                    data-testid="button-add-to-waiting"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add to Waiting List
                  </Button>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search-waiting"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40" data-testid="select-filter-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingWaitingList ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Preferred Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Wait Time</TableHead>
                      <TableHead>Enrolled By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWaitingList.length > 0 ? filteredWaitingList.map((item) => {
                      const waitDays = Math.floor((Date.now() - new Date(item.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <TableRow key={item.id} data-testid={`row-waiting-${item.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.userName}</div>
                              <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.userDepartment}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.preferredSpotType === "electric" && <Zap className="h-4 w-4" />}
                              {item.preferredSpotType === "accessible" && <Accessibility className="h-4 w-4" />}
                              {item.preferredSpotType === "regular" && <Car className="h-4 w-4" />}
                              <span className="capitalize">{item.preferredSpotType}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.priority === 1 ? "destructive" : item.priority === 2 ? "secondary" : "outline"}
                              data-testid={`badge-priority-${item.priority === 1 ? 'high' : item.priority === 2 ? 'medium' : 'low'}`}
                            >
                              {item.priority === 1 ? 'High' : item.priority === 2 ? 'Medium' : 'Low'}
                            </Badge>
                          </TableCell>
                          <TableCell>{waitDays} days</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.enrolledBy === "self" ? "Profile" : item.enrolledBy}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedWaitingListItem(item.id);
                                setShowAssignDialog(true);
                              }}
                              data-testid={`button-assign-${item.id}`}
                            >
                              Assign Spot
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users in waiting list
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spots" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available Parking Spots</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
                      toast({ title: "Refreshed", description: "Available spots updated." });
                    }}
                    data-testid="button-refresh-available-spots"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  {selectedSpots.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950"
                        onClick={() => handleBulkToggleBookability(true)}
                        disabled={bulkToggleBookabilityMutation.isPending}
                        data-testid="button-bulk-enable-bookability"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Enable Booking ({selectedSpots.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                        onClick={() => handleBulkToggleBookability(false)}
                        disabled={bulkToggleBookabilityMutation.isPending}
                        data-testid="button-bulk-disable-bookability"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Disable Booking ({selectedSpots.size})
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {unallocatedSpots.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-spots"
                      checked={isSelectAllChecked}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all-spots"
                    />
                    <label htmlFor="select-all-spots" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Select All ({unallocatedSpots.length} spots)
                    </label>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedSpots.size} of {unallocatedSpots.length} selected
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unallocatedSpots
                  .map((spot) => (
                  <Card key={spot.id} className="p-4" data-testid={`card-spot-${spot.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedSpots.has(spot.id)}
                          onCheckedChange={(checked) => handleSpotSelection(spot.id, checked as boolean)}
                          data-testid={`checkbox-spot-${spot.id}`}
                        />
                        <div className="font-semibold">{spot.spotNumber}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">Available</Badge>
                        <Badge variant={spot.isBookable ? "default" : "secondary"} className="text-xs">
                          {spot.isBookable ? "Bookable" : "Not Bookable"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {spot.location}
                      </div>
                      <div className="flex items-center gap-1">
                        {spot.spotType === "electric" && <Zap className="h-3 w-3" />}
                        {spot.spotType === "accessible" && <Accessibility className="h-3 w-3" />}
                        {spot.spotType === "regular" && <Car className="h-3 w-3" />}
                        <span className="capitalize">{spot.spotType}</span>
                      </div>
                      <div className="text-xs">
                        {spot.ownerId ? `Assigned` : "Unallocated"}
                      </div>
                      <div className="text-xs font-medium">
                        Available for Assignment
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`flex-1 ${
                            spot.isBookable 
                              ? "border-red-500 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                              : "border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-950"
                          }`}
                          onClick={() => handleToggleSpotBookability(spot.id, spot.isBookable)}
                          disabled={toggleBookabilityMutation.isPending}
                          data-testid={`button-toggle-bookability-${spot.id}`}
                        >
                          {spot.isBookable ? "Disable Booking" : "Enable Booking"}
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedSpotForAssign(spot);
                          setShowDirectAssignDialog(true);
                        }}
                        data-testid={`button-assign-spot-${spot.id}`}
                      >
                        Assign to User
                      </Button>
                    </div>
                  </Card>
                ))}
                {unallocatedSpots.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No available parking spots at the moment
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-spots" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Parking Spots Management</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
                      toast({ title: "Refreshed", description: "All spots data updated." });
                    }}
                    data-testid="button-refresh-all-spots"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={() => setShowAddSpotDialog(true)}
                    data-testid="button-add-spot"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Spot
                  </Button>
                </div>
              </div>
              <div className="flex gap-4">
                <Select value={activeSpotTab} onValueChange={setActiveSpotTab}>
                  <SelectTrigger className="w-40" data-testid="select-spot-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Spots</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spot Number</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSpots
                    .filter(spot => {
                      if (activeSpotTab === "all") return true;
                      if (activeSpotTab === "available") return !spot.ownerId;
                      if (activeSpotTab === "occupied") return !!spot.ownerId;
                      return spot.isActive; // for maintenance, show active spots
                    })
                    .map((spot) => (
                      <TableRow key={spot.id} data-testid={`row-spot-${spot.id}`}>
                        <TableCell className="font-medium">{spot.spotNumber}</TableCell>
                        <TableCell>{spot.location}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {spot.spotType === "electric" && <Zap className="h-4 w-4 text-yellow-500" />}
                            {spot.spotType === "accessible" && <Accessibility className="h-4 w-4 text-blue-500" />}
                            {spot.spotType === "regular" && <Car className="h-4 w-4 text-gray-500" />}
                            <span className="capitalize">{spot.spotType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              !spot.ownerId ? "default" : 
                              spot.ownerId ? "secondary" : "destructive"
                            }
                            data-testid={`badge-status-${spot.ownerId ? 'occupied' : 'available'}`}
                          >
                            {!spot.ownerId ? "Available" : "Occupied"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {spot.ownerId ? (
                            <div>
                              <div className="font-medium">Assigned</div>
                              <div className="text-xs text-muted-foreground">ID: {spot.ownerId.substring(0, 8)}...</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unallocated</span>
                          )}
                        </TableCell>
                        <TableCell>{spot.isActive ? "Active" : "Inactive"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditDialog(spot)}
                              data-testid={`button-edit-${spot.id}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSpot(spot.id)}
                              data-testid={`button-delete-${spot.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Assignments (Last 7 Days)</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-assignments"] });
                    toast({ title: "Refreshed", description: "Recent assignments updated." });
                  }}
                  data-testid="button-refresh-recent-assignments"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRecentAssignments ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Spot</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Spot Type</TableHead>
                      <TableHead>Assignment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(recentAssignments) && recentAssignments.length > 0 ? recentAssignments.map((assignment: any) => (
                      <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <div>{assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString() : 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">
                              {assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleTimeString() : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">{assignment.userName}</div>
                            <div className="text-xs text-muted-foreground">{assignment.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>{assignment.userDepartment}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {assignment.spotDetails?.spotNumber || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {assignment.spotDetails?.location || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {assignment.spotDetails?.spotType === "electric" && <Zap className="h-3 w-3 text-yellow-500" />}
                            {assignment.spotDetails?.spotType === "accessible" && <Accessibility className="h-3 w-3 text-blue-500" />}
                            {assignment.spotDetails?.spotType === "regular" && <Car className="h-3 w-3 text-gray-500" />}
                            <span className="capitalize">{assignment.spotDetails?.spotType || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.enrolledBy === 'admin' ? 'default' : 'secondary'}>
                            {assignment.enrolledBy === 'admin' ? 'Admin Assignment' : 'Waiting List'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No recent assignments in the last 7 days
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select an available parking spot to assign to the selected user.
            </p>
            <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800" data-testid="alert-payroll-notification">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription>
                <strong>IMPORTANT:</strong> Please ensure that HR/Payroll is notified to set up automatic payroll deduction for parking fees from the assigned employee's salary.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unallocatedSpots.map((spot) => (
                <Button
                  key={spot.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => selectedWaitingListItem && handleAssignSpot(selectedWaitingListItem, spot.id)}
                  disabled={assignFromWaitingListMutation.isPending}
                  data-testid={`button-select-spot-${spot.id}`}
                >
                  <div className="flex items-center gap-2">
                    {spot.spotType === "electric" && <Zap className="h-4 w-4" />}
                    {spot.spotType === "accessible" && <Accessibility className="h-4 w-4" />}
                    {spot.spotType === "regular" && <Car className="h-4 w-4" />}
                    <span>{spot.spotNumber}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {spot.location}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Spot Dialog */}
      <Dialog open={showAddSpotDialog} onOpenChange={setShowAddSpotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Spot Number *</label>
              <Input 
                placeholder="e.g., A-301" 
                value={addSpotFormData.spotNumber}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, spotNumber: e.target.value }))}
                data-testid="input-spot-number" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Building/Location *</label>
              <Input 
                placeholder="e.g., Building A, Floor 3" 
                value={addSpotFormData.location}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, location: e.target.value }))}
                data-testid="input-location" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spot Type</label>
              <Select 
                value={addSpotFormData.spotType}
                onValueChange={(value) => setAddSpotFormData(prev => ({ ...prev, spotType: value as SpotType }))}
              >
                <SelectTrigger data-testid="select-spot-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Indoor/Outdoor</label>
              <Select 
                value={addSpotFormData.isIndoor ? "true" : "false"}
                onValueChange={(value) => setAddSpotFormData(prev => ({ ...prev, isIndoor: value === "true" }))}
              >
                <SelectTrigger data-testid="select-indoor">
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Outdoor</SelectItem>
                  <SelectItem value="true">Indoor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input 
                placeholder="Additional details about the spot" 
                value={addSpotFormData.description}
                onChange={(e) => setAddSpotFormData(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-description" 
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleAddSpot} 
                className="flex-1" 
                disabled={addSpotMutation.isPending}
                data-testid="button-save-spot"
              >
                {addSpotMutation.isPending ? "Creating..." : "Add Spot"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddSpotDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpotDialog} onOpenChange={setShowEditSpotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Spot Number</label>
                <Input 
                  value={editFormData.spotNumber} 
                  onChange={(e) => setEditFormData(prev => ({ ...prev, spotNumber: e.target.value }))} 
                  data-testid="input-edit-spot-number" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input 
                  value={editFormData.location} 
                  onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))} 
                  data-testid="input-edit-location" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Spot Type</label>
                <Select 
                  value={editFormData.spotType} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, spotType: value as SpotType }))}
                >
                  <SelectTrigger data-testid="select-edit-spot-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Indoor Spot</label>
                <Select 
                  value={editFormData.isIndoor ? "true" : "false"} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, isIndoor: value === "true" }))}
                >
                  <SelectTrigger data-testid="select-edit-indoor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Indoor</SelectItem>
                    <SelectItem value="false">Outdoor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Active Status</label>
                <Select 
                  value={editFormData.isActive ? "true" : "false"} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, isActive: value === "true" }))}
                >
                  <SelectTrigger data-testid="select-edit-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input 
                  value={editFormData.description} 
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))} 
                  data-testid="input-edit-description" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Owner Assignment</label>
                <div className="flex items-center gap-2">
                  <Badge variant={editFormData.ownerId ? "secondary" : "default"}>
                    {editFormData.ownerId ? "Assigned" : "Unallocated"}
                  </Badge>
                  {editFormData.ownerId && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setEditFormData(prev => ({ ...prev, ownerId: null }))}
                      data-testid="button-mark-unallocated"
                    >
                      Mark as Unallocated
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {editFormData.ownerId ? "This spot is assigned to a user. Click 'Mark as Unallocated' to make it available for waiting list assignment." : "This spot is unallocated and will appear in the Available Spots tab."}
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleEditSpot} className="flex-1" data-testid="button-save-edit-spot">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setShowEditSpotDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Waiting List Dialog */}
      <Dialog open={showAddToWaitingDialog} onOpenChange={setShowAddToWaitingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User to Waiting List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select 
                value={waitingListFormData.userId} 
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, userId: value }))}
              >
                <SelectTrigger data-testid="select-user-waiting">
                  <SelectValue placeholder="Search and select user..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingUsers ? (
                    <SelectItem value="loading" disabled>Loading users...</SelectItem>
                  ) : usersError ? (
                    <SelectItem value="error" disabled>Error loading users</SelectItem>
                  ) : allUsers.length === 0 ? (
                    <SelectItem value="empty" disabled>No users found</SelectItem>
                  ) : (
                    allUsers.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email} • {user.department}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred Spot Type</label>
              <Select 
                value={waitingListFormData.preferredSpotType}
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, preferredSpotType: value as SpotType }))}
              >
                <SelectTrigger data-testid="select-preferred-type">
                  <SelectValue placeholder="Select preferred type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select 
                value={waitingListFormData.priority.toString()}
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, priority: parseInt(value) }))}
              >
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">High</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason *</label>
              <Input 
                placeholder="Reason for waiting list request" 
                value={waitingListFormData.reason}
                onChange={(e) => setWaitingListFormData(prev => ({ ...prev, reason: e.target.value }))}
                data-testid="input-reason" 
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleAddToWaitingList} 
                className="flex-1" 
                disabled={addToWaitingListMutation.isPending}
                data-testid="button-add-to-waiting"
              >
                {addToWaitingListMutation.isPending ? "Adding..." : "Add to List"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddToWaitingDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Assign Spot Dialog */}
      <Dialog open={showDirectAssignDialog} onOpenChange={setShowDirectAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Spot to User</DialogTitle>
          </DialogHeader>
          {selectedSpotForAssign && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Spot: {selectedSpotForAssign.spotNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedSpotForAssign.location} • {selectedSpotForAssign.spotType} • {selectedSpotForAssign.isIndoor ? 'Indoor' : 'Outdoor'}
                </div>
              </div>
              <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800" data-testid="alert-payroll-notification-direct">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription>
                  <strong>IMPORTANT:</strong> Please ensure that HR/Payroll is notified to set up automatic payroll deduction for parking fees from the assigned employee's salary.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select User</label>
                <Select value={selectedUserForAssign} onValueChange={setSelectedUserForAssign}>
                  <SelectTrigger data-testid="select-user-assign">
                    <SelectValue placeholder="Search and select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingUsers ? (
                      <SelectItem value="loading" disabled>Loading users...</SelectItem>
                    ) : usersError ? (
                      <SelectItem value="error" disabled>Error loading users</SelectItem>
                    ) : allUsers.length === 0 ? (
                      <SelectItem value="empty" disabled>No users found</SelectItem>
                    ) : (
                      allUsers.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email} • {user.department}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignment Duration</label>
                <Select>
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent Assignment</SelectItem>
                    <SelectItem value="temporary">Temporary (30 days)</SelectItem>
                    <SelectItem value="trial">Trial Period (7 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input placeholder="Assignment notes" data-testid="input-assign-notes" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleDirectAssign} className="flex-1" data-testid="button-confirm-assign">
                  Assign Spot
                </Button>
                <Button variant="outline" onClick={() => setShowDirectAssignDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}