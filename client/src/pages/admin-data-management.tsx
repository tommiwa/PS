import { useState, useMemo, useEffect, Fragment } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/hooks/use-language"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { 
  insertDepartmentSchema, 
  type InsertDepartment, 
  type Department,
  insertLocationSchema,
  type InsertLocation,
  type Location,
  insertSpotTypeSchema,
  type InsertSpotType,
  type SpotTypeTable,
  type AppConfig,
  insertFeatureAnnouncementSchema,
  type InsertFeatureAnnouncement,
  type FeatureAnnouncement,
} from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TablePagination } from "@/components/shared/TablePagination"
import { z } from "zod"
import { 
  Database,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  MapPin,
  Tag,
  Building2,
  Layers,
  Eye,
  EyeOff,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Key,
  Copy,
  Sparkles
} from "lucide-react"

// Department form schema
const departmentFormSchema = insertDepartmentSchema.extend({
  name: z.string()
    .min(1, "Department name is required")
    .max(100, "Department name must be less than 100 characters")
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

// Location form schema
const locationFormSchema = insertLocationSchema.extend({
  office: z.string().min(1, "Office is required"),
  building: z.string().min(1, "Building is required"),
  level: z.string().min(1, "Level is required"),
  address: z.string().optional(),
  timezone: z.string().default("America/Vancouver"),
  isActive: z.boolean().default(true),
  floorPlanBaseUrl: z.string().optional()
});

type LocationFormData = z.infer<typeof locationFormSchema>;

// Spot Type form schema
const spotTypeFormSchema = insertSpotTypeSchema.extend({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  bciChargingAmount: z.string().optional().default("0"),
  isActive: z.boolean().default(true)
});

type SpotTypeFormData = z.infer<typeof spotTypeFormSchema>;

type SortDirection = 'asc' | 'desc' | null;

const BADGE_COLOR_OPTIONS = [
  { value: null, label: "Default", bg: "bg-secondary", text: "text-secondary-foreground" },
  { value: "blue", label: "Blue", bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-800 dark:text-blue-200" },
  { value: "green", label: "Green", bg: "bg-green-100 dark:bg-green-900", text: "text-green-800 dark:text-green-200" },
  { value: "red", label: "Red", bg: "bg-red-100 dark:bg-red-900", text: "text-red-800 dark:text-red-200" },
  { value: "yellow", label: "Yellow", bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-800 dark:text-yellow-200" },
  { value: "purple", label: "Purple", bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-800 dark:text-purple-200" },
  { value: "orange", label: "Orange", bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-800 dark:text-orange-200" },
] as const;

function getBadgeColorClasses(color: string | null | undefined) {
  const found = BADGE_COLOR_OPTIONS.find((c) => c.value === (color ?? null));
  return found
    ? `${found.bg} ${found.text}`
    : `${BADGE_COLOR_OPTIONS[0].bg} ${BADGE_COLOR_OPTIONS[0].text}`;
}

// Announcement form schema
const announcementFormSchema = insertFeatureAnnouncementSchema.extend({
  title: z.string().min(1, "Title is required").max(150, "Title must be less than 150 characters"),
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  badgeLabel: z.string().max(30, "Badge label must be less than 30 characters").optional().or(z.literal("")),
  badgeColor: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0, "Sort order must be 0 or greater").default(0),
  enabled: z.boolean().default(true),
});

type AnnouncementFormData = z.infer<typeof announcementFormSchema>;

export default function AdminDataManagement() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { t } = useLanguage()
  const { cardsVisible, toggleCards } = useCardsVisibility('data-management')
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Departments state
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false)
  const [showEditDepartmentDialog, setShowEditDepartmentDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [departmentNameFilter, setDepartmentNameFilter] = useState("")
  const [departmentSortField, setDepartmentSortField] = useState<'name' | 'createdAt' | null>(null)
  const [departmentSortDirection, setDepartmentSortDirection] = useState<SortDirection>(null)

  // Locations state
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false)
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [locationOfficeFilter, setLocationOfficeFilter] = useState("")
  const [locationBuildingFilter, setLocationBuildingFilter] = useState("")
  const [locationLevelFilter, setLocationLevelFilter] = useState("")
  const [locationStatusFilter, setLocationStatusFilter] = useState<string>("")
  const [locationSortField, setLocationSortField] = useState<'office' | 'building' | 'level' | 'isActive' | 'createdAt' | null>(null)
  const [locationSortDirection, setLocationSortDirection] = useState<SortDirection>(null)

  // Spot Types state
  const [showAddSpotTypeDialog, setShowAddSpotTypeDialog] = useState(false)
  const [showEditSpotTypeDialog, setShowEditSpotTypeDialog] = useState(false)
  const [editingSpotType, setEditingSpotType] = useState<SpotTypeTable | null>(null)
  const [spotTypeNameFilter, setSpotTypeNameFilter] = useState("")
  const [spotTypeSlugFilter, setSpotTypeSlugFilter] = useState("")
  const [spotTypeStatusFilter, setSpotTypeStatusFilter] = useState<string>("")
  const [spotTypeSortField, setSpotTypeSortField] = useState<'name' | 'slug' | 'isActive' | 'createdAt' | null>(null)
  const [spotTypeSortDirection, setSpotTypeSortDirection] = useState<SortDirection>(null)

  // Pagination state - Departments
  const [departmentPageIndex, setDepartmentPageIndex] = useState(0)
  const [departmentPageSize, setDepartmentPageSize] = useState(10)

  // Pagination state - Locations
  const [locationPageIndex, setLocationPageIndex] = useState(0)
  const [locationPageSize, setLocationPageSize] = useState(10)

  // Pagination state - Spot Types
  const [spotTypePageIndex, setSpotTypePageIndex] = useState(0)
  const [spotTypePageSize, setSpotTypePageSize] = useState(10)

  // App Configs state
  const [showEditConfigDialog, setShowEditConfigDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AppConfig | null>(null)
  const [configSearchFilter, setConfigSearchFilter] = useState("")
  
  // API Keys state
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKeyValue, setCreatedKeyValue] = useState("")
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false)

  // Announcements state
  const [showAddAnnouncementDialog, setShowAddAnnouncementDialog] = useState(false)
  const [showEditAnnouncementDialog, setShowEditAnnouncementDialog] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<FeatureAnnouncement | null>(null)

  // Active tab state
  const [activeTab, setActiveTab] = useState("departments")

  // Department forms
  const addDepartmentForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: ""
    }
  })

  const editDepartmentForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: ""
    }
  })

  // Location forms
  const addLocationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      office: "",
      building: "",
      level: "",
      address: "",
      timezone: "America/Vancouver",
      isActive: true,
      floorPlanBaseUrl: ""
    }
  })

  const editLocationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      office: "",
      building: "",
      level: "",
      address: "",
      timezone: "America/Vancouver",
      isActive: true,
      floorPlanBaseUrl: ""
    }
  })

  // Spot Type forms
  const addSpotTypeForm = useForm<SpotTypeFormData>({
    resolver: zodResolver(spotTypeFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      bciChargingAmount: "0",
      isActive: true
    }
  })

  const editSpotTypeForm = useForm<SpotTypeFormData>({
    resolver: zodResolver(spotTypeFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      bciChargingAmount: "0",
      isActive: true
    }
  })

  // Queries
  const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: spotTypes = [], isLoading: isLoadingSpotTypes } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  });

  const { data: appConfigs = [], isLoading: isLoadingConfigs, isError: isErrorConfigs, error: configsError } = useQuery<AppConfig[]>({
    queryKey: ["/api/admin/app-configs"],
  });

  const { data: apiKeys = [], isLoading: apiKeysLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/api-keys'],
  });

  const { data: announcements = [], isLoading: isLoadingAnnouncements } = useQuery<FeatureAnnouncement[]>({
    queryKey: ['/api/admin/announcements'],
  });

  // Announcement forms
  const addAnnouncementForm = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: "",
      description: "",
      badgeLabel: "",
      badgeColor: null,
      sortOrder: 0,
      enabled: true,
    }
  })

  const editAnnouncementForm = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: {
      title: "",
      description: "",
      badgeLabel: "",
      badgeColor: null,
      sortOrder: 0,
      enabled: true,
    }
  })


  // Filtered and sorted data
  const filteredAndSortedDepartments = useMemo(() => {
    let filtered = departments.filter(dept =>
      dept.name.toLowerCase().includes(departmentNameFilter.toLowerCase())
    );

    if (departmentSortField && departmentSortDirection) {
      filtered.sort((a, b) => {
        let aVal: any = a[departmentSortField];
        let bVal: any = b[departmentSortField];

        if (departmentSortField === 'createdAt') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        } else {
          aVal = aVal?.toString().toLowerCase() || '';
          bVal = bVal?.toString().toLowerCase() || '';
        }

        if (aVal < bVal) return departmentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return departmentSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [departments, departmentNameFilter, departmentSortField, departmentSortDirection]);

  const filteredAndSortedLocations = useMemo(() => {
    let filtered = locations.filter(loc => {
      const matchesOffice = loc.office.toLowerCase().includes(locationOfficeFilter.toLowerCase());
      const matchesBuilding = loc.building.toLowerCase().includes(locationBuildingFilter.toLowerCase());
      const matchesLevel = loc.level.toLowerCase().includes(locationLevelFilter.toLowerCase());
      const matchesStatus = locationStatusFilter === "" || 
        (locationStatusFilter === "active" && loc.isActive) || 
        (locationStatusFilter === "inactive" && !loc.isActive);
      
      return matchesOffice && matchesBuilding && matchesLevel && matchesStatus;
    });

    if (locationSortField && locationSortDirection) {
      filtered.sort((a, b) => {
        let aVal: any = a[locationSortField];
        let bVal: any = b[locationSortField];

        if (locationSortField === 'createdAt') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        } else if (locationSortField === 'isActive') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
        } else {
          aVal = aVal?.toString().toLowerCase() || '';
          bVal = bVal?.toString().toLowerCase() || '';
        }

        if (aVal < bVal) return locationSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return locationSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [locations, locationOfficeFilter, locationBuildingFilter, locationLevelFilter, locationStatusFilter, locationSortField, locationSortDirection]);

  const filteredAndSortedSpotTypes = useMemo(() => {
    let filtered = spotTypes.filter(st => {
      const matchesName = st.name.toLowerCase().includes(spotTypeNameFilter.toLowerCase());
      const matchesSlug = st.slug.toLowerCase().includes(spotTypeSlugFilter.toLowerCase());
      const matchesStatus = spotTypeStatusFilter === "" || 
        (spotTypeStatusFilter === "active" && st.isActive) || 
        (spotTypeStatusFilter === "inactive" && !st.isActive);
      
      return matchesName && matchesSlug && matchesStatus;
    });

    if (spotTypeSortField && spotTypeSortDirection) {
      filtered.sort((a, b) => {
        let aVal: any = a[spotTypeSortField];
        let bVal: any = b[spotTypeSortField];

        if (spotTypeSortField === 'createdAt') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        } else if (spotTypeSortField === 'isActive') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
        } else {
          aVal = aVal?.toString().toLowerCase() || '';
          bVal = bVal?.toString().toLowerCase() || '';
        }

        if (aVal < bVal) return spotTypeSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return spotTypeSortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [spotTypes, spotTypeNameFilter, spotTypeSlugFilter, spotTypeStatusFilter, spotTypeSortField, spotTypeSortDirection]);

  // Paginated data
  const paginatedDepartments = useMemo(() => {
    const startIndex = departmentPageIndex * departmentPageSize;
    const endIndex = startIndex + departmentPageSize;
    return filteredAndSortedDepartments.slice(startIndex, endIndex);
  }, [filteredAndSortedDepartments, departmentPageIndex, departmentPageSize]);

  const paginatedLocations = useMemo(() => {
    const startIndex = locationPageIndex * locationPageSize;
    const endIndex = startIndex + locationPageSize;
    return filteredAndSortedLocations.slice(startIndex, endIndex);
  }, [filteredAndSortedLocations, locationPageIndex, locationPageSize]);

  const paginatedSpotTypes = useMemo(() => {
    const startIndex = spotTypePageIndex * spotTypePageSize;
    const endIndex = startIndex + spotTypePageSize;
    return filteredAndSortedSpotTypes.slice(startIndex, endIndex);
  }, [filteredAndSortedSpotTypes, spotTypePageIndex, spotTypePageSize]);

  const filteredAndSortedConfigs = useMemo(() => {
    return appConfigs.filter(config => {
      const searchTerm = configSearchFilter.toLowerCase();
      return (
        config.key.toLowerCase().includes(searchTerm) ||
        config.label.toLowerCase().includes(searchTerm) ||
        config.description?.toLowerCase().includes(searchTerm)
      );
    });
  }, [appConfigs, configSearchFilter]);

  const configCategoryLabel = (category: string): string => {
    const map: Record<string, string> = {
      booking: 'Booking',
      system: 'System',
      pricing: 'Pricing',
    };
    return map[category?.toLowerCase()] ?? category.replace(/\b\w/g, c => c.toUpperCase());
  };

  const groupedConfigs = useMemo(() => {
    if (configSearchFilter.trim()) {
      return null;
    }
    const groups: Record<string, typeof filteredAndSortedConfigs> = {};
    for (const config of filteredAndSortedConfigs) {
      const cat = config.category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(config);
    }
    return groups;
  }, [filteredAndSortedConfigs, configSearchFilter]);

  // Reset pagination when filters/sorting changes
  useEffect(() => {
    setDepartmentPageIndex(0);
  }, [departmentNameFilter, departmentSortField, departmentSortDirection]);

  useEffect(() => {
    setLocationPageIndex(0);
  }, [locationOfficeFilter, locationBuildingFilter, locationLevelFilter, locationStatusFilter, locationSortField, locationSortDirection]);

  useEffect(() => {
    setSpotTypePageIndex(0);
  }, [spotTypeNameFilter, spotTypeSlugFilter, spotTypeStatusFilter, spotTypeSortField, spotTypeSortDirection]);

  // Clamp page index when filtered data changes (e.g., after deletions)
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredAndSortedDepartments.length / departmentPageSize) - 1);
    if (departmentPageIndex > maxPage) {
      setDepartmentPageIndex(maxPage);
    }
  }, [filteredAndSortedDepartments.length, departmentPageSize, departmentPageIndex]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredAndSortedLocations.length / locationPageSize) - 1);
    if (locationPageIndex > maxPage) {
      setLocationPageIndex(maxPage);
    }
  }, [filteredAndSortedLocations.length, locationPageSize, locationPageIndex]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredAndSortedSpotTypes.length / spotTypePageSize) - 1);
    if (spotTypePageIndex > maxPage) {
      setSpotTypePageIndex(maxPage);
    }
  }, [filteredAndSortedSpotTypes.length, spotTypePageSize, spotTypePageIndex]);


  // Department mutations
  const createDepartmentMutation = useMutation({
    mutationFn: async (departmentData: DepartmentFormData): Promise<Department> => {
      const response = await apiRequest('/api/admin/departments', { 
        method: 'POST', 
        body: departmentData 
      });
      return await response.json();
    },
    onSuccess: (newDepartment: Department) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowAddDepartmentDialog(false);
      addDepartmentForm.reset();
      toast({
        title: "Department Created",
        description: `Successfully created department "${newDepartment.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating department:', error);
      toast({
        variant: "destructive",
        title: "Error Creating Department",
        description: error.message || "Failed to create department. Please try again.",
      });
    }
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DepartmentFormData }): Promise<Department> => {
      const response = await apiRequest(`/api/admin/departments/${id}`, { 
        method: 'PATCH', 
        body: data 
      });
      return await response.json();
    },
    onSuccess: (updatedDepartment: Department) => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowEditDepartmentDialog(false);
      setEditingDepartment(null);
      editDepartmentForm.reset();
      toast({
        title: "Department Updated",
        description: `Successfully updated department "${updatedDepartment.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating department:', error);
      toast({
        variant: "destructive",
        title: "Error Updating Department",
        description: error.message || "Failed to update department. Please try again.",
      });
    }
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest(`/api/admin/departments/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department Deleted",
        description: "Successfully deleted department",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting department:', error);
      toast({
        variant: "destructive",
        title: "Error Deleting Department",
        description: error.message || "Failed to delete department. Please try again.",
      });
    }
  });

  // Location mutations
  const createLocationMutation = useMutation({
    mutationFn: async (locationData: LocationFormData): Promise<Location> => {
      const response = await apiRequest('/api/admin/locations', { 
        method: 'POST', 
        body: locationData 
      });
      return await response.json();
    },
    onSuccess: (newLocation: Location) => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setShowAddLocationDialog(false);
      addLocationForm.reset();
      toast({
        title: "Location Created",
        description: `Successfully created location "${newLocation.building}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating location:', error);
      toast({
        variant: "destructive",
        title: "Error Creating Location",
        description: error.message || "Failed to create location. Please try again.",
      });
    }
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: LocationFormData }): Promise<Location> => {
      const response = await apiRequest(`/api/admin/locations/${id}`, { 
        method: 'PATCH', 
        body: data 
      });
      return await response.json();
    },
    onSuccess: (updatedLocation: Location) => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setShowEditLocationDialog(false);
      setEditingLocation(null);
      editLocationForm.reset();
      toast({
        title: "Location Updated",
        description: `Successfully updated location "${updatedLocation.building}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating location:', error);
      toast({
        variant: "destructive",
        title: "Error Updating Location",
        description: error.message || "Failed to update location. Please try again.",
      });
    }
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest(`/api/admin/locations/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: "Location Deleted",
        description: "Successfully deleted location",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting location:', error);
      toast({
        variant: "destructive",
        title: "Error Deleting Location",
        description: error.message || "Failed to delete location. Please try again.",
      });
    }
  });

  // Spot Type mutations
  const createSpotTypeMutation = useMutation({
    mutationFn: async (spotTypeData: SpotTypeFormData): Promise<SpotTypeTable> => {
      const dataWithLowercaseSlug = {
        ...spotTypeData,
        slug: spotTypeData.slug.toLowerCase()
      };
      const response = await apiRequest('/api/admin/spot-types', { 
        method: 'POST', 
        body: dataWithLowercaseSlug 
      });
      return await response.json();
    },
    onSuccess: (newSpotType: SpotTypeTable) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] });
      setShowAddSpotTypeDialog(false);
      addSpotTypeForm.reset();
      toast({
        title: "Spot Type Created",
        description: `Successfully created spot type "${newSpotType.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating spot type:', error);
      toast({
        variant: "destructive",
        title: "Error Creating Spot Type",
        description: error.message || "Failed to create spot type. Please try again.",
      });
    }
  });

  const updateSpotTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SpotTypeFormData }): Promise<SpotTypeTable> => {
      const dataWithLowercaseSlug = {
        ...data,
        slug: data.slug.toLowerCase()
      };
      const response = await apiRequest(`/api/admin/spot-types/${id}`, { 
        method: 'PATCH', 
        body: dataWithLowercaseSlug 
      });
      return await response.json();
    },
    onSuccess: (updatedSpotType: SpotTypeTable) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] });
      setShowEditSpotTypeDialog(false);
      setEditingSpotType(null);
      editSpotTypeForm.reset();
      toast({
        title: "Spot Type Updated",
        description: `Successfully updated spot type "${updatedSpotType.name}"`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating spot type:', error);
      toast({
        variant: "destructive",
        title: "Error Updating Spot Type",
        description: error.message || "Failed to update spot type. Please try again.",
      });
    }
  });

  const deleteSpotTypeMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      await apiRequest(`/api/admin/spot-types/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] });
      toast({
        title: "Spot Type Deleted",
        description: "Successfully deleted spot type",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting spot type:', error);
      toast({
        variant: "destructive",
        title: "Error Deleting Spot Type",
        description: error.message || "Failed to delete spot type. Please try again.",
      });
    }
  });

  // App Config mutations
  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }): Promise<AppConfig> => {
      const response = await apiRequest(`/api/admin/app-configs/${key}`, {
        method: 'PATCH',
        body: { value }
      });
      return await response.json();
    },
    onSuccess: (updatedConfig: AppConfig) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/app-configs"] });
      setShowEditConfigDialog(false);
      setEditingConfig(null);
      toast({
        title: "Configuration Updated",
        description: `Successfully updated ${updatedConfig.label}`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating config:', error);
      toast({
        variant: "destructive",
        title: "Error Updating Configuration",
        description: error.message || "Failed to update configuration. Please try again.",
      });
    }
  });

  // API Key mutations
  const createApiKeyMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const res = await apiRequest('/api/admin/api-keys', { method: 'POST', body: { name } });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      setCreatedKeyValue(data.key);
      toast({ title: "API key created", description: "Copy the key now - it won't be shown again." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create API key" });
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      toast({ title: "API key revoked" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to revoke API key" });
    },
  });

  // Announcement mutations
  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData): Promise<FeatureAnnouncement> => {
      const body = { ...data, badgeLabel: data.badgeLabel || null, badgeColor: data.badgeColor || null };
      const res = await apiRequest('/api/admin/announcements', { method: 'POST', body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setShowAddAnnouncementDialog(false);
      addAnnouncementForm.reset();
      toast({ title: "Announcement Created", description: "The announcement has been added." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create announcement" });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AnnouncementFormData }): Promise<FeatureAnnouncement> => {
      const body = { ...data, badgeLabel: data.badgeLabel || null, badgeColor: data.badgeColor || null };
      const res = await apiRequest(`/api/admin/announcements/${id}`, { method: 'PATCH', body });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      setShowEditAnnouncementDialog(false);
      setEditingAnnouncement(null);
      editAnnouncementForm.reset();
      toast({ title: "Announcement Updated" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update announcement" });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      toast({ title: "Announcement Deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete announcement" });
    },
  });

  const toggleAnnouncementMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest(`/api/admin/announcements/${id}`, { method: 'PATCH', body: { enabled } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to toggle announcement" });
    },
  });

  // Sort handlers
  const handleDepartmentSort = (field: 'name' | 'createdAt') => {
    if (departmentSortField === field) {
      if (departmentSortDirection === 'asc') {
        setDepartmentSortDirection('desc');
      } else if (departmentSortDirection === 'desc') {
        setDepartmentSortDirection(null);
        setDepartmentSortField(null);
      }
    } else {
      setDepartmentSortField(field);
      setDepartmentSortDirection('asc');
    }
  };

  const handleLocationSort = (field: 'office' | 'building' | 'level' | 'isActive' | 'createdAt') => {
    if (locationSortField === field) {
      if (locationSortDirection === 'asc') {
        setLocationSortDirection('desc');
      } else if (locationSortDirection === 'desc') {
        setLocationSortDirection(null);
        setLocationSortField(null);
      }
    } else {
      setLocationSortField(field);
      setLocationSortDirection('asc');
    }
  };

  const handleSpotTypeSort = (field: 'name' | 'slug' | 'isActive' | 'createdAt') => {
    if (spotTypeSortField === field) {
      if (spotTypeSortDirection === 'asc') {
        setSpotTypeSortDirection('desc');
      } else if (spotTypeSortDirection === 'desc') {
        setSpotTypeSortDirection(null);
        setSpotTypeSortField(null);
      }
    } else {
      setSpotTypeSortField(field);
      setSpotTypeSortDirection('asc');
    }
  };

  const getSortIcon = (field: string, currentField: string | null, direction: SortDirection) => {
    if (field !== currentField) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    if (direction === 'asc') return <ArrowUp className="ml-2 h-4 w-4" />;
    if (direction === 'desc') return <ArrowDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  // Handlers
  const handleAddDepartment = async (data: DepartmentFormData) => {
    await createDepartmentMutation.mutateAsync(data);
  };

  const handleEditDepartment = async (data: DepartmentFormData) => {
    if (!editingDepartment) return;
    await updateDepartmentMutation.mutateAsync({ id: editingDepartment.id, data });
  };

  const handleDeleteDepartment = async (department: Department) => {
    const confirmed = await confirm({
      title: "Delete Department",
      description: `Are you sure you want to delete "${department.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });

    if (confirmed) {
      await deleteDepartmentMutation.mutateAsync(department.id);
    }
  };

  const openEditDepartmentDialog = (department: Department) => {
    setEditingDepartment(department);
    editDepartmentForm.reset({ name: department.name });
    setShowEditDepartmentDialog(true);
  };

  const handleAddLocation = async (data: LocationFormData) => {
    await createLocationMutation.mutateAsync(data);
  };

  const handleEditLocation = async (data: LocationFormData) => {
    if (!editingLocation) return;
    await updateLocationMutation.mutateAsync({ id: editingLocation.id, data });
  };

  const handleDeleteLocation = async (location: Location) => {
    const confirmed = await confirm({
      title: "Delete Location",
      description: `Are you sure you want to delete "${location.building}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });

    if (confirmed) {
      await deleteLocationMutation.mutateAsync(location.id);
    }
  };

  const openEditLocationDialog = (location: Location) => {
    setEditingLocation(location);
    editLocationForm.reset({
      office: location.office,
      building: location.building,
      level: location.level,
      address: location.address || "",
      timezone: location.timezone,
      isActive: location.isActive,
      floorPlanBaseUrl: location.floorPlanBaseUrl || ""
    });
    setShowEditLocationDialog(true);
  };

  const handleAddSpotType = async (data: SpotTypeFormData) => {
    await createSpotTypeMutation.mutateAsync(data);
  };

  const handleEditSpotType = async (data: SpotTypeFormData) => {
    if (!editingSpotType) return;
    await updateSpotTypeMutation.mutateAsync({ id: editingSpotType.id, data });
  };

  const handleDeleteSpotType = async (spotType: SpotTypeTable) => {
    const confirmed = await confirm({
      title: "Delete Spot Type",
      description: `Are you sure you want to delete "${spotType.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });

    if (confirmed) {
      await deleteSpotTypeMutation.mutateAsync(spotType.id);
    }
  };

  const openEditSpotTypeDialog = (spotType: SpotTypeTable) => {
    setEditingSpotType(spotType);
    editSpotTypeForm.reset({
      name: spotType.name,
      slug: spotType.slug,
      description: spotType.description || "",
      bciChargingAmount: spotType.bciChargingAmount || "0",
      isActive: spotType.isActive
    });
    setShowEditSpotTypeDialog(true);
  };

  const openEditConfigDialog = (config: AppConfig) => {
    setEditingConfig(config);
    setShowEditConfigDialog(true);
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/app-configs"] })
      ])
      toast({
        title: "Refreshed",
        description: "Data management data has been refreshed",
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
  };

  const isLoading = isLoadingDepartments || isLoadingLocations || isLoadingSpotTypes;

  const totalDepartments = departments.length;
  const totalLocations = locations.length;
  const totalSpotTypes = spotTypes.length;
  const activeLocations = locations.filter(l => l.isActive).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-8 w-8 text-primary" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage system-wide configuration, departments, locations, and spot types
          </p>
        </div>
        <div className="flex gap-2">
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleCards}
                data-testid="button-toggle-cards"
              >
                {cardsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {cardsVisible ? 'Hide Cards' : 'Show Cards'}
            </TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleRefreshAll} 
                variant="outline"
                disabled={isRefreshing || isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh all data
            </TooltipContent>
          </UITooltip>
        </div>
      </div>

      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="data-management-cards">
          <Card 
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setActiveTab("departments")}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
              <div className="rounded-full border-2 border-blue-400 p-2">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDepartments ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-departments">
                    {totalDepartments}
                  </div>
                  <p className="text-xs text-muted-foreground">Departments</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setActiveTab("locations")}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
              <div className="rounded-full border-2 border-green-400 p-2">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLocations ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-locations">
                    {totalLocations}
                  </div>
                  <p className="text-xs text-muted-foreground">Locations</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setActiveTab("spot-types")}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spot Types</CardTitle>
              <div className="rounded-full border-2 border-purple-400 p-2">
                <Tag className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSpotTypes ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-spot-types">
                    {totalSpotTypes}
                  </div>
                  <p className="text-xs text-muted-foreground">Spot Types</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setActiveTab("app-configs")}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">App Settings</CardTitle>
              <div className="rounded-full border-2 border-amber-400 p-2">
                <Database className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLocations ? (
                <>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-active-locations">
                    {activeLocations}
                  </div>
                  <p className="text-xs text-muted-foreground">Active Locations</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="departments" data-testid="tab-departments" className="gap-2">
            <Building2 className="h-4 w-4 !text-blue-600" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations" className="gap-2">
            <MapPin className="h-4 w-4 !text-green-600" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="spot-types" data-testid="tab-spot-types" className="gap-2">
            <Layers className="h-4 w-4 !text-purple-600" />
            Spot Types
          </TabsTrigger>
          <TabsTrigger value="app-configs" data-testid="tab-app-configs" className="gap-2">
            <Database className="h-4 w-4 !text-orange-600" />
            App Settings
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys" className="gap-2">
            <Key className="h-4 w-4 !text-amber-600" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="whats-new" data-testid="tab-whats-new" className="gap-2">
            <Sparkles className="h-4 w-4 !text-violet-600" />
            What's New
          </TabsTrigger>
        </TabsList>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Departments
                </CardTitle>
                <Dialog open={showAddDepartmentDialog} onOpenChange={setShowAddDepartmentDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-department">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Department</DialogTitle>
                    </DialogHeader>
                    <Form {...addDepartmentForm}>
                      <form onSubmit={addDepartmentForm.handleSubmit(handleAddDepartment)} className="space-y-4">
                        <FormField
                          control={addDepartmentForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Department Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter department name" 
                                  {...field} 
                                  data-testid="input-department-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowAddDepartmentDialog(false)}
                            data-testid="button-cancel-add"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createDepartmentMutation.isPending}
                            data-testid="button-submit-add"
                          >
                            {createDepartmentMutation.isPending ? "Creating..." : "Create Department"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-4 flex gap-2">
                <Input
                  placeholder="Filter by name..."
                  value={departmentNameFilter}
                  onChange={(e) => setDepartmentNameFilter(e.target.value)}
                  className="max-w-sm"
                  data-testid="filter-department-name"
                />
              </div>

              {isLoadingDepartments ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleDepartmentSort('name')}
                          className="hover-elevate"
                          data-testid="sort-department-name"
                        >
                          Department Name
                          {getSortIcon('name', departmentSortField, departmentSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleDepartmentSort('createdAt')}
                          className="hover-elevate"
                          data-testid="sort-department-date"
                        >
                          Created Date
                          {getSortIcon('createdAt', departmentSortField, departmentSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedDepartments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No departments found. {departmentNameFilter ? "Try adjusting your filters." : "Create your first department to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDepartments.map((department) => (
                        <TableRow key={department.id} data-testid={`row-department-${department.id}`}>
                          <TableCell className="font-medium" data-testid={`text-department-name-${department.id}`}>
                            {department.name}
                          </TableCell>
                          <TableCell data-testid={`text-department-date-${department.id}`}>
                            {new Date(department.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDepartmentDialog(department)}
                                data-testid={`button-edit-department-${department.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDepartment(department)}
                                data-testid={`button-delete-department-${department.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              
              {filteredAndSortedDepartments.length > 0 && (
                <TablePagination
                  totalCount={filteredAndSortedDepartments.length}
                  pageSize={departmentPageSize}
                  pageIndex={departmentPageIndex}
                  onPageSizeChange={(size) => {
                    setDepartmentPageSize(size);
                    setDepartmentPageIndex(0);
                  }}
                  onPageIndexChange={setDepartmentPageIndex}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Locations
                </CardTitle>
                <Dialog open={showAddLocationDialog} onOpenChange={setShowAddLocationDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-location">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Location</DialogTitle>
                    </DialogHeader>
                    <Form {...addLocationForm}>
                      <form onSubmit={addLocationForm.handleSubmit(handleAddLocation)} className="space-y-4">
                        <FormField
                          control={addLocationForm.control}
                          name="office"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Office</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter office name" 
                                  {...field} 
                                  data-testid="input-location-office"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="building"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Building</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter building name" 
                                  {...field} 
                                  data-testid="input-location-building"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="level"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Level</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter level" 
                                  {...field} 
                                  data-testid="input-location-level"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address (Optional)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter address" 
                                  {...field} 
                                  data-testid="input-location-address"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="timezone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Timezone</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="America/Vancouver" 
                                  {...field} 
                                  data-testid="input-location-timezone"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="floorPlanBaseUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Floor Plan Base URL (Optional)</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://example.com/visual-directory/floors/18/seats/" 
                                  {...field} 
                                  data-testid="input-location-floor-plan-url"
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground">
                                Base URL for floor plan software. Seat number will be appended.
                              </p>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addLocationForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-location-active"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowAddLocationDialog(false)}
                            data-testid="button-cancel-add-location"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createLocationMutation.isPending}
                            data-testid="button-submit-add-location"
                          >
                            {createLocationMutation.isPending ? "Creating..." : "Create Location"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input
                  placeholder="Filter by office..."
                  value={locationOfficeFilter}
                  onChange={(e) => setLocationOfficeFilter(e.target.value)}
                  data-testid="filter-location-office"
                />
                <Input
                  placeholder="Filter by building..."
                  value={locationBuildingFilter}
                  onChange={(e) => setLocationBuildingFilter(e.target.value)}
                  data-testid="filter-location-building"
                />
                <Input
                  placeholder="Filter by level..."
                  value={locationLevelFilter}
                  onChange={(e) => setLocationLevelFilter(e.target.value)}
                  data-testid="filter-location-level"
                />
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={locationStatusFilter}
                  onChange={(e) => setLocationStatusFilter(e.target.value)}
                  data-testid="filter-location-status"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {isLoadingLocations ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleLocationSort('office')}
                          className="hover-elevate"
                          data-testid="sort-location-office"
                        >
                          Office
                          {getSortIcon('office', locationSortField, locationSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleLocationSort('building')}
                          className="hover-elevate"
                          data-testid="sort-location-building"
                        >
                          Building
                          {getSortIcon('building', locationSortField, locationSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleLocationSort('level')}
                          className="hover-elevate"
                          data-testid="sort-location-level"
                        >
                          Level
                          {getSortIcon('level', locationSortField, locationSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleLocationSort('isActive')}
                          className="hover-elevate"
                          data-testid="sort-location-status"
                        >
                          Status
                          {getSortIcon('isActive', locationSortField, locationSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleLocationSort('createdAt')}
                          className="hover-elevate"
                          data-testid="sort-location-date"
                        >
                          Created Date
                          {getSortIcon('createdAt', locationSortField, locationSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedLocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No locations found. {(locationOfficeFilter || locationBuildingFilter || locationLevelFilter || locationStatusFilter) ? "Try adjusting your filters." : "Create your first location to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLocations.map((location) => (
                        <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                          <TableCell className="font-medium" data-testid={`text-location-office-${location.id}`}>
                            {location.office}
                          </TableCell>
                          <TableCell data-testid={`text-location-building-${location.id}`}>
                            {location.building}
                          </TableCell>
                          <TableCell data-testid={`text-location-level-${location.id}`}>
                            {location.level}
                          </TableCell>
                          <TableCell data-testid={`text-location-status-${location.id}`}>
                            {location.isActive ? "Active" : "Inactive"}
                          </TableCell>
                          <TableCell data-testid={`text-location-date-${location.id}`}>
                            {new Date(location.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditLocationDialog(location)}
                                data-testid={`button-edit-location-${location.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteLocation(location)}
                                data-testid={`button-delete-location-${location.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              
              {filteredAndSortedLocations.length > 0 && (
                <TablePagination
                  totalCount={filteredAndSortedLocations.length}
                  pageSize={locationPageSize}
                  pageIndex={locationPageIndex}
                  onPageSizeChange={(size) => {
                    setLocationPageSize(size);
                    setLocationPageIndex(0);
                  }}
                  onPageIndexChange={setLocationPageIndex}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spot Types Tab */}
        <TabsContent value="spot-types">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Spot Types
                </CardTitle>
                <Dialog open={showAddSpotTypeDialog} onOpenChange={setShowAddSpotTypeDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-spot-type">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Spot Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Spot Type</DialogTitle>
                    </DialogHeader>
                    <Form {...addSpotTypeForm}>
                      <form onSubmit={addSpotTypeForm.handleSubmit(handleAddSpotType)} className="space-y-4">
                        <FormField
                          control={addSpotTypeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter spot type name" 
                                  {...field} 
                                  data-testid="input-spot-type-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addSpotTypeForm.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Slug</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="enter-slug" 
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                                  data-testid="input-spot-type-slug"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addSpotTypeForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter description" 
                                  {...field} 
                                  data-testid="input-spot-type-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addSpotTypeForm.control}
                          name="bciChargingAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monthly Fee ($)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00" 
                                  {...field} 
                                  data-testid="input-spot-type-monthly-fee"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addSpotTypeForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-spot-type-active"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowAddSpotTypeDialog(false)}
                            data-testid="button-cancel-add-spot-type"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createSpotTypeMutation.isPending}
                            data-testid="button-submit-add-spot-type"
                          >
                            {createSpotTypeMutation.isPending ? "Creating..." : "Create Spot Type"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  placeholder="Filter by name..."
                  value={spotTypeNameFilter}
                  onChange={(e) => setSpotTypeNameFilter(e.target.value)}
                  data-testid="filter-spot-type-name"
                />
                <Input
                  placeholder="Filter by slug..."
                  value={spotTypeSlugFilter}
                  onChange={(e) => setSpotTypeSlugFilter(e.target.value)}
                  data-testid="filter-spot-type-slug"
                />
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={spotTypeStatusFilter}
                  onChange={(e) => setSpotTypeStatusFilter(e.target.value)}
                  data-testid="filter-spot-type-status"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {isLoadingSpotTypes ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleSpotTypeSort('name')}
                          className="hover-elevate"
                          data-testid="sort-spot-type-name"
                        >
                          Name
                          {getSortIcon('name', spotTypeSortField, spotTypeSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleSpotTypeSort('slug')}
                          className="hover-elevate"
                          data-testid="sort-spot-type-slug"
                        >
                          Slug
                          {getSortIcon('slug', spotTypeSortField, spotTypeSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Monthly Fee ($)</TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleSpotTypeSort('isActive')}
                          className="hover-elevate"
                          data-testid="sort-spot-type-status"
                        >
                          Status
                          {getSortIcon('isActive', spotTypeSortField, spotTypeSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          onClick={() => handleSpotTypeSort('createdAt')}
                          className="hover-elevate"
                          data-testid="sort-spot-type-date"
                        >
                          Created Date
                          {getSortIcon('createdAt', spotTypeSortField, spotTypeSortDirection)}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedSpotTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No spot types found. {(spotTypeNameFilter || spotTypeSlugFilter || spotTypeStatusFilter) ? "Try adjusting your filters." : "Create your first spot type to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSpotTypes.map((spotType) => (
                        <TableRow key={spotType.id} data-testid={`row-spot-type-${spotType.id}`}>
                          <TableCell className="font-medium" data-testid={`text-spot-type-name-${spotType.id}`}>
                            {spotType.name}
                          </TableCell>
                          <TableCell data-testid={`text-spot-type-slug-${spotType.id}`}>
                            {spotType.slug}
                          </TableCell>
                          <TableCell data-testid={`text-spot-type-description-${spotType.id}`}>
                            {spotType.description || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-spot-type-bci-charging-${spotType.id}`}>
                            ${parseFloat(spotType.bciChargingAmount || "0").toFixed(2)}
                          </TableCell>
                          <TableCell data-testid={`text-spot-type-status-${spotType.id}`}>
                            {spotType.isActive ? "Active" : "Inactive"}
                          </TableCell>
                          <TableCell data-testid={`text-spot-type-date-${spotType.id}`}>
                            {new Date(spotType.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditSpotTypeDialog(spotType)}
                                data-testid={`button-edit-spot-type-${spotType.id}`}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSpotType(spotType)}
                                data-testid={`button-delete-spot-type-${spotType.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              
              {filteredAndSortedSpotTypes.length > 0 && (
                <TablePagination
                  totalCount={filteredAndSortedSpotTypes.length}
                  pageSize={spotTypePageSize}
                  pageIndex={spotTypePageIndex}
                  onPageSizeChange={(size) => {
                    setSpotTypePageSize(size);
                    setSpotTypePageIndex(0);
                  }}
                  onPageIndexChange={setSpotTypePageIndex}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* App Configurations Tab */}
        <TabsContent value="app-configs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Application Settings
                </CardTitle>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search settings..."
                    value={configSearchFilter}
                    onChange={(e) => setConfigSearchFilter(e.target.value)}
                    data-testid="input-search-configs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingConfigs ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : isErrorConfigs ? (
                <div className="text-center text-red-500 py-8">
                  Failed to load settings. {configsError instanceof Error ? configsError.message : 'Please try refreshing the page.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setting</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedConfigs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No settings found. {configSearchFilter ? "Try adjusting your search." : "No settings available."}
                        </TableCell>
                      </TableRow>
                    ) : groupedConfigs ? (
                      Object.entries(groupedConfigs).map(([category, configs]) => (
                        <Fragment key={`group-${category}`}>
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={4} className="py-2 pt-4 pb-1">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {configCategoryLabel(category)}
                              </span>
                            </TableCell>
                          </TableRow>
                          {configs.map((config) => (
                            <TableRow key={config.key} data-testid={`row-config-${config.key}`}>
                              <TableCell className="font-medium" data-testid={`text-config-label-${config.key}`}>
                                {config.label || config.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                              </TableCell>
                              <TableCell data-testid={`text-config-value-${config.key}`}>
                                {config.dataType === 'number' && config.key.includes('timeout')
                                  ? `${Number(config.value) / 1000}s`
                                  : config.key === 'cancellation_window_hours'
                                    ? `${config.value} hours`
                                    : config.key === 'city_parking_daily_rate'
                                      ? `$${config.value}/day`
                                      : config.key === 'expired_date_window_days'
                                        ? `${config.value} days`
                                        : config.dataType === 'boolean'
                                          ? config.value === 'true' ? 'Enabled' : config.value === 'hide_all' ? 'Hide all' : 'Disabled'
                                          : config.value}
                              </TableCell>
                              <TableCell data-testid={`text-config-description-${config.key}`}>
                                {config.description || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditConfigDialog(config)}
                                  data-testid={`button-edit-config-${config.key}`}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      ))
                    ) : (
                      filteredAndSortedConfigs.map((config) => (
                        <TableRow key={config.key} data-testid={`row-config-${config.key}`}>
                          <TableCell className="font-medium" data-testid={`text-config-label-${config.key}`}>
                            {config.label || config.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </TableCell>
                          <TableCell data-testid={`text-config-value-${config.key}`}>
                            {config.dataType === 'number' && config.key.includes('timeout')
                              ? `${Number(config.value) / 1000}s`
                              : config.key === 'cancellation_window_hours'
                                ? `${config.value} hours`
                                : config.key === 'city_parking_daily_rate'
                                  ? `$${config.value}/day`
                                  : config.key === 'expired_date_window_days'
                                    ? `${config.value} days`
                                    : config.dataType === 'boolean'
                                      ? config.value === 'true' ? 'Enabled' : config.value === 'hide_all' ? 'Hide all' : 'Disabled'
                                      : config.value}
                          </TableCell>
                          <TableCell data-testid={`text-config-description-${config.key}`}>
                            {config.description || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditConfigDialog(config)}
                              data-testid={`button-edit-config-${config.key}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 !text-amber-600" />
                  API Keys
                </CardTitle>
                <Button onClick={() => { setCreatedKeyValue(""); setNewKeyName(""); setShowCreateKeyDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage API keys for MCP server access. Keys allow AI assistants to connect to ParkShare.
              </p>
            </CardHeader>
            <CardContent>
              {apiKeysLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No API keys yet</p>
                  <p className="text-sm mt-1">Create a key to allow AI assistants to connect to ParkShare.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key: any) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{key.keyPrefix}...</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: "Revoke API Key",
                                description: `Are you sure you want to revoke "${key.name}"? This action cannot be undone.`,
                                confirmText: "Revoke",
                                cancelText: "Cancel",
                                variant: "destructive"
                              });
                              if (confirmed) {
                                revokeApiKeyMutation.mutate(key.id);
                              }
                            }}
                            disabled={revokeApiKeyMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* What's New Tab */}
        <TabsContent value="whats-new">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 !text-violet-600" />
                  What's New Announcements
                </CardTitle>
                <Button
                  onClick={() => { addAnnouncementForm.reset(); setShowAddAnnouncementDialog(true); }}
                  data-testid="button-add-announcement"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Announcement
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage feature announcements shown to users when they log in. Users see only new announcements they haven't dismissed yet.
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingAnnouncements ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No announcements yet</p>
                  <p className="text-sm mt-1">Add an announcement to inform users about new features.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Badge</TableHead>
                      <TableHead>Sort Order</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {announcements.map((announcement) => (
                      <TableRow key={announcement.id}>
                        <TableCell className="font-medium max-w-[150px]">
                          <span className="truncate block">{announcement.title}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm text-muted-foreground truncate block">{announcement.description}</span>
                        </TableCell>
                        <TableCell>
                          {announcement.badgeLabel ? (
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getBadgeColorClasses(announcement.badgeColor)}`}>
                              {announcement.badgeLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{announcement.sortOrder}</TableCell>
                        <TableCell>
                          <Switch
                            checked={announcement.enabled}
                            onCheckedChange={(checked) => toggleAnnouncementMutation.mutate({ id: announcement.id, enabled: checked })}
                            data-testid={`switch-announcement-enabled-${announcement.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(announcement.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingAnnouncement(announcement);
                                editAnnouncementForm.reset({
                                  title: announcement.title,
                                  description: announcement.description,
                                  badgeLabel: announcement.badgeLabel || "",
                                  badgeColor: announcement.badgeColor || null,
                                  sortOrder: announcement.sortOrder,
                                  enabled: announcement.enabled,
                                });
                                setShowEditAnnouncementDialog(true);
                              }}
                              data-testid={`button-edit-announcement-${announcement.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: "Delete Announcement",
                                  description: `Are you sure you want to delete "${announcement.title}"? This action cannot be undone.`,
                                  confirmText: "Delete",
                                  cancelText: "Cancel",
                                  variant: "destructive"
                                });
                                if (confirmed) {
                                  deleteAnnouncementMutation.mutate(announcement.id);
                                }
                              }}
                              disabled={deleteAnnouncementMutation.isPending}
                              data-testid={`button-delete-announcement-${announcement.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Announcement Dialog */}
      <Dialog open={showAddAnnouncementDialog} onOpenChange={setShowAddAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Announcement</DialogTitle>
          </DialogHeader>
          <Form {...addAnnouncementForm}>
            <form onSubmit={addAnnouncementForm.handleSubmit((data) => createAnnouncementMutation.mutate(data))} className="space-y-4">
              <FormField
                control={addAnnouncementForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Faster booking flow" {...field} data-testid="input-announcement-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addAnnouncementForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the feature or change..." rows={3} {...field} data-testid="input-announcement-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addAnnouncementForm.control}
                  name="badgeLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Label <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. New, Improved, Fixed" {...field} value={field.value ?? ""} data-testid="input-announcement-badge" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addAnnouncementForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} data-testid="input-announcement-sort-order" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={addAnnouncementForm.control}
                name="badgeColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Color <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2" data-testid="badge-color-picker-add">
                        {BADGE_COLOR_OPTIONS.map((color) => {
                          const isSelected = (field.value ?? null) === color.value;
                          return (
                            <button
                              key={color.value ?? "default"}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-all ${color.bg} ${color.text} ${isSelected ? "ring-2 ring-offset-1 ring-foreground" : "opacity-70 hover:opacity-100"}`}
                              data-testid={`badge-color-option-${color.value ?? "default"}`}
                            >
                              {color.label}
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addAnnouncementForm.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-announcement-new-enabled" />
                    </FormControl>
                    <FormLabel className="!mt-0">Enabled</FormLabel>
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowAddAnnouncementDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createAnnouncementMutation.isPending} data-testid="button-submit-add-announcement">
                  {createAnnouncementMutation.isPending ? "Adding..." : "Add Announcement"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={showEditAnnouncementDialog} onOpenChange={setShowEditAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <Form {...editAnnouncementForm}>
            <form onSubmit={editAnnouncementForm.handleSubmit((data) => {
              if (!editingAnnouncement) return;
              updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data });
            })} className="space-y-4">
              <FormField
                control={editAnnouncementForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Faster booking flow" {...field} data-testid="input-edit-announcement-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editAnnouncementForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the feature or change..." rows={3} {...field} data-testid="input-edit-announcement-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editAnnouncementForm.control}
                  name="badgeLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Label <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. New, Improved, Fixed" {...field} value={field.value ?? ""} data-testid="input-edit-announcement-badge" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editAnnouncementForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} data-testid="input-edit-announcement-sort-order" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editAnnouncementForm.control}
                name="badgeColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Color <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2" data-testid="badge-color-picker-edit">
                        {BADGE_COLOR_OPTIONS.map((color) => {
                          const isSelected = (field.value ?? null) === color.value;
                          return (
                            <button
                              key={color.value ?? "default"}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-all ${color.bg} ${color.text} ${isSelected ? "ring-2 ring-offset-1 ring-foreground" : "opacity-70 hover:opacity-100"}`}
                              data-testid={`badge-color-edit-option-${color.value ?? "default"}`}
                            >
                              {color.label}
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editAnnouncementForm.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-announcement-enabled" />
                    </FormControl>
                    <FormLabel className="!mt-0">Enabled</FormLabel>
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowEditAnnouncementDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={updateAnnouncementMutation.isPending} data-testid="button-submit-edit-announcement">
                  {updateAnnouncementMutation.isPending ? "Updating..." : "Update Announcement"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={(open) => { if (!open) { setShowCreateKeyDialog(false); setCreatedKeyValue(""); setNewKeyName(""); } else { setShowCreateKeyDialog(true); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          {createdKeyValue ? (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2">
                <p className="font-medium text-sm">Your API key has been created. Copy it now - it won't be shown again.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">{createdKeyValue}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(createdKeyValue);
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setShowCreateKeyDialog(false); setCreatedKeyValue(""); setNewKeyName(""); }}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Key Name</label>
                <Input
                  placeholder="e.g., Claude Desktop, ChatGPT"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">A descriptive name to identify this key</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowCreateKeyDialog(false); setNewKeyName(""); }}>Cancel</Button>
                <Button
                  onClick={() => createApiKeyMutation.mutate({ name: newKeyName })}
                  disabled={!newKeyName.trim() || createApiKeyMutation.isPending}
                >
                  {createApiKeyMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    "Create Key"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDepartmentDialog} onOpenChange={setShowEditDepartmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <Form {...editDepartmentForm}>
            <form onSubmit={editDepartmentForm.handleSubmit(handleEditDepartment)} className="space-y-4">
              <FormField
                control={editDepartmentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter department name" 
                        {...field} 
                        data-testid="input-edit-department-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDepartmentDialog(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateDepartmentMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateDepartmentMutation.isPending ? "Updating..." : "Update Department"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={showEditLocationDialog} onOpenChange={setShowEditLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <Form {...editLocationForm}>
            <form onSubmit={editLocationForm.handleSubmit(handleEditLocation)} className="space-y-4">
              <FormField
                control={editLocationForm.control}
                name="office"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter office name" 
                        {...field} 
                        data-testid="input-edit-location-office"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="building"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter building name" 
                        {...field} 
                        data-testid="input-edit-location-building"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter level" 
                        {...field} 
                        data-testid="input-edit-location-level"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter address" 
                        {...field} 
                        data-testid="input-edit-location-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="America/Vancouver" 
                        {...field} 
                        data-testid="input-edit-location-timezone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="floorPlanBaseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor Plan Base URL (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/visual-directory/floors/18/seats/" 
                        {...field} 
                        data-testid="input-edit-location-floor-plan-url"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Base URL for floor plan software. Seat number will be appended.
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={editLocationForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-location-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditLocationDialog(false)}
                  data-testid="button-cancel-edit-location"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateLocationMutation.isPending}
                  data-testid="button-submit-edit-location"
                >
                  {updateLocationMutation.isPending ? "Updating..." : "Update Location"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Type Dialog */}
      <Dialog open={showEditSpotTypeDialog} onOpenChange={setShowEditSpotTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Spot Type</DialogTitle>
          </DialogHeader>
          <Form {...editSpotTypeForm}>
            <form onSubmit={editSpotTypeForm.handleSubmit(handleEditSpotType)} className="space-y-4">
              <FormField
                control={editSpotTypeForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter spot type name" 
                        {...field} 
                        data-testid="input-edit-spot-type-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSpotTypeForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="enter-slug" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                        data-testid="input-edit-spot-type-slug"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSpotTypeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter description" 
                        {...field} 
                        data-testid="input-edit-spot-type-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSpotTypeForm.control}
                name="bciChargingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Fee ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00" 
                        {...field} 
                        data-testid="input-edit-spot-type-monthly-fee"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSpotTypeForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-spot-type-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditSpotTypeDialog(false)}
                  data-testid="button-cancel-edit-spot-type"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateSpotTypeMutation.isPending}
                  data-testid="button-submit-edit-spot-type"
                >
                  {updateSpotTypeMutation.isPending ? "Updating..." : "Update Spot Type"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Config Dialog */}
      <Dialog open={showEditConfigDialog} onOpenChange={setShowEditConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
          </DialogHeader>
          {editingConfig && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {editingConfig.label}
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  {editingConfig.description}
                </p>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const value = formData.get('value') as string;
                let finalValue = value;
                
                // Convert timeout values from seconds to milliseconds
                if (editingConfig.dataType === 'number' && editingConfig.key.includes('timeout')) {
                  finalValue = String(Number(value) * 1000);
                }
                
                updateConfigMutation.mutate({ 
                  key: editingConfig.key, 
                  value: finalValue 
                });
              }} className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Value
                  </label>
                  {editingConfig.key === 'timezone' ? (
                    <select
                      name="value"
                      defaultValue={editingConfig.value}
                      required
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-edit-config-timezone"
                    >
                      <option value="America/Los_Angeles">Pacific Time (PST/PDT) - Los Angeles</option>
                      <option value="America/Denver">Mountain Time (MST/MDT) - Denver</option>
                      <option value="America/Chicago">Central Time (CST/CDT) - Chicago</option>
                      <option value="America/New_York">Eastern Time (EST/EDT) - New York</option>
                      <option value="America/Phoenix">Arizona Time (MST) - Phoenix</option>
                      <option value="America/Anchorage">Alaska Time (AKST/AKDT) - Anchorage</option>
                      <option value="Pacific/Honolulu">Hawaii Time (HST) - Honolulu</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                    </select>
                  ) : editingConfig.key === 'week_start_day' ? (
                    <select
                      name="value"
                      defaultValue={editingConfig.value}
                      required
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-edit-config-week-start-day"
                    >
                      <option value="sunday">Sunday (week ends Saturday)</option>
                      <option value="monday">Monday (week ends Sunday)</option>
                    </select>
                  ) : editingConfig.key === 'expired_date_window_enabled' ? (
                    <select
                      name="value"
                      defaultValue={editingConfig.value}
                      required
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="select-edit-config-expired-date-window-enabled"
                    >
                      <option value="true">Enabled — limit past dates shown on calendar</option>
                      <option value="false">Disabled — show all past unbooked dates</option>
                      <option value="hide_all">Hide all — never show expired dates</option>
                    </select>
                  ) : (
                    <Input
                      name="value"
                      type={editingConfig.dataType === 'number' ? 'number' : 'text'}
                      min={editingConfig.dataType === 'number' && (editingConfig.key.includes('timeout') || editingConfig.key === 'cancellation_window_hours') ? 1 : undefined}
                      step={editingConfig.dataType === 'number' ? 1 : undefined}
                      defaultValue={
                        editingConfig.dataType === 'number' && editingConfig.key.includes('timeout')
                          ? Number(editingConfig.value) / 1000
                          : editingConfig.value
                      }
                      placeholder="Enter value"
                      required
                      className="mt-2"
                      data-testid="input-edit-config-value"
                    />
                  )}
                  {editingConfig.dataType === 'number' && editingConfig.key.includes('timeout') && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Value in seconds (minimum: 1)
                    </p>
                  )}
                  {editingConfig.key === 'cancellation_window_hours' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Value in hours (minimum: 1). Users cannot cancel bookings within this many hours of the booking date.
                    </p>
                  )}
                  {editingConfig.key === 'city_parking_daily_rate' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Value in CAD $/day. Renters see this rate as a comparison on their Statistics page.
                    </p>
                  )}
                  {editingConfig.key === 'expired_date_window_days' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Number of past days to show on the calendar (minimum: 1). Only applies when the Expired Date Window toggle is enabled.
                    </p>
                  )}
                  {editingConfig.key === 'expired_date_window_enabled' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      When enabled, configure the number of days using the "Expired Date Window (Days)" setting.
                    </p>
                  )}
                  {editingConfig.key === 'timezone' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      All dates and times in the application will be displayed in this timezone
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditConfigDialog(false)}
                    data-testid="button-cancel-edit-config"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateConfigMutation.isPending}
                    data-testid="button-submit-edit-config"
                  >
                    {updateConfigMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
