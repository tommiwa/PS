import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { UserProfileCard } from "@/components/user-profile-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/hooks/use-confirm"
import { Textarea } from "@/components/ui/textarea"
import { 
  Car, 
  Settings, 
  Bell, 
  Mail, 
  Shield, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Trash2, 
  Zap,
  Car as CarIcon,
  Edit,
  Loader2,
  Plus,
  Calendar,
  CreditCard,
  ChevronRight,
  User,
  Palette,
  Globe,
  AlertTriangle
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { useLanguage } from "@/hooks/use-language"
import type { Vehicle, WaitingList, NotificationPreferences, UpdateNotificationPreferences, PaymentPreferences, UpdatePaymentPreferences, ParkingSpot, Department, SpotTypeTable } from "@shared/schema"
import { insertPaymentPreferencesSchema } from "@shared/schema"

// Waiting list enrollment form schema
const waitingListFormSchema = z.object({
  priority: z.number().min(1).max(3), // 1=high, 2=medium, 3=low
  preferredSpotTypeId: z.number().nullable().optional()
});

type WaitingListFormData = z.infer<typeof waitingListFormSchema>;

// Vehicle form validation schema
const vehicleSchema = z.object({
  make: z.string().min(1, "Vehicle make is required"),
  model: z.string().min(1, "Vehicle model is required"),
  year: z.number().min(1990, "Year must be 1990 or later").max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  color: z.string().optional(),
  isElectric: z.boolean().default(false),
  isDefault: z.boolean().default(false)
});

// Payment preferences form validation schema - use shared schema
const paymentPreferencesSchema = insertPaymentPreferencesSchema;

// Profile edit form validation schema
const profileEditSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  departmentId: z.string().min(1, "Department is required")
});

type VehicleForm = z.infer<typeof vehicleSchema>;
type PaymentPreferencesForm = z.infer<typeof paymentPreferencesSchema>;
type ProfileEditForm = z.infer<typeof profileEditSchema>;

