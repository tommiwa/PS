import { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Link } from "wouter"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete'
import '@geoapify/geocoder-autocomplete/styles/minimal.css'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TablePagination } from "@/components/shared/TablePagination"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays, UserPlus, ArrowRight,
  Timer, Target, CheckCircle2, Search, Filter,
  Zap, Accessibility, Building, MoreHorizontal, Info, RefreshCw,
  Trash2, Edit, UserMinus, UserCheck, Download, FileText,
  Eye, EyeOff, Layers, Sparkles
} from "lucide-react"
import type { WaitingList, ParkingSpot, ParkingSpotWithUser, SpotType, Location, SpotTypeTable } from "@shared/schema"
import { quickExportParkingSpotsPDF, quickExportParkingSpotsExcel, quickExportWaitingListPDF, quickExportWaitingListExcel } from "@/utils/export-utils"

// Standard parking locations (preferred for new spots)
const STANDARD_PARKING_LOCATIONS = [
  { value: "Victoria - 750 Pandora Ave, Parking Level 1", label: "Victoria - 750 Pandora Ave, Parking Level 1" },
  { value: "Victoria - 750 Pandora Ave, Parking Level 2", label: "Victoria - 750 Pandora Ave, Parking Level 2" }
];

export default function AdminParkingManagement() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [availableSpotsSearchTerm, setAvailableSpotsSearchTerm] = useState("")
  const [availableSpotsFilterValues, setAvailableSpotsFilterValues] = useState<FilterValues>({})
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [waitingListFilterValues, setWaitingListFilterValues] = useState<FilterValues>({})
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAddSpotDialog, setShowAddSpotDialog] = useState(false)
  const [showEditSpotDialog, setShowEditSpotDialog] = useState(false)
  const [showAddToWaitingDialog, setShowAddToWaitingDialog] = useState(false)
  const [showDirectAssignDialog, setShowDirectAssignDialog] = useState(false)
  const [showReleaseSpotDialog, setShowReleaseSpotDialog] = useState(false)
  const [showAssignAvailableSpotDialog, setShowAssignAvailableSpotDialog] = useState(false)
  const [showCreateAvailabilityDialog, setShowCreateAvailabilityDialog] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotWithUser | null>(null)
  const [selectedSpotForAssign, setSelectedSpotForAssign] = useState<ParkingSpotWithUser | null>(null)
  const [selectedSpotForRelease, setSelectedSpotForRelease] = useState<ParkingSpotWithUser | null>(null)
  const [selectedAvailableSpot, setSelectedAvailableSpot] = useState<ParkingSpotWithUser | null>(null)
  
  // Date picker popover state for auto-close functionality
  const [singleDatePickerOpen, setSingleDatePickerOpen] = useState(false)
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false)
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false)
  const [selectedUserForWaiting, setSelectedUserForWaiting] = useState("")
  const [selectedUserForAssign, setSelectedUserForAssign] = useState("")
  const [selectedUserForAvailableSpot, setSelectedUserForAvailableSpot] = useState("")
  const [assignAvailableSpotFormData, setAssignAvailableSpotFormData] = useState({
    isBciManaged: true
  })
  const [activeSpotTab, setActiveSpotTab] = useState("bci-managed")
  const [unallocatedFilterType, setUnallocatedFilterType] = useState("all")
  
  // Form state for add to waiting list dialog
  const [waitingListFormData, setWaitingListFormData] = useState({
    userId: "",
    preferredSpotTypeId: undefined as number | undefined,
    preferredLocationId: undefined as number | undefined,
    priority: 2, // 1=high, 2=medium, 3=low
    reason: ""
  })
  
  // Form state for direct assignment dialog
  const [directAssignFormData, setDirectAssignFormData] = useState({
    userId: "",
    duration: "permanent",
    isBciManaged: true,
    notes: ""
  })
  
  // User search state for direct assignment
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [debouncedUserSearchQuery, setDebouncedUserSearchQuery] = useState("")
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false)
  
  // Debounce user search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearchQuery(userSearchQuery)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [userSearchQuery])
  
  // Bookability control state
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set())
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false)
  
  // Pagination state for All BCI Managed Spots
  const [allSpotsPageIndex, setAllSpotsPageIndex] = useState(0)
  const [allSpotsPageSize, setAllSpotsPageSize] = useState(10)

  // Pagination state for Available BCI Managed Spots
  const [availableSpotsPageIndex, setAvailableSpotsPageIndex] = useState(0)
  const [availableSpotsPageSize, setAvailableSpotsPageSize] = useState(10)

  // Pagination state for Waiting List
  const [waitingListPageIndex, setWaitingListPageIndex] = useState(0)
  const [waitingListPageSize, setWaitingListPageSize] = useState(25)

  // Pagination state for Personal Spots
  const [personalSpotsPageIndex, setPersonalSpotsPageIndex] = useState(0)
  const [personalSpotsPageSize, setPersonalSpotsPageSize] = useState(10)
  
  // Cards visibility hook
  const { cardsVisible, toggleCards } = useCardsVisibility("parking-management")
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Refresh all data handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      ])
      toast({
        title: "Refreshed",
        description: "Parking management data has been refreshed",
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

  // Form state for edit dialog
  const [editFormData, setEditFormData] = useState({
    spotNumber: "",
    locationId: undefined as number | undefined,
    spotTypeId: undefined as number | undefined,
    isIndoor: false,
    isActive: true,
    isBookable: true,
    isBciManaged: false,
    description: "",
    ownerId: null as string | null
  })
  
  // Form state for add spot dialog
  const [addSpotFormData, setAddSpotFormData] = useState({
    spotNumber: "",
    locationId: undefined as number | undefined,
    spotTypeId: undefined as number | undefined,
    isIndoor: false,
    isActive: true,
    isBookable: true,
    isBciManaged: false,
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
  
  // Form state for create availability dialog
  const [createAvailabilityFormData, setCreateAvailabilityFormData] = useState({
    listingType: "single" as "single" | "period",
    singleDate: undefined as Date | undefined,
    periodStartDate: undefined as Date | undefined,
    periodEndDate: undefined as Date | undefined,
    dailyRate: ""
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

  // Use only standard parking locations (no existing locations)
  const allLocationOptions = STANDARD_PARKING_LOCATIONS;

  // Fetch all users for dropdown selection
  const { data: allUsers = [], isLoading: isLoadingUsers, error: usersError } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch lookup data for form dropdowns
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: spotTypes = [], isLoading: isLoadingSpotTypes } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  });

  // Search users for direct assignment (only triggers when query >= 3 chars)
  const { data: searchedUsers = [], isLoading: isSearchingUsers } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  }>>({
    queryKey: [`/api/admin/search-users?query=${encodeURIComponent(debouncedUserSearchQuery)}`],
    enabled: debouncedUserSearchQuery.length >= 3,
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

  // Filter waiting list - show all waiting list entries, not just active (keeping this for backwards compatibility)
  const filteredWaitingList = allWaitingList?.filter(item => {
    const matchesSearch = item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    const preferredSpotTypeName = item.preferredSpotTypeId 
      ? spotTypes.find(st => st.id === item.preferredSpotTypeId)?.name 
      : null;
    const matchesType = unallocatedFilterType === "all" || preferredSpotTypeName === unallocatedFilterType
    return matchesSearch && matchesType
  }) || []

  // Mutation to assign a spot from the waiting list
  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ userId, spotId }: { userId: string; spotId: string }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { userId, spotId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
    mutationFn: async ({ waitingListId, userId }: { waitingListId: string; userId: string }) => {
      return await apiRequest(`/api/waiting-list/${waitingListId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      // Also invalidate the user-specific waiting list query so their profile updates
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", variables.userId] });
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

  // Mutation for bulk update of spots
  const bulkUpdateSpotsMutation = useMutation({
    mutationFn: async ({ spotIds, updates }: { spotIds: string[]; updates: { isActive?: boolean; isBookable?: boolean } }) => {
      return await apiRequest(`/api/admin/spots/bulk-update`, {
        method: "POST",
        body: { spotIds, updates },
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      
      const updateMessages = [];
      if (variables.updates.isActive !== undefined) {
        updateMessages.push(`made ${variables.updates.isActive ? 'active' : 'inactive'}`);
      }
      if (variables.updates.isBookable !== undefined) {
        updateMessages.push(`made ${variables.updates.isBookable ? 'bookable' : 'not bookable'}`);
      }
      
      toast({
        title: "Success",
        description: `${variables.spotIds.length} spot(s) ${updateMessages.join(' and ')}.`,
        variant: "success",
      });
      
      handleClearSelection();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update spots.",
        variant: "error",
      });
    },
  });

  // Mutation for bulk creating spot listings
  const bulkCreateListingsMutation = useMutation({
    mutationFn: async (data: {
      spotIds: string[];
      listingType: "single" | "period";
      singleDate?: string;
      periodStartDate?: string;
      periodEndDate?: string;
      dailyRate: number;
    }) => {
      return await apiRequest(`/api/admin/bulk-create-listings`, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      
      const dateDescription = variables.listingType === "single" 
        ? `for ${variables.singleDate}`
        : `from ${variables.periodStartDate} to ${variables.periodEndDate}`;
      
      toast({
        title: "Success",
        description: `Created ${variables.spotIds.length} spot listing(s) ${dateDescription} at $${variables.dailyRate}/day.`,
        variant: "success",
      });
      
      setShowCreateAvailabilityDialog(false);
      setCreateAvailabilityFormData({
        listingType: "single",
        singleDate: undefined,
        periodStartDate: undefined,
        periodEndDate: undefined,
        dailyRate: ""
      });
      handleClearSelection();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create spot listings.",
        variant: "error",
      });
    },
  });

  // Handler to create spot with custom location if needed
  const handleAddSpotWithCustomLocation = async () => {
    try {
      let locationIdToUse = addSpotFormData.locationId;
      
      // If creating custom location for Personal spots, create it first
      if (isCreatingCustomLocation && !addSpotFormData.isBciManaged) {
        // Validate custom location fields
        if (!customLocationData.office || !customLocationData.building || !customLocationData.level) {
          toast({
            title: "Validation Error",
            description: "Office, building, and level are required for custom locations.",
            variant: "destructive",
          });
          return;
        }
        
        // Create the custom location
        const locationResponse: any = await createLocationMutation.mutateAsync(customLocationData);
        locationIdToUse = locationResponse.id;
      }
      
      // Now create the spot with the location ID
      if (locationIdToUse) {
        // Business Rule: Reserved spots (spotTypeId = 2) should NOT be bookable (reserved for C-suite)
        const isReservedSpot = addSpotFormData.spotTypeId === 2;
        
        await addSpotMutation.mutateAsync({
          ...addSpotFormData,
          locationId: locationIdToUse,
          isBookable: isReservedSpot ? false : addSpotFormData.isBookable, // Force isBookable to false for Reserved spots
          ownerId: addSpotFormData.isBciManaged ? null : undefined // BCI spots have null owner, Personal spots will be unassigned
        });
        
        // Reset custom location state
        setIsCreatingCustomLocation(false);
        setCustomLocationData({
          office: "",
          building: "",
          level: "",
          address: ""
        });
      }
    } catch (error: any) {
      console.error("Error adding spot with custom location:", error);
    }
  };

  // Mutation to add a new spot
  const addSpotMutation = useMutation({
    mutationFn: async (spotData: typeof addSpotFormData & { ownerId?: string | null }) => {
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
        locationId: undefined,
        spotTypeId: undefined,
        isIndoor: false,
        isActive: true,
        isBookable: true,
        isBciManaged: false,
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
      // Business Rule: Reserved spots (spotTypeId = 2) should NOT be bookable (reserved for C-suite)
      const isReservedSpot = spotData.spotTypeId === 2;
      const finalSpotData = {
        ...spotData,
        isBookable: isReservedSpot ? false : spotData.isBookable // Force isBookable to false for Reserved spots
      };
      
      return await apiRequest(`/api/admin/spots/${spotId}`, {
        method: "PATCH",
        body: finalSpotData,
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/admin/all-spots"] });
      await queryClient.refetchQueries({ queryKey: ["/api/admin/unallocated-spots"] });
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
        preferredSpotTypeId: undefined,
        preferredLocationId: undefined,
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

  // Mutation to create custom location
  const createLocationMutation = useMutation({
    mutationFn: async (locationData: typeof customLocationData) => {
      return await apiRequest(`/api/admin/locations`, {
        method: "POST",
        body: locationData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: "Success",
        description: "Custom location created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create location.",
        variant: "destructive",
      });
    },
  });

  // Mutation for direct assignment
  const directAssignMutation = useMutation({
    mutationFn: async ({ spotId, assignmentData }: { spotId: string; assignmentData: typeof directAssignFormData }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { spotId, userId: assignmentData.userId, isBciManaged: assignmentData.isBciManaged },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
        isBciManaged: true,
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
    mutationFn: async ({ spotId, userId, isBciManaged }: { spotId: string; userId: string; isBciManaged: boolean }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { spotId, userId, isBciManaged },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      // Also invalidate waiting list queries since user may have been removed from waiting list
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
      setAssignAvailableSpotFormData({
        isBciManaged: true
      });
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
      locationId: spot.locationId ?? undefined,
      spotTypeId: spot.spotTypeId ?? undefined,
      isIndoor: spot.isIndoor || false,
      isActive: spot.isActive !== false,
      isBookable: spot.isBookable !== false,
      isBciManaged: spot.isBciManaged || false,
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
      removeFromWaitingListMutation.mutate({
        waitingListId: waitingListItem.id,
        userId: waitingListItem.userId
      });
    }
  };

  const handleDirectAssign = (spot: ParkingSpot) => {
    setSelectedSpotForAssign(spot);
    setDirectAssignFormData({
      userId: "",
      duration: "permanent",
      isBciManaged: spot?.isBciManaged ?? true,
      notes: ""
    });
    setShowDirectAssignDialog(true);
  };

  const handleReleaseSpot = (spot: ParkingSpot) => {
    setSelectedSpotForRelease(spot);
    setShowReleaseSpotDialog(true);
  };

  const handleAssignAvailableSpot = (spot: ParkingSpot) => {
    setSelectedAvailableSpot(spot);
    setAssignAvailableSpotFormData({
      isBciManaged: spot?.isBciManaged ?? true
    });
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
    
    // Update select all checkbox based on sortedAvailableSpots
    const allAvailableSpotsSelected = sortedAvailableSpots.every(spot => newSelectedSpots.has(spot.id));
    setIsSelectAllChecked(allAvailableSpotsSelected && sortedAvailableSpots.length > 0);
  };

  const handleSelectAllSpots = () => {
    if (isSelectAllChecked) {
      // Deselect all spots
      setSelectedSpots(new Set());
      setIsSelectAllChecked(false);
    } else {
      // Select all spots from allSpots
      setSelectedSpots(new Set(allSpots.map(spot => spot.id)));
      setIsSelectAllChecked(true);
    }
  };

  const handleSelectAllAvailableSpots = () => {
    if (isSelectAllChecked) {
      // Deselect all available spots
      setSelectedSpots(new Set());
      setIsSelectAllChecked(false);
    } else {
      // Select all available spots from sortedAvailableSpots
      setSelectedSpots(new Set(sortedAvailableSpots.map(spot => spot.id)));
      setIsSelectAllChecked(true);
    }
  };
  
  const handleClearSelection = () => {
    setSelectedSpots(new Set());
    setIsSelectAllChecked(false);
  };

  // Enhanced filtering for parking spots
  const filteredSpots = allSpots.filter(spot => {
    const matchesTab = activeSpotTab === "bci-managed" ? spot.isBciManaged :
                     activeSpotTab === "personal" ? !spot.isBciManaged :
                     false; // Don't use this filter for bci-available or waiting tabs
    
    // If the tab doesn't use this filter, skip this spot
    if (activeSpotTab === "bci-managed" || activeSpotTab === "personal") {
      if (!matchesTab) return false;
    }
    
    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = spot.spotNumber.toLowerCase().includes(searchLower) ||
                           (spot.locationName?.toLowerCase().includes(searchLower) ?? false)
      if (!matchesSearch) return false
    }
    
    // Spot type filter
    if (filterValues.spotType && filterValues.spotType !== "all") {
      if (spot.spotTypeName !== filterValues.spotType) return false
    }
    
    // Location filter - exact match since dropdown has all actual values
    if (filterValues.location && filterValues.location !== "all") {
      if (spot.locationName !== filterValues.location) {
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
      const isEnabled = spot.isActive !== false
      if (filterValues.enableStatus === "enabled" && !isEnabled) return false
      if (filterValues.enableStatus === "disabled" && isEnabled) return false
    }
    
    return true
  });
  
  // Sorting functionality for parking spots
  const { sortState, sortedData: sortedSpots, handleSort } = useTableSort(
    filteredSpots,
    "spotNumber", // Default sort by spot number
    "asc" // Ascending order
  )

  // Paginated data for All BCI Managed Spots
  const paginatedAllSpots = useMemo(() => {
    const startIndex = allSpotsPageIndex * allSpotsPageSize
    const endIndex = startIndex + allSpotsPageSize
    return sortedSpots.slice(startIndex, endIndex)
  }, [sortedSpots, allSpotsPageIndex, allSpotsPageSize])

  // Enhanced filtering for available BCI managed spots
  const filteredAvailableSpots = unallocatedSpots.filter(spot => {
    // Filter for BCI managed spots only
    if (!spot.isBciManaged) return false;
    
    // Search filter
    if (availableSpotsSearchTerm.trim()) {
      const searchLower = availableSpotsSearchTerm.toLowerCase()
      const matchesSearch = spot.spotNumber.toLowerCase().includes(searchLower) ||
                           (spot.locationName?.toLowerCase().includes(searchLower) ?? false)
      if (!matchesSearch) return false
    }
    
    // Spot type filter
    if (availableSpotsFilterValues.spotType && availableSpotsFilterValues.spotType !== "all") {
      if (spot.spotTypeName !== availableSpotsFilterValues.spotType) return false
    }
    
    // Location filter - exact match since dropdown has all actual values
    if (availableSpotsFilterValues.location && availableSpotsFilterValues.location !== "all") {
      if (spot.locationName !== availableSpotsFilterValues.location) {
        return false
      }
    }
    
    // Enable/Disable status filter
    if (availableSpotsFilterValues.enableStatus && availableSpotsFilterValues.enableStatus !== "all") {
      const isEnabled = spot.isActive !== false
      if (availableSpotsFilterValues.enableStatus === "enabled" && !isEnabled) return false
      if (availableSpotsFilterValues.enableStatus === "disabled" && isEnabled) return false
    }
    
    return true
  });

  // Sorting functionality for available spots
  const { sortState: availableSpotsSortState, sortedData: sortedAvailableSpots, handleSort: handleAvailableSpotsSort } = useTableSort(
    filteredAvailableSpots,
    "spotNumber", // Default sort by spot number
    "asc" // Ascending order
  )

  // Paginated data for Available BCI Managed Spots
  const paginatedAvailableSpots = useMemo(() => {
    const startIndex = availableSpotsPageIndex * availableSpotsPageSize
    const endIndex = startIndex + availableSpotsPageSize
    return sortedAvailableSpots.slice(startIndex, endIndex)
  }, [sortedAvailableSpots, availableSpotsPageIndex, availableSpotsPageSize])

  // Paginated data for Personal Spots
  const paginatedPersonalSpots = useMemo(() => {
    const startIndex = personalSpotsPageIndex * personalSpotsPageSize
    const endIndex = startIndex + personalSpotsPageSize
    return sortedSpots.slice(startIndex, endIndex)
  }, [sortedSpots, personalSpotsPageIndex, personalSpotsPageSize])

  // Enhanced filtering for waiting list
  const filteredWaitingListEnhanced = allWaitingList?.filter(item => {
    // Search filter
    if (waitingListSearchTerm.trim()) {
      const searchLower = waitingListSearchTerm.toLowerCase()
      const matchesSearch = item.userName?.toLowerCase().includes(searchLower) ||
                           item.userEmail?.toLowerCase().includes(searchLower) ||
                           item.reason?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Priority filter
    if (waitingListFilterValues.priority && waitingListFilterValues.priority !== "all") {
      if (item.priority?.toString() !== waitingListFilterValues.priority) return false
    }
    
    // Preferred spot type filter
    if (waitingListFilterValues.preferredSpotType && waitingListFilterValues.preferredSpotType !== "all") {
      const preferredSpotTypeName = item.preferredSpotTypeId 
        ? spotTypes.find(st => st.id === item.preferredSpotTypeId)?.name 
        : null;
      if (preferredSpotTypeName !== waitingListFilterValues.preferredSpotType) return false
    }
    
    // Status filter
    if (waitingListFilterValues.status && waitingListFilterValues.status !== "all") {
      // If a specific status is selected, show only that status
      if (item.status !== waitingListFilterValues.status) return false
    } else {
      // By default (when no status filter is selected), exclude "assigned" entries
      // since those users have already received their parking spots
      if (item.status === "assigned") return false
    }
    
    return true
  }) || []

  // Sorting functionality for waiting list
  const { sortState: waitingListSortState, sortedData: sortedWaitingList, handleSort: handleWaitingListSort } = useTableSort(
    filteredWaitingListEnhanced,
    "enrolledDate", // Default sort by enrolled date
    "desc" // Descending order (newest first)
  )

  // Paginated data for Waiting List
  const paginatedWaitingList = useMemo(() => {
    const startIndex = waitingListPageIndex * waitingListPageSize
    const endIndex = startIndex + waitingListPageSize
    return sortedWaitingList.slice(startIndex, endIndex)
  }, [sortedWaitingList, waitingListPageIndex, waitingListPageSize])

  // Page clamping useEffects to prevent invalid page indices
  // Clamp All Spots page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedSpots.length / allSpotsPageSize) - 1)
    if (allSpotsPageIndex > maxPage) {
      setAllSpotsPageIndex(maxPage)
    }
  }, [sortedSpots.length, allSpotsPageSize, allSpotsPageIndex])

  // Clamp Available Spots page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedAvailableSpots.length / availableSpotsPageSize) - 1)
    if (availableSpotsPageIndex > maxPage) {
      setAvailableSpotsPageIndex(maxPage)
    }
  }, [sortedAvailableSpots.length, availableSpotsPageSize, availableSpotsPageIndex])

  // Clamp Waiting List page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedWaitingList.length / waitingListPageSize) - 1)
    if (waitingListPageIndex > maxPage) {
      setWaitingListPageIndex(maxPage)
    }
  }, [sortedWaitingList.length, waitingListPageSize, waitingListPageIndex])

  // Clamp Personal Spots page
  useEffect(() => {
    // Only clamp when on personal tab
    if (activeSpotTab === 'personal') {
      const maxPage = Math.max(0, Math.ceil(sortedSpots.length / personalSpotsPageSize) - 1)
      if (personalSpotsPageIndex > maxPage) {
        setPersonalSpotsPageIndex(maxPage)
      }
    }
  }, [sortedSpots.length, personalSpotsPageSize, personalSpotsPageIndex, activeSpotTab])

  // Reset page to 0 when filters or search terms change
  // Reset All Spots page on filter/search change
  useEffect(() => {
    setAllSpotsPageIndex(0)
  }, [searchTerm, filterValues])

  // Reset Personal Spots page on filter/search change
  useEffect(() => {
    setPersonalSpotsPageIndex(0)
  }, [searchTerm, filterValues])

  // Reset Available Spots page on filter/search change
  useEffect(() => {
    setAvailableSpotsPageIndex(0)
  }, [availableSpotsSearchTerm, availableSpotsFilterValues])

  // Reset Waiting List page on filter/search change
  useEffect(() => {
    setWaitingListPageIndex(0)
  }, [waitingListSearchTerm, waitingListFilterValues])
  
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
      options: allLocationOptions
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

  // Filter configuration for available spots
  const availableSpotsFilterConfigs: FilterConfig[] = [
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
      options: allLocationOptions
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

  // Filter configuration for waiting list
  const waitingListFilterConfigs: FilterConfig[] = [
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { value: "1", label: "High Priority" },
        { value: "2", label: "Medium Priority" },
        { value: "3", label: "Low Priority" }
      ]
    },
    {
      key: "preferredSpotType",
      label: "Preferred Spot Type",
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
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "assigned", label: "Assigned" },
        { value: "cancelled", label: "Cancelled" }
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

  // Handle available spots filter changes
  const handleAvailableSpotsFilterChange = (key: string, value: string | undefined) => {
    setAvailableSpotsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear available spots filters
  const handleClearAvailableSpotsFilters = () => {
    setAvailableSpotsSearchTerm("")
    setAvailableSpotsFilterValues({})
  }

  // Handle waiting list filter changes
  const handleWaitingListFilterChange = (key: string, value: string | undefined) => {
    setWaitingListFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear waiting list filters
  const handleClearWaitingListFilters = () => {
    setWaitingListSearchTerm("")
    setWaitingListFilterValues({})
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

  const getSpotTypeBadge = (spotType: SpotType | string | null | undefined) => {
    if (!spotType) {
      return <Badge variant="secondary" data-testid="badge-spot-type-unknown">Unknown</Badge>;
    }
    
    const badgeConfigs: Record<string, { className: string; label: string }> = {
      // Handle both slugs and names for backwards compatibility
      regular: { 
        className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", 
        label: "Regular" 
      },
      "Regular": { 
        className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", 
        label: "Regular" 
      },
      electric: { 
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        label: "EV Charging" 
      },
      "EV Chargers": { 
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        label: "EV Chargers" 
      },
      tesla_ev: { 
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", 
        label: "Tesla Charger" 
      },
      "Tesla Chargers": { 
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", 
        label: "Tesla Chargers" 
      },
      accessible: { 
        className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", 
        label: "Accessible" 
      },
      "Accessible": { 
        className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", 
        label: "Accessible" 
      },
      reserved: { 
        className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", 
        label: "Reserved" 
      },
      "Reserved": { 
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
          <h1 className="text-3xl font-bold">{t("admin.parkingManagement.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.parkingManagement.description")}
          </p>
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
                aria-label="Refresh all parking data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t("admin.parkingManagement.refreshData")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh all parking data and assignments
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => setShowAddToWaitingDialog(true)}
                data-testid="button-add-to-waiting"
                aria-label="Add user to waiting list"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t("admin.parkingManagement.addToWaiting")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add user to parking spot waiting list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => setShowAddSpotDialog(true)}
                data-testid="button-add-spot"
                aria-label="Create new parking spot"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.parkingManagement.addSpot")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Create new parking spot with location settings
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
              data-testid="card-total-spots" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("bci-managed")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spots</CardTitle>
                <div className="rounded-full border-2 border-blue-400 p-2">
                  <Car className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-spots">
                  {allSpots.length}
                </div>
                <p className="text-xs text-blue-600">All parking spots</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            Click to view all BCI managed parking spots
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card 
              data-testid="card-available-spots" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("bci-available")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("admin.parkingManagement.availableSpots")}</CardTitle>
                <div className="rounded-full border-2 border-green-400 p-2">
                  <Sparkles className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-available-spots">
                  {unallocatedSpots.length}
                </div>
                <p className="text-xs text-green-600">Unassigned spots</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            Click to view available BCI managed spots
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card 
              data-testid="card-bci-managed-total" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("bci-managed")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total BCI Managed Spots</CardTitle>
                <div className="rounded-full border-2 border-purple-400 p-2">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-bci-managed-total">
                  {allSpots.filter(spot => spot.isBciManaged).length}
                </div>
                <p className="text-xs text-purple-600">BCI managed spots</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            Click to view all BCI managed parking spots
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Card 
              data-testid="card-waiting-list" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("waiting")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Waiting List</CardTitle>
                <div className="rounded-full border-2 border-orange-400 p-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-waiting-list">
                  {waitingListMetrics.active}
                </div>
                <p className="text-xs text-orange-600">Pending requests</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            Click to view parking spot waiting list
          </TooltipContent>
        </Tooltip>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeSpotTab} onValueChange={setActiveSpotTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bci-managed" data-testid="tab-bci-managed-spots" className="gap-2">
            <Building className="h-4 w-4 !text-purple-600" />
            All BCI Managed ({allSpots.filter(spot => spot.isBciManaged).length})
          </TabsTrigger>
          <TabsTrigger value="bci-available" data-testid="tab-bci-available-spots" className="gap-2">
            <Sparkles className="h-4 w-4 !text-green-600" />
            Available BCI ({unallocatedSpots.filter(spot => spot.isBciManaged).length})
          </TabsTrigger>
          <TabsTrigger value="personal" data-testid="tab-personal-spots" className="gap-2">
            <Users className="h-4 w-4 !text-blue-600" />
            All Personal ({allSpots.filter(spot => !spot.isBciManaged).length})
          </TabsTrigger>
          <TabsTrigger value="waiting" data-testid="tab-waiting-list" className="gap-2">
            <Clock className="h-4 w-4 !text-orange-600" />
            {t("admin.parkingManagement.waiting")} ({waitingListMetrics.active})
          </TabsTrigger>
        </TabsList>

        {/* All BCI Managed Spots Tab */}
        <TabsContent value="bci-managed" className="space-y-4">
          {/* Enhanced Filters */}
          <EnhancedFilters
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterConfigs={parkingFilterConfigs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            searchPlaceholder={t("admin.parkingManagement.searchPlaceholder")}
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All BCI Managed Spots ({sortedSpots.length})</CardTitle>
                <div className="flex gap-2">
                  {selectedSpots.size > 0 && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Get selected spot details to check for Reserved spots
                              const selectedSpotDetails = allSpots.filter(spot => selectedSpots.has(spot.id));
                              const reservedSpots = selectedSpotDetails.filter(spot => spot.spotTypeId === 2);
                              const nonReservedSpots = selectedSpotDetails.filter(spot => spot.spotTypeId !== 2);
                              
                              if (reservedSpots.length > 0) {
                                // Show warning about Reserved spots
                                toast({
                                  title: "Reserved Spots Cannot Be Modified",
                                  description: `${reservedSpots.length} Reserved spot(s) (C-suite exclusive) cannot be made bookable. ${nonReservedSpots.length > 0 ? `Proceeding with ${nonReservedSpots.length} other spot(s).` : 'No action taken.'}`,
                                  variant: "warning",
                                });
                              }
                              
                              // Only process non-Reserved spots
                              if (nonReservedSpots.length > 0) {
                                toggleSpotBookabilityMutation.mutate({ 
                                  spotIds: nonReservedSpots.map(s => s.id), 
                                  isBookable: true 
                                });
                              }
                            }}
                            disabled={toggleSpotBookabilityMutation.isPending}
                            data-testid="button-make-bookable"
                            aria-label="Make selected spots bookable"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Make Bookable ({selectedSpots.size})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Make selected spots available for booking and rental
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Get selected spot details to check for Reserved spots
                              const selectedSpotDetails = allSpots.filter(spot => selectedSpots.has(spot.id));
                              const reservedSpots = selectedSpotDetails.filter(spot => spot.spotTypeId === 2);
                              const nonReservedSpots = selectedSpotDetails.filter(spot => spot.spotTypeId !== 2);
                              
                              if (reservedSpots.length > 0) {
                                // Show warning about Reserved spots
                                toast({
                                  title: "Reserved Spots Cannot Be Modified",
                                  description: `${reservedSpots.length} Reserved spot(s) (C-suite exclusive) are always non-bookable. ${nonReservedSpots.length > 0 ? `Proceeding with ${nonReservedSpots.length} other spot(s).` : 'No action taken.'}`,
                                  variant: "warning",
                                });
                              }
                              
                              // Only process non-Reserved spots
                              if (nonReservedSpots.length > 0) {
                                toggleSpotBookabilityMutation.mutate({ 
                                  spotIds: nonReservedSpots.map(s => s.id), 
                                  isBookable: false 
                                });
                              }
                            }}
                            disabled={toggleSpotBookabilityMutation.isPending}
                            data-testid="button-make-non-bookable"
                            aria-label="Make selected spots non-bookable"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Make Non-Bookable ({selectedSpots.size})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Make selected spots unavailable for booking (maintenance/reserved)
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                        aria-label="Export parking spots to PDF"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export parking spots data to PDF report
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                        aria-label="Export parking spots to Excel"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export parking spots data to Excel spreadsheet
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
          {sortedSpots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-spots">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{t("admin.parkingManagement.noSpotsFound")}</p>
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
{t("admin.parkingManagement.spotNumber")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="location"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
{t("admin.parkingManagement.location")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="spotType"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
{t("admin.parkingManagement.type")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isActive"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
{t("admin.parkingManagement.status")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="ownerId"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
{t("admin.parkingManagement.assignedTo")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isBookable"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
{t("admin.parkingManagement.assignmentStatus")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isBciManaged"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                          >
                            Management Type
                          </SortableTableHeader>
                          <TableHead>{t("admin.parkingManagement.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAllSpots.map((spot) => (
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
                              {spot.locationName}
                              {spot.isIndoor && <Badge variant="outline" className="ml-2">{t("admin.parkingManagement.indoor")}</Badge>}
                            </TableCell>
                            <TableCell data-testid={`text-spot-type-${spot.id}`}>
                              {getSpotTypeBadge(spot.spotTypeName)}
                            </TableCell>
                            <TableCell data-testid={`text-spot-status-${spot.id}`}>
                              <div className="flex gap-2">
                                {spot.isActive !== false ? (
                                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">{t("admin.parkingManagement.active")}</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">{t("admin.parkingManagement.inactive")}</Badge>
                                )}
                                {spot.isBookable !== false ? (
                                  <Badge variant="outline">{t("admin.parkingManagement.bookable")}</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100">Not Bookable</Badge>
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
                                <p className="font-medium text-muted-foreground">{t("admin.parkingManagement.workplaceServices")}</p>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-spot-assignment-status-${spot.id}`}>
                              {spot.ownerId ? (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{t("admin.parkingManagement.assigned")}</Badge>
                              ) : (
                                <Badge variant="outline">{t("admin.parkingManagement.available")}</Badge>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-spot-management-type-${spot.id}`}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {spot.isBciManaged ? (
                                    <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
                                      BCI Managed
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                      Personal
                                    </Badge>
                                  )}
                                </TooltipTrigger>
                                <TooltipContent>
                                  {spot.isBciManaged 
                                    ? "BCI Managed: Only admins can reassign. Personal: Owner can create listings."
                                    : "Personal: Owner can create listings and manage availability."}
                                </TooltipContent>
                              </Tooltip>
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
                    <TablePagination
                      totalCount={sortedSpots.length}
                      pageSize={allSpotsPageSize}
                      pageIndex={allSpotsPageIndex}
                      onPageSizeChange={(size) => {
                        setAllSpotsPageSize(size)
                        setAllSpotsPageIndex(0)
                      }}
                      onPageIndexChange={setAllSpotsPageIndex}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
        </TabsContent>

        {/* Available BCI Managed Spots Tab */}
        <TabsContent value="bci-available" className="space-y-4">
          {/* Enhanced Filters for Available Spots */}
          <EnhancedFilters
            searchValue={availableSpotsSearchTerm}
            onSearchChange={setAvailableSpotsSearchTerm}
            filterConfigs={availableSpotsFilterConfigs}
            filterValues={availableSpotsFilterValues}
            onFilterChange={handleAvailableSpotsFilterChange}
            onClearFilters={handleClearAvailableSpotsFilters}
            searchPlaceholder={t("admin.parkingManagement.availableSearchPlaceholder")}
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available BCI Managed Spots ({sortedAvailableSpots.length})</CardTitle>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedAvailableSpots.length === 0}
                        onClick={() => {
                          const success = quickExportParkingSpotsPDF(sortedAvailableSpots, 'Available Spots Report', (errorMessage) => {
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
                        data-testid="button-export-available-spots-pdf"
                        aria-label="Export available spots to PDF"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export available spots data to PDF report
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedAvailableSpots.length === 0}
                        onClick={() => {
                          const success = quickExportParkingSpotsExcel(sortedAvailableSpots, 'Available Spots Report', (errorMessage) => {
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
                        data-testid="button-export-available-spots-excel"
                        aria-label="Export available spots to Excel"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export available spots data to Excel spreadsheet
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedAvailableSpots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-unallocated-spots">
                  <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No available spots found matching your criteria.</p>
                </div>
              ) : (
                <>
                  {selectedSpots.size > 0 && (
                    <Alert className="mb-4" data-testid="toolbar-bulk-actions">
                      <AlertDescription className="flex items-center justify-between">
                        <span className="font-medium">{selectedSpots.size} spot(s) selected</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Get selected spot details to check for non-bookable spots
                              const selectedSpotDetails = unallocatedSpots.filter(spot => selectedSpots.has(spot.id));
                              const nonBookableSpots = selectedSpotDetails.filter(spot => !spot.isBookable || spot.spotTypeId === 2);
                              
                              if (nonBookableSpots.length > 0) {
                                // Show error about non-bookable spots
                                toast({
                                  title: "Cannot Create Availability",
                                  description: `${nonBookableSpots.length} selected spot(s) are not bookable (Reserved or disabled). Please select only bookable spots to create availability.`,
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              setShowCreateAvailabilityDialog(true);
                            }}
                            data-testid="button-create-availability"
                          >
                            <CalendarDays className="h-4 w-4 mr-2" />
                            Create Availability
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearSelection}
                            data-testid="button-clear-selection"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="overflow-x-auto">
                    <Table data-testid="table-unallocated-spots">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={isSelectAllChecked}
                              onCheckedChange={handleSelectAllAvailableSpots}
                              data-testid="checkbox-select-all-available-spots"
                              aria-label="Select all available spots"
                            />
                          </TableHead>
                          <SortableTableHeader
                            column="spotNumber"
                            currentSortColumn={availableSpotsSortState.column}
                            currentSortDirection={availableSpotsSortState.direction}
                            onSort={handleAvailableSpotsSort}
                          >
                            Spot Number
                          </SortableTableHeader>
                        <SortableTableHeader
                          column="location"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotType"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="isActive"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerId"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Assigned To
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="isBookable"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Assignment Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="isBciManaged"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Management Type
                        </SortableTableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAvailableSpots.map((spot) => (
                        <TableRow key={spot.id} data-testid={`row-unallocated-spot-${spot.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSpots.has(spot.id)}
                              onCheckedChange={() => handleToggleSpotSelection(spot.id)}
                              data-testid={`checkbox-select-spot-${spot.id}`}
                              aria-label={`Select spot ${spot.spotNumber}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-unallocated-spot-number-${spot.id}`}>
                            {spot.spotNumber}
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-location-${spot.id}`}>
                            {spot.locationName}
                            {spot.isIndoor && <Badge variant="outline" className="ml-2">Indoor</Badge>}
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-type-${spot.id}`}>
                            {getSpotTypeBadge(spot.spotTypeName)}
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
                                <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100">Not Bookable</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-assigned-to-${spot.id}`}>
                            <p className="font-medium text-muted-foreground">Workplace Services</p>
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-assignment-status-${spot.id}`}>
                            <Badge variant="outline">Available</Badge>
                          </TableCell>
                          <TableCell data-testid={`text-unallocated-spot-management-type-${spot.id}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {spot.isBciManaged ? (
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">
                                    BCI Managed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                    Personal
                                  </Badge>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {spot.isBciManaged 
                                  ? "BCI Managed: Only admins can reassign. Personal: Owner can create listings."
                                  : "Personal: Owner can create listings and manage availability."}
                              </TooltipContent>
                            </Tooltip>
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
                  <TablePagination
                    totalCount={sortedAvailableSpots.length}
                    pageSize={availableSpotsPageSize}
                    pageIndex={availableSpotsPageIndex}
                    onPageSizeChange={(size) => {
                      setAvailableSpotsPageSize(size)
                      setAvailableSpotsPageIndex(0)
                    }}
                    onPageIndexChange={setAvailableSpotsPageIndex}
                  />
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Personal Spots Tab */}
        <TabsContent value="personal" className="space-y-4">
          {/* Enhanced Filters */}
          <EnhancedFilters
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterConfigs={parkingFilterConfigs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            searchPlaceholder="Search personal spots by number or location..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Personal Spots ({sortedSpots.length})</CardTitle>
                <div className="flex gap-2">
                  {selectedSpots.size > 0 && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSpotBookabilityMutation.mutate({ 
                              spotIds: Array.from(selectedSpots), 
                              isBookable: true 
                            })}
                            disabled={toggleSpotBookabilityMutation.isPending}
                            data-testid="button-enable-personal-spots"
                            aria-label="Enable selected personal spots for booking"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {t("admin.parkingManagement.enable")} ({selectedSpots.size})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Enable selected personal spots for booking and rental
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSpotBookabilityMutation.mutate({ 
                              spotIds: Array.from(selectedSpots), 
                              isBookable: false 
                            })}
                            disabled={toggleSpotBookabilityMutation.isPending}
                            data-testid="button-disable-personal-spots"
                            aria-label="Disable selected personal spots from booking"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            {t("admin.parkingManagement.disable")} ({selectedSpots.size})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Disable selected personal spots from booking (maintenance)
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedSpots.length === 0}
                        onClick={() => {
                          const success = quickExportParkingSpotsPDF(sortedSpots, 'Personal Spots Report', (errorMessage) => {
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
                        data-testid="button-export-personal-spots-pdf"
                        aria-label="Export personal spots to PDF"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export personal spots data to PDF report
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedSpots.length === 0}
                        onClick={() => {
                          const success = quickExportParkingSpotsExcel(sortedSpots, 'Personal Spots Report', (errorMessage) => {
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
                        data-testid="button-export-personal-spots-excel"
                        aria-label="Export personal spots to Excel"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export personal spots data to Excel report
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        onClick={() => setShowAddSpotDialog(true)}
                        data-testid="button-add-personal-spot"
                        aria-label="Add new personal spot"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Spot
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Add a new personal parking spot to the system
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sortedSpots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Car className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No personal spots found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isSelectAllChecked}
                            onCheckedChange={handleSelectAllSpots}
                            data-testid="checkbox-select-all-personal"
                            aria-label="Select all personal spots"
                          />
                        </TableHead>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                        >
                          Spot #
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="locationName"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotTypeName"
                          currentSortColumn={sortState.column}
                          currentSortDirection={sortState.direction}
                          onSort={handleSort}
                        >
                          Type
                        </SortableTableHeader>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPersonalSpots.map((spot) => (
                        <TableRow key={spot.id} data-testid={`row-personal-spot-${spot.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSpots.has(spot.id)}
                              onCheckedChange={() => handleToggleSpotSelection(spot.id)}
                              data-testid={`checkbox-select-personal-spot-${spot.id}`}
                              aria-label={`Select personal spot ${spot.spotNumber}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-spot-number-${spot.id}`}>
                            {spot.spotNumber}
                          </TableCell>
                          <TableCell data-testid={`text-location-${spot.id}`}>
                            {spot.locationName}
                          </TableCell>
                          <TableCell data-testid={`text-type-${spot.id}`}>
                            {spot.spotTypeName}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge 
                                variant={spot.isActive ? "default" : "secondary"}
                                data-testid={`badge-active-status-${spot.id}`}
                              >
                                {spot.isActive ? "Enabled" : "Disabled"}
                              </Badge>
                              {spot.ownerId && (
                                <Badge variant="outline" data-testid={`badge-assigned-${spot.id}`}>
                                  Assigned
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-owner-${spot.id}`}>
                            {spot.ownerId ? (
                              allUsers.find(user => user.id === spot.ownerId)?.name || 
                              `${allUsers.find(user => user.id === spot.ownerId)?.firstName || ''} ${allUsers.find(user => user.id === spot.ownerId)?.lastName || ''}`.trim() || 
                              'Assigned User'
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSpot(spot)}
                                data-testid={`button-edit-personal-spot-${spot.id}`}
                                title="Edit Spot"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {spot.ownerId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReleaseSpot(spot)}
                                  data-testid={`button-release-personal-spot-${spot.id}`}
                                  title="Release Spot"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSpot(spot.id)}
                                data-testid={`button-delete-personal-spot-${spot.id}`}
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
              {sortedSpots.length > 0 && (
                <TablePagination
                  totalCount={sortedSpots.length}
                  pageSize={personalSpotsPageSize}
                  pageIndex={personalSpotsPageIndex}
                  onPageSizeChange={(size) => {
                    setPersonalSpotsPageSize(size)
                    setPersonalSpotsPageIndex(0)
                  }}
                  onPageIndexChange={setPersonalSpotsPageIndex}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waiting List Tab */}
        <TabsContent value="waiting" className="space-y-4">
          {/* Enhanced Filters for Waiting List */}
          <EnhancedFilters
            searchValue={waitingListSearchTerm}
            onSearchChange={setWaitingListSearchTerm}
            filterConfigs={waitingListFilterConfigs}
            filterValues={waitingListFilterValues}
            onFilterChange={handleWaitingListFilterChange}
            onClearFilters={handleClearWaitingListFilters}
            searchPlaceholder="Search waiting list by name, email, or reason..."
            className="hover-elevate"
          />
          
          {/* Waiting List */}
      <Card data-testid="card-waiting-list">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Waiting List ({sortedWaitingList.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm"
                variant="outline" 
                disabled={sortedWaitingList.length === 0}
                onClick={() => {
                  const success = quickExportWaitingListPDF(sortedWaitingList, 'Waiting List Report', (errorMessage) => {
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
                data-testid="button-export-waiting-list-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button 
                size="sm"
                variant="outline" 
                disabled={sortedWaitingList.length === 0}
                onClick={() => {
                  const success = quickExportWaitingListExcel(sortedWaitingList, 'Waiting List Report', (errorMessage) => {
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
                data-testid="button-export-waiting-list-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingWaitingList ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedWaitingList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-waiting">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No waiting list entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-waiting-list">
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        column="userName"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        User
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="priority"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        Priority
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="preferredSpotType"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        Preferred Type
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="status"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        Status
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="enrolledDate"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        Enrolled Date
                      </SortableTableHeader>
                      <TableHead>Waiting Days</TableHead>
                      <SortableTableHeader
                        column="reason"
                        currentSortColumn={waitingListSortState.column}
                        currentSortDirection={waitingListSortState.direction}
                        onSort={handleWaitingListSort}
                      >
                        Reason
                      </SortableTableHeader>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedWaitingList.map((item) => {
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
                            {item.preferredSpotTypeId ? getSpotTypeBadge(spotTypes.find(st => st.id === item.preferredSpotTypeId)?.name) : <Badge variant="outline">Any</Badge>}
                          </TableCell>
                          <TableCell data-testid={`text-waiting-status-${item.id}`}>
                            <Badge 
                              variant="secondary"
                              className={
                                item.status === "active" ? "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" :
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
                          <TableCell data-testid={`text-waiting-reason-${item.id}`}>
                            {item.reason && item.reason.trim() ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="max-w-[200px] truncate block cursor-help">
                                    {item.reason}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <p>{item.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not specified</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {item.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAssignFromWaitingList(item)}
                                  data-testid={`button-assign-waiting-${item.id}`}
                                  title="Assign Spot"
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Assign
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
                <TablePagination
                  totalCount={sortedWaitingList.length}
                  pageSize={waitingListPageSize}
                  pageIndex={waitingListPageIndex}
                  onPageSizeChange={(size) => {
                    setWaitingListPageSize(size)
                    setWaitingListPageIndex(0)
                  }}
                  onPageIndexChange={setWaitingListPageIndex}
                />
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Location</label>
                {!addSpotFormData.isBciManaged && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsCreatingCustomLocation(!isCreatingCustomLocation)}
                    data-testid="button-toggle-custom-location"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300"
                  >
                    {isCreatingCustomLocation ? "Select Existing" : "+ Custom Location"}
                  </Button>
                )}
              </div>
              
              {isCreatingCustomLocation && !addSpotFormData.isBciManaged ? (
                <div className="space-y-3 p-3 border rounded-md">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Address Search *</label>
                    <div 
                      ref={autocompleteContainerRef} 
                      id="geoapify-autocomplete-container-admin"
                      data-testid="container-address-autocomplete-admin"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a full address to auto-fill location details
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Office *</label>
                    <Input
                      value={customLocationData.office}
                      onChange={(e) => setCustomLocationData(prev => ({ ...prev, office: e.target.value }))}
                      placeholder="e.g., Victoria"
                      data-testid="input-custom-office"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Building *</label>
                    <Input
                      value={customLocationData.building}
                      onChange={(e) => setCustomLocationData(prev => ({ ...prev, building: e.target.value }))}
                      placeholder="e.g., 750 Pandora Ave"
                      data-testid="input-custom-building"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Level *</label>
                    <Input
                      value={customLocationData.level}
                      onChange={(e) => setCustomLocationData(prev => ({ ...prev, level: e.target.value }))}
                      placeholder="e.g., Parking Level 1"
                      data-testid="input-custom-level"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Full Address (Optional)</label>
                    <Input
                      value={customLocationData.address}
                      onChange={(e) => setCustomLocationData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="e.g., 750 Pandora Ave, Victoria, BC V8W 1N8"
                      data-testid="input-custom-address"
                    />
                  </div>
                </div>
              ) : (
                <Select
                  value={addSpotFormData.locationId?.toString() || ""}
                  onValueChange={(value) => setAddSpotFormData(prev => ({ ...prev, locationId: parseInt(value) }))}
                  disabled={isLoadingLocations}
                >
                  <SelectTrigger data-testid="select-add-spot-location">
                    <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Select location"} />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.office} - {loc.building}, {loc.level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Spot Type</label>
              <Select 
                value={addSpotFormData.spotTypeId?.toString() || ""}
                onValueChange={(value) => setAddSpotFormData(prev => ({ ...prev, spotTypeId: parseInt(value) }))}
                disabled={isLoadingSpotTypes}
              >
                <SelectTrigger data-testid="select-add-spot-type">
                  <SelectValue placeholder={isLoadingSpotTypes ? "Loading spot types..." : "Select spot type"} />
                </SelectTrigger>
                <SelectContent>
                  {spotTypes.map(type => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
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
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bci-managed"
                  checked={addSpotFormData.isBciManaged}
                  onCheckedChange={(checked) => setAddSpotFormData(prev => ({ ...prev, isBciManaged: checked as boolean }))}
                  data-testid="checkbox-add-spot-bci-managed"
                />
                <label htmlFor="bci-managed" className="text-sm font-medium">BCI Managed</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      type="button"
                      aria-label="BCI Managed information"
                    >
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    BCI Managed: Only admins can reassign. Personal: Owner can create listings.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Default is Personal (unchecked) for new spots
              </p>
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
                onClick={handleAddSpotWithCustomLocation}
                disabled={
                  addSpotMutation.isPending || 
                  createLocationMutation.isPending ||
                  !addSpotFormData.spotNumber || 
                  !addSpotFormData.spotTypeId ||
                  (!isCreatingCustomLocation && !addSpotFormData.locationId) ||
                  (isCreatingCustomLocation && (!customLocationData.office || !customLocationData.building || !customLocationData.level))
                }
                className="flex-1"
                data-testid="button-confirm-add-spot"
              >
                {addSpotMutation.isPending || createLocationMutation.isPending ? "Adding..." : "Add Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddSpotDialog(false);
                  setIsCreatingCustomLocation(false);
                  setCustomLocationData({
                    office: "",
                    building: "",
                    level: "",
                    address: ""
                  });
                }}
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
              <Select
                value={editFormData.locationId?.toString() || ""}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, locationId: parseInt(value) }))}
                disabled={isLoadingLocations}
              >
                <SelectTrigger data-testid="select-edit-spot-location">
                  <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Select location"} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.office} - {loc.building}, {loc.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Spot Type</label>
              <Select 
                value={editFormData.spotTypeId?.toString() || ""}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, spotTypeId: parseInt(value) }))}
                disabled={isLoadingSpotTypes}
              >
                <SelectTrigger data-testid="select-edit-spot-type">
                  <SelectValue placeholder={isLoadingSpotTypes ? "Loading spot types..." : "Select spot type"} />
                </SelectTrigger>
                <SelectContent>
                  {spotTypes.map(type => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-bci-managed"
                checked={editFormData.isBciManaged}
                onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isBciManaged: checked as boolean }))}
                data-testid="checkbox-edit-spot-bci-managed"
              />
              <label htmlFor="edit-bci-managed" className="text-sm font-medium">BCI Managed</label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    type="button"
                    aria-label="BCI Managed information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  BCI Managed: Only admins can reassign. Personal: Owner can create listings.
                </TooltipContent>
              </Tooltip>
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
                disabled={editSpotMutation.isPending || !editFormData.spotNumber || !editFormData.locationId || !editFormData.spotTypeId}
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
                      {spot.spotNumber} - {spot.locationName} ({getSpotTypeBadge(spot.spotTypeName)})
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
                  <div>Spot: {selectedSpotForAssign.spotNumber} - {selectedSpotForAssign.locationName}</div>
                  <div>Type: {getSpotTypeBadge(selectedSpotForAssign.spotTypeName)}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  if (selectedWaitingListItem && selectedSpotForAssign) {
                    const waitingListEntry = filteredWaitingList.find(w => w.id === selectedWaitingListItem);
                    if (waitingListEntry) {
                      assignFromWaitingListMutation.mutate({
                        userId: waitingListEntry.userId,
                        spotId: selectedSpotForAssign.id
                      });
                    }
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
              <label className="text-sm font-medium">Preferred Location (Optional)</label>
              <Select 
                value={waitingListFormData.preferredLocationId?.toString() || "any"}
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, preferredLocationId: value === "any" ? undefined : parseInt(value) }))}
                disabled={isLoadingLocations}
              >
                <SelectTrigger data-testid="select-waiting-location">
                  <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : "Any location"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any location</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id.toString()}>
                      {loc.office} - {loc.building}, {loc.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Preferred Spot Type (Optional)</label>
              <Select 
                value={waitingListFormData.preferredSpotTypeId?.toString() || "any"}
                onValueChange={(value) => setWaitingListFormData(prev => ({ ...prev, preferredSpotTypeId: value === "any" ? undefined : parseInt(value) }))}
                disabled={isLoadingSpotTypes}
              >
                <SelectTrigger data-testid="select-waiting-spot-type">
                  <SelectValue placeholder={isLoadingSpotTypes ? "Loading spot types..." : "Any spot type"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any spot type</SelectItem>
                  {spotTypes.map(type => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
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
                  <div>Location: {selectedSpotForAssign.locationName}</div>
                  <div>Type: {getSpotTypeBadge(selectedSpotForAssign.spotTypeName)}</div>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Select User</label>
              <Popover open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserSearchOpen}
                    className="w-full justify-between"
                    data-testid="button-select-user"
                  >
                    {directAssignFormData.userId ? (
                      (() => {
                        const selectedUser = searchedUsers.find(u => u.id === directAssignFormData.userId) || 
                                           allUsers.find((u: any) => u.id === directAssignFormData.userId);
                        if (selectedUser) {
                          const firstName = selectedUser.firstName || '';
                          const lastName = selectedUser.lastName || '';
                          const email = selectedUser.email || '';
                          return `${firstName} ${lastName} (${email})`.trim();
                        }
                        return "Select user...";
                      })()
                    ) : (
                      "Select user..."
                    )}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search users..." 
                      value={userSearchQuery}
                      onValueChange={setUserSearchQuery}
                      data-testid="input-search-user"
                    />
                    <CommandList>
                      <CommandEmpty>
                        {userSearchQuery.length < 3 
                          ? "Type at least 3 characters to search..." 
                          : isSearchingUsers 
                            ? "Searching..." 
                            : "No users found."}
                      </CommandEmpty>
                      {debouncedUserSearchQuery.length >= 3 && !isSearchingUsers && searchedUsers.length > 0 && (
                        <CommandGroup>
                          {searchedUsers.map((user) => {
                            const firstName = user.firstName || '';
                            const lastName = user.lastName || '';
                            const email = user.email || '';
                            const displayName = `${firstName} ${lastName} (${email})`.trim();
                            
                            return (
                              <CommandItem
                                key={user.id}
                                value={user.id}
                                onSelect={() => {
                                  setDirectAssignFormData(prev => ({ ...prev, userId: user.id }));
                                  setIsUserSearchOpen(false);
                                  setUserSearchQuery("");
                                }}
                                data-testid={`button-user-option-${user.id}`}
                              >
                                {displayName}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="direct-assign-bci-managed"
                  checked={directAssignFormData.isBciManaged}
                  onCheckedChange={(checked) => setDirectAssignFormData(prev => ({ ...prev, isBciManaged: checked as boolean }))}
                  data-testid="checkbox-direct-assign-bci-managed"
                />
                <label htmlFor="direct-assign-bci-managed" className="text-sm font-medium">BCI Managed</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0"
                      type="button"
                      aria-label="BCI Managed information"
                    >
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    BCI Managed: Only admins can reassign. Personal: Owner can create listings.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Default is BCI Managed (checked) for direct assignments
              </p>
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
                <p>Assigning parking spot <strong>{selectedAvailableSpot.spotNumber}</strong> at {selectedAvailableSpot.locationName}</p>
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
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="assign-available-bci-managed"
                      checked={assignAvailableSpotFormData.isBciManaged}
                      onCheckedChange={(checked) => setAssignAvailableSpotFormData(prev => ({ ...prev, isBciManaged: checked as boolean }))}
                      data-testid="checkbox-assign-available-bci-managed"
                    />
                    <label htmlFor="assign-available-bci-managed" className="text-sm font-medium">BCI Managed</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          type="button"
                          aria-label="BCI Managed information"
                        >
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        BCI Managed: Only admins can reassign. Personal: Owner can create listings.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Default is BCI Managed (checked) for assignments
                  </p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedAvailableSpot && selectedUserForAvailableSpot) {
                        assignAvailableSpotMutation.mutate({
                          spotId: selectedAvailableSpot.id,
                          userId: selectedUserForAvailableSpot,
                          isBciManaged: assignAvailableSpotFormData.isBciManaged
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

      {/* Create Availability Dialog */}
      <Dialog open={showCreateAvailabilityDialog} onOpenChange={setShowCreateAvailabilityDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-create-availability">
          <DialogHeader>
            <DialogTitle>Create Availability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Listing Type</Label>
              <RadioGroup
                value={createAvailabilityFormData.listingType}
                onValueChange={(value: "single" | "period") => 
                  setCreateAvailabilityFormData({ ...createAvailabilityFormData, listingType: value })
                }
                data-testid="radiogroup-listing-type"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="single" data-testid="radio-single-day" />
                  <Label htmlFor="single" className="font-normal cursor-pointer">Single Day</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="period" id="period" data-testid="radio-date-range" />
                  <Label htmlFor="period" className="font-normal cursor-pointer">Date Range</Label>
                </div>
              </RadioGroup>
            </div>

            {createAvailabilityFormData.listingType === "single" ? (
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Popover open={singleDatePickerOpen} onOpenChange={setSingleDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-select-single-date"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {createAvailabilityFormData.singleDate 
                        ? format(createAvailabilityFormData.singleDate, "PPP")
                        : "Pick a date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={createAvailabilityFormData.singleDate}
                      onSelect={(date) => {
                        setCreateAvailabilityFormData({ ...createAvailabilityFormData, singleDate: date })
                        setSingleDatePickerOpen(false)
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-select-start-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {createAvailabilityFormData.periodStartDate 
                          ? format(createAvailabilityFormData.periodStartDate, "PPP")
                          : "Pick start date"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={createAvailabilityFormData.periodStartDate}
                        onSelect={(date) => {
                          setCreateAvailabilityFormData({ ...createAvailabilityFormData, periodStartDate: date })
                          setStartDatePickerOpen(false)
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-select-end-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {createAvailabilityFormData.periodEndDate 
                          ? format(createAvailabilityFormData.periodEndDate, "PPP")
                          : "Pick end date"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={createAvailabilityFormData.periodEndDate}
                        onSelect={(date) => {
                          setCreateAvailabilityFormData({ ...createAvailabilityFormData, periodEndDate: date })
                          setEndDatePickerOpen(false)
                        }}
                        disabled={(date) => {
                          if (date < new Date()) return true;
                          if (createAvailabilityFormData.periodStartDate && date < createAvailabilityFormData.periodStartDate) return true;
                          return false;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dailyRate">Daily Rate ($)</Label>
              <Input
                id="dailyRate"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter daily rate"
                value={createAvailabilityFormData.dailyRate}
                onChange={(e) => 
                  setCreateAvailabilityFormData({ ...createAvailabilityFormData, dailyRate: e.target.value })
                }
                data-testid="input-daily-rate"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  const dailyRate = parseFloat(createAvailabilityFormData.dailyRate);
                  
                  // Validation
                  if (!dailyRate || dailyRate <= 0) {
                    toast({
                      title: "Validation Error",
                      description: "Please enter a valid daily rate greater than 0.",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (createAvailabilityFormData.listingType === "single") {
                    if (!createAvailabilityFormData.singleDate) {
                      toast({
                        title: "Validation Error",
                        description: "Please select a date.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    bulkCreateListingsMutation.mutate({
                      spotIds: Array.from(selectedSpots),
                      listingType: "single",
                      singleDate: format(createAvailabilityFormData.singleDate, "yyyy-MM-dd"),
                      dailyRate
                    });
                  } else {
                    if (!createAvailabilityFormData.periodStartDate || !createAvailabilityFormData.periodEndDate) {
                      toast({
                        title: "Validation Error",
                        description: "Both start and end dates are required for date range",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (createAvailabilityFormData.periodEndDate < createAvailabilityFormData.periodStartDate) {
                      toast({
                        title: "Validation Error",
                        description: "End date must be on or after start date",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    bulkCreateListingsMutation.mutate({
                      spotIds: Array.from(selectedSpots),
                      listingType: "period",
                      periodStartDate: format(createAvailabilityFormData.periodStartDate, "yyyy-MM-dd"),
                      periodEndDate: format(createAvailabilityFormData.periodEndDate, "yyyy-MM-dd"),
                      dailyRate
                    });
                  }
                }}
                disabled={bulkCreateListingsMutation.isPending}
                className="flex-1"
                data-testid="button-submit-create-availability"
              >
                {bulkCreateListingsMutation.isPending ? "Creating..." : "Create Listings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateAvailabilityDialog(false)}
                className="flex-1"
                data-testid="button-cancel-create-availability"
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