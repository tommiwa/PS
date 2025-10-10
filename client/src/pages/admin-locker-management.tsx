import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useTableSort } from "@/hooks/use-table-sort"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Package, Plus, Edit, Trash2, UserPlus, UserMinus,
  Search, Filter, Clock, CheckCircle2, XCircle, Calendar as CalendarIcon,
  ChevronDown, Users, ListOrdered
} from "lucide-react"
import type { 
  Locker, 
  LockerWaitlist, 
  LockerAssignmentHistory,
  LockerType,
  Location 
} from "@shared/schema"

// Extended locker type with user details
interface LockerWithUser extends Locker {
  locationName?: string;
  lockerTypeName?: string;
  assignedUserName?: string;
  assignedUserEmail?: string;
  assignedUserDepartment?: string;
}

// Extended waitlist type with user details
interface LockerWaitlistWithUser extends LockerWaitlist {
  userName?: string;
  userEmail?: string;
  userDepartment?: string;
  locationName?: string;
  lockerTypeName?: string;
}

// Extended history type with details
interface LockerAssignmentHistoryWithDetails extends LockerAssignmentHistory {
  lockerNumber?: string;
  locationName?: string;
  userName?: string;
  userEmail?: string;
  actorName?: string;
}

export default function AdminLockerManagement() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("lockers")
  
  // Search and filter states for each tab
  const [lockersSearchTerm, setLockersSearchTerm] = useState("")
  const [lockersLocationFilter, setLockersLocationFilter] = useState<string>("all")
  const [lockersTypeFilter, setLockersTypeFilter] = useState<string>("all")
  const [lockersStatusFilter, setLockersStatusFilter] = useState<string>("all")
  
  const [waitlistSearchTerm, setWaitlistSearchTerm] = useState("")
  const [waitlistLocationFilter, setWaitlistLocationFilter] = useState<string>("all")
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState<string>("all")
  
  const [historySearchTerm, setHistorySearchTerm] = useState("")
  const [historyLockerFilter, setHistoryLockerFilter] = useState<string>("all")
  const [historyActionFilter, setHistoryActionFilter] = useState<string>("all")
  
  // Dialog states
  const [showAddLockerDialog, setShowAddLockerDialog] = useState(false)
  const [showEditLockerDialog, setShowEditLockerDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showUnassignDialog, setShowUnassignDialog] = useState(false)
  const [showAddToWaitlistDialog, setShowAddToWaitlistDialog] = useState(false)
  
  // Selected items for operations
  const [selectedLocker, setSelectedLocker] = useState<LockerWithUser | null>(null)
  const [selectedWaitlistItem, setSelectedWaitlistItem] = useState<LockerWaitlistWithUser | null>(null)
  
  // Date picker states
  const [assignEffectiveDate, setAssignEffectiveDate] = useState<Date>(new Date())
  const [unassignEffectiveDate, setUnassignEffectiveDate] = useState<Date>(new Date())
  const [assignDatePickerOpen, setAssignDatePickerOpen] = useState(false)
  const [unassignDatePickerOpen, setUnassignDatePickerOpen] = useState(false)
  
  // Form states
  const [addLockerForm, setAddLockerForm] = useState({
    lockerNumber: "",
    locationId: undefined as number | undefined,
    lockerTypeId: undefined as number | undefined,
    isBciManaged: true,
    notes: ""
  })
  
  const [editLockerForm, setEditLockerForm] = useState({
    lockerNumber: "",
    locationId: undefined as number | undefined,
    lockerTypeId: undefined as number | undefined,
    isBciManaged: true,
    notes: ""
  })
  
  const [assignForm, setAssignForm] = useState({
    userId: "",
    notes: ""
  })
  
  const [unassignForm, setUnassignForm] = useState({
    notes: ""
  })
  
  const [addToWaitlistForm, setAddToWaitlistForm] = useState({
    userId: "",
    locationId: undefined as number | undefined,
    requestedLockerTypeId: undefined as number | undefined,
    notes: ""
  })
  
  // User search for assign/waitlist
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [waitlistUserSearchOpen, setWaitlistUserSearchOpen] = useState(false)
  const [waitlistUserSearchQuery, setWaitlistUserSearchQuery] = useState("")
  
  // Fetch all lockers
  const { data: allLockers = [], isLoading: isLoadingLockers } = useQuery<LockerWithUser[]>({
    queryKey: ["/api/admin/lockers"],
  })
  
  // Fetch locker waitlist
  const { data: lockerWaitlist = [], isLoading: isLoadingWaitlist } = useQuery<LockerWaitlistWithUser[]>({
    queryKey: ["/api/admin/locker-waitlist"],
  })
  
  // Fetch locker assignment history
  const { data: lockerHistory = [], isLoading: isLoadingHistory } = useQuery<LockerAssignmentHistoryWithDetails[]>({
    queryKey: ["/api/admin/locker-assignment-history"],
  })
  
  // Fetch locker types
  const { data: lockerTypes = [], isLoading: isLoadingLockerTypes } = useQuery<LockerType[]>({
    queryKey: ["/api/admin/locker-types"],
  })
  
  // Fetch locations
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  })
  
  // Fetch all users
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  })
  
  // Table sorting for lockers
  const { sortedData: sortedLockers, sortState, handleSort } = useTableSort(
    allLockers,
    "lockerNumber",
    "asc"
  )
  
  // Filter lockers
  const filteredLockers = useMemo(() => {
    return sortedLockers.filter(locker => {
      const matchesSearch = locker.lockerNumber?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                           locker.assignedUserName?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                           locker.assignedUserEmail?.toLowerCase().includes(lockersSearchTerm.toLowerCase())
      const matchesLocation = lockersLocationFilter === "all" || locker.locationId?.toString() === lockersLocationFilter
      const matchesType = lockersTypeFilter === "all" || locker.lockerTypeId?.toString() === lockersTypeFilter
      const matchesStatus = lockersStatusFilter === "all" || locker.status === lockersStatusFilter
      
      return matchesSearch && matchesLocation && matchesType && matchesStatus
    })
  }, [sortedLockers, lockersSearchTerm, lockersLocationFilter, lockersTypeFilter, lockersStatusFilter])
  
  // Filter waitlist
  const filteredWaitlist = useMemo(() => {
    return lockerWaitlist.filter(item => {
      const matchesSearch = item.userName?.toLowerCase().includes(waitlistSearchTerm.toLowerCase()) ||
                           item.userEmail?.toLowerCase().includes(waitlistSearchTerm.toLowerCase())
      const matchesLocation = waitlistLocationFilter === "all" || item.locationId?.toString() === waitlistLocationFilter
      const matchesStatus = waitlistStatusFilter === "all" || item.status === waitlistStatusFilter
      
      return matchesSearch && matchesLocation && matchesStatus
    })
  }, [lockerWaitlist, waitlistSearchTerm, waitlistLocationFilter, waitlistStatusFilter])
  
  // Filter history
  const filteredHistory = useMemo(() => {
    return lockerHistory.filter(item => {
      const matchesSearch = item.userName?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                           item.lockerNumber?.toLowerCase().includes(historySearchTerm.toLowerCase())
      const matchesLocker = historyLockerFilter === "all" || String(item.lockerId) === historyLockerFilter
      const matchesAction = historyActionFilter === "all" || item.action === historyActionFilter
      
      return matchesSearch && matchesLocker && matchesAction
    })
  }, [lockerHistory, historySearchTerm, historyLockerFilter, historyActionFilter])
  
  // Available lockers for assignment (only available status)
  const availableLockers = useMemo(() => {
    return allLockers.filter(locker => locker.status === "available")
  }, [allLockers])
  
  // Users search for assignment
  const filteredUsersForAssign = useMemo(() => {
    if (userSearchQuery.length < 2) return []
    return allUsers.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
      const email = (user.email || '').toLowerCase()
      const query = userSearchQuery.toLowerCase()
      return fullName.includes(query) || email.includes(query)
    }).slice(0, 10)
  }, [allUsers, userSearchQuery])
  
  // Users search for waitlist
  const filteredUsersForWaitlist = useMemo(() => {
    if (waitlistUserSearchQuery.length < 2) return []
    return allUsers.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
      const email = (user.email || '').toLowerCase()
      const query = waitlistUserSearchQuery.toLowerCase()
      return fullName.includes(query) || email.includes(query)
    }).slice(0, 10)
  }, [allUsers, waitlistUserSearchQuery])
  
  // CREATE locker mutation
  const createLockerMutation = useMutation({
    mutationFn: async (data: typeof addLockerForm) => {
      return await apiRequest("/api/admin/lockers", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] })
      toast({
        title: "Success",
        description: "Locker created successfully",
      })
      setShowAddLockerDialog(false)
      setAddLockerForm({
        lockerNumber: "",
        locationId: undefined,
        lockerTypeId: undefined,
        isBciManaged: true,
        notes: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create locker",
        variant: "destructive",
      })
    },
  })
  
  // UPDATE locker mutation
  const updateLockerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof editLockerForm> }) => {
      return await apiRequest(`/api/admin/lockers/${id}`, {
        method: "PATCH",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] })
      toast({
        title: "Success",
        description: "Locker updated successfully",
      })
      setShowEditLockerDialog(false)
      setSelectedLocker(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update locker",
        variant: "destructive",
      })
    },
  })
  
  // DELETE locker mutation
  const deleteLockerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/lockers/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] })
      toast({
        title: "Success",
        description: "Locker deleted successfully",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete locker",
        variant: "destructive",
      })
    },
  })
  
  // ASSIGN locker mutation
  const assignLockerMutation = useMutation({
    mutationFn: async ({ lockerId, userId, effectiveDate, notes }: { 
      lockerId: string; 
      userId: string; 
      effectiveDate: string;
      notes?: string;
    }) => {
      return await apiRequest(`/api/admin/lockers/${lockerId}/assign`, {
        method: "POST",
        body: { userId, effectiveDate, notes },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-assignment-history"] })
      toast({
        title: "Success",
        description: "Locker assigned successfully",
      })
      setShowAssignDialog(false)
      setSelectedLocker(null)
      setAssignForm({ userId: "", notes: "" })
      setAssignEffectiveDate(new Date())
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign locker",
        variant: "destructive",
      })
    },
  })
  
  // UNASSIGN locker mutation
  const unassignLockerMutation = useMutation({
    mutationFn: async ({ lockerId, effectiveDate, notes }: { 
      lockerId: string; 
      effectiveDate: string;
      notes?: string;
    }) => {
      return await apiRequest(`/api/admin/lockers/${lockerId}/unassign`, {
        method: "POST",
        body: { effectiveDate, notes },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-assignment-history"] })
      toast({
        title: "Success",
        description: "Locker unassigned successfully",
      })
      setShowUnassignDialog(false)
      setSelectedLocker(null)
      setUnassignForm({ notes: "" })
      setUnassignEffectiveDate(new Date())
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unassign locker",
        variant: "destructive",
      })
    },
  })
  
  // ADD to waitlist mutation
  const addToWaitlistMutation = useMutation({
    mutationFn: async (data: typeof addToWaitlistForm) => {
      return await apiRequest("/api/admin/locker-waitlist", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-waitlist"] })
      toast({
        title: "Success",
        description: "User added to locker waitlist",
      })
      setShowAddToWaitlistDialog(false)
      setAddToWaitlistForm({
        userId: "",
        locationId: undefined,
        requestedLockerTypeId: undefined,
        notes: ""
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to waitlist",
        variant: "destructive",
      })
    },
  })
  
  // UPDATE waitlist status mutation
  const updateWaitlistStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const fulfilledAt = status === "fulfilled" ? new Date().toISOString() : undefined
      return await apiRequest(`/api/admin/locker-waitlist/${id}`, {
        method: "PATCH",
        body: { status, fulfilledAt },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-waitlist"] })
      toast({
        title: "Success",
        description: "Waitlist status updated",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update waitlist status",
        variant: "destructive",
      })
    },
  })
  
  // REMOVE from waitlist mutation
  const removeFromWaitlistMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/locker-waitlist/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-waitlist"] })
      toast({
        title: "Success",
        description: "User removed from waitlist",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove from waitlist",
        variant: "destructive",
      })
    },
  })
  
  // Handlers
  const handleAddLocker = () => {
    if (!addLockerForm.lockerNumber || !addLockerForm.locationId || !addLockerForm.lockerTypeId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }
    createLockerMutation.mutate(addLockerForm)
  }
  
  const handleEditLocker = (locker: LockerWithUser) => {
    setSelectedLocker(locker)
    setEditLockerForm({
      lockerNumber: locker.lockerNumber,
      locationId: locker.locationId,
      lockerTypeId: locker.lockerTypeId,
      isBciManaged: locker.isBciManaged,
      notes: locker.notes || ""
    })
    setShowEditLockerDialog(true)
  }
  
  const handleUpdateLocker = () => {
    if (!selectedLocker) return
    
    if (!editLockerForm.lockerNumber || !editLockerForm.locationId || !editLockerForm.lockerTypeId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }
    
    updateLockerMutation.mutate({ 
      id: selectedLocker.id, 
      data: editLockerForm 
    })
  }
  
  const handleDeleteLocker = (locker: LockerWithUser) => {
    if (locker.status === "assigned") {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete an assigned locker. Please unassign it first.",
        variant: "destructive",
      })
      return
    }
    
    if (confirm(`Are you sure you want to delete locker ${locker.lockerNumber}?`)) {
      deleteLockerMutation.mutate(locker.id)
    }
  }
  
  const handleShowAssignDialog = (locker: LockerWithUser) => {
    if (locker.status === "assigned") {
      toast({
        title: "Already Assigned",
        description: "This locker is already assigned. Please unassign it first.",
        variant: "destructive",
      })
      return
    }
    setSelectedLocker(locker)
    setShowAssignDialog(true)
  }
  
  const handleAssignLocker = () => {
    if (!selectedLocker || !assignForm.userId) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive",
      })
      return
    }
    
    assignLockerMutation.mutate({
      lockerId: selectedLocker.id,
      userId: assignForm.userId,
      effectiveDate: format(assignEffectiveDate, "yyyy-MM-dd"),
      notes: assignForm.notes
    })
  }
  
  const handleShowUnassignDialog = (locker: LockerWithUser) => {
    if (locker.status !== "assigned") {
      toast({
        title: "Not Assigned",
        description: "This locker is not currently assigned",
        variant: "destructive",
      })
      return
    }
    setSelectedLocker(locker)
    setShowUnassignDialog(true)
  }
  
  const handleUnassignLocker = () => {
    if (!selectedLocker) return
    
    unassignLockerMutation.mutate({
      lockerId: selectedLocker.id,
      effectiveDate: format(unassignEffectiveDate, "yyyy-MM-dd"),
      notes: unassignForm.notes
    })
  }
  
  const handleAddToWaitlist = () => {
    if (!addToWaitlistForm.userId) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive",
      })
      return
    }
    
    addToWaitlistMutation.mutate(addToWaitlistForm)
  }
  
  const getSelectedUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId)
    return user ? `${user.firstName || ''} ${user.lastName || ''}` : ''
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-locker-management">Locker Management</h1>
          <p className="text-muted-foreground mt-1">Manage locker inventory, assignments, and waitlist</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList data-testid="tabs-locker-management">
          <TabsTrigger value="lockers" data-testid="tab-lockers">
            <Package className="h-4 w-4 mr-2" />
            Lockers
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            <Users className="h-4 w-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="waitlist" data-testid="tab-waitlist">
            <ListOrdered className="h-4 w-4 mr-2" />
            Waitlist
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* LOCKERS TAB */}
        <TabsContent value="lockers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
              <CardTitle>All Lockers</CardTitle>
              <Dialog open={showAddLockerDialog} onOpenChange={setShowAddLockerDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-locker">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Locker
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-locker">
                  <DialogHeader>
                    <DialogTitle>Add New Locker</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="locker-number">Locker Number *</Label>
                      <Input
                        id="locker-number"
                        data-testid="input-add-locker-number"
                        value={addLockerForm.lockerNumber}
                        onChange={(e) => setAddLockerForm({ ...addLockerForm, lockerNumber: e.target.value })}
                        placeholder="e.g., L-001"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Select
                        value={addLockerForm.locationId?.toString()}
                        onValueChange={(value) => setAddLockerForm({ ...addLockerForm, locationId: parseInt(value) })}
                      >
                        <SelectTrigger id="location" data-testid="select-add-location">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(location => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {`${location.office} - ${location.building}, ${location.level}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="locker-type">Locker Type *</Label>
                      <Select
                        value={addLockerForm.lockerTypeId?.toString()}
                        onValueChange={(value) => setAddLockerForm({ ...addLockerForm, lockerTypeId: parseInt(value) })}
                      >
                        <SelectTrigger id="locker-type" data-testid="select-add-locker-type">
                          <SelectValue placeholder="Select locker type" />
                        </SelectTrigger>
                        <SelectContent>
                          {lockerTypes.map(type => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        data-testid="textarea-add-notes"
                        value={addLockerForm.notes}
                        onChange={(e) => setAddLockerForm({ ...addLockerForm, notes: e.target.value })}
                        placeholder="Optional notes about this locker"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAddLockerDialog(false)}
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddLocker}
                      disabled={createLockerMutation.isPending}
                      data-testid="button-submit-add"
                    >
                      {createLockerMutation.isPending ? "Adding..." : "Add Locker"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search lockers..."
                      value={lockersSearchTerm}
                      onChange={(e) => setLockersSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-lockers"
                    />
                  </div>
                </div>
                
                <Select value={lockersLocationFilter} onValueChange={setLockersLocationFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-location">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {`${location.office} - ${location.building}, ${location.level}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={lockersTypeFilter} onValueChange={setLockersTypeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {lockerTypes.map(type => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={lockersStatusFilter} onValueChange={setLockersStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lockers Table */}
              {isLoadingLockers ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="lockerNumber"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                          data-testid="header-locker-number"
                        >
                          Locker Number
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="locationName"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                          data-testid="header-location"
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="lockerTypeName"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                          data-testid="header-type"
                        >
                          Type
                        </SortableTableHeader>
                        <TableHead data-testid="header-status">Status</TableHead>
                        <TableHead data-testid="header-assigned-to">Assigned To</TableHead>
                        <TableHead data-testid="header-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLockers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No lockers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLockers.map((locker) => (
                          <TableRow key={locker.id} data-testid={`row-locker-${locker.id}`}>
                            <TableCell className="font-medium" data-testid={`text-locker-number-${locker.id}`}>
                              {locker.lockerNumber}
                            </TableCell>
                            <TableCell data-testid={`text-location-${locker.id}`}>
                              {locker.locationName || '-'}
                            </TableCell>
                            <TableCell data-testid={`text-type-${locker.id}`}>
                              {locker.lockerTypeName || '-'}
                            </TableCell>
                            <TableCell data-testid={`badge-status-${locker.id}`}>
                              <Badge variant={locker.status === "available" ? "outline" : "default"}>
                                {locker.status}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-assigned-user-${locker.id}`}>
                              {locker.assignedUserName ? (
                                <div>
                                  <div className="font-medium">{locker.assignedUserName}</div>
                                  <div className="text-sm text-muted-foreground">{locker.assignedUserEmail}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditLocker(locker)}
                                  data-testid={`button-edit-${locker.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteLocker(locker)}
                                  data-testid={`button-delete-${locker.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSIGNMENTS TAB */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Locker Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Available Lockers */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" data-testid="heading-available-lockers">Available Lockers</h3>
                  {isLoadingLockers ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : availableLockers.length === 0 ? (
                    <Alert>
                      <AlertDescription>No available lockers at this time.</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-available-locker-number">Locker Number</TableHead>
                            <TableHead data-testid="header-available-location">Location</TableHead>
                            <TableHead data-testid="header-available-type">Type</TableHead>
                            <TableHead data-testid="header-available-actions">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {availableLockers.map((locker) => (
                            <TableRow key={locker.id} data-testid={`row-available-locker-${locker.id}`}>
                              <TableCell className="font-medium" data-testid={`text-available-locker-number-${locker.id}`}>{locker.lockerNumber}</TableCell>
                              <TableCell data-testid={`text-available-location-${locker.id}`}>{locker.locationName || '-'}</TableCell>
                              <TableCell data-testid={`text-available-type-${locker.id}`}>{locker.lockerTypeName || '-'}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handleShowAssignDialog(locker)}
                                  data-testid={`button-assign-${locker.id}`}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Assign
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Assigned Lockers */}
                <div>
                  <h3 className="text-lg font-semibold mb-3" data-testid="heading-assigned-lockers">Assigned Lockers</h3>
                  {isLoadingLockers ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-assigned-locker-number">Locker Number</TableHead>
                            <TableHead data-testid="header-assigned-location">Location</TableHead>
                            <TableHead data-testid="header-assigned-type">Type</TableHead>
                            <TableHead data-testid="header-assigned-to">Assigned To</TableHead>
                            <TableHead data-testid="header-assigned-date">Assigned Date</TableHead>
                            <TableHead data-testid="header-assigned-actions">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allLockers.filter(l => l.status === "assigned").length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No assigned lockers
                              </TableCell>
                            </TableRow>
                          ) : (
                            allLockers.filter(l => l.status === "assigned").map((locker) => (
                              <TableRow key={locker.id} data-testid={`row-assigned-locker-${locker.id}`}>
                                <TableCell className="font-medium" data-testid={`text-assigned-locker-number-${locker.id}`}>{locker.lockerNumber}</TableCell>
                                <TableCell data-testid={`text-assigned-location-${locker.id}`}>{locker.locationName || '-'}</TableCell>
                                <TableCell data-testid={`text-assigned-type-${locker.id}`}>{locker.lockerTypeName || '-'}</TableCell>
                                <TableCell data-testid={`text-assigned-user-${locker.id}`}>
                                  <div>
                                    <div className="font-medium">{locker.assignedUserName}</div>
                                    <div className="text-sm text-muted-foreground">{locker.assignedUserEmail}</div>
                                  </div>
                                </TableCell>
                                <TableCell data-testid={`text-assigned-date-${locker.id}`}>
                                  {locker.assignedAt ? format(new Date(locker.assignedAt), 'MMM dd, yyyy') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleShowUnassignDialog(locker)}
                                    data-testid={`button-unassign-${locker.id}`}
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Unassign
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WAITLIST TAB */}
        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
              <CardTitle>Locker Waitlist</CardTitle>
              <Dialog open={showAddToWaitlistDialog} onOpenChange={setShowAddToWaitlistDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-to-waitlist">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Waitlist
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-to-waitlist">
                  <DialogHeader>
                    <DialogTitle>Add User to Waitlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>User *</Label>
                      <Popover open={waitlistUserSearchOpen} onOpenChange={setWaitlistUserSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            data-testid="button-select-waitlist-user"
                          >
                            {addToWaitlistForm.userId
                              ? getSelectedUserName(addToWaitlistForm.userId)
                              : "Select user"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" data-testid="popover-waitlist-user-search">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Search users..." 
                              value={waitlistUserSearchQuery}
                              onValueChange={setWaitlistUserSearchQuery}
                              data-testid="input-waitlist-user-search"
                            />
                            <CommandList>
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                {filteredUsersForWaitlist.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.id}
                                    onSelect={(value) => {
                                      setAddToWaitlistForm({ ...addToWaitlistForm, userId: value })
                                      setWaitlistUserSearchOpen(false)
                                    }}
                                    data-testid={`option-waitlist-user-${user.id}`}
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {user.firstName} {user.lastName}
                                      </div>
                                      <div className="text-sm text-muted-foreground">{user.email}</div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="waitlist-location">Preferred Location (Optional)</Label>
                      <Select
                        value={addToWaitlistForm.locationId?.toString()}
                        onValueChange={(value) => setAddToWaitlistForm({ 
                          ...addToWaitlistForm, 
                          locationId: value ? parseInt(value) : undefined 
                        })}
                      >
                        <SelectTrigger id="waitlist-location" data-testid="select-add-waitlist-location">
                          <SelectValue placeholder="Any location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map(location => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {`${location.office} - ${location.building}, ${location.level}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="waitlist-type">Preferred Locker Type (Optional)</Label>
                      <Select
                        value={addToWaitlistForm.requestedLockerTypeId?.toString()}
                        onValueChange={(value) => setAddToWaitlistForm({ 
                          ...addToWaitlistForm, 
                          requestedLockerTypeId: value ? parseInt(value) : undefined 
                        })}
                      >
                        <SelectTrigger id="waitlist-type" data-testid="select-add-waitlist-type">
                          <SelectValue placeholder="Any type" />
                        </SelectTrigger>
                        <SelectContent>
                          {lockerTypes.map(type => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="waitlist-notes">Notes</Label>
                      <Textarea
                        id="waitlist-notes"
                        data-testid="textarea-add-waitlist-notes"
                        value={addToWaitlistForm.notes}
                        onChange={(e) => setAddToWaitlistForm({ ...addToWaitlistForm, notes: e.target.value })}
                        placeholder="Optional notes"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAddToWaitlistDialog(false)}
                      data-testid="button-cancel-waitlist"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddToWaitlist}
                      disabled={addToWaitlistMutation.isPending}
                      data-testid="button-submit-waitlist"
                    >
                      {addToWaitlistMutation.isPending ? "Adding..." : "Add to Waitlist"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search waitlist..."
                      value={waitlistSearchTerm}
                      onChange={(e) => setWaitlistSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-waitlist"
                    />
                  </div>
                </div>
                
                <Select value={waitlistLocationFilter} onValueChange={setWaitlistLocationFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-waitlist-location-filter">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {`${location.office} - ${location.building}, ${location.level}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={waitlistStatusFilter} onValueChange={setWaitlistStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-waitlist-status-filter">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Waitlist Table */}
              {isLoadingWaitlist ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-waitlist-user">User</TableHead>
                        <TableHead data-testid="header-waitlist-location">Location</TableHead>
                        <TableHead data-testid="header-waitlist-type">Requested Type</TableHead>
                        <TableHead data-testid="header-waitlist-requested-at">Requested At</TableHead>
                        <TableHead data-testid="header-waitlist-status">Status</TableHead>
                        <TableHead data-testid="header-waitlist-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWaitlist.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No waitlist entries found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredWaitlist.map((item) => (
                          <TableRow key={item.id} data-testid={`row-waitlist-${item.id}`}>
                            <TableCell data-testid={`text-waitlist-user-${item.id}`}>
                              <div>
                                <div className="font-medium">{item.userName}</div>
                                <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-waitlist-location-${item.id}`}>{item.locationName || 'Any'}</TableCell>
                            <TableCell data-testid={`text-waitlist-type-${item.id}`}>{item.lockerTypeName || 'Any'}</TableCell>
                            <TableCell data-testid={`text-waitlist-date-${item.id}`}>
                              {format(new Date(item.requestedAt), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell data-testid={`badge-waitlist-status-${item.id}`}>
                              <Badge 
                                variant={
                                  item.status === "pending" ? "default" : 
                                  item.status === "fulfilled" ? "outline" : 
                                  "secondary"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateWaitlistStatusMutation.mutate({ 
                                        id: item.id, 
                                        status: "fulfilled" 
                                      })}
                                      data-testid={`button-fulfill-${item.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Fulfill
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateWaitlistStatusMutation.mutate({ 
                                        id: item.id, 
                                        status: "cancelled" 
                                      })}
                                      data-testid={`button-cancel-${item.id}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFromWaitlistMutation.mutate(item.id)}
                                  data-testid={`button-remove-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment History</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search history..."
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-history"
                    />
                  </div>
                </div>
                
                <Select value={historyLockerFilter} onValueChange={setHistoryLockerFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-history-locker-filter">
                    <SelectValue placeholder="All Lockers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lockers</SelectItem>
                    {allLockers.map(locker => (
                      <SelectItem key={locker.id} value={locker.id}>
                        {locker.lockerNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={historyActionFilter} onValueChange={setHistoryActionFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-history-action-filter">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* History Timeline */}
              {isLoadingHistory ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <Alert>
                  <AlertDescription>No assignment history found.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {filteredHistory.map((item) => (
                    <div 
                      key={item.id} 
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`history-item-${item.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 p-2 rounded-full ${
                            item.action === 'assigned' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                          }`}>
                            {item.action === 'assigned' ? (
                              <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <UserMinus className="h-4 w-4 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {item.action === 'assigned' ? 'Locker Assigned' : 'Locker Unassigned'}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Locker: <span className="font-medium">{item.lockerNumber}</span>
                              {item.locationName && ` at ${item.locationName}`}
                            </div>
                            {item.userName && (
                              <div className="text-sm text-muted-foreground">
                                User: <span className="font-medium">{item.userName}</span>
                                {item.userEmail && ` (${item.userEmail})`}
                              </div>
                            )}
                            {item.actorName && (
                              <div className="text-sm text-muted-foreground">
                                By: {item.actorName}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-sm text-muted-foreground mt-1">
                                Notes: {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground text-right">
                          <div>{format(new Date(item.effectiveDate), 'MMM dd, yyyy')}</div>
                          <div className="text-xs">{format(new Date(item.createdAt), 'h:mm a')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Locker Dialog */}
      <Dialog open={showEditLockerDialog} onOpenChange={setShowEditLockerDialog}>
        <DialogContent data-testid="dialog-edit-locker">
          <DialogHeader>
            <DialogTitle>Edit Locker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-locker-number">Locker Number *</Label>
              <Input
                id="edit-locker-number"
                data-testid="input-edit-locker-number"
                value={editLockerForm.lockerNumber}
                onChange={(e) => setEditLockerForm({ ...editLockerForm, lockerNumber: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location *</Label>
              <Select
                value={editLockerForm.locationId?.toString()}
                onValueChange={(value) => setEditLockerForm({ ...editLockerForm, locationId: parseInt(value) })}
              >
                <SelectTrigger id="edit-location" data-testid="select-edit-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {`${location.office} - ${location.building}, ${location.level}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-locker-type">Locker Type *</Label>
              <Select
                value={editLockerForm.lockerTypeId?.toString()}
                onValueChange={(value) => setEditLockerForm({ ...editLockerForm, lockerTypeId: parseInt(value) })}
              >
                <SelectTrigger id="edit-locker-type" data-testid="select-edit-locker-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lockerTypes.map(type => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                data-testid="textarea-edit-notes"
                value={editLockerForm.notes}
                onChange={(e) => setEditLockerForm({ ...editLockerForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditLockerDialog(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateLocker}
              disabled={updateLockerMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateLockerMutation.isPending ? "Updating..." : "Update Locker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Locker Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent data-testid="dialog-assign-locker">
          <DialogHeader>
            <DialogTitle>Assign Locker {selectedLocker?.lockerNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User *</Label>
              <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="button-select-assign-user"
                  >
                    {assignForm.userId
                      ? getSelectedUserName(assignForm.userId)
                      : "Select user"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" data-testid="popover-assign-user-search">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search users..." 
                      value={userSearchQuery}
                      onValueChange={setUserSearchQuery}
                      data-testid="input-assign-user-search"
                    />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {filteredUsersForAssign.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={(value) => {
                              setAssignForm({ ...assignForm, userId: value })
                              setUserSearchOpen(false)
                            }}
                            data-testid={`option-assign-user-${user.id}`}
                          >
                            <div>
                              <div className="font-medium">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Popover open={assignDatePickerOpen} onOpenChange={setAssignDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-assign-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(assignEffectiveDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" data-testid="popover-assign-date-picker">
                  <Calendar
                    mode="single"
                    selected={assignEffectiveDate}
                    onSelect={(date) => {
                      if (date) {
                        setAssignEffectiveDate(date)
                        setAssignDatePickerOpen(false)
                      }
                    }}
                    initialFocus
                    data-testid="calendar-assign-date"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes</Label>
              <Textarea
                id="assign-notes"
                data-testid="textarea-assign-notes"
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="Optional notes about this assignment"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAssignDialog(false)}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignLocker}
              disabled={assignLockerMutation.isPending}
              data-testid="button-submit-assign"
            >
              {assignLockerMutation.isPending ? "Assigning..." : "Assign Locker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Locker Dialog */}
      <Dialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
        <DialogContent data-testid="dialog-unassign-locker">
          <DialogHeader>
            <DialogTitle>Unassign Locker {selectedLocker?.lockerNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                You are about to unassign locker {selectedLocker?.lockerNumber} from{' '}
                <strong>{selectedLocker?.assignedUserName}</strong>.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label>Effective Date *</Label>
              <Popover open={unassignDatePickerOpen} onOpenChange={setUnassignDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-unassign-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(unassignEffectiveDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" data-testid="popover-unassign-date-picker">
                  <Calendar
                    mode="single"
                    selected={unassignEffectiveDate}
                    onSelect={(date) => {
                      if (date) {
                        setUnassignEffectiveDate(date)
                        setUnassignDatePickerOpen(false)
                      }
                    }}
                    initialFocus
                    data-testid="calendar-unassign-date"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unassign-notes">Notes</Label>
              <Textarea
                id="unassign-notes"
                data-testid="textarea-unassign-notes"
                value={unassignForm.notes}
                onChange={(e) => setUnassignForm({ ...unassignForm, notes: e.target.value })}
                placeholder="Optional notes about this unassignment"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUnassignDialog(false)}
              data-testid="button-cancel-unassign"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUnassignLocker}
              disabled={unassignLockerMutation.isPending}
              data-testid="button-submit-unassign"
            >
              {unassignLockerMutation.isPending ? "Unassigning..." : "Unassign Locker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
