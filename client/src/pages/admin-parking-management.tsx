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
import { getBCStatHolidaysForRange } from "@/lib/bc-stat-holidays"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TablePagination } from "@/components/shared/TablePagination"
import { Switch } from "@/components/ui/switch"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays,
  Timer, Target, CheckCircle2, Search, Filter, Check, ChevronsUpDown,
  Zap, Accessibility, Building, MoreHorizontal, Info, RefreshCw,
  Trash2, Edit, UserMinus, UserCheck, Download, FileText,
  Eye, EyeOff, Layers, Sparkles, Loader2, MapPin, AlertCircle, Heart
} from "lucide-react"
import type { ParkingSpot, ParkingSpotWithUser, SpotType, Location, SpotTypeTable } from "@shared/schema"
import { quickExportParkingSpotsPDF, quickExportParkingSpotsExcel } from "@/utils/export-utils"

const _year = new Date().getFullYear()
const statHolidays = getBCStatHolidaysForRange(_year, _year + 1)

export default function AdminParkingManagement() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [availableSpotsSearchTerm, setAvailableSpotsSearchTerm] = useState("")
  const [availableSpotsFilterValues, setAvailableSpotsFilterValues] = useState<FilterValues>({})
  const [assignedSpotsSearchTerm, setAssignedSpotsSearchTerm] = useState("")
  const [assignedSpotsFilterValues, setAssignedSpotsFilterValues] = useState<FilterValues>({})
  const [bookableSpotsSearchTerm, setBookableSpotsSearchTerm] = useState("")
  const [bookableSpotsFilterValues, setBookableSpotsFilterValues] = useState<FilterValues>({})
  const [showAddSpotDialog, setShowAddSpotDialog] = useState(false)
  const [showEditSpotDialog, setShowEditSpotDialog] = useState(false)
  const [showDirectAssignDialog, setShowDirectAssignDialog] = useState(false)
  const [showReleaseSpotDialog, setShowReleaseSpotDialog] = useState(false)
  const [showAssignAvailableSpotDialog, setShowAssignAvailableSpotDialog] = useState(false)
  const [showCreateAvailabilityDialog, setShowCreateAvailabilityDialog] = useState(false)
  const [showBulkSeatNumberDialog, setShowBulkSeatNumberDialog] = useState(false)
  const [bulkSeatNumberData, setBulkSeatNumberData] = useState("")
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
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [assignAvailableSpotFormData, setAssignAvailableSpotFormData] = useState({
    isBciManaged: true,
    scheduledDate: null as Date | null,
    cancelFutureBookings: true
  })
  const [activeSpotTab, setActiveSpotTab] = useState("bci-managed")
  const [unallocatedFilterType, setUnallocatedFilterType] = useState("all")
  
  
  const [effectiveDatePickerOpen, setEffectiveDatePickerOpen] = useState(false)
  const [availableSpotEffectiveDatePickerOpen, setAvailableSpotEffectiveDatePickerOpen] = useState(false)

  // Form state for direct assignment dialog
  const [directAssignFormData, setDirectAssignFormData] = useState({
    userId: "",
    duration: "permanent",
    isBciManaged: true,
    notes: "",
    scheduledDate: null as Date | null,
    cancelFutureBookings: true
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


  // Pagination state for Personal Spots
  const [personalSpotsPageIndex, setPersonalSpotsPageIndex] = useState(0)
  const [personalSpotsPageSize, setPersonalSpotsPageSize] = useState(10)
  
  // Pagination state for Assigned Spots
  const [assignedSpotsPageIndex, setAssignedSpotsPageIndex] = useState(0)
  const [assignedSpotsPageSize, setAssignedSpotsPageSize] = useState(10)
  
  // Pagination state for Bookable Spots
  const [bookableSpotsPageIndex, setBookableSpotsPageIndex] = useState(0)
  const [bookableSpotsPageSize, setBookableSpotsPageSize] = useState(10)
  
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
    isBciManaged: true,
    description: "",
    ownerId: null as string | null,
    mapLink: "" as string | null,
    seatNumber: "" as string | null,
    reservedForDepartmentId: null as number | null
  })
  
  // Form state for add spot dialog
  const [addSpotFormData, setAddSpotFormData] = useState({
    spotNumber: "",
    locationId: undefined as number | undefined,
    spotTypeId: undefined as number | undefined,
    isIndoor: false,
    isActive: true,
    isBookable: true,
    isBciManaged: true,
    description: "",
    reservedForDepartmentId: null as number | null
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
    dailyRate: "16",
    donateToCharity: false
  })
  
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

  // Fetch lookup data for form dropdowns
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: spotTypes = [], isLoading: isLoadingSpotTypes } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  });

  // Fetch departments for department-reserved spots
  const { data: departments = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/departments"],
  });

  // Generate location options dynamically from fetched locations
  const allLocationOptions = useMemo(() => {
    return locations.map(loc => ({
      value: `${loc.office} - ${loc.building}, ${loc.level}`,
      label: `${loc.office} - ${loc.building}, ${loc.level}`
    }));
  }, [locations]);

  // Get the Department Reserved spot type ID dynamically (not hardcoded)
  const departmentReservedSpotTypeId = useMemo(() => {
    const deptReservedType = spotTypes.find(t => 
      t.name === 'Department Reserved' || 
      t.slug === 'department-reserved'
    );
    return deptReservedType?.id ?? null;
  }, [spotTypes]);

  // Search users for direct assignment (only triggers when query >= 3 chars)
  const { data: searchedUsers = [], isLoading: isSearchingUsers } = useQuery<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    departmentId: number | null;
  }>>({
    queryKey: [`/api/admin/search-users?query=${encodeURIComponent(debouncedUserSearchQuery)}`],
    enabled: debouncedUserSearchQuery.length >= 3,
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
      donateToCharity?: boolean;
    }) => {
      return await apiRequest(`/api/admin/bulk-create-listings`, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/available-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spot-listings"] });
      
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
        dailyRate: "16",
        donateToCharity: false
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
        await addSpotMutation.mutateAsync({
          ...addSpotFormData,
          locationId: locationIdToUse,
          isBookable: addSpotFormData.isBookable,
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
        isBciManaged: true,
        description: "",
        reservedForDepartmentId: null
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
      const isScheduled = assignmentData.scheduledDate && assignmentData.scheduledDate.toDateString() !== new Date().toDateString();
      const body: { spotId: string; userId: string; isBciManaged: boolean; scheduledDate?: string; cancelFutureBookings?: boolean } = {
        spotId, userId: assignmentData.userId, isBciManaged: assignmentData.isBciManaged
      };
      if (isScheduled) {
        body.scheduledDate = format(assignmentData.scheduledDate!, "yyyy-MM-dd");
        body.cancelFutureBookings = assignmentData.cancelFutureBookings;
      }
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body,
      });
    },
    onSuccess: (_data, variables) => {
      const isScheduled = variables.assignmentData.scheduledDate && variables.assignmentData.scheduledDate.toDateString() !== new Date().toDateString();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-assignments"] });
      toast({
        title: "Success",
        description: isScheduled
          ? `Spot assignment scheduled for ${format(variables.assignmentData.scheduledDate!, "PPP")}.`
          : "Spot assigned directly to user successfully.",
        variant: "success",
      });
      setShowDirectAssignDialog(false);
      setSelectedSpotForAssign(null);
      setDirectAssignFormData({
        userId: "",
        duration: "permanent",
        isBciManaged: true,
        notes: "",
        scheduledDate: null,
        cancelFutureBookings: true
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

  // Type for future bookings response
  type FutureBookingsResponse = {
    spotId: string;
    spotNumber: string;
    count: number;
    bookings: Array<{
      id: string;
      bookingDate: string;
      status: string;
      renterName: string;
      renterEmail: string;
      dailyRate: string;
    }>;
  };

  // Query to fetch future bookings for a spot before release
  const { data: futureBookingsData, isLoading: isLoadingFutureBookings } = useQuery<FutureBookingsResponse>({
    queryKey: ["/api/admin/spots", selectedSpotForRelease?.id, "future-bookings"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/spots/${selectedSpotForRelease?.id}/future-bookings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch future bookings');
      return response.json();
    },
    enabled: !!selectedSpotForRelease?.id && showReleaseSpotDialog,
  });

  // Query to fetch future bookings for a spot before direct assign (reassignment)
  const { data: directAssignFutureBookings, isLoading: isLoadingDirectAssignBookings } = useQuery<FutureBookingsResponse>({
    queryKey: ["/api/admin/spots", selectedSpotForAssign?.id, "future-bookings"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/spots/${selectedSpotForAssign?.id}/future-bookings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch future bookings');
      return response.json();
    },
    // Only fetch if spot has an owner (reassignment scenario) and dialog is open
    enabled: !!selectedSpotForAssign?.id && !!selectedSpotForAssign?.ownerId && showDirectAssignDialog,
  });

  // Query to fetch future bookings for available spot assignment
  // Available spots (no owner) can still have bookings from Workplace Services listings
  const { data: availableSpotFutureBookings, isLoading: isLoadingAvailableSpotBookings } = useQuery<FutureBookingsResponse>({
    queryKey: ["/api/admin/spots", selectedAvailableSpot?.id, "future-bookings"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/spots/${selectedAvailableSpot?.id}/future-bookings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch future bookings');
      return response.json();
    },
    enabled: !!selectedAvailableSpot?.id && showAssignAvailableSpotDialog,
  });

  // Query to fetch count of unbooked listings from the effective date onwards
  const effectiveDateStr = format(
    assignAvailableSpotFormData.scheduledDate || new Date(),
    'yyyy-MM-dd'
  );
  const { data: futureListingsData } = useQuery<{ spotId: string; count: number }>({
    queryKey: ["/api/admin/spots", selectedAvailableSpot?.id, "future-listings", effectiveDateStr],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/spots/${selectedAvailableSpot?.id}/future-listings?fromDate=${effectiveDateStr}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch future listings count');
      return response.json();
    },
    enabled: !!selectedAvailableSpot?.id && showAssignAvailableSpotDialog,
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
    mutationFn: async ({ spotId, userId, isBciManaged, scheduledDate, cancelFutureBookings }: { spotId: string; userId: string; isBciManaged: boolean; scheduledDate?: Date | null; cancelFutureBookings?: boolean }) => {
      const isScheduled = scheduledDate && scheduledDate.toDateString() !== new Date().toDateString();
      const body: { spotId: string; userId: string; isBciManaged: boolean; scheduledDate?: string; cancelFutureBookings?: boolean } = { spotId, userId, isBciManaged };
      if (isScheduled) {
        body.scheduledDate = format(scheduledDate!, "yyyy-MM-dd");
        body.cancelFutureBookings = cancelFutureBookings;
      }
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body,
      });
    },
    onSuccess: (_response, variables) => {
      const isScheduled = variables.scheduledDate && variables.scheduledDate.toDateString() !== new Date().toDateString();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-assignments"] });
      const userName = allUsers.find(user => user.id === selectedUserForAvailableSpot)?.name || "user";
      const spotNumber = selectedAvailableSpot?.spotNumber || 'Unknown';
      toast({
        title: "Success",
        description: isScheduled
          ? `Spot ${spotNumber} assignment to ${userName} scheduled for ${format(variables.scheduledDate!, "PPP")}.`
          : `Spot ${spotNumber} has been assigned to ${userName}.`,
        variant: "success",
      });
      setShowAssignAvailableSpotDialog(false);
      setSelectedAvailableSpot(null);
      setSelectedUserForAvailableSpot("");
      setAssignAvailableSpotFormData({
        isBciManaged: true,
        scheduledDate: null,
        cancelFutureBookings: true
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

  // Bulk seat number update mutation
  const bulkSeatNumberMutation = useMutation({
    mutationFn: async (mappings: Array<{ spotNumber: string; seatNumber: string }>) => {
      return apiRequest("/api/admin/spots/bulk-seat-numbers", {
        method: "POST",
        body: { mappings }
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: response.message || `Updated ${response.updated} spots`,
        variant: "success",
      });
      setShowBulkSeatNumberDialog(false);
      setBulkSeatNumberData("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update seat numbers.",
        variant: "destructive",
      });
    },
  });

  type ScheduledAssignment = {
    id: string;
    spotId: string;
    spotNumber: string;
    locationName: string;
    userId: string;
    userName: string;
    userEmail: string;
    scheduledDate: string;
    cancelFutureBookings: boolean;
    createdAt: string;
  };

  const { data: scheduledAssignments = [], isLoading: isLoadingScheduledAssignments } = useQuery<ScheduledAssignment[]>({
    queryKey: ["/api/admin/scheduled-assignments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/scheduled-assignments", { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const cancelScheduledAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return await apiRequest(`/api/admin/scheduled-assignments/${assignmentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      toast({
        title: "Success",
        description: "Scheduled assignment cancelled successfully.",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel scheduled assignment.",
        variant: "error",
      });
    },
  });

  const scheduledAssignmentsBySpotId = useMemo(() => {
    const map = new Map<string, ScheduledAssignment>();
    for (const sa of scheduledAssignments) {
      map.set(sa.spotId, sa);
    }
    return map;
  }, [scheduledAssignments]);

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
      ownerId: spot.ownerId || null,
      mapLink: spot.mapLink || "",
      seatNumber: (spot as any).seatNumber || "",
      reservedForDepartmentId: spot.reservedForDepartmentId || null
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

  const handleDirectAssign = (spot: ParkingSpot) => {
    setSelectedSpotForAssign(spot);
    setDirectAssignFormData({
      userId: "",
      duration: "permanent",
      isBciManaged: spot?.isBciManaged ?? true,
      notes: "",
      scheduledDate: null,
      cancelFutureBookings: true
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
      isBciManaged: spot?.isBciManaged ?? true,
      scheduledDate: null,
      cancelFutureBookings: true
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
    
    // Search filter - searches across all visible columns
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      // Get owner info for searching
      const owner = spot.ownerId ? allUsers.find(user => user.id === spot.ownerId) : null
      const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.toLowerCase().trim() : ''
      const ownerEmail = owner?.email?.toLowerCase() || ''
      
      const matchesSearch = 
        spot.spotNumber.toLowerCase().includes(searchLower) ||
        (spot.locationName?.toLowerCase().includes(searchLower) ?? false) ||
        (spot.spotTypeName?.toLowerCase().includes(searchLower) ?? false) ||
        ownerName.includes(searchLower) ||
        ownerEmail.includes(searchLower) ||
        (spot.seatNumber?.toLowerCase().includes(searchLower) ?? false)
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
    
    // Search filter - searches across all visible columns
    if (availableSpotsSearchTerm.trim()) {
      const searchLower = availableSpotsSearchTerm.toLowerCase()
      // Get owner info for searching (if any)
      const owner = spot.ownerId ? allUsers.find(user => user.id === spot.ownerId) : null
      const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.toLowerCase().trim() : ''
      const ownerEmail = owner?.email?.toLowerCase() || ''
      
      const matchesSearch = 
        spot.spotNumber.toLowerCase().includes(searchLower) ||
        (spot.locationName?.toLowerCase().includes(searchLower) ?? false) ||
        (spot.spotTypeName?.toLowerCase().includes(searchLower) ?? false) ||
        ownerName.includes(searchLower) ||
        ownerEmail.includes(searchLower) ||
        (spot.seatNumber?.toLowerCase().includes(searchLower) ?? false)
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

  // Derived data for Assigned Spots tab (spots with owners) with filtering
  const filteredAssignedSpots = useMemo(() => {
    return allSpots.filter(spot => {
      // Must have an owner
      if (!spot.ownerId) return false
      
      // Search filter - searches across all visible columns
      if (assignedSpotsSearchTerm.trim()) {
        const searchLower = assignedSpotsSearchTerm.toLowerCase()
        const owner = allUsers.find(user => user.id === spot.ownerId)
        const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.toLowerCase().trim() : ''
        const ownerEmail = owner?.email?.toLowerCase() || ''
        
        const matchesSearch = 
          spot.spotNumber.toLowerCase().includes(searchLower) ||
          (spot.locationName?.toLowerCase().includes(searchLower) ?? false) ||
          (spot.spotTypeName?.toLowerCase().includes(searchLower) ?? false) ||
          ownerName.includes(searchLower) ||
          ownerEmail.includes(searchLower) ||
          (spot.seatNumber?.toLowerCase().includes(searchLower) ?? false)
        if (!matchesSearch) return false
      }
      
      // Spot type filter
      if (assignedSpotsFilterValues.spotType && assignedSpotsFilterValues.spotType !== "all") {
        if (spot.spotTypeName !== assignedSpotsFilterValues.spotType) return false
      }
      
      // Location filter
      if (assignedSpotsFilterValues.location && assignedSpotsFilterValues.location !== "all") {
        if (spot.locationName !== assignedSpotsFilterValues.location) return false
      }
      
      // Enable/Disable status filter
      if (assignedSpotsFilterValues.enableStatus && assignedSpotsFilterValues.enableStatus !== "all") {
        const isEnabled = spot.isActive !== false
        if (assignedSpotsFilterValues.enableStatus === "enabled" && !isEnabled) return false
        if (assignedSpotsFilterValues.enableStatus === "disabled" && isEnabled) return false
      }
      
      return true
    })
  }, [allSpots, allUsers, assignedSpotsSearchTerm, assignedSpotsFilterValues])

  // Sorting functionality for assigned spots
  const { sortState: assignedSpotsSortState, sortedData: sortedAssignedSpots, handleSort: handleAssignedSpotsSort } = useTableSort(
    filteredAssignedSpots,
    "spotNumber",
    "asc"
  )

  // Derived data for Non-Bookable Spots tab (spots NOT enabled for booking) with filtering
  const filteredBookableSpots = useMemo(() => {
    return allSpots.filter(spot => {
      // Must be NOT bookable (so admin can release them)
      if (spot.isBookable) return false
      
      // Search filter - searches across all visible columns
      if (bookableSpotsSearchTerm.trim()) {
        const searchLower = bookableSpotsSearchTerm.toLowerCase()
        const owner = spot.ownerId ? allUsers.find(user => user.id === spot.ownerId) : null
        const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.toLowerCase().trim() : ''
        const ownerEmail = owner?.email?.toLowerCase() || ''
        
        const matchesSearch = 
          spot.spotNumber.toLowerCase().includes(searchLower) ||
          (spot.locationName?.toLowerCase().includes(searchLower) ?? false) ||
          (spot.spotTypeName?.toLowerCase().includes(searchLower) ?? false) ||
          ownerName.includes(searchLower) ||
          ownerEmail.includes(searchLower) ||
          (spot.seatNumber?.toLowerCase().includes(searchLower) ?? false)
        if (!matchesSearch) return false
      }
      
      // Spot type filter
      if (bookableSpotsFilterValues.spotType && bookableSpotsFilterValues.spotType !== "all") {
        if (spot.spotTypeName !== bookableSpotsFilterValues.spotType) return false
      }
      
      // Location filter
      if (bookableSpotsFilterValues.location && bookableSpotsFilterValues.location !== "all") {
        if (spot.locationName !== bookableSpotsFilterValues.location) return false
      }
      
      // Assignment status filter
      if (bookableSpotsFilterValues.assignmentStatus && bookableSpotsFilterValues.assignmentStatus !== "all") {
        const isAssigned = !!spot.ownerId
        if (bookableSpotsFilterValues.assignmentStatus === "assigned" && !isAssigned) return false
        if (bookableSpotsFilterValues.assignmentStatus === "available" && isAssigned) return false
      }
      
      // Enable/Disable status filter
      if (bookableSpotsFilterValues.enableStatus && bookableSpotsFilterValues.enableStatus !== "all") {
        const isEnabled = spot.isActive !== false
        if (bookableSpotsFilterValues.enableStatus === "enabled" && !isEnabled) return false
        if (bookableSpotsFilterValues.enableStatus === "disabled" && isEnabled) return false
      }
      
      return true
    })
  }, [allSpots, allUsers, bookableSpotsSearchTerm, bookableSpotsFilterValues])

  // Sorting functionality for non-bookable spots
  const { sortState: bookableSpotsSortState, sortedData: sortedBookableSpots, handleSort: handleBookableSpotsSort } = useTableSort(
    filteredBookableSpots,
    "spotNumber",
    "asc"
  )

  // Keep legacy names for backward compatibility
  const assignedSpots = sortedAssignedSpots
  const bookableSpots = sortedBookableSpots

  // Paginated data for Assigned Spots
  const paginatedAssignedSpots = useMemo(() => {
    const startIndex = assignedSpotsPageIndex * assignedSpotsPageSize
    const endIndex = startIndex + assignedSpotsPageSize
    return sortedAssignedSpots.slice(startIndex, endIndex)
  }, [sortedAssignedSpots, assignedSpotsPageIndex, assignedSpotsPageSize])

  // Paginated data for Bookable Spots
  const paginatedBookableSpots = useMemo(() => {
    const startIndex = bookableSpotsPageIndex * bookableSpotsPageSize
    const endIndex = startIndex + bookableSpotsPageSize
    return sortedBookableSpots.slice(startIndex, endIndex)
  }, [sortedBookableSpots, bookableSpotsPageIndex, bookableSpotsPageSize])

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

  // Reset Assigned Spots page on filter/search change
  useEffect(() => {
    setAssignedSpotsPageIndex(0)
  }, [assignedSpotsSearchTerm, assignedSpotsFilterValues])

  // Reset Bookable Spots page on filter/search change
  useEffect(() => {
    setBookableSpotsPageIndex(0)
  }, [bookableSpotsSearchTerm, bookableSpotsFilterValues])

  // Clamp Assigned Spots page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(assignedSpots.length / assignedSpotsPageSize) - 1)
    if (assignedSpotsPageIndex > maxPage) {
      setAssignedSpotsPageIndex(maxPage)
    }
  }, [assignedSpots.length, assignedSpotsPageSize, assignedSpotsPageIndex])

  // Clamp Bookable Spots page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(bookableSpots.length / bookableSpotsPageSize) - 1)
    if (bookableSpotsPageIndex > maxPage) {
      setBookableSpotsPageIndex(maxPage)
    }
  }, [bookableSpots.length, bookableSpotsPageSize, bookableSpotsPageIndex])
  
  // Filter configuration for parking management
  // NOTE: Filter values must match database spot_types.name exactly for filtering to work
  const parkingFilterConfigs: FilterConfig[] = [
    {
      key: "spotType",
      label: "Spot Type",
      type: "select",
      options: [
        { value: "Regular", label: "Regular" },
        { value: "Electric", label: "EV" },
        { value: "Tesla Electric", label: "Tesla Charger" },
        { value: "Accessible", label: "Accessible" },
        { value: "Reserved", label: "Reserved" }
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
  // NOTE: Filter values must match database spot_types.name exactly for filtering to work
  const availableSpotsFilterConfigs: FilterConfig[] = [
    {
      key: "spotType",
      label: "Spot Type",
      type: "select",
      options: [
        { value: "Regular", label: "Regular" },
        { value: "Electric", label: "EV" },
        { value: "Tesla Electric", label: "Tesla Charger" },
        { value: "Accessible", label: "Accessible" },
        { value: "Reserved", label: "Reserved" }
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

  // Handle assigned spots filter changes
  const handleAssignedSpotsFilterChange = (key: string, value: string | undefined) => {
    setAssignedSpotsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear assigned spots filters
  const handleClearAssignedSpotsFilters = () => {
    setAssignedSpotsSearchTerm("")
    setAssignedSpotsFilterValues({})
  }

  // Handle bookable spots filter changes
  const handleBookableSpotsFilterChange = (key: string, value: string | undefined) => {
    setBookableSpotsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear bookable spots filters
  const handleClearBookableSpotsFilters = () => {
    setBookableSpotsSearchTerm("")
    setBookableSpotsFilterValues({})
  }

  // Filter configuration for assigned spots
  const assignedSpotsFilterConfigs: FilterConfig[] = [
    {
      key: "spotType",
      label: "Spot Type",
      type: "select",
      options: spotTypes.map(type => ({ value: type.name, label: type.name }))
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: locations.map(loc => ({
        value: `${loc.office} - ${loc.building}, ${loc.level}`,
        label: `${loc.office} - ${loc.building}, ${loc.level}`
      }))
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

  // Filter configuration for bookable spots
  const bookableSpotsFilterConfigs: FilterConfig[] = [
    {
      key: "spotType",
      label: "Spot Type",
      type: "select",
      options: spotTypes.map(type => ({ value: type.name, label: type.name }))
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: locations.map(loc => ({
        value: `${loc.office} - ${loc.building}, ${loc.level}`,
        label: `${loc.office} - ${loc.building}, ${loc.level}`
      }))
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
        label: "Electric" 
      },
      "Electric": { 
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        label: "Electric" 
      },
      "EV Chargers": { 
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", 
        label: "EV Chargers" 
      },
      tesla_ev: { 
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", 
        label: "Tesla Electric" 
      },
      "Tesla Electric": { 
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", 
        label: "Tesla Electric" 
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
      },
      "department_reserved": { 
        className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", 
        label: "Dept Reserved" 
      },
      "Department Reserved": { 
        className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100", 
        label: "Dept Reserved" 
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

  const isInitialLoading = isLoadingLocations || isLoadingSpotTypes;

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-admin-parking">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading parking data...</p>
        </div>
      </div>
    );
  }

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
                onClick={() => setShowBulkSeatNumberDialog(true)}
                data-testid="button-bulk-seat-numbers"
                aria-label="Bulk upload seat numbers"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Bulk Seat Numbers
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Upload seat number mappings for floor plan links
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
              data-testid="card-assigned-spots" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("bci-assigned")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assigned Spots</CardTitle>
                <div className="rounded-full border-2 border-purple-400 p-2">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-assigned-spots">
                  {allSpots.filter(spot => spot.ownerId).length}
                </div>
                <p className="text-xs text-purple-600">Spots with assigned owners</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            View all spots that are assigned to employees
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
              data-testid="card-bookable-spots" 
              className="hover-elevate cursor-pointer active-elevate-2"
              onClick={() => setActiveSpotTab("bci-bookable")}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Non-Bookable Spots</CardTitle>
                <div className="rounded-full border-2 border-orange-400 p-2">
                  <EyeOff className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-bookable-spots">
                  {allSpots.filter(spot => !spot.isBookable).length}
                </div>
                <p className="text-xs text-orange-600">Spots disabled for booking</p>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            View all spots disabled for booking (can be released)
          </TooltipContent>
        </Tooltip>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeSpotTab} onValueChange={setActiveSpotTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="bci-managed" data-testid="tab-bci-managed-spots" className="gap-2">
            <Car className="h-4 w-4 !text-blue-600" />
            All ({allSpots.length})
          </TabsTrigger>
          <TabsTrigger value="bci-assigned" data-testid="tab-bci-assigned-spots" className="gap-2">
            <Users className="h-4 w-4 !text-purple-600" />
            Assigned ({assignedSpots.length})
          </TabsTrigger>
          <TabsTrigger value="bci-available" data-testid="tab-bci-available-spots" className="gap-2">
            <Sparkles className="h-4 w-4 !text-green-600" />
            Available ({unallocatedSpots.length})
          </TabsTrigger>
          <TabsTrigger value="bci-bookable" data-testid="tab-bci-bookable-spots" className="gap-2">
            <EyeOff className="h-4 w-4 !text-orange-600" />
            Non-Bookable ({bookableSpots.length})
          </TabsTrigger>
        </TabsList>

        {/* All Spots Tab */}
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
                <CardTitle>All Parking Spots ({sortedSpots.length})</CardTitle>
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
                        onClick={async () => {
                          const success = await quickExportParkingSpotsExcel(sortedSpots, 'Parking Spots Report', (errorMessage) => {
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
                            infoTooltip="Unique identifier for the parking spot"
                          >
                            {t("admin.parkingManagement.spotNumber")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="locationName"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                            infoTooltip="Building and parking level where spot is located"
                          >
                            {t("admin.parkingManagement.location")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="spotTypeName"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                            infoTooltip="Standard, Accessible, Reserved (C-Suite), or EV Charging"
                          >
                            {t("admin.parkingManagement.type")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isActive"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                            infoTooltip="Active = in use, Bookable = can be shared/booked"
                          >
                            {t("admin.parkingManagement.status")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="ownerId"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                            infoTooltip="Employee assigned to this spot, or Workplace Services"
                          >
                            {t("admin.parkingManagement.assignedTo")}
                          </SortableTableHeader>
                          <SortableTableHeader
                            column="isBookable"
                            currentSortColumn={sortState.column}
                            currentSortDirection={sortState.direction}
                            onSort={handleSort}
                            infoTooltip="Assigned = has owner, Available = managed by Workplace Services"
                          >
                            {t("admin.parkingManagement.assignmentStatus")}
                          </SortableTableHeader>
                          <TableHead>Map</TableHead>
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
                              <div className="flex items-center gap-2 flex-wrap">
                                {spot.spotNumber}
                                {scheduledAssignmentsBySpotId.has(spot.id) && (
                                  <div className="flex flex-col gap-0.5">
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs w-fit">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Scheduled {new Date(scheduledAssignmentsBySpotId.get(spot.id)!.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      &#8594; {scheduledAssignmentsBySpotId.get(spot.id)!.userName}
                                    </span>
                                  </div>
                                )}
                              </div>
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
                            <TableCell>
                              {(() => {
                                const seatNum = (spot as any).seatNumber;
                                const location = locations.find(loc => loc.id === spot.locationId);
                                const floorPlanBaseUrl = (location as any)?.floorPlanBaseUrl;
                                const mapUrl = seatNum && floorPlanBaseUrl
                                  ? `${floorPlanBaseUrl}${seatNum}`
                                  : spot.mapLink;
                                return mapUrl ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" asChild>
                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                                          <MapPin className="h-4 w-4 text-blue-500" />
                                        </a>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View on floor plan{seatNum ? ` (Seat ${seatNum})` : ''}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                );
                              })()}
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

        {/* Available Spots Tab */}
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
                <CardTitle>Available Parking Spots ({sortedAvailableSpots.length})</CardTitle>
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
                        onClick={async () => {
                          const success = await quickExportParkingSpotsExcel(sortedAvailableSpots, 'Available Spots Report', (errorMessage) => {
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
                          column="locationName"
                          currentSortColumn={availableSpotsSortState.column}
                          currentSortDirection={availableSpotsSortState.direction}
                          onSort={handleAvailableSpotsSort}
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotTypeName"
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
                        <TableHead>Map</TableHead>
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
                            <div className="flex items-center gap-2 flex-wrap">
                              {spot.spotNumber}
                              {scheduledAssignmentsBySpotId.has(spot.id) && (
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-xs w-fit">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Scheduled {new Date(scheduledAssignmentsBySpotId.get(spot.id)!.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    &#8594; {scheduledAssignmentsBySpotId.get(spot.id)!.userName}
                                  </span>
                                </div>
                              )}
                            </div>
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
                          <TableCell data-testid={`text-unallocated-spot-map-${spot.id}`}>
                            {(() => {
                              const seatNum = (spot as any).seatNumber;
                              const location = locations.find(loc => loc.id === spot.locationId);
                              const floorPlanBaseUrl = (location as any)?.floorPlanBaseUrl;
                              const mapUrl = seatNum && floorPlanBaseUrl
                                ? `${floorPlanBaseUrl}${seatNum}`
                                : spot.mapLink;
                              return mapUrl ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={mapUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-map-${spot.id}`}>
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View on floor plan{seatNum ? ` (Seat ${seatNum})` : ''}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              );
                            })()}
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

        {/* Assigned Spots Tab */}
        <TabsContent value="bci-assigned" className="space-y-4">
          {/* Search & Filters for Assigned Spots */}
          <EnhancedFilters
            searchValue={assignedSpotsSearchTerm}
            onSearchChange={setAssignedSpotsSearchTerm}
            filterConfigs={assignedSpotsFilterConfigs}
            filterValues={assignedSpotsFilterValues}
            onFilterChange={handleAssignedSpotsFilterChange}
            onClearFilters={handleClearAssignedSpotsFilters}
            searchPlaceholder="Search by spot number, location, assigned user, email, or type..."
            className="hover-elevate"
          />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Assigned Parking Spots ({assignedSpots.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {assignedSpots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-assigned-spots">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No spots are currently assigned to employees.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-assigned-spots">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={assignedSpotsSortState.column}
                          currentSortDirection={assignedSpotsSortState.direction}
                          onSort={handleAssignedSpotsSort}
                          infoTooltip="Unique identifier for the parking spot"
                        >
                          Spot #
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="locationName"
                          currentSortColumn={assignedSpotsSortState.column}
                          currentSortDirection={assignedSpotsSortState.direction}
                          onSort={handleAssignedSpotsSort}
                          infoTooltip="Building and parking level where spot is located"
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerId"
                          currentSortColumn={assignedSpotsSortState.column}
                          currentSortDirection={assignedSpotsSortState.direction}
                          onSort={handleAssignedSpotsSort}
                          infoTooltip="Employee currently assigned to this spot"
                        >
                          Assigned To
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotTypeName"
                          currentSortColumn={assignedSpotsSortState.column}
                          currentSortDirection={assignedSpotsSortState.direction}
                          onSort={handleAssignedSpotsSort}
                          infoTooltip="Spot type: Standard, Accessible, Reserved (C-Suite), or EV Charging"
                        >
                          Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="isActive"
                          currentSortColumn={assignedSpotsSortState.column}
                          currentSortDirection={assignedSpotsSortState.direction}
                          onSort={handleAssignedSpotsSort}
                          infoTooltip="Active = in use, Bookable = can be shared/booked by others"
                        >
                          Status
                        </SortableTableHeader>
                        <TableHead>Map</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAssignedSpots.map((spot) => (
                        <TableRow key={spot.id} data-testid={`row-assigned-spot-${spot.id}`}>
                          <TableCell className="font-medium">{spot.spotNumber}</TableCell>
                          <TableCell>
                            {spot.locationName}
                            {spot.isIndoor && <Badge variant="outline" className="ml-2">Indoor</Badge>}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {allUsers.find(user => user.id === spot.ownerId)?.name || 
                               `${allUsers.find(user => user.id === spot.ownerId)?.firstName || ''} ${allUsers.find(user => user.id === spot.ownerId)?.lastName || ''}`.trim() || 
                               'Assigned User'}
                            </span>
                          </TableCell>
                          <TableCell>{getSpotTypeBadge(spot.spotTypeName)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {spot.isActive !== false ? (
                                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">Inactive</Badge>
                              )}
                              {spot.isBookable ? (
                                <Badge variant="outline">Bookable</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">Not Bookable</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const seatNum = (spot as any).seatNumber;
                              const location = locations.find(loc => loc.id === spot.locationId);
                              const floorPlanBaseUrl = (location as any)?.floorPlanBaseUrl;
                              const mapUrl = seatNum && floorPlanBaseUrl
                                ? `${floorPlanBaseUrl}${seatNum}`
                                : spot.mapLink;
                              return mapUrl ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View on floor plan{seatNum ? ` (Seat ${seatNum})` : ''}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditSpot(spot)} title="Edit Spot">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleReleaseSpot(spot)} title="Release Spot">
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={assignedSpots.length}
                    pageSize={assignedSpotsPageSize}
                    pageIndex={assignedSpotsPageIndex}
                    onPageSizeChange={(size) => {
                      setAssignedSpotsPageSize(size)
                      setAssignedSpotsPageIndex(0)
                    }}
                    onPageIndexChange={setAssignedSpotsPageIndex}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Non-Bookable Spots Tab */}
        <TabsContent value="bci-bookable" className="space-y-4">
          {/* Search & Filters for Non-Bookable Spots */}
          <EnhancedFilters
            searchValue={bookableSpotsSearchTerm}
            onSearchChange={setBookableSpotsSearchTerm}
            filterConfigs={bookableSpotsFilterConfigs}
            filterValues={bookableSpotsFilterValues}
            onFilterChange={handleBookableSpotsFilterChange}
            onClearFilters={handleClearBookableSpotsFilters}
            searchPlaceholder="Search by spot number, location, assigned user, email, or type..."
            className="hover-elevate"
          />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <EyeOff className="h-5 w-5 text-orange-600" />
                  Non-Bookable Parking Spots ({bookableSpots.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {bookableSpots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-bookable-spots">
                  <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No spots are currently disabled for booking.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-bookable-spots">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={bookableSpotsSortState.column}
                          currentSortDirection={bookableSpotsSortState.direction}
                          onSort={handleBookableSpotsSort}
                          infoTooltip="Unique identifier for the parking spot"
                        >
                          Spot #
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="locationName"
                          currentSortColumn={bookableSpotsSortState.column}
                          currentSortDirection={bookableSpotsSortState.direction}
                          onSort={handleBookableSpotsSort}
                          infoTooltip="Building and parking level where spot is located"
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerId"
                          currentSortColumn={bookableSpotsSortState.column}
                          currentSortDirection={bookableSpotsSortState.direction}
                          onSort={handleBookableSpotsSort}
                          infoTooltip="Assigned employee, or Workplace Services if unassigned"
                        >
                          Owner
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotTypeName"
                          currentSortColumn={bookableSpotsSortState.column}
                          currentSortDirection={bookableSpotsSortState.direction}
                          onSort={handleBookableSpotsSort}
                          infoTooltip="Spot type: Standard, Accessible, Reserved (C-Suite), or EV Charging"
                        >
                          Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerId"
                          currentSortColumn={bookableSpotsSortState.column}
                          currentSortDirection={bookableSpotsSortState.direction}
                          onSort={handleBookableSpotsSort}
                          infoTooltip="Assigned = has an owner, Available = managed by Workplace Services"
                        >
                          Assignment
                        </SortableTableHeader>
                        <TableHead>Map</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedBookableSpots.map((spot) => (
                        <TableRow key={spot.id} data-testid={`row-bookable-spot-${spot.id}`}>
                          <TableCell className="font-medium">{spot.spotNumber}</TableCell>
                          <TableCell>
                            {spot.locationName}
                            {spot.isIndoor && <Badge variant="outline" className="ml-2">Indoor</Badge>}
                          </TableCell>
                          <TableCell>
                            {spot.ownerId ? (
                              <span className="font-medium">
                                {allUsers.find(user => user.id === spot.ownerId)?.name || 
                                 `${allUsers.find(user => user.id === spot.ownerId)?.firstName || ''} ${allUsers.find(user => user.id === spot.ownerId)?.lastName || ''}`.trim() || 
                                 'Assigned User'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Workplace Services</span>
                            )}
                          </TableCell>
                          <TableCell>{getSpotTypeBadge(spot.spotTypeName)}</TableCell>
                          <TableCell>
                            {spot.ownerId ? (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">Assigned</Badge>
                            ) : (
                              <Badge variant="outline">Available</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const seatNum = (spot as any).seatNumber;
                              const location = locations.find(loc => loc.id === spot.locationId);
                              const floorPlanBaseUrl = (location as any)?.floorPlanBaseUrl;
                              const mapUrl = seatNum && floorPlanBaseUrl
                                ? `${floorPlanBaseUrl}${seatNum}`
                                : spot.mapLink;
                              return mapUrl ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View on floor plan{seatNum ? ` (Seat ${seatNum})` : ''}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditSpot(spot)} title="Edit Spot">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={bookableSpots.length}
                    pageSize={bookableSpotsPageSize}
                    pageIndex={bookableSpotsPageIndex}
                    onPageSizeChange={(size) => {
                      setBookableSpotsPageSize(size)
                      setBookableSpotsPageIndex(0)
                    }}
                    onPageIndexChange={setBookableSpotsPageIndex}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {scheduledAssignments.length > 0 && (
        <Card className="mt-6" data-testid="card-scheduled-assignments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Pending Scheduled Assignments ({scheduledAssignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingScheduledAssignments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scheduled assignments...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table data-testid="table-scheduled-assignments">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spot</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Cancel Bookings</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledAssignments.map((sa) => (
                      <TableRow key={sa.id} data-testid={`row-scheduled-assignment-${sa.id}`}>
                        <TableCell className="font-medium">{sa.spotNumber}</TableCell>
                        <TableCell>{sa.locationName}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sa.userName}</p>
                            <p className="text-xs text-muted-foreground">{sa.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                            {new Date(sa.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {sa.cancelFutureBookings ? (
                            <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: "Cancel Scheduled Assignment",
                                description: `Cancel the scheduled assignment of spot ${sa.spotNumber} to ${sa.userName} on ${new Date(sa.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}?`,
                                confirmText: "Cancel Assignment",
                                cancelText: "Keep",
                                variant: "destructive"
                              });
                              if (confirmed) {
                                cancelScheduledAssignmentMutation.mutate(sa.id);
                              }
                            }}
                            disabled={cancelScheduledAssignmentMutation.isPending}
                            data-testid={`button-cancel-scheduled-${sa.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
            {departmentReservedSpotTypeId && addSpotFormData.spotTypeId === departmentReservedSpotTypeId && (
              <div>
                <label className="text-sm font-medium">Reserved for Department</label>
                <Select 
                  value={addSpotFormData.reservedForDepartmentId?.toString() || ""}
                  onValueChange={(value) => setAddSpotFormData(prev => ({ ...prev, reservedForDepartmentId: value ? parseInt(value) : null }))}
                >
                  <SelectTrigger data-testid="select-add-spot-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Only employees from this department can book this spot</p>
              </div>
            )}
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
                onClick={handleAddSpotWithCustomLocation}
                disabled={
                  addSpotMutation.isPending || 
                  createLocationMutation.isPending ||
                  !addSpotFormData.spotNumber || 
                  !addSpotFormData.spotTypeId ||
                  (departmentReservedSpotTypeId && addSpotFormData.spotTypeId === departmentReservedSpotTypeId && !addSpotFormData.reservedForDepartmentId) ||
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
            {departmentReservedSpotTypeId && editFormData.spotTypeId === departmentReservedSpotTypeId && (
              <div>
                <label className="text-sm font-medium">Reserved for Department</label>
                <Select 
                  value={editFormData.reservedForDepartmentId?.toString() || ""}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, reservedForDepartmentId: value ? parseInt(value) : null }))}
                >
                  <SelectTrigger data-testid="select-edit-spot-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Only employees from this department can book this spot</p>
              </div>
            )}
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
            <div>
              <label className="text-sm font-medium">Seat Number</label>
              <Input
                value={editFormData.seatNumber || ""}
                onChange={(e) => setEditFormData(prev => ({ ...prev, seatNumber: e.target.value }))}
                placeholder="e.g., 34478"
                data-testid="input-edit-spot-seat-number"
              />
              <p className="text-xs text-muted-foreground mt-1">Office space seat ID for floor plan link (e.g., 34478)</p>
            </div>
            {selectedSpot && scheduledAssignmentsBySpotId.has(selectedSpot.id) && (() => {
              const sa = scheduledAssignmentsBySpotId.get(selectedSpot.id)!;
              return (
                <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Pending Scheduled Transfer</span>
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-400 space-y-0.5">
                    <div><span className="text-muted-foreground">To:</span> <strong>{sa.userName}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> {sa.userEmail}</div>
                    <div><span className="text-muted-foreground">On:</span> {new Date(sa.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-700"
                    onClick={() => cancelScheduledAssignmentMutation.mutate(sa.id)}
                    disabled={cancelScheduledAssignmentMutation.isPending}
                    data-testid="button-cancel-scheduled-transfer"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {cancelScheduledAssignmentMutation.isPending ? "Cancelling..." : "Cancel Scheduled Transfer"}
                  </Button>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => selectedSpot && editSpotMutation.mutate({ 
                  spotId: selectedSpot.id, 
                  spotData: editFormData 
                })}
                disabled={editSpotMutation.isPending || !editFormData.spotNumber || !editFormData.locationId || !editFormData.spotTypeId || !!(departmentReservedSpotTypeId && editFormData.spotTypeId === departmentReservedSpotTypeId && !editFormData.reservedForDepartmentId)}
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
            {/* Department restriction validation warning */}
            {(() => {
              if (!selectedSpotForAssign || !directAssignFormData.userId) return null;
              
              // Check if this is a Department Reserved spot
              const isDeptReserved = selectedSpotForAssign.spotTypeName === 'Department Reserved' || 
                                     (departmentReservedSpotTypeId && selectedSpotForAssign.spotTypeId === departmentReservedSpotTypeId);
              
              if (!isDeptReserved || !selectedSpotForAssign.reservedForDepartmentId) return null;
              
              // Find the selected user
              const selectedUser = searchedUsers.find(u => u.id === directAssignFormData.userId) || 
                                   allUsers.find((u: any) => u.id === directAssignFormData.userId);
              
              if (!selectedUser) return null;
              
              // Check if user's department matches
              const userDeptId = selectedUser.departmentId;
              const spotDeptId = selectedSpotForAssign.reservedForDepartmentId;
              
              if (userDeptId !== spotDeptId) {
                const deptName = selectedSpotForAssign.reservedForDepartmentName || 'the restricted department';
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="warning-department-mismatch">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-700">
                        <p className="font-medium">Department Restriction</p>
                        <p>This spot is reserved for <strong>{deptName}</strong> department only. The selected user is not a member of this department and cannot be assigned to this spot.</p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              return null;
            })()}
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

            <div>
              <label className="text-sm font-medium">Effective Date</label>
              <Popover open={effectiveDatePickerOpen} onOpenChange={setEffectiveDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-direct-assign-effective-date"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {directAssignFormData.scheduledDate
                      ? format(directAssignFormData.scheduledDate, "PPP")
                      : "Today (immediate)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={directAssignFormData.scheduledDate || undefined}
                    defaultMonth={directAssignFormData.scheduledDate || new Date()}
                    onSelect={(date) => {
                      setDirectAssignFormData(prev => ({ ...prev, scheduledDate: date || null }));
                      setEffectiveDatePickerOpen(false);
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    holidays={statHolidays}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedSpotForAssign && scheduledAssignmentsBySpotId.has(selectedSpotForAssign.id) && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  This spot already has a scheduled transfer to <strong>{scheduledAssignmentsBySpotId.get(selectedSpotForAssign.id)!.userName}</strong> on <strong>{new Date(scheduledAssignmentsBySpotId.get(selectedSpotForAssign.id)!.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>. Saving will cancel it and replace it with this new assignment.
                </AlertDescription>
              </Alert>
            )}

            {directAssignFormData.scheduledDate && directAssignFormData.scheduledDate.toDateString() !== new Date().toDateString() && (
              <div className="space-y-3">
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Ownership will transfer on <strong>{format(directAssignFormData.scheduledDate, "PPP")}</strong>. The current owner retains the spot until then.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center justify-between gap-4 p-3 bg-muted rounded-lg">
                  <div className="text-sm">
                    <p className="font-medium">Cancel existing bookings from {format(directAssignFormData.scheduledDate, "MMM d")} onwards?</p>
                    <p className="text-muted-foreground">Affected renters will be notified automatically.</p>
                  </div>
                  <Switch
                    checked={directAssignFormData.cancelFutureBookings}
                    onCheckedChange={(checked) => setDirectAssignFormData(prev => ({ ...prev, cancelFutureBookings: checked }))}
                    data-testid="switch-cancel-future-bookings"
                  />
                </div>
              </div>
            )}
            
            {/* Show future bookings warning for reassignment */}
            {selectedSpotForAssign?.ownerId && (
              <>
                {isLoadingDirectAssignBookings ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for affected bookings...
                  </div>
                ) : directAssignFutureBookings && directAssignFutureBookings.count > 0 ? (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">
                          {directAssignFutureBookings.count} upcoming booking{directAssignFutureBookings.count > 1 ? 's' : ''} will be cancelled
                        </p>
                        <p className="text-sm">
                          Reassigning this spot will cancel these bookings and notify affected users:
                        </p>
                        <div className="max-h-24 overflow-y-auto mt-2 space-y-1">
                          {directAssignFutureBookings.bookings.map((booking) => (
                            <div key={booking.id} className="text-xs bg-destructive/10 rounded px-2 py-1 flex justify-between items-center">
                              <span className="font-medium">{booking.renterName}</span>
                              <span className="text-muted-foreground">
                                {new Date(booking.bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : directAssignFutureBookings && directAssignFutureBookings.count === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    No upcoming bookings will be affected.
                  </div>
                ) : null}
              </>
            )}
            
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
                disabled={(() => {
                  if (directAssignMutation.isPending || !directAssignFormData.userId || !selectedSpotForAssign) return true;
                  if (isLoadingDirectAssignBookings) return true;
                  
                  // Disable if department mismatch for Department Reserved spots
                  const isDeptReserved = selectedSpotForAssign.spotTypeName === 'Department Reserved' || 
                                         (departmentReservedSpotTypeId && selectedSpotForAssign.spotTypeId === departmentReservedSpotTypeId);
                  if (isDeptReserved && selectedSpotForAssign.reservedForDepartmentId) {
                    const selectedUser = searchedUsers.find(u => u.id === directAssignFormData.userId) || 
                                         allUsers.find((u: any) => u.id === directAssignFormData.userId);
                    if (selectedUser && selectedUser.departmentId !== selectedSpotForAssign.reservedForDepartmentId) {
                      return true;
                    }
                  }
                  return false;
                })()}
                className="flex-1"
                data-testid="button-confirm-direct-assign"
              >
                {directAssignMutation.isPending ? (directAssignFormData.scheduledDate && directAssignFormData.scheduledDate.toDateString() !== new Date().toDateString() ? "Scheduling..." : "Assigning...") : 
                 directAssignFormData.scheduledDate && directAssignFormData.scheduledDate.toDateString() !== new Date().toDateString()
                   ? "Schedule Assignment"
                   : directAssignFutureBookings && directAssignFutureBookings.count > 0 
                     ? `Reassign & Cancel ${directAssignFutureBookings.count} Booking${directAssignFutureBookings.count > 1 ? 's' : ''}`
                     : "Assign Spot"}
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
        <DialogContent className="max-w-lg" data-testid="dialog-release-spot">
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
                
                {/* Show loading state or future bookings warning */}
                {isLoadingFutureBookings ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for affected bookings...
                  </div>
                ) : futureBookingsData && futureBookingsData.count > 0 ? (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">
                          {futureBookingsData.count} upcoming booking{futureBookingsData.count > 1 ? 's' : ''} will be cancelled
                        </p>
                        <p className="text-sm">
                          The following people will be notified that their bookings have been cancelled:
                        </p>
                        <div className="max-h-32 overflow-y-auto mt-2 space-y-1">
                          {futureBookingsData.bookings.map((booking) => (
                            <div key={booking.id} className="text-xs bg-destructive/10 rounded px-2 py-1 flex justify-between items-center">
                              <span className="font-medium">{booking.renterName}</span>
                              <span className="text-muted-foreground">
                                {new Date(booking.bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : futureBookingsData && futureBookingsData.count === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    No upcoming bookings will be affected.
                  </div>
                ) : null}
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedSpotForRelease) {
                        releaseSpotMutation.mutate(selectedSpotForRelease.id);
                      }
                    }}
                    disabled={releaseSpotMutation.isPending || isLoadingFutureBookings}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-confirm-release-spot"
                  >
                    {releaseSpotMutation.isPending ? "Releasing..." : 
                     futureBookingsData && futureBookingsData.count > 0 
                       ? `Release & Cancel ${futureBookingsData.count} Booking${futureBookingsData.count > 1 ? 's' : ''}`
                       : "Release Spot"}
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
      <Dialog open={showAssignAvailableSpotDialog} onOpenChange={(open) => {
        setShowAssignAvailableSpotDialog(open);
        if (!open) {
          setUserPickerOpen(false);
          setSelectedUserForAvailableSpot("");
        }
      }}>
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
                  <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userPickerOpen}
                        className="w-full justify-between font-normal"
                        data-testid="select-user-for-available-spot"
                      >
                        {selectedUserForAvailableSpot ? (
                          (() => {
                            const user = allUsers.find(u => u.id === selectedUserForAvailableSpot);
                            return user ? `${user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim()} (${user.email})` : "Select user...";
                          })()
                        ) : (
                          "Search and select user..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Type to search users by name or email..." />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandGroup>
                            {allUsers.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={`${user.name || ''} ${user.firstName || ''} ${user.lastName || ''} ${user.email || ''} ${user.department || ''}`}
                                onSelect={() => {
                                  setSelectedUserForAvailableSpot(user.id);
                                  setUserPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedUserForAvailableSpot === user.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim()}</span>
                                  <span className="text-xs text-muted-foreground">{user.email} - {user.department || 'Unknown'}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-sm font-medium">Effective Date</label>
                  <Popover open={availableSpotEffectiveDatePickerOpen} onOpenChange={setAvailableSpotEffectiveDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-available-spot-effective-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {assignAvailableSpotFormData.scheduledDate
                          ? format(assignAvailableSpotFormData.scheduledDate, "PPP")
                          : "Today (immediate)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignAvailableSpotFormData.scheduledDate || undefined}
                        defaultMonth={assignAvailableSpotFormData.scheduledDate || new Date()}
                        onSelect={(date) => {
                          setAssignAvailableSpotFormData(prev => ({ ...prev, scheduledDate: date || null }));
                          setAvailableSpotEffectiveDatePickerOpen(false);
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        holidays={statHolidays}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedAvailableSpot && scheduledAssignmentsBySpotId.has(selectedAvailableSpot.id) && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      This spot already has a scheduled transfer to <strong>{scheduledAssignmentsBySpotId.get(selectedAvailableSpot.id)!.userName}</strong> on <strong>{new Date(scheduledAssignmentsBySpotId.get(selectedAvailableSpot.id)!.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>. Saving will cancel it and replace it with this new assignment.
                    </AlertDescription>
                  </Alert>
                )}

                {assignAvailableSpotFormData.scheduledDate && assignAvailableSpotFormData.scheduledDate.toDateString() !== new Date().toDateString() && (
                  <div className="space-y-3">
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        Ownership will transfer on <strong>{format(assignAvailableSpotFormData.scheduledDate, "PPP")}</strong>.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center justify-between gap-4 p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        <p className="font-medium">Cancel existing bookings from {format(assignAvailableSpotFormData.scheduledDate, "MMM d")} onwards?</p>
                        <p className="text-muted-foreground">Affected renters will be notified automatically.</p>
                      </div>
                      <Switch
                        checked={assignAvailableSpotFormData.cancelFutureBookings}
                        onCheckedChange={(checked) => setAssignAvailableSpotFormData(prev => ({ ...prev, cancelFutureBookings: checked }))}
                        data-testid="switch-available-spot-cancel-future-bookings"
                      />
                    </div>
                  </div>
                )}
                
                {/* Show unbooked listings that will be removed */}
                {futureListingsData && futureListingsData.count > 0 && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      <strong>{futureListingsData.count} existing listing{futureListingsData.count > 1 ? 's' : ''}</strong> will also be removed from <strong>{format(assignAvailableSpotFormData.scheduledDate || new Date(), "MMM d")}</strong> onwards.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Show future bookings warning for available spot assignment */}
                {isLoadingAvailableSpotBookings ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking for existing bookings...
                  </div>
                ) : availableSpotFutureBookings && availableSpotFutureBookings.count > 0 ? (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">
                          {availableSpotFutureBookings.count} upcoming booking{availableSpotFutureBookings.count > 1 ? 's' : ''} will be cancelled
                        </p>
                        <p className="text-sm">
                          This spot has existing bookings from the shared pool. Assigning it will cancel these bookings and notify affected users:
                        </p>
                        <div className="max-h-24 overflow-y-auto mt-2 space-y-1">
                          {availableSpotFutureBookings.bookings.map((booking) => (
                            <div key={booking.id} className="text-xs bg-destructive/10 rounded px-2 py-1 flex justify-between items-center">
                              <span className="font-medium">{booking.renterName}</span>
                              <span className="text-muted-foreground">
                                {new Date(booking.bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : availableSpotFutureBookings && availableSpotFutureBookings.count === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    No existing bookings will be affected.
                  </div>
                ) : null}
                
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      if (selectedAvailableSpot && selectedUserForAvailableSpot) {
                        assignAvailableSpotMutation.mutate({
                          spotId: selectedAvailableSpot.id,
                          userId: selectedUserForAvailableSpot,
                          isBciManaged: assignAvailableSpotFormData.isBciManaged,
                          scheduledDate: assignAvailableSpotFormData.scheduledDate,
                          cancelFutureBookings: assignAvailableSpotFormData.cancelFutureBookings
                        });
                      }
                    }}
                    disabled={assignAvailableSpotMutation.isPending || !selectedUserForAvailableSpot || isLoadingAvailableSpotBookings}
                    className="flex-1"
                    data-testid="button-confirm-assign-available-spot"
                  >
                    {assignAvailableSpotMutation.isPending ? (assignAvailableSpotFormData.scheduledDate && assignAvailableSpotFormData.scheduledDate.toDateString() !== new Date().toDateString() ? "Scheduling..." : "Assigning...") : 
                     assignAvailableSpotFormData.scheduledDate && assignAvailableSpotFormData.scheduledDate.toDateString() !== new Date().toDateString()
                       ? "Schedule Assignment"
                       : availableSpotFutureBookings && availableSpotFutureBookings.count > 0 
                         ? `Assign & Cancel ${availableSpotFutureBookings.count} Booking${availableSpotFutureBookings.count > 1 ? 's' : ''}`
                         : "Assign Spot"}
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
                    {singleDatePickerOpen && (
                      <Calendar
                        mode="single"
                        selected={createAvailabilityFormData.singleDate}
                        defaultMonth={createAvailabilityFormData.singleDate || new Date()}
                        onSelect={(date) => {
                          setCreateAvailabilityFormData({ ...createAvailabilityFormData, singleDate: date })
                          setSingleDatePickerOpen(false)
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const maxDate = new Date();
                          maxDate.setMonth(maxDate.getMonth() + 6);
                          return date < today || date > maxDate;
                        }}
                        holidays={statHolidays}
                        initialFocus
                      />
                    )}
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
                      {startDatePickerOpen && (
                        <Calendar
                          mode="single"
                          selected={createAvailabilityFormData.periodStartDate}
                          defaultMonth={createAvailabilityFormData.periodStartDate || createAvailabilityFormData.periodEndDate || new Date()}
                          onSelect={(date) => {
                            const updates: any = { periodStartDate: date };
                            if (date && (!createAvailabilityFormData.periodEndDate || createAvailabilityFormData.periodEndDate < date)) {
                              updates.periodEndDate = date;
                            }
                            setCreateAvailabilityFormData({ ...createAvailabilityFormData, ...updates });
                            setStartDatePickerOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const maxDate = new Date();
                            maxDate.setMonth(maxDate.getMonth() + 6);
                            return date < today || date > maxDate;
                          }}
                          holidays={statHolidays}
                          initialFocus
                        />
                      )}
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
                      {endDatePickerOpen && (
                        <Calendar
                          mode="single"
                          selected={createAvailabilityFormData.periodEndDate}
                          defaultMonth={createAvailabilityFormData.periodStartDate || createAvailabilityFormData.periodEndDate || new Date()}
                          onSelect={(date) => {
                            const updates: any = { periodEndDate: date };
                            if (date && (!createAvailabilityFormData.periodStartDate || createAvailabilityFormData.periodStartDate > date)) {
                              updates.periodStartDate = date;
                            }
                            setCreateAvailabilityFormData({ ...createAvailabilityFormData, ...updates });
                            setEndDatePickerOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const maxDate = new Date();
                            maxDate.setMonth(maxDate.getMonth() + 6);
                            if (date < today || date > maxDate) return true;
                            return false;
                          }}
                          holidays={statHolidays}
                          initialFocus
                        />
                      )}
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

            {/* Donate to Charity Option */}
            <div className="flex items-start space-x-3 p-4 bg-pink-50 border border-pink-200 rounded-lg">
              <Checkbox
                id="donateToCharity"
                checked={createAvailabilityFormData.donateToCharity}
                onCheckedChange={(checked) => 
                  setCreateAvailabilityFormData({ ...createAvailabilityFormData, donateToCharity: checked === true })
                }
                className="mt-0.5 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                data-testid="checkbox-donate-to-charity"
              />
              <div className="space-y-1">
                <Label htmlFor="donateToCharity" className="cursor-pointer font-medium text-pink-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Donate Earnings to Charity
                </Label>
                <p className="text-sm text-pink-700">
                  By selecting this, you commit to donating all earnings from this listing to charity. A special badge will appear on the listing.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => {
                  console.log('[DEBUG] Form data dailyRate (string):', createAvailabilityFormData.dailyRate);
                  const dailyRate = parseFloat(createAvailabilityFormData.dailyRate);
                  console.log('[DEBUG] Parsed dailyRate (number):', dailyRate, 'Type:', typeof dailyRate);
                  
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
                    
                    console.log('[DEBUG] Sending to API - dailyRate:', dailyRate);
                    bulkCreateListingsMutation.mutate({
                      spotIds: Array.from(selectedSpots),
                      listingType: "single",
                      singleDate: format(createAvailabilityFormData.singleDate, "yyyy-MM-dd"),
                      dailyRate,
                      donateToCharity: createAvailabilityFormData.donateToCharity
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
                    
                    console.log('[DEBUG] Sending to API - dailyRate:', dailyRate);
                    bulkCreateListingsMutation.mutate({
                      spotIds: Array.from(selectedSpots),
                      listingType: "period",
                      periodStartDate: format(createAvailabilityFormData.periodStartDate, "yyyy-MM-dd"),
                      periodEndDate: format(createAvailabilityFormData.periodEndDate, "yyyy-MM-dd"),
                      dailyRate,
                      donateToCharity: createAvailabilityFormData.donateToCharity
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

      {/* Bulk Seat Number Upload Dialog */}
      <Dialog open={showBulkSeatNumberDialog} onOpenChange={setShowBulkSeatNumberDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-bulk-seat-numbers">
          <DialogHeader>
            <DialogTitle>Bulk Upload Seat Numbers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste your mapping data below. Each line should have: SpotNumber,SeatNumber
            </p>
            <div className="bg-muted p-3 rounded-md text-xs font-mono">
              <p>Example format:</p>
              <p>A001,34478</p>
              <p>A002,34479</p>
              <p>A003,34480</p>
            </div>
            <textarea
              className="w-full h-48 p-3 border rounded-md font-mono text-sm"
              placeholder="SpotNumber,SeatNumber&#10;A001,34478&#10;A002,34479"
              value={bulkSeatNumberData}
              onChange={(e) => setBulkSeatNumberData(e.target.value)}
              data-testid="textarea-bulk-seat-numbers"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  // Parse the CSV data
                  const lines = bulkSeatNumberData.trim().split('\n').filter(line => line.trim());
                  const mappings = lines.map(line => {
                    const parts = line.split(',').map(p => p.trim());
                    return { spotNumber: parts[0], seatNumber: parts[1] };
                  }).filter(m => m.spotNumber && m.seatNumber);
                  
                  if (mappings.length === 0) {
                    toast({
                      title: "Error",
                      description: "No valid mappings found. Each line should have SpotNumber,SeatNumber",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  bulkSeatNumberMutation.mutate(mappings);
                }}
                disabled={bulkSeatNumberMutation.isPending || !bulkSeatNumberData.trim()}
                className="flex-1"
                data-testid="button-submit-bulk-seat-numbers"
              >
                {bulkSeatNumberMutation.isPending ? "Updating..." : `Upload Mappings`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkSeatNumberDialog(false);
                  setBulkSeatNumberData("");
                }}
                className="flex-1"
                data-testid="button-cancel-bulk-seat-numbers"
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