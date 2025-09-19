import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
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
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays, UserPlus, ArrowRight,
  Timer, Target, CheckCircle2, Search, Filter,
  Zap, Accessibility, Building, MoreHorizontal, Info, RefreshCw,
  Trash2, Edit, UserMinus, UserCheck, Download, FileText,
  Eye, EyeOff
} from "lucide-react"
import type { WaitingList, ParkingSpot, ParkingSpotWithUser, SpotType } from "@shared/schema"
import { quickExportParkingSpotsPDF, quickExportParkingSpotsExcel } from "@/utils/export-utils"

export default function AdminParkingManagement() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAddSpotDialog, setShowAddSpotDialog] = useState(false)
  const [showEditSpotDialog, setShowEditSpotDialog] = useState(false)
  const [showAddToWaitingDialog, setShowAddToWaitingDialog] = useState(false)
  const [showDirectAssignDialog, setShowDirectAssignDialog] = useState(false)
  const [showReleaseSpotDialog, setShowReleaseSpotDialog] = useState(false)
  const [showAssignAvailableSpotDialog, setShowAssignAvailableSpotDialog] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotWithUser | null>(null)
  const [selectedSpotForAssign, setSelectedSpotForAssign] = useState<ParkingSpotWithUser | null>(null)
  const [selectedSpotForRelease, setSelectedSpotForRelease] = useState<ParkingSpotWithUser | null>(null)
  const [selectedAvailableSpot, setSelectedAvailableSpot] = useState<ParkingSpotWithUser | null>(null)
  const [selectedUserForWaiting, setSelectedUserForWaiting] = useState("")
  const [selectedUserForAssign, setSelectedUserForAssign] = useState("")
  const [selectedUserForAvailableSpot, setSelectedUserForAvailableSpot] = useState("")
  const [activeSpotTab, setActiveSpotTab] = useState("all")
  const [unallocatedFilterType, setUnallocatedFilterType] = useState("all")
  
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
  
  // Cards visibility hook
  const { cardsVisible, toggleCards } = useCardsVisibility("parking-management")
  
  // Refresh all data handler
  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] })
    queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] })
    queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
  }

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
  const { data: unallocatedSpots = [] } = useQuery<ParkingSpotWithUser[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  });

  // Fetch all spots (allocated + unallocated) for comprehensive admin view
  const { data: allSpots = [] } = useQuery<ParkingSpotWithUser[]>({
    queryKey: ["/api/admin/all-spots"],
  });

  // Fetch all users for dropdown selection
  const { data: allUsers = [], isLoading: isLoadingUsers, error: usersError } = useQuery<any[]>({
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
    const matchesType = unallocatedFilterType === "all" || item.preferredSpotType === unallocatedFilterType
    return matchesSearch && matchesType
  }) || []

  // Mutation to assign a spot from the waiting list
  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ waitingListId, spotId }: { waitingListId: string; spotId: string }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { waitingListId, spotId },
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

  // Mutation to remove from waiting list
  const removeFromWaitingListMutation = useMutation({
    mutationFn: async (waitingListId: string) => {
      return await apiRequest(`/api/admin/waiting-list/${waitingListId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      toast({
        title: "Success",
        description: "User removed from waiting list successfully.",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user from waiting list.",
        variant: "error",
      });
    },
  });

  // Mutation to toggle spot bookability
  const toggleSpotBookabilityMutation = useMutation({
    mutationFn: async ({ spotIds, isBookable }: { spotIds: string[]; isBookable: boolean }) => {
      return await apiRequest(`/api/admin/toggle-spot-bookability`, {
        method: "PATCH",
        body: { spotIds, isBookable },
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
        body: spotData,
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
        body: spotData,
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
        body: waitingData,
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
        body: { spotId, ...assignmentData },
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

  // Mutation to release spot (make available)
  const releaseSpotMutation = useMutation({
    mutationFn: async (spotId: string) => {
      return await apiRequest(`/api/admin/spots/${spotId}`, {
        method: "PUT",
        body: { ownerId: null },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      const spotNumber = selectedSpotForRelease?.spotNumber || 'Unknown';
      toast({
        title: "Success",
        description: `Spot ${spotNumber} has been released and is now available.`,
        variant: "success",
      });
      setShowReleaseSpotDialog(false);
      setSelectedSpotForRelease(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to release parking spot.",
        variant: "error",
      });
    },
  });

  // Mutation to assign available spot to user
  const assignAvailableSpotMutation = useMutation({
    mutationFn: async ({ spotId, userId }: { spotId: string; userId: string }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { spotId, userId },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      // Also invalidate waiting list queries since user may have been removed from waiting list
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      const userName = allUsers.find(user => user.id === selectedUserForAvailableSpot)?.name || "user";
      const spotNumber = selectedAvailableSpot?.spotNumber || 'Unknown';
      toast({
        title: "Success",
        description: `Spot ${spotNumber} has been assigned to ${userName}.`,
        variant: "success",
      });
      setShowAssignAvailableSpotDialog(false);
      setSelectedAvailableSpot(null);
      setSelectedUserForAvailableSpot("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign parking spot.",
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
    const spot = allSpots.find(s => s.id === spotId);
    const confirmed = await confirm(confirmations.deleteSpot(spot?.spotNumber || 'Unknown Spot'));
    if (confirmed) {
      deleteSpotMutation.mutate(spotId);
    }
  };

  const handleAssignFromWaitingList = (waitingListItem: WaitingList) => {
    setSelectedWaitingListItem(waitingListItem.id);
    setShowAssignDialog(true);
  };

  const handleRemoveFromWaitingList = async (waitingListItem: WaitingList) => {
    const confirmed = await confirm({
      title: "Remove from Waiting List",
      description: `Are you sure you want to remove ${waitingListItem.userName} from the waiting list? This action cannot be undone.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive"
    });
    
    if (confirmed) {
      removeFromWaitingListMutation.mutate(waitingListItem.id);
    }
  };

  const handleDirectAssign = (spot: ParkingSpot) => {
    setSelectedSpotForAssign(spot);
    setShowDirectAssignDialog(true);
  };

  const handleReleaseSpot = (spot: ParkingSpot) => {
    setSelectedSpotForRelease(spot);
    setShowReleaseSpotDialog(true);
  };

  const handleAssignAvailableSpot = (spot: ParkingSpot) => {
    setSelectedAvailableSpot(spot);
    setShowAssignAvailableSpotDialog(true);
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

  // Enhanced filtering for parking spots
  const filteredSpots = allSpots.filter(spot => {
    const matchesTab = activeSpotTab === "all" || 
                     (activeSpotTab === "unallocated" && !spot.ownerId) ||
                     (activeSpotTab === "allocated" && spot.ownerId);
    
    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = spot.spotNumber.toLowerCase().includes(searchLower) ||
                           spot.location.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Spot type filter
    if (filterValues.spotType && filterValues.spotType !== "all") {
      if (spot.spotType !== filterValues.spotType) return false
    }
    
    // Location filter
    if (filterValues.location && filterValues.location !== "all") {
      if (!spot.location.toLowerCase().includes(filterValues.location.toLowerCase())) {
        return false
      }
    }
    
    // Assignment status filter (assigned vs available)
    if (filterValues.assignmentStatus && filterValues.assignmentStatus !== "all") {
      const isAssigned = !!spot.ownerId
      if (filterValues.assignmentStatus === "assigned" && !isAssigned) return false
      if (filterValues.assignmentStatus === "available" && isAssigned) return false
    }
    
    // Enable/Disable status filter
    if (filterValues.enableStatus && filterValues.enableStatus !== "all") {
      const isEnabled = spot.isBookable !== false
      if (filterValues.enableStatus === "enabled" && !isEnabled) return false
      if (filterValues.enableStatus === "disabled" && isEnabled) return false
    }
    
    return matchesTab
  });
  
  // Sorting functionality for parking spots
  const { sortState, sortedData: sortedSpots, handleSort } = useTableSort(
    filteredSpots,
    "spotNumber", // Default sort by spot number
    "asc" // Ascending order
  )
  
  // Filter configuration for parking management
  const parkingFilterConfigs: FilterConfig[] = [
    {
      key: "spotType",
      label: "Spot Type",
      type: "select",
      options: [
        { value: "regular", label: "Regular" },
        { value: "electric", label: "EV" },
        { value: "tesla_ev", label: "Tesla Charger" },
        { value: "accessible", label: "Accessible" },
        { value: "reserved", label: "Reserved" }
      ]
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: [
        // These would ideally come from the API
        { value: "building-a", label: "Building A" },
        { value: "building-b", label: "Building B" },
        { value: "parking-garage", label: "Parking Garage" },
        { value: "outdoor-lot", label: "Outdoor Lot" },
        { value: "underground", label: "Underground" }
      ]
    },
    {
      key: "assignmentStatus",
      label: "Assignment Status",
      type: "select",
      options: [
        { value: "assigned", label: "Assigned" },
        { value: "available", label: "Available" }
      ]
    },
    {
      key: "enableStatus",
      label: "Enable/Disable Status",
      type: "select",
      options: [
        { value: "enabled", label: "Enabled" },
        { value: "disabled", label: "Disabled" }
      ]
    }
  ]
  
  // Handle filter changes
  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("")
    setFilterValues({})
  }

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100" data-testid={`badge-priority-high`}>High Priority</Badge>;
      case 2:
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" data-testid={`badge-priority-medium`}>Medium Priority</Badge>;
      case 3:
        return <Badge variant="outline" data-testid={`badge-priority-low`}>Low Priority</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-priority-unknown`}>Unknown</Badge>;
    }
  };

  const getSpotTypeBadge = (spotType: SpotType) => {
    const badgeConfigs: Record<SpotType, { className: string; label: string }> = {
      regular: { 
        className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", 
        label: "Regular" 
      },
      electric: { 
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        label: "EV Charging" 
      },
      tesla_ev: { 
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", 
        label: "Tesla Charger" 
      },
      accessible: { 
        className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", 
        label: "Accessible" 
      },
      reserved: { 
        className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", 
        label: "Reserved" 
      }
    };
    
    const config = badgeConfigs[spotType] || badgeConfigs.regular;
    return (
      <Badge 
        variant="secondary" 
        className={config.className} 
        data-testid={`badge-spot-type-${spotType}`}
      >
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-parking-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parking Management</h1>
          <p className="text-muted-foreground">
            Comprehensive management of parking spots and waiting list assignments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={toggleCards}
            data-testid="button-toggle-cards"
            title={cardsVisible ? "Hide dashboard cards" : "Show dashboard cards"}
          >
            {cardsVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {cardsVisible ? "Hide Cards" : "Show Cards"}
          </Button>
          <Button 
            variant="outline"
            onClick={handleRefreshAll}
            data-testid="button-refresh-data"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button 
            variant="outline" 
            disabled={allSpots.length === 0}
            onClick={() => {
              const success = quickExportParkingSpotsPDF(sortedSpots, 'Parking Management Report', (errorMessage) => {
                toast({
                  variant: "destructive",
                  title: "Export Failed",
                  description: errorMessage
                })
              })
              if (success) {
                toast({
                  title: "Export Successful",
                  description: "PDF report has been downloaded successfully"
                })
              }
            }}
            data-testid="button-export-parking-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            variant="outline" 
            disabled={allSpots.length === 0}
            onClick={() => {
              const success = quickExportParkingSpotsExcel(sortedSpots, 'Parking Management Report', (errorMessage) => {
                toast({
                  variant: "destructive",
                  title: "Export Failed",
                  description: errorMessage
                })
              })
              if (success) {
                toast({
                  title: "Export Successful",
                  description: "Excel report has been downloaded successfully"
                })
              }
            }}
            data-testid="button-export-parking-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowAddSpotDialog(true)}
            data-testid="button-add-spot"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Spot
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddToWaitingDialog(true)}
            data-testid="button-add-to-waiting"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add to Waiting
          </Button>
        </div>
      </div>

      {/* Quick Analytics Cards */}
      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-total-spots">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Spots</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-available-spots">
              {unallocatedSpots.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for assignment
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-waiting-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users Waiting</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-waiting-users">
              {waitingListMetrics.active}
            </div>
            <p className="text-xs text-muted-foreground">
              Active waiting list entries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-wait">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-avg-wait-time">
              {waitingListMetrics.averageWaitTime}
            </div>
            <p className="text-xs text-muted-foreground">
              Days on waiting list
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-assignments">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-assigned">
              {waitingListMetrics.assigned}
            </div>
            <p className="text-xs text-muted-foreground">
              Spots successfully assigned
            </p>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeSpotTab} onValueChange={setActiveSpotTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" data-testid="tab-all-spots">All Spots</TabsTrigger>
          <TabsTrigger value="unallocated" data-testid="tab-available-spots">Available ({unallocatedSpots.length})</TabsTrigger>
          <TabsTrigger value="waiting" data-testid="tab-waiting-list">Waiting List ({waitingListMetrics.active})</TabsTrigger>
        </TabsList>

        {/* All Spots and Unallocated Spots Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Enhanced Filters */}
          <EnhancedFilters
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterConfigs={parkingFilterConfigs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            searchPlaceholder="Search spots by number or location..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Parking Spots ({sortedSpots.length})</CardTitle>
                <div className="flex gap-2">
                  {selectedSpots.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
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
                        size="sm"
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
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedSpots.length === 0}
                    onClick={() => {
                      const success = quickExportParkingSpotsPDF(sortedSpots, 'Parking Spots Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "PDF report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-spots-pdf"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedSpots.length === 0}
                    onClick={() => {
                      const success = quickExportParkingSpotsExcel(sortedSpots, 'Parking Spots Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "Excel report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-spots-excel"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
          {sortedSpots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-spots">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No parking spots found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                          <SortableTableHeader
                            column="spotNumber"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Spot Number
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="location"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Location
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="spotType"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Type
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isActive"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Status
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="ownerId"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Assigned To
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isBookable"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Assignment Status
                          </SortableTableHeader>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSpots.map((spot) => (
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
                                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">Inactive</Badge>
                                )}
                                {spot.isBookable !== false ? (
                                  <Badge variant="outline">Bookable</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100">Disabled</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-spot-assigned-to-${spot.id}`}>
                              {spot.ownerId ? (
                                <p className="font-medium">
                                  {allUsers.find(user => user.id === spot.ownerId)?.name || 
                                   `${allUsers.find(user => user.id === spot.ownerId)?.firstName || ''} ${allUsers.find(user => user.id === spot.ownerId)?.lastName || ''}`.trim() || 
                                   'Assigned User'}
                                </p>
                              ) : (
                                <p className="font-medium text-muted-foreground">Workplace Services</p>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-spot-assignment-status-${spot.id}`}>
                              {spot.ownerId ? (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">Assigned</Badge>
                              ) : (
                                <Badge variant="outline">Available</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditSpot(spot)}
                                  data-testid={`button-edit-spot-${spot.id}`}
                                  title="Edit Spot"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {!spot.ownerId ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDirectAssign(spot)}
                                    data-testid={`button-assign-spot-${spot.id}`}
                                    title="Assign Spot"
                                  >
                                    <Target className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReleaseSpot(spot)}
                                    data-testid={`button-release-spot-${spot.id}`}
                                    title="Release Spot"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSpot(spot.id)}
                                  data-testid={`button-delete-spot-${spot.id}`}
                                  title="Delete Spot"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
        </TabsContent>

        {/* Unallocated Spots Tab */}
        <TabsContent value="unallocated" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available Spots ({unallocatedSpots.length})</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search spots..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                      data-testid="input-search-unallocated-spots"
                    />
                  </div>
                  <Select value={unallocatedFilterType} onValueChange={setUnallocatedFilterType}>
                    <SelectTrigger className="w-32" data-testid="select-filter-unallocated-type">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="electric">EV</SelectItem>
                      <SelectItem value="tesla_ev">Tesla Charger</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {unallocatedSpots.filter(spot => {
                const matchesSearch = spot.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                     spot.location.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesType = unallocatedFilterType === "all" || spot.spotType === unallocatedFilterType;
                return matchesSearch && matchesType;
              }).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-unallocated-spots">
                  <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No available spots found matching your criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-unallocated-spots">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Spot Number</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Assignment Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unallocatedSpots.filter(spot => {
                        const matchesSearch = spot.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                             spot.location.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesType = unallocatedFilterType === "all" || spot.spotType === unallocatedFilterType;
                        return matchesSearch && matchesType;
                      }).map((spot) => (
                        <TableRow key={spot.id} data-testid={`row-unallocated-spot-${spot.id}`}>
                          <TableCell className="font-medium" data-testid={`text-unallocated-spot-number-${spot.id}`}>
                            {spot.spotNumber}
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-location-${spot.id}`}>
                            {spot.location}
                            {spot.isIndoor && <Badge variant="outline" className="ml-2">Indoor</Badge>}
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-type-${spot.id}`}>
                            {getSpotTypeBadge(spot.spotType)}
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-status-${spot.id}`}>
                            <div className="flex gap-2">
                              {spot.isActive !== false ? (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">Inactive</Badge>
                              )}
                              {spot.isBookable !== false ? (
                                <Badge variant="outline">Bookable</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100">Disabled</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-assigned-to-${spot.id}`}>
                            <p className="font-medium text-muted-foreground">Workplace Services</p>
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-assignment-status-${spot.id}`}>
                            <Badge variant="outline">Available</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSpot(spot)}
                                data-testid={`button-edit-unallocated-spot-${spot.id}`}
                                title="Edit Spot"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAssignAvailableSpot(spot)}
                                data-testid={`button-assign-unallocated-spot-${spot.id}`}
                                title="Assign to User"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSpot(spot.id)}
                                data-testid={`button-delete-unallocated-spot-${spot.id}`}
                                title="Delete Spot"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waiting List Tab */}
        <TabsContent value="waiting" className="space-y-4">
          {/* Waiting List */}
      <Card data-testid="card-waiting-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Waiting List ({filteredWaitingList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingWaitingList ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredWaitingList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-waiting">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No waiting list entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                            {item.preferredSpotType ? getSpotTypeBadge(item.preferredSpotType) : <Badge variant="outline">Any</Badge>}
                          </TableCell>
                          <TableCell data-testid={`text-waiting-status-${item.id}`}>
                            <Badge 
                              variant="secondary"
                              className={
                                item.status === "waiting" ? "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" :
                                item.status === "assigned" ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" :
                                "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                              }
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
                            <div className="flex items-center justify-end gap-1">
                              {item.status === "waiting" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAssignFromWaitingList(item)}
                                  data-testid={`button-assign-waiting-${item.id}`}
                                  title="Assign Spot"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFromWaitingList(item)}
                                data-testid={`button-remove-waiting-${item.id}`}
                                title="Remove from Waiting List"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
                    {(allUsers as any[]).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.firstName || user.email} ({user.email})
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
                    {(allUsers as any[]).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.firstName || user.email} ({user.email})
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

      {/* Release Spot Confirmation Dialog */}
      <Dialog open={showReleaseSpotDialog} onOpenChange={setShowReleaseSpotDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-release-spot">
          <DialogHeader>
            <DialogTitle>Release Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSpotForRelease && (
              <>
                <p>Are you sure you want to release parking spot <strong>{selectedSpotForRelease.spotNumber}</strong>?</p>
                <p className="text-sm text-muted-foreground">
                  This will make the spot available for assignment to other users. The current owner will lose access to this spot.
                </p>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedSpotForRelease) {
                        releaseSpotMutation.mutate(selectedSpotForRelease.id);
                      }
                    }}
                    disabled={releaseSpotMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-confirm-release-spot"
                  >
                    {releaseSpotMutation.isPending ? "Releasing..." : "Release Spot"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowReleaseSpotDialog(false)}
                    className="flex-1"
                    data-testid="button-cancel-release-spot"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Available Spot to User Dialog */}
      <Dialog open={showAssignAvailableSpotDialog} onOpenChange={setShowAssignAvailableSpotDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-assign-available-spot">
          <DialogHeader>
            <DialogTitle>Assign Available Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAvailableSpot && (
              <>
                <p>Assigning parking spot <strong>{selectedAvailableSpot.spotNumber}</strong> at {selectedAvailableSpot.location}</p>
                <div>
                  <label className="text-sm font-medium">Select User</label>
                  <Select 
                    value={selectedUserForAvailableSpot} 
                    onValueChange={setSelectedUserForAvailableSpot}
                  >
                    <SelectTrigger data-testid="select-user-for-available-spot">
                      <SelectValue placeholder="Choose user to assign spot to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email}) - {user.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedAvailableSpot && selectedUserForAvailableSpot) {
                        assignAvailableSpotMutation.mutate({
                          spotId: selectedAvailableSpot.id,
                          userId: selectedUserForAvailableSpot
                        });
                      }
                    }}
                    disabled={assignAvailableSpotMutation.isPending || !selectedUserForAvailableSpot}
                    className="flex-1"
                    data-testid="button-confirm-assign-available-spot"
                  >
                    {assignAvailableSpotMutation.isPending ? "Assigning..." : "Assign Spot"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAssignAvailableSpotDialog(false)}
                    className="flex-1"
                    data-testid="button-cancel-assign-available-spot"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}