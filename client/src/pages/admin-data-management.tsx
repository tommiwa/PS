import { useState } from "react"
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
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/hooks/use-language"
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
  type SpotTypeTable
} from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { 
  Database,
  Plus,
  Edit,
  Trash2,
  RefreshCw
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
  campus: z.string().min(1, "Campus is required"),
  building: z.string().min(1, "Building is required"),
  level: z.string().min(1, "Level is required"),
  address: z.string().optional(),
  timezone: z.string().default("America/Vancouver"),
  isActive: z.boolean().default(true)
});

type LocationFormData = z.infer<typeof locationFormSchema>;

// Spot Type form schema
const spotTypeFormSchema = insertSpotTypeSchema.extend({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

type SpotTypeFormData = z.infer<typeof spotTypeFormSchema>;

export default function AdminDataManagement() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { t } = useLanguage()

  // Departments state
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false)
  const [showEditDepartmentDialog, setShowEditDepartmentDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  // Locations state
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false)
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

  // Spot Types state
  const [showAddSpotTypeDialog, setShowAddSpotTypeDialog] = useState(false)
  const [showEditSpotTypeDialog, setShowEditSpotTypeDialog] = useState(false)
  const [editingSpotType, setEditingSpotType] = useState<SpotTypeTable | null>(null)

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
      campus: "",
      building: "",
      level: "",
      address: "",
      timezone: "America/Vancouver",
      isActive: true
    }
  })

  const editLocationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      campus: "",
      building: "",
      level: "",
      address: "",
      timezone: "America/Vancouver",
      isActive: true
    }
  })

  // Spot Type forms
  const addSpotTypeForm = useForm<SpotTypeFormData>({
    resolver: zodResolver(spotTypeFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      isActive: true
    }
  })

  const editSpotTypeForm = useForm<SpotTypeFormData>({
    resolver: zodResolver(spotTypeFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
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
      // Auto-lowercase the slug
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
      // Auto-lowercase the slug
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
      campus: location.campus,
      building: location.building,
      level: location.level,
      address: location.address || "",
      timezone: location.timezone,
      isActive: location.isActive
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
      isActive: spotType.isActive
    });
    setShowEditSpotTypeDialog(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-8 w-8 text-primary" />
            Data Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage departments, locations, and spot types
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="icon"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="departments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations">Locations</TabsTrigger>
          <TabsTrigger value="spot-types" data-testid="tab-spot-types">Spot Types</TabsTrigger>
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
                      <TableHead>Department Name</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No departments found. Create your first department to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      departments.map((department) => (
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
                          name="campus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Campus</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter campus name" 
                                  {...field} 
                                  data-testid="input-location-campus"
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
                      <TableHead>Campus</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No locations found. Create your first location to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations.map((location) => (
                        <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                          <TableCell className="font-medium" data-testid={`text-location-campus-${location.id}`}>
                            {location.campus}
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
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spotTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No spot types found. Create your first spot type to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      spotTypes.map((spotType) => (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                name="campus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campus</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter campus name" 
                        {...field} 
                        data-testid="input-edit-location-campus"
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
    </div>
  )
}
