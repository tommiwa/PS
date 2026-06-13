import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
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
import { getBCStatHolidaysForRange } from "@/lib/bc-stat-holidays"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Package, Plus, Edit, Trash2, UserPlus, UserMinus, UserCheck,
  Search, Filter, Clock, CheckCircle2, XCircle, Calendar as CalendarIcon,
  ChevronDown, Users, ListOrdered, Building, Sparkles, Eye, EyeOff, RefreshCw,
  FileText, Download
} from "lucide-react"
import { 
  quickExportLockersPDF, 
  quickExportLockersExcel,
  quickExportLockerWaitlistPDF,
  quickExportLockerWaitlistExcel,
  quickExportLockerAssignmentHistoryPDF,
  quickExportLockerAssignmentHistoryExcel
} from "@/utils/export-utils"
import type { 
  Locker, 
  LockerWaitlist, 
  LockerAssignmentHistory,
  LockerType,
  Location 
} from "@shared/schema"

const _year = new Date().getFullYear()
const statHolidays = getBCStatHolidaysForRange(_year, _year + 1)

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
  const [activeTab, setActiveTab] = useState("bci-managed")
  
  // Cards visibility hook
  const { cardsVisible, toggleCards } = useCardsVisibility("locker-management")
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)
  
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
  
  // Refresh all data handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/lockers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-waitlist"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/locker-assignment-history"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      ])
      toast({
        title: "Refreshed",
        description: "Locker management data has been refreshed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }
  
  // Table sorting for lockers
  const { sortedData: sortedLockers, sortState, handleSort } = useTableSort(
    allLockers,
    "lockerNumber",
    "asc"
  )
  
  // Calculate metrics for locker management
  const bciManagedLockers = useMemo(() => allLockers.filter(locker => locker.isBciManaged), [allLockers])
  const availableLockers = useMemo(() => allLockers.filter(locker => locker.status === "available"), [allLockers])
  const availableBciLockers = useMemo(() => allLockers.filter(locker => locker.isBciManaged && locker.status === "available"), [allLockers])
  const assignedLockers = useMemo(() => allLockers.filter(locker => locker.status === "assigned"), [allLockers])
  
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
  const availableLockersForAssignment = useMemo(() => {
    return allLockers.filter(locker => locker.status === "available")
  }, [allLockers])
  
  // Users search for assignment
  const filteredUsersForAssign = useMemo(() => {
    if (userSearchQuery.length === 0) {
      // Show first 10 users when no search query
      return allUsers.slice(0, 10)
    }
    return allUsers.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
      const email = (user.email || '').toLowerCase()
      const query = userSearchQuery.toLowerCase()
      return fullName.includes(query) || email.includes(query)
    }).slice(0, 10)
  }, [allUsers, userSearchQuery])
  
  // Users search for waitlist
  const filteredUsersForWaitlist = useMemo(() => {
    if (waitlistUserSearchQuery.length === 0) {
      // Show first 10 users when no search query
      return allUsers.slice(0, 10)
    }
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-locker-management">Locker Management</h1>
          <p className="text-muted-foreground mt-1">Manage locker inventory, assignments, and waitlist</p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleCards}
                data-testid="button-toggle-cards"
                aria-label={cardsVisible ? "Hide dashboard cards" : "Show dashboard cards"}
              >
                {cardsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {cardsVisible ? "Hide dashboard cards" : "Show dashboard cards"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                data-testid="button-refresh-data"
                aria-label="Refresh all locker data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh all locker data and assignments
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => setShowAddToWaitlistDialog(true)}
                data-testid="button-add-to-waiting"
                aria-label="Add user to waiting list"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add to Waiting
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add user to locker waiting list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => setShowAddLockerDialog(true)}
                data-testid="button-add-locker"
                aria-label="Create new locker"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Locker
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Create new locker with location settings
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Quick Analytics Cards */}
      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-total-lockers" 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("bci-managed")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Lockers</CardTitle>
                  <div className="rounded-full !border-2 !border-blue-400 p-2">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-lockers">
                    {allLockers.length}
                  </div>
                  <p className="text-xs text-blue-600">All lockers</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view all BCI managed lockers
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-available-lockers" 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("bci-available")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Lockers</CardTitle>
                  <div className="rounded-full !border-2 !border-green-400 p-2">
                    <Sparkles className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-available-lockers">
                    {availableLockers.length}
                  </div>
                  <p className="text-xs text-green-600">Unassigned lockers</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view available lockers
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-assigned-lockers" 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("assigned")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assigned Lockers</CardTitle>
                  <div className="rounded-full !border-2 !border-purple-400 p-2">
                    <UserCheck className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-assigned-lockers">
                    {assignedLockers.length}
                  </div>
                  <p className="text-xs text-purple-600">Currently assigned</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view all assigned lockers
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-waiting-list" 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("waitlist")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Waiting List</CardTitle>
                  <div className="rounded-full !border-2 !border-orange-400 p-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-waiting-list">
                    {lockerWaitlist.length}
                  </div>
                  <p className="text-xs text-orange-600">Pending requests</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view locker waiting list
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bci-managed" data-testid="tab-bci-managed-lockers" className="gap-2">
            <Building className="h-4 w-4 !text-purple-600" />
            All BCI Managed ({bciManagedLockers.length})
          </TabsTrigger>
          <TabsTrigger value="bci-available" data-testid="tab-bci-available-lockers" className="gap-2">
            <Sparkles className="h-4 w-4 !text-green-600" />
            Available BCI ({availableBciLockers.length})
          </TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned-lockers" className="gap-2">
            <UserCheck className="h-4 w-4 !text-blue-600" />
            All Assigned ({assignedLockers.length})
          </TabsTrigger>
          <TabsTrigger value="waitlist" data-testid="tab-waiting-list" className="gap-2">
            <Clock className="h-4 w-4 !text-orange-600" />
            Waiting List ({lockerWaitlist.length})
          </TabsTrigger>
        </TabsList>

        {/* All BCI Managed Lockers Tab */}
        <TabsContent value="bci-managed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All BCI Managed Lockers ({bciManagedLockers.length})</CardTitle>
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
                        {location.office} - {location.building}
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

              {/* Export Actions */}
              <div className="flex justify-end gap-2 mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={bciManagedLockers.length === 0}
                      onClick={() => {
                        const success = quickExportLockersPDF(bciManagedLockers, 'All BCI Managed Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-bci-lockers-pdf"
                      aria-label="Export BCI managed lockers to PDF"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export BCI managed lockers to PDF report
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={bciManagedLockers.length === 0}
                      onClick={async () => {
                        const success = await quickExportLockersExcel(bciManagedLockers, 'All BCI Managed Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-bci-lockers-excel"
                      aria-label="Export BCI managed lockers to Excel"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export BCI managed lockers to Excel spreadsheet
                  </TooltipContent>
                </Tooltip>
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
                      {bciManagedLockers.filter(locker => {
                        const matchesSearch = locker.lockerNumber?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                                             locker.assignedUserName?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                                             locker.assignedUserEmail?.toLowerCase().includes(lockersSearchTerm.toLowerCase())
                        const matchesLocation = lockersLocationFilter === "all" || locker.locationId?.toString() === lockersLocationFilter
                        const matchesType = lockersTypeFilter === "all" || locker.lockerTypeId?.toString() === lockersTypeFilter
                        const matchesStatus = lockersStatusFilter === "all" || locker.status === lockersStatusFilter
                        return matchesSearch && matchesLocation && matchesType && matchesStatus
                      }).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No BCI managed lockers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        bciManagedLockers.filter(locker => {
                          const matchesSearch = locker.lockerNumber?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                                               locker.assignedUserName?.toLowerCase().includes(lockersSearchTerm.toLowerCase()) ||
                                               locker.assignedUserEmail?.toLowerCase().includes(lockersSearchTerm.toLowerCase())
                          const matchesLocation = lockersLocationFilter === "all" || locker.locationId?.toString() === lockersLocationFilter
                          const matchesType = lockersTypeFilter === "all" || locker.lockerTypeId?.toString() === lockersTypeFilter
                          const matchesStatus = lockersStatusFilter === "all" || locker.status === lockersStatusFilter
                          return matchesSearch && matchesLocation && matchesType && matchesStatus
                        }).map((locker) => (
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditLocker(locker)}
                                      data-testid={`button-edit-${locker.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit locker details</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteLocker(locker)}
                                      data-testid={`button-delete-${locker.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete locker</TooltipContent>
                                </Tooltip>
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

        {/* Available BCI Lockers Tab */}
        <TabsContent value="bci-available" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available BCI Managed Lockers ({availableBciLockers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Export Actions */}
              <div className="flex justify-end gap-2 mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={availableBciLockers.length === 0}
                      onClick={() => {
                        const success = quickExportLockersPDF(availableBciLockers, 'Available BCI Managed Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-available-lockers-pdf"
                      aria-label="Export available lockers to PDF"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export available BCI lockers to PDF report
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={availableBciLockers.length === 0}
                      onClick={async () => {
                        const success = await quickExportLockersExcel(availableBciLockers, 'Available BCI Managed Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-available-lockers-excel"
                      aria-label="Export available lockers to Excel"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export available BCI lockers to Excel spreadsheet
                  </TooltipContent>
                </Tooltip>
              </div>

              {isLoadingLockers ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : availableBciLockers.length === 0 ? (
                <Alert>
                  <AlertDescription>No available BCI managed lockers at this time.</AlertDescription>
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
                      {availableBciLockers.map((locker) => (
                        <TableRow key={locker.id} data-testid={`row-available-locker-${locker.id}`}>
                          <TableCell className="font-medium" data-testid={`text-available-locker-number-${locker.id}`}>
                            {locker.lockerNumber}
                          </TableCell>
                          <TableCell data-testid={`text-available-location-${locker.id}`}>
                            {locker.locationName || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-available-type-${locker.id}`}>
                            {locker.lockerTypeName || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    onClick={() => handleShowAssignDialog(locker)}
                                    data-testid={`button-assign-${locker.id}`}
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Assign
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Assign locker to user</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditLocker(locker)}
                                    data-testid={`button-edit-available-${locker.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit locker details</TooltipContent>
                              </Tooltip>
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

        {/* Assigned Lockers Tab */}
        <TabsContent value="assigned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Lockers ({assignedLockers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Export Actions */}
              <div className="flex justify-end gap-2 mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={assignedLockers.length === 0}
                      onClick={() => {
                        const success = quickExportLockersPDF(assignedLockers, 'Assigned Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-assigned-lockers-pdf"
                      aria-label="Export assigned lockers to PDF"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export assigned lockers to PDF report
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={assignedLockers.length === 0}
                      onClick={async () => {
                        const success = await quickExportLockersExcel(assignedLockers, 'Assigned Lockers Report', (errorMessage) => {
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
                      data-testid="button-export-assigned-lockers-excel"
                      aria-label="Export assigned lockers to Excel"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export assigned lockers to Excel spreadsheet
                  </TooltipContent>
                </Tooltip>
              </div>

              {isLoadingLockers ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : assignedLockers.length === 0 ? (
                <Alert>
                  <AlertDescription>No assigned lockers found.</AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-assigned-locker-number">Locker Number</TableHead>
                        <TableHead data-testid="header-assigned-location">Location</TableHead>
                        <TableHead data-testid="header-assigned-type">Type</TableHead>
                        <TableHead data-testid="header-assigned-status">Status</TableHead>
                        <TableHead data-testid="header-assigned-assigned-to">Assigned To</TableHead>
                        <TableHead data-testid="header-assigned-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedLockers.map((locker) => (
                        <TableRow key={locker.id} data-testid={`row-assigned-locker-${locker.id}`}>
                          <TableCell className="font-medium" data-testid={`text-assigned-locker-number-${locker.id}`}>
                            {locker.lockerNumber}
                          </TableCell>
                          <TableCell data-testid={`text-assigned-location-${locker.id}`}>
                            {locker.locationName || '-'}
                          </TableCell>
                          <TableCell data-testid={`text-assigned-type-${locker.id}`}>
                            {locker.lockerTypeName || '-'}
                          </TableCell>
                          <TableCell data-testid={`badge-assigned-status-${locker.id}`}>
                            <Badge variant={locker.status === "available" ? "outline" : "default"}>
                              {locker.status}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-assigned-assigned-user-${locker.id}`}>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditLocker(locker)}
                                    data-testid={`button-edit-assigned-${locker.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit locker details</TooltipContent>
                              </Tooltip>
                              {locker.status === "assigned" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleShowUnassignDialog(locker)}
                                      data-testid={`button-unassign-assigned-${locker.id}`}
                                    >
                                      <UserMinus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Unassign locker</TooltipContent>
                                </Tooltip>
                              )}
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

        {/* WAITLIST TAB */}
        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Locker Waitlist ({lockerWaitlist.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Waitlist Filters */}
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
                  <SelectTrigger className="w-[180px]" data-testid="select-waitlist-filter-location">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.office} - {location.building}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={waitlistStatusFilter} onValueChange={setWaitlistStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-waitlist-filter-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Actions */}
              <div className="flex justify-end gap-2 mb-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={filteredWaitlist.length === 0}
                      onClick={() => {
                        const success = quickExportLockerWaitlistPDF(filteredWaitlist, 'Locker Waitlist Report', (errorMessage) => {
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
                      data-testid="button-export-waitlist-pdf"
                      aria-label="Export waitlist to PDF"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export locker waitlist to PDF report
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm"
                      variant="outline" 
                      disabled={filteredWaitlist.length === 0}
                      onClick={async () => {
                        const success = await quickExportLockerWaitlistExcel(filteredWaitlist, 'Locker Waitlist Report', (errorMessage) => {
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
                      data-testid="button-export-waitlist-excel"
                      aria-label="Export waitlist to Excel"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export locker waitlist to Excel spreadsheet
                  </TooltipContent>
                </Tooltip>
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
                        <TableHead data-testid="header-waitlist-location">Preferred Location</TableHead>
                        <TableHead data-testid="header-waitlist-type">Preferred Type</TableHead>
                        <TableHead data-testid="header-waitlist-status">Status</TableHead>
                        <TableHead data-testid="header-waitlist-enrolled">Enrolled Date</TableHead>
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
                            <TableCell data-testid={`text-waitlist-location-${item.id}`}>
                              {item.locationName || '-'}
                            </TableCell>
                            <TableCell data-testid={`text-waitlist-type-${item.id}`}>
                              {item.lockerTypeName || 'Any'}
                            </TableCell>
                            <TableCell data-testid={`badge-waitlist-status-${item.id}`}>
                              <Badge variant={item.status === "pending" ? "outline" : "default"}>
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-waitlist-enrolled-${item.id}`}>
                              {item.requestedAt ? format(new Date(item.requestedAt), 'MMM dd, yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.status === "pending" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        onClick={() => updateWaitlistStatusMutation.mutate({ id: item.id, status: "fulfilled" })}
                                        data-testid={`button-fulfill-${item.id}`}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Fulfill
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Mark as fulfilled</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removeFromWaitlistMutation.mutate(item.id)}
                                      data-testid={`button-remove-waitlist-${item.id}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Remove
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove from waitlist</TooltipContent>
                                </Tooltip>
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
      </Tabs>

      {/* Add Locker Dialog */}
      <Dialog open={showAddLockerDialog} onOpenChange={setShowAddLockerDialog}>
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
              <Label htmlFor="edit-locker-type">Locker Type *</Label>
              <Select
                value={editLockerForm.lockerTypeId?.toString()}
                onValueChange={(value) => setEditLockerForm({ ...editLockerForm, lockerTypeId: parseInt(value) })}
              >
                <SelectTrigger id="edit-locker-type" data-testid="select-edit-locker-type">
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
            <DialogTitle>Assign Locker</DialogTitle>
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
                            onSelect={() => {
                              setAssignForm({ ...assignForm, userId: user.id })
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
              <Label>Effective Date</Label>
              <Popover open={assignDatePickerOpen} onOpenChange={setAssignDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-assign-effective-date"
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
                    holidays={statHolidays}
                    initialFocus
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
            <DialogTitle>Unassign Locker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Popover open={unassignDatePickerOpen} onOpenChange={setUnassignDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-unassign-effective-date"
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
                    holidays={statHolidays}
                    initialFocus
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

      {/* Add to Waitlist Dialog */}
      <Dialog open={showAddToWaitlistDialog} onOpenChange={setShowAddToWaitlistDialog}>
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
                            onSelect={() => {
                              setAddToWaitlistForm({ ...addToWaitlistForm, userId: user.id })
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
              <Label htmlFor="waitlist-location">Preferred Location</Label>
              <Select
                value={addToWaitlistForm.locationId?.toString()}
                onValueChange={(value) => setAddToWaitlistForm({ ...addToWaitlistForm, locationId: parseInt(value) })}
              >
                <SelectTrigger id="waitlist-location" data-testid="select-waitlist-location">
                  <SelectValue placeholder="Select preferred location" />
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
              <Label htmlFor="waitlist-locker-type">Preferred Locker Type</Label>
              <Select
                value={addToWaitlistForm.requestedLockerTypeId?.toString()}
                onValueChange={(value) => setAddToWaitlistForm({ ...addToWaitlistForm, requestedLockerTypeId: parseInt(value) })}
              >
                <SelectTrigger id="waitlist-locker-type" data-testid="select-waitlist-locker-type">
                  <SelectValue placeholder="Select preferred locker type" />
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
                placeholder="Optional notes or special requirements"
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
    </div>
  )
}