export default function Profile() {
  const { user, isOwner, isRenter, isAdmin, refreshUser } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { confirm } = useConfirm()
  
  // State for various settings and drawers
  const [activeTab, setActiveTab] = useState("waiting-list")
  const [showAddVehicleDrawer, setShowAddVehicleDrawer] = useState(false)
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false)
  const [showPaymentPreferencesDrawer, setShowPaymentPreferencesDrawer] = useState(false)
  const [showProfileEditDrawer, setShowProfileEditDrawer] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [showSpotWarning, setShowSpotWarning] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Vehicle form
  const vehicleForm = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      color: "",
      isElectric: false,
      isDefault: false
    }
  });

  // Payment preferences form
  const paymentForm = useForm<PaymentPreferencesForm>({
    resolver: zodResolver(paymentPreferencesSchema),
    defaultValues: {
      paymentType: "interac_transfer",
      paymentInstructions: ""
    }
  });

  // Profile edit form
  const profileForm = useForm<ProfileEditForm>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      departmentId: ""
    }
  });

  // Query user's waiting list status  
  const { data: waitingListEntry, isLoading: isLoadingWaitingList } = useQuery<WaitingList | null>({
    queryKey: ["/api/waiting-list/user", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/waiting-list/user/${user?.id}`, { method: 'GET' });
        return await response.json();
      } catch (error) {
        // Handle 404 as valid "no entry" state
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        throw error;
      }
    }
  });

  // Query user's vehicles  
  const { data: userVehicles = [], isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/users", user?.id, "vehicles"],
    enabled: !!user?.id
  });

  // Query notification preferences
  const { data: notificationPreferences, isLoading: isLoadingPreferences } = useQuery<NotificationPreferences>({
    queryKey: ["/api/users", user?.id, "notification-preferences"],
    enabled: !!user?.id
  });

  // Query payment preferences
  const { data: paymentPreferences, isLoading: isLoadingPaymentPreferences } = useQuery<PaymentPreferences | null>({
    queryKey: ["/api/users", user?.id, "payment-preferences"],
    enabled: !!user?.id
  });

  // Query assigned spots
  const { data: assignedSpots = [], isLoading: isLoadingAssignedSpots } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/users", user?.id, "assigned-spots"],
    enabled: !!user?.id
  });

  // Fetch departments for dropdown select
  const { data: departments = [], isLoading: isDepartmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch spot types for waiting list form
  const { data: spotTypes = [] } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  });

  // Waiting list enrollment form
  const waitingListForm = useForm<WaitingListFormData>({
    resolver: zodResolver(waitingListFormSchema),
    defaultValues: {
      priority: 2, // Default to Medium Priority
      preferredSpotTypeId: null
    }
  });

  // Update payment form when payment preferences are loaded
  useEffect(() => {
    if (paymentPreferences) {
      paymentForm.reset({
        paymentType: paymentPreferences.paymentType,
        paymentInstructions: paymentPreferences.paymentInstructions || ""
      });
    }
  }, [paymentPreferences, paymentForm]);

  // Notification preferences mutation
  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: async (preferences: UpdateNotificationPreferences) => {
      const response = await apiRequest(`/api/users/${user?.id}/notification-preferences`, { 
        method: 'PATCH', 
        body: preferences 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "notification-preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Preferences",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Vehicle mutations
  const addVehicleMutation = useMutation({
    mutationFn: async (vehicleData: VehicleForm) => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/users/${user.id}/vehicles`, { 
        method: 'POST', 
        body: vehicleData 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "vehicles"] });
      setShowAddVehicleDrawer(false);
      setShowAddVehicleDialog(false);
      setEditingVehicle(null);
      vehicleForm.reset();
      toast({
        title: "Vehicle Added",
        description: "Your vehicle has been successfully added.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Vehicle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/users/${user.id}/vehicles/${vehicleId}`, { 
        method: 'DELETE' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "vehicles"] });
      toast({
        title: "Vehicle Deleted",
        description: "The vehicle has been removed from your profile.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Vehicle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const createWaitingListMutation = useMutation({
    mutationFn: async (data: WaitingListFormData) => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/waiting-list`, { 
        method: 'POST',
        body: {
          priority: data.priority,
          preferredSpotTypeId: data.preferredSpotTypeId || null
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      // Reset form and UI states
      waitingListForm.reset();
      setShowSpotWarning(false);
      setShowJoinForm(false);
      toast({
        title: "Joined Waiting List",
        description: "You're on the list! We'll notify you when a spot becomes available.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Join Waiting List",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const cancelWaitingListMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/waiting-list/user/${user.id}`, { 
        method: 'DELETE' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      // Reset UI states so flow starts fresh if user wants to re-join
      setShowSpotWarning(false);
      setShowJoinForm(false);
      toast({
        title: "Left Waiting List",
        description: "You've been removed from the parking waiting list.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Leave Waiting List",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update vehicle mutation
  const updateVehicleMutation = useMutation({
    mutationFn: async (vehicleData: VehicleForm) => {
      if (!editingVehicle?.id) throw new Error("Vehicle not found");
      const response = await apiRequest(`/api/users/${user?.id}/vehicles/${editingVehicle.id}`, { 
        method: 'PUT', 
        body: vehicleData 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "vehicles"] });
      setShowAddVehicleDrawer(false);
      setShowAddVehicleDialog(false);
      setEditingVehicle(null);
      vehicleForm.reset();
      toast({
        title: "Vehicle Updated",
        description: "Your vehicle has been successfully updated.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Vehicle",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });


  const handlePreferenceChange = (preferences: UpdateNotificationPreferences) => {
    updateNotificationPreferencesMutation.mutate(preferences);
  };

  const handleSubmitVehicle = (data: VehicleForm) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      addVehicleMutation.mutate(data);
    }
  };

  // Payment preferences mutation
  const updatePaymentPreferencesMutation = useMutation({
    mutationFn: async (preferences: PaymentPreferencesForm) => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/users/${user.id}/payment-preferences`, { 
        method: 'PATCH', 
        body: preferences 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "payment-preferences"] });
      setShowPaymentPreferencesDrawer(false);
      toast({
        title: "Payment Preferences Saved",
        description: "Your payment preferences have been updated.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Save Payment Preferences",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Profile edit mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileEditForm) => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/users/${user.id}`, {
        method: "PATCH",
        body: data
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user-related queries to refresh the profile data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id] });
      setShowProfileEditDrawer(false);
      profileForm.reset();
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated."
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmitPaymentPreferences = (data: PaymentPreferencesForm) => {
    updatePaymentPreferencesMutation.mutate(data);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    vehicleForm.reset({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color || "",
      isElectric: vehicle.isElectric,
      isDefault: vehicle.isDefault
    });
    setShowAddVehicleDrawer(true);
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      description: `Are you sure you want to delete ${vehicle.make} ${vehicle.model}?`,
      variant: "destructive"
    });
    
    if (confirmed) {
      deleteVehicleMutation.mutate(vehicle.id);
    }
  };

  const handleJoinWaitingList = (data: WaitingListFormData) => {
    createWaitingListMutation.mutate(data);
  };

  const handleLeaveWaitingList = () => {
    cancelWaitingListMutation.mutate();
  };

  const handleEditProfile = () => {
    // Set the form with current user data
    profileForm.reset({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      departmentId: user?.departmentId?.toString() || ""
    });
    setShowProfileEditDrawer(true);
  };

  const handleSubmitProfile = (data: ProfileEditForm) => {
    // Split name into firstName and lastName for backend
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    const backendData = {
      firstName,
      lastName,
      email: data.email,
      phone: data.phone,
      departmentId: parseInt(data.departmentId, 10)
    };
    
    updateProfileMutation.mutate(backendData as any);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh the auth context user data (this updates department, name, etc.)
      await refreshUser();
      // Also invalidate React Query caches for related data
      await queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "notification-preferences"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "payment-preferences"] });
      toast({
        title: "Refreshed",
        description: "Profile data has been refreshed."
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Sticky for PWA */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user?.name || t("profile.profile")}</h1>
              <p className="text-sm md:text-base text-muted-foreground">{t("profile.settings")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First */}
      <div className="container mx-auto p-4 md:p-6 pb-8">
        {/* User Profile Summary */}
        <div className="py-4 md:py-6">
          <UserProfileCard 
            user={{
              id: user?.id || "",
              name: user?.name || "",
              email: user?.email || "",
              phone: user?.phone || "",
              department: user?.department || "",
              role: user?.roles?.[0] || "renter",
              assignedSpots: assignedSpots,
              memberSince: new Date().getFullYear().toString()
            }}
            onEditProfile={handleEditProfile}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            showEditButton={true}
          />
        </div>

        {/* Mobile Accordion Layout */}
        <div className="md:hidden">
          <Accordion type="multiple" className="space-y-3 md:space-y-4" defaultValue={["waiting-list"]}>
            
            {/* Waiting List Section */}
            <AccordionItem value="waiting-list" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4 min-h-[44px]">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-medium text-sm md:text-base">{t("waitingList.title")}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground break-words">
                      {isLoadingWaitingList ? t("common.loading") : 
                       waitingListEntry ? `${t("waitingList.enrolled")} • Priority ${waitingListEntry.priority}` : 
                       t("waitingList.notEnrolled")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {waitingListEntry && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                      {t("common.active")}
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 md:pb-6">
              <div className="space-y-3 md:space-y-4">
                {isLoadingWaitingList || isLoadingAssignedSpots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : waitingListEntry ? (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-medium text-green-900 dark:text-green-100">
                          {t("waitingList.enrolled")}
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Priority: {waitingListEntry.priority === 1 ? "High" : waitingListEntry.priority === 2 ? "Medium" : "Low"} • Enrolled: {waitingListEntry.enrolledDate ? new Date(waitingListEntry.enrolledDate).toLocaleDateString() : 'N/A'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleLeaveWaitingList}
                          disabled={cancelWaitingListMutation.isPending}
                          className="mt-3"
                          data-testid="button-leave-waiting-list-mobile"
                        >
                          {cancelWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {t("waitingList.leave")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : showSpotWarning ? (
                  <div className="space-y-4">
                    <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50" data-testid="alert-has-spot-warning-mobile">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <p className="font-medium mb-2">You already have {assignedSpots.length} parking spot{assignedSpots.length > 1 ? 's' : ''} assigned to you.</p>
                        <p className="text-sm">Are you sure you want to join the waiting list for another spot?</p>
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowSpotWarning(false)}
                        data-testid="button-cancel-waiting-list-mobile"
                      >
                        No, Cancel
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={() => { setShowSpotWarning(false); setShowJoinForm(true); }}
                        data-testid="button-confirm-waiting-list-mobile"
                      >
                        Yes, Continue
                      </Button>
                    </div>
                  </div>
                ) : showJoinForm ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t("waitingList.description")}</p>
                    <Form {...waitingListForm}>
                      <form onSubmit={waitingListForm.handleSubmit(handleJoinWaitingList)} className="space-y-4">
                        <FormField
                          control={waitingListForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select 
                                onValueChange={(value) => field.onChange(parseInt(value))}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-priority-mobile">
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">High Priority</SelectItem>
                                  <SelectItem value="2">Medium Priority</SelectItem>
                                  <SelectItem value="3">Low Priority</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={waitingListForm.control}
                          name="preferredSpotTypeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Preferred Spot Type</FormLabel>
                              <Select 
                                onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                                value={field.value?.toString() || "none"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-spot-type-mobile">
                                    <SelectValue placeholder="Select preferred spot type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No preference</SelectItem>
                                  {spotTypes.filter(type => type.name.toLowerCase() !== 'reserved').map((type) => (
                                    <SelectItem key={type.id} value={type.id.toString()}>
                                      {type.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-3">
                          <Button 
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setShowJoinForm(false)}
                            data-testid="button-back-waiting-list-mobile"
                          >
                            Back
                          </Button>
                          <Button 
                            type="submit"
                            className="flex-1" 
                            disabled={createWaitingListMutation.isPending}
                            data-testid="button-join-waiting-list-mobile"
                          >
                            {createWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t("waitingList.enrollButton")}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">{t("waitingList.description")}</p>
                    <Button 
                      className="w-full h-12" 
                      onClick={() => assignedSpots.length > 0 ? setShowSpotWarning(true) : setShowJoinForm(true)}
                      data-testid="button-start-join-waiting-list-mobile"
                    >
                      {t("waitingList.enrollButton")}
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
          
          {/* Vehicles Section */}
          <AccordionItem value="vehicles" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4 min-h-[44px]">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-medium text-sm md:text-base">My Vehicles</h3>
                    <p className="text-xs md:text-sm text-muted-foreground break-words">
                      {isLoadingVehicles ? "Loading..." : 
                       userVehicles?.length ? `${userVehicles.length} vehicle${userVehicles.length > 1 ? 's' : ''} registered` : 
                       "No vehicles added"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userVehicles?.length && (
                    <Badge variant="outline" className="text-xs">{userVehicles.length}</Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 md:pb-6">
              <div className="space-y-3 md:space-y-4">
                {isLoadingVehicles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : userVehicles?.length === 0 ? (
                  <div className="text-center py-6">
                    <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No vehicles added</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add your vehicle information to complete your parking profile.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userVehicles?.map((vehicle: any) => (
                      <div key={vehicle.id} className="border rounded-lg p-4 hover-elevate">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              {vehicle.isElectric ? (
                                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <CarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {vehicle.year} {vehicle.make} {vehicle.model}
                                </p>
                                {vehicle.isDefault && (
                                  <Badge variant="secondary" className="text-xs">Default</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {vehicle.color || "No color specified"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVehicle(vehicle)}
                              data-testid={`button-edit-vehicle-${vehicle.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteVehicle(vehicle)}
                              disabled={deleteVehicleMutation.isPending}
                              data-testid={`button-delete-vehicle-${vehicle.id}`}
                            >
                              {deleteVehicleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                              {!deleteVehicleMutation.isPending && <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Notifications Section */}
          <AccordionItem value="notifications" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4 min-h-[44px]">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-medium text-sm md:text-base">Notifications</h3>
                    <p className="text-xs md:text-sm text-muted-foreground break-words">
                      {isLoadingPreferences ? "Loading..." : 
                       notificationPreferences?.emailNotifications ? "Email notifications enabled" : 
                       "Email notifications disabled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notificationPreferences?.emailNotifications && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                      On
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 md:pb-6">
              <div className="space-y-3 md:space-y-4">
                {isLoadingPreferences ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <Label>Email Notifications</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Receive email notifications for bookings and updates
                        </p>
                      </div>
                      <Switch 
                        checked={notificationPreferences?.emailNotifications ?? true}
                        onCheckedChange={(checked) => handlePreferenceChange({ emailNotifications: checked })}
                        data-testid="switch-email-notifications"
                        disabled={updateNotificationPreferencesMutation.isPending}
                      />
                    </div>
                    
                    {(notificationPreferences?.emailNotifications ?? true) && (
                      <div className="space-y-3">
                        <Separator />
                        <h4 className="font-medium text-sm text-muted-foreground">Email Types</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label htmlFor="booking-confirmations">Booking Confirmations</Label>
                            <Switch 
                              id="booking-confirmations" 
                              checked={notificationPreferences?.bookingConfirmations ?? true}
                              onCheckedChange={(checked) => handlePreferenceChange({ bookingConfirmations: checked })}
                              data-testid="switch-booking-confirmations"
                              disabled={updateNotificationPreferencesMutation.isPending}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label htmlFor="payment-reminders">Payment Reminders</Label>
                            <Switch 
                              id="payment-reminders" 
                              checked={notificationPreferences?.paymentReminders ?? true}
                              onCheckedChange={(checked) => handlePreferenceChange({ paymentReminders: checked })}
                              data-testid="switch-payment-reminders"
                              disabled={updateNotificationPreferencesMutation.isPending}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Payment Preferences Section - Only for Owners */}
          {isOwner() && (
            <AccordionItem value="payment-preferences" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4 min-h-[44px]">
                <div className="flex items-center justify-between w-full mr-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="text-left">
                      <h3 className="font-medium text-sm md:text-base">Payment Preferences</h3>
                      <p className="text-xs md:text-sm text-muted-foreground break-words">
                        {paymentPreferences?.paymentType === "cash" ? "Cash" : "Interac Transfer"}
                        {paymentPreferences?.paymentInstructions ? " • Instructions set" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 md:pb-6">
                <div className="space-y-3 md:space-y-4">
                  {isLoadingPaymentPreferences ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Set how you want to receive payment when others book your parking spots.
                      </p>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <Label>Payment Type</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {paymentPreferences?.paymentType === "cash" ? "Cash" : "Interac Transfer"}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowPaymentPreferencesDrawer(true)}
                          data-testid="button-edit-payment-preferences"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                      {paymentPreferences?.paymentInstructions && (
                        <div className="p-4 border rounded-lg">
                          <Label className="text-sm font-medium">Payment Instructions</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {paymentPreferences.paymentInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* App Settings Section */}
          <AccordionItem value="app-settings" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4 min-h-[44px]">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-medium text-sm md:text-base">{t("profile.tabs.appSettings")}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground break-words">
                      Theme: {theme} • Language: {language === 'en' ? 'English' : 'Français'}
                    </p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 md:pb-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      <Label>{t("appSettings.theme")}</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("appSettings.theme.description")}
                    </p>
                  </div>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-32" data-testid="select-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("appSettings.theme.light")}</SelectItem>
                      <SelectItem value="dark">{t("appSettings.theme.dark")}</SelectItem>
                      <SelectItem value="system">{t("appSettings.theme.system")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <Label>{t("appSettings.language")}</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("appSettings.language.description")}
                    </p>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("appSettings.language.english")}</SelectItem>
                      <SelectItem value="fr">{t("appSettings.language.french")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          </Accordion>
        </div>

        {/* Desktop Tabs Layout */}
        <div className="hidden md:block">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 gap-1 mb-4 md:mb-6">
              <TabsTrigger value="waiting-list" className="flex items-center gap-2 min-h-11 text-xs md:text-sm">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t("profile.tabs.waitingList")}</span>
                <span className="sm:hidden">Waiting</span>
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="flex items-center gap-2 min-h-11 text-xs md:text-sm">
                <Car className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t("profile.tabs.vehicles")}</span>
                <span className="sm:hidden">Vehicles</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2 min-h-11 text-xs md:text-sm">
                <Bell className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t("profile.tabs.notifications")}</span>
                <span className="sm:hidden">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="app-settings" className="flex items-center gap-2 min-h-11 text-xs md:text-sm">
                <Settings className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t("profile.tabs.appSettings")}</span>
                <span className="sm:hidden">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Waiting List Tab */}
            <TabsContent value="waiting-list" className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Calendar className="h-5 w-5 md:h-6 md:w-6" />
                    {t("waitingList.title")}
                  </CardTitle>
                  <p className="text-sm md:text-base text-muted-foreground">
                    {t("waitingList.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
                  {isLoadingWaitingList || isLoadingAssignedSpots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : waitingListEntry ? (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-green-900 dark:text-green-100">
                            {t("waitingList.enrolled")}
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Priority: {waitingListEntry.priority === 1 ? "High" : waitingListEntry.priority === 2 ? "Medium" : "Low"} • Enrolled: {waitingListEntry.enrolledDate ? new Date(waitingListEntry.enrolledDate).toLocaleDateString() : 'N/A'}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleLeaveWaitingList}
                            disabled={cancelWaitingListMutation.isPending}
                            className="mt-3"
                            data-testid="button-leave-waiting-list"
                          >
                            {cancelWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {t("waitingList.leave")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : showSpotWarning ? (
                    <div className="space-y-4">
                      <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50" data-testid="alert-has-spot-warning">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          <p className="font-medium mb-2">You already have {assignedSpots.length} parking spot{assignedSpots.length > 1 ? 's' : ''} assigned to you.</p>
                          <p className="text-sm">Are you sure you want to join the waiting list for another spot?</p>
                        </AlertDescription>
                      </Alert>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowSpotWarning(false)}
                          data-testid="button-cancel-waiting-list"
                        >
                          No, Cancel
                        </Button>
                        <Button 
                          className="flex-1"
                          onClick={() => { setShowSpotWarning(false); setShowJoinForm(true); }}
                          data-testid="button-confirm-waiting-list"
                        >
                          Yes, Continue
                        </Button>
                      </div>
                    </div>
                  ) : showJoinForm ? (
                    <div className="space-y-4">
                      <Form {...waitingListForm}>
                        <form onSubmit={waitingListForm.handleSubmit(handleJoinWaitingList)} className="space-y-4">
                          <FormField
                            control={waitingListForm.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select 
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                  value={field.value?.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-priority">
                                      <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1">High Priority</SelectItem>
                                    <SelectItem value="2">Medium Priority</SelectItem>
                                    <SelectItem value="3">Low Priority</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={waitingListForm.control}
                            name="preferredSpotTypeId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Preferred Spot Type</FormLabel>
                                <Select 
                                  onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                                  value={field.value?.toString() || "none"}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid="select-spot-type">
                                      <SelectValue placeholder="Select preferred spot type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">No preference</SelectItem>
                                    {spotTypes.filter(type => type.name.toLowerCase() !== 'reserved').map((type) => (
                                      <SelectItem key={type.id} value={type.id.toString()}>
                                        {type.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex gap-3">
                            <Button 
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setShowJoinForm(false)}
                              data-testid="button-back-waiting-list"
                            >
                              Back
                            </Button>
                            <Button 
                              type="submit"
                              className="flex-1" 
                              disabled={createWaitingListMutation.isPending}
                              data-testid="button-join-waiting-list"
                            >
                              {createWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              {t("waitingList.enrollButton")}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Button 
                        className="w-full h-12" 
                        onClick={() => assignedSpots.length > 0 ? setShowSpotWarning(true) : setShowJoinForm(true)}
                        data-testid="button-start-join-waiting-list"
                      >
                        {t("waitingList.enrollButton")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vehicles Tab */}
            <TabsContent value="vehicles" className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                        <Car className="h-5 w-5 md:h-6 md:w-6" />
                        My Vehicles
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manage your vehicles for quick booking with model and color auto-fill.
                      </p>
                    </div>
{/* Mobile Vehicle Form - Drawer */}
                    <div className="md:hidden">
                      <Drawer open={showAddVehicleDrawer} onOpenChange={setShowAddVehicleDrawer}>
                        <DrawerTrigger asChild>
                          <Button data-testid="button-add-vehicle">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Vehicle
                          </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                          <DrawerHeader>
                            <DrawerTitle>{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DrawerTitle>
                          </DrawerHeader>
                          <div className="px-4 pb-4">
                            <Form {...vehicleForm}>
                              <form onSubmit={vehicleForm.handleSubmit(handleSubmitVehicle)} className="space-y-3 md:space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="make"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Make</FormLabel>
                                        <FormControl>
                                          <Input className="min-h-11" placeholder="e.g., Toyota" {...field} data-testid="input-vehicle-make" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="model"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Model</FormLabel>
                                        <FormControl>
                                          <Input className="min-h-11" placeholder="e.g., Camry" {...field} data-testid="input-vehicle-model" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="year"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Year</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            className="min-h-11"
                                            placeholder="2020" 
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || "")}
                                            data-testid="input-vehicle-year"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="color"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Color (Optional)</FormLabel>
                                        <FormControl>
                                          <Input className="min-h-11" placeholder="e.g., Blue" {...field} data-testid="input-vehicle-color" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="flex items-center gap-4">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="isElectric"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <Switch 
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-vehicle-electric"
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel>Electric Vehicle</FormLabel>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="isDefault"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <Switch 
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-vehicle-default"
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel>Default Vehicle</FormLabel>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </form>
                            </Form>
                          </div>
                          <DrawerFooter>
                            <Button 
                              onClick={vehicleForm.handleSubmit(handleSubmitVehicle)}
                              disabled={addVehicleMutation.isPending}
                              className="w-full h-12"
                              data-testid="button-save-vehicle"
                            >
                              {addVehicleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              {editingVehicle ? "Update Vehicle" : "Add Vehicle"}
                            </Button>
                            <DrawerClose asChild>
                              <Button variant="outline" className="w-full h-12">Cancel</Button>
                            </DrawerClose>
                          </DrawerFooter>
                        </DrawerContent>
                      </Drawer>
                    </div>

                    {/* Desktop Vehicle Form - Dialog */}
                    <div className="hidden md:block">
                      <Dialog open={showAddVehicleDialog} onOpenChange={setShowAddVehicleDialog}>
                        <DialogTrigger asChild>
                          <Button className="min-h-11" data-testid="button-add-vehicle-desktop">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Vehicle
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-full md:max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl">{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <Form {...vehicleForm}>
                              <form onSubmit={vehicleForm.handleSubmit(handleSubmitVehicle)} className="space-y-4 md:space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="make"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Make</FormLabel>
                                        <FormControl>
                                          <Input 
                                            placeholder="e.g., Toyota" 
                                            {...field} 
                                            className="h-11"
                                            data-testid="input-vehicle-make-desktop" 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="model"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Model</FormLabel>
                                        <FormControl>
                                          <Input 
                                            placeholder="e.g., Camry" 
                                            {...field} 
                                            className="h-11"
                                            data-testid="input-vehicle-model-desktop" 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="year"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Year</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            placeholder="2020" 
                                            {...field}
                                            className="h-11"
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || "")}
                                            data-testid="input-vehicle-year-desktop"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="color"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">Color (Optional)</FormLabel>
                                        <FormControl>
                                          <Input 
                                            placeholder="e.g., Blue" 
                                            {...field} 
                                            className="h-11"
                                            data-testid="input-vehicle-color-desktop" 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="isElectric"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-sm font-medium">Electric Vehicle</FormLabel>
                                          <div className="text-sm text-muted-foreground">
                                            This vehicle is electric or hybrid
                                          </div>
                                        </div>
                                        <FormControl>
                                          <Switch 
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-vehicle-electric-desktop"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={vehicleForm.control}
                                    name="isDefault"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-sm font-medium">Default Vehicle</FormLabel>
                                          <div className="text-sm text-muted-foreground">
                                            Use as primary vehicle for bookings
                                          </div>
                                        </div>
                                        <FormControl>
                                          <Switch 
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid="switch-vehicle-default-desktop"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </form>
                            </Form>
                          </div>
                          <DialogFooter className="flex-col md:flex-row gap-2 md:gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowAddVehicleDrawer(false)}
                              className="w-full md:w-auto h-11"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={vehicleForm.handleSubmit(handleSubmitVehicle)}
                              disabled={addVehicleMutation.isPending}
                              className="w-full md:w-auto h-11"
                              data-testid="button-save-vehicle-desktop"
                            >
                              {addVehicleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              {editingVehicle ? "Update Vehicle" : "Add Vehicle"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  {isLoadingVehicles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : userVehicles?.length === 0 ? (
                    <div className="text-center py-8">
                      <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium text-base md:text-lg mb-2">No vehicles added</h3>
                      <p className="text-sm md:text-base text-muted-foreground mb-4">
                        Add your vehicle information to complete your parking profile.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
                      {userVehicles?.map((vehicle: any) => (
                        <Card key={vehicle.id} className="hover-elevate">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                  {vehicle.isElectric ? (
                                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  ) : (
                                    <CarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">
                                      {vehicle.year} {vehicle.make} {vehicle.model}
                                    </p>
                                    {vehicle.isDefault && (
                                      <Badge variant="secondary" className="text-xs">Default</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {vehicle.color || "No color specified"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditVehicle(vehicle)}
                                  data-testid={`button-edit-vehicle-${vehicle.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteVehicle(vehicle)}
                                  disabled={deleteVehicleMutation.isPending}
                                  data-testid={`button-delete-vehicle-${vehicle.id}`}
                                >
                                  {deleteVehicleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                  {!deleteVehicleMutation.isPending && <Trash2 className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Bell className="h-5 w-5 md:h-6 md:w-6" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Notification preferences will be available in a future update. Stay tuned!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* App Settings Tab */}
            <TabsContent value="app-settings" className="space-y-4 md:space-y-6">
              <Card>
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <Settings className="h-5 w-5 md:h-6 md:w-6" />
                    {t("profile.tabs.appSettings")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Customize your app experience with language preferences.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <Label>{t("appSettings.language")}</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Select your preferred language
                        </p>
                      </div>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-32" data-testid="select-language">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Profile Edit Drawer */}
      <Drawer open={showProfileEditDrawer} onOpenChange={setShowProfileEditDrawer}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>{t("profile.editProfile")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleSubmitProfile)} className="space-y-4 md:space-y-6">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.fullName")}</FormLabel>
                      <FormControl>
                        <Input className="min-h-11" placeholder="Enter your full name" {...field} data-testid="input-profile-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.emailAddress")}</FormLabel>
                      <FormControl>
                        <Input 
                          className="min-h-11 bg-muted/50" 
                          type="email" 
                          {...field} 
                          disabled 
                          data-testid="input-profile-email" 
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">{t("profile.managedByIT")}</p>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.phoneNumber")}</FormLabel>
                      <FormControl>
                        <Input className="min-h-11" placeholder="Enter your phone number" {...field} data-testid="input-profile-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.department")}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} 
                        disabled={isDepartmentsLoading}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-profile-department">
                            <SelectValue placeholder={isDepartmentsLoading ? "Loading departments..." : "Select department"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <DrawerFooter>
            <Button 
              onClick={profileForm.handleSubmit(handleSubmitProfile)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                t("profile.saveChanges")
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="button-cancel-profile">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Payment Preferences Dialog */}
      <Dialog open={showPaymentPreferencesDrawer} onOpenChange={setShowPaymentPreferencesDrawer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Preferences
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set how you want to receive payment when others book your parking spots.
            </p>
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(handleSubmitPaymentPreferences)} className="space-y-4">
                <FormField
                  control={paymentForm.control}
                  name="paymentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-type">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="interac_transfer">Interac Transfer</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={paymentForm.control}
                  name="paymentInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={paymentForm.watch("paymentType") === "cash" 
                            ? "e.g., Meet me at BCI main Building Lobby or message me on Teams"
                            : "e.g., Send e-Transfer to john.doe@bci.ca (auto-deposit enabled)"
                          }
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="textarea-payment-instructions"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will be shown to renters when they book your spot.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPaymentPreferencesDrawer(false)}
              data-testid="button-cancel-payment-preferences"
            >
              Cancel
            </Button>
            <Button
              onClick={paymentForm.handleSubmit(handleSubmitPaymentPreferences)}
              disabled={updatePaymentPreferencesMutation.isPending}
              data-testid="button-save-payment-preferences"
            >
              {updatePaymentPreferencesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
