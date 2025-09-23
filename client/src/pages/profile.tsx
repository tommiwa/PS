import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import type { Vehicle } from "@/components/user-profile-card"
import { 
  Car, 
  Settings, 
  Bell, 
  Shield, 
  MapPin, 
  Users,
  User,
  Mail,
  Phone,
  Key,
  Download,
  Trash2,
  AlertTriangle,
  Sun,
  Moon,
  Globe,
  Smartphone,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  CalendarClock,
  Building,
  Zap,
  Car as CarIcon,
  Accessibility,
  Edit,
  Loader2,
  Info,
  Plus,
  Calendar
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { useLanguage } from "@/hooks/use-language"
import { spotTypes, type SpotType, type WaitingList, type InsertWaitingList, type ParkingSpot, type NotificationPreferences, type UpdateNotificationPreferences } from "@shared/schema"

// Type definitions for forms
type WaitingListForm = {
  preferredSpotType: "regular" | "electric" | "accessible";
  preferredBuilding: string;
  priority: "1" | "2" | "3";
  reason: string;
};

type VehicleForm = {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string;
  isElectric: boolean;
  isDefault: boolean;
};

export default function Profile() {
  const { user, isOwner, isRenter, isAdmin } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { confirm } = useConfirm()

  // Schemas with translation support
  const waitingListSchema = z.object({
    preferredSpotType: z.enum(["regular", "electric", "accessible"], {
      required_error: t("validation.spotTypeRequired")
    }),
    preferredBuilding: z.string().min(1, t("validation.buildingRequired")),
    priority: z.enum(["1", "2", "3"], {
      required_error: t("validation.priorityRequired")
    }),
    reason: z.string().min(10, t("validation.reasonMinLength"))
  });

  const vehicleSchema = z.object({
    make: z.string().min(1, t("validation.makeRequired")),
    model: z.string().min(1, t("validation.modelRequired")),
    year: z.number().min(1990, t("validation.yearMin")).max(new Date().getFullYear() + 1, t("validation.yearMax")),
    licensePlate: z.string().min(1, t("validation.licensePlateRequired")),
    color: z.string().optional(),
    isElectric: z.boolean().default(false),
    isDefault: z.boolean().default(false)
  });

  // Priority levels with translations
  const priorityLevels = {
    "1": { label: t("priority.high.label"), description: t("priority.high.description") },
    "2": { label: t("priority.medium.label"), description: t("priority.medium.description") },
    "3": { label: t("priority.low.label"), description: t("priority.low.description") }
  };

  // Building options with translations
  const buildingOptions = [
    { value: "Building A", label: t("building.a") },
    { value: "Building B", label: t("building.b") },
    { value: "Building C", label: t("building.c") },
    { value: "Building D", label: t("building.d") }
  ];
  
  // State for various settings
  const [darkMode, setDarkMode] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("notifications")
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [isEnrolledInWaitingList, setIsEnrolledInWaitingList] = useState(false)
  const [availabilityAlertsEnabled, setAvailabilityAlertsEnabled] = useState(false)
  const [editWaitingListMode, setEditWaitingListMode] = useState(false)

  // Waiting list form
  const waitingListForm = useForm<WaitingListForm>({
    resolver: zodResolver(waitingListSchema),
    defaultValues: {
      preferredSpotType: "regular",
      preferredBuilding: "",
      priority: "2",
      reason: ""
    }
  });

  // Vehicle form
  const vehicleForm = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      licensePlate: "",
      color: "",
      isElectric: false,
      isDefault: false
    }
  });

  // Query user's waiting list status  
  const { data: waitingListEntry, isLoading: isLoadingWaitingList, refetch: refetchWaitingList } = useQuery<WaitingList | null>({
    queryKey: ["/api/waiting-list/user", user?.id],
    enabled: !!user?.id
  });

  // Query user's assigned spots (for owners and admins)
  const { data: assignedSpots = [], isLoading: isLoadingSpots } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/users", user?.id, "assigned-spots"],
    enabled: !!user?.id && (isOwner() || isAdmin())
  });

  // Query user's vehicles
  const { data: userVehicles = [], isLoading: isLoadingVehicles, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/users", user?.id, "vehicles"],
    enabled: !!user?.id
  });

  // Query user's notification preferences
  const { data: notificationPreferences, isLoading: isLoadingPreferences } = useQuery<NotificationPreferences>({
    queryKey: ["/api/users", user?.id, "notification-preferences"],
    enabled: !!user?.id
  });

  // Mutation for creating waiting list entry
  const createWaitingListMutation = useMutation({
    mutationFn: async (data: WaitingListForm) => {
      if (!user) throw new Error("User not found");
      
      const waitingListData: Partial<InsertWaitingList> = {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userDepartment: user.department || "Unknown",
        preferredSpotType: data.preferredSpotType as SpotType,
        preferredBuilding: data.preferredBuilding,
        priority: parseInt(data.priority),
        reason: data.reason,
        status: "active",
        enrolledBy: "user"
      };
      
      const response = await apiRequest("/api/waiting-list", { method: 'POST', body: waitingListData });
      return response.json();
    },
    onSuccess: (newEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      setIsEnrolledInWaitingList(true);
      waitingListForm.reset();

      // Send welcome notification (in background, don't block UI)
      if (user && notificationPreferences?.emailNotifications) {
        apiRequest("/api/notifications/welcome", { method: 'POST', body: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          waitingListEntry: newEntry,
          preferences: notificationPreferences
        }}).catch((error) => {
          console.warn('Failed to send welcome notification:', error);
          // Don't show error to user since enrollment was successful
        });
      }
      
      toast({
        title: t("toast.enrollSuccess.title"),
        description: t("toast.enrollSuccess.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.enrollFailed.title"),
        description: error instanceof Error ? error.message : t("toast.enrollFailed.description"),
        variant: "destructive"
      });
    }
  });

  // Mutation for updating waiting list entry
  const updateWaitingListMutation = useMutation({
    mutationFn: async (data: WaitingListForm) => {
      if (!waitingListEntry?.id) throw new Error("Waiting list entry not found");
      
      const updateData = {
        preferredSpotType: data.preferredSpotType as SpotType,
        preferredBuilding: data.preferredBuilding,
        priority: parseInt(data.priority),
        reason: data.reason
      };
      
      const response = await apiRequest(`/api/waiting-list/${waitingListEntry.id}`, { method: 'PUT', body: updateData });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      setEditWaitingListMode(false);
      toast({
        title: t("toast.preferencesUpdated.title"),
        description: t("toast.preferencesUpdated.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.updateFailed.title"),
        description: error instanceof Error ? error.message : t("toast.updateFailed.description"),
        variant: "destructive"
      });
    }
  });

  // Mutation for canceling waiting list entry
  const cancelWaitingListMutation = useMutation({
    mutationFn: async () => {
      if (!waitingListEntry?.id) throw new Error("Waiting list entry not found");
      
      const response = await apiRequest(`/api/waiting-list/${waitingListEntry.id}`, { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      setIsEnrolledInWaitingList(false);
      setEditWaitingListMode(false);
      toast({
        title: t("toast.removedFromList.title"),
        description: t("toast.removedFromList.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.cancellationFailed.title"),
        description: error instanceof Error ? error.message : t("toast.cancellationFailed.description"),
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
      setShowAddVehicleDialog(false);
      vehicleForm.reset();
      toast({
        title: t("toast.vehicleAdded.title"),
        description: t("toast.vehicleAdded.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.vehicleAddFailed.title"),
        description: error instanceof Error ? error.message : t("toast.vehicleAddFailed.description"),
        variant: "destructive"
      });
    }
  });

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
      setEditingVehicle(null);
      setShowAddVehicleDialog(false);
      vehicleForm.reset();
      toast({
        title: t("toast.vehicleUpdated.title"),
        description: t("toast.vehicleUpdated.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.vehicleUpdateFailed.title"),
        description: error instanceof Error ? error.message : t("toast.vehicleUpdateFailed.description"),
        variant: "destructive"
      });
    }
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const response = await apiRequest(`/api/users/${user?.id}/vehicles/${vehicleId}`, { 
        method: 'DELETE' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "vehicles"] });
      toast({
        title: t("toast.vehicleDeleted.title"),
        description: t("toast.vehicleDeleted.description"),
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: t("toast.vehicleDeleteFailed.title"),
        description: error instanceof Error ? error.message : t("toast.vehicleDeleteFailed.description"),
        variant: "destructive"
      });
    }
  });

  // Mutation for updating notification preferences with optimistic updates
  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: async (updates: UpdateNotificationPreferences) => {
      if (!user?.id) throw new Error("User not found");
      
      const response = await apiRequest(`/api/users/${user.id}/notification-preferences`, {
        method: 'PATCH',
        body: updates
      });
      return response.json();
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/users", user?.id, "notification-preferences"] });

      // Snapshot the previous value
      const previousPreferences = queryClient.getQueryData(["/api/users", user?.id, "notification-preferences"]);

      // Create default preferences if none exist
      const defaultPreferences: NotificationPreferences = {
        id: "temp",
        userId: user?.id || "",
        emailNotifications: true,
        bookingConfirmations: true,
        paymentReminders: true,
        spotAvailability: true,
        weeklyReports: true,
        systemMaintenance: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Safely optimistically update to the new value
      queryClient.setQueryData(["/api/users", user?.id, "notification-preferences"], (old: NotificationPreferences | undefined) => ({
        ...(old ?? defaultPreferences),
        ...updates,
        updatedAt: new Date()
      }));

      // Return a context object with the snapshotted value
      return { previousPreferences };
    },
    onError: (err, updates, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        ["/api/users", user?.id, "notification-preferences"],
        context?.previousPreferences
      );
      toast({
        title: t("toast.notificationUpdateFailed.title"),
        description: t("toast.notificationUpdateFailed.description"),
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync with server
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "notification-preferences"] });
    }
  });

  // Debounced auto-save handler for notification preferences
  const handlePreferenceChange = (updates: UpdateNotificationPreferences) => {
    updateNotificationPreferencesMutation.mutate(updates);
  };

  if (!user) {
    return (
      <div className="p-6" data-testid="page-profile">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t("profile.profile")}</h1>
          <p className="text-muted-foreground">{t("profile.loginPrompt")}</p>
        </div>
      </div>
    )
  }

  // Create user profile object compatible with UserProfileCard
  const userProfile = {
    id: user.id,
    name: user.name || t("profile.user"),
    email: user.email,
    phone: user.phone || "(555) 000-0000",
    department: user.department || t("profile.department"),
    role: user.role,
    vehicles: userVehicles,
    assignedSpots: assignedSpots,
    spotCount: assignedSpots.length || 0,
    memberSince: user.memberSince || t("common.recently")
  }

  const handleSaveProfile = () => {
    console.log('Save profile changes')
    setEditDialogOpen(false)
    // Handle profile update
  }

  const handleChangePassword = () => {
    console.log('Change password')
    // Handle password change
  }

  const handleDeleteAccount = async () => {
    const confirmed = await confirm(confirmations.deleteAccount(user?.name))
    if (confirmed) {
      console.log('Delete account request')
      // TODO: Implement actual account deletion logic
    }
  }

  const handleExportData = () => {
    console.log('Export user data')
    // Generate and download user data
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const handleEditProfile = () => {
    setEditDialogOpen(true)
  }

  const handleUpdateVehicle = () => {
    setActiveTab("vehicle")
  }

  const handleNotificationSettings = () => {
    setActiveTab("notifications")
  }

  const handleEnrollWaitingList = () => {
    if (isEnrolledInWaitingList) {
      console.log('Leaving waiting list')
      setIsEnrolledInWaitingList(false)
      toast({
        title: "Left Waiting List",
        description: "You've been removed from the waiting list. You can re-enroll anytime.",
        variant: "default",
      })
    } else {
      console.log('Enrolling in waiting list')
      setIsEnrolledInWaitingList(true)
      toast({
        title: "✅ Enrolled in Waiting List!",
        description: "You'll receive notifications when spots become available that match your preferences.",
        variant: "default",
      })
    }
  }

  const handleAvailabilityAlerts = () => {
    if (availabilityAlertsEnabled) {
      console.log('Disabling availability alerts')
      setAvailabilityAlertsEnabled(false)
      toast({
        title: "Availability Alerts Disabled",
        description: "You won't receive push notifications about available spots. You can re-enable this anytime.",
        variant: "default",
      })
    } else {
      console.log('Enabling availability alerts')
      setAvailabilityAlertsEnabled(true)
      toast({
        title: "🔔 Availability Alerts Enabled!",
        description: "You'll get instant notifications when your preferred spots become available. Never miss out!",
        variant: "default",
      })
    }
  }

  const handleManageSpots = () => {
    setLocation('/my-spots')
  }

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    vehicleForm.reset();
    setShowAddVehicleDialog(true);
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    vehicleForm.reset({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      licensePlate: vehicle.licensePlate,
      color: vehicle.color || "",
      isElectric: false // We'll need to add this to the Vehicle interface
    });
    setShowAddVehicleDialog(true);
  }

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const confirmed = await confirm({
      title: t("vehicles.delete"),
      description: `Are you sure you want to delete ${vehicle.year} ${vehicle.make} ${vehicle.model}?`,
      confirmText: t("common.delete"),
      variant: "destructive"
    });
    
    if (confirmed) {
      deleteVehicleMutation.mutate(vehicle.id);
    }
  }

  const handleSubmitVehicle = (data: VehicleForm) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate(data);
    } else {
      addVehicleMutation.mutate(data);
    }
  }

  const handleManageBookings = () => {
    setLocation('/my-bookings')
  }

  const handleViewReports = () => {
    setLocation('/reports')
    toast({
      title: t("toast.reportsAvailable.title"),
      description: t("toast.reportsAvailable.description"),
      variant: "default"
    })
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-profile">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
          <p className="text-muted-foreground">
            {t("profile.settings")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UserProfileCard 
            user={userProfile} 
            onEditProfile={handleEditProfile}
          />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="notifications" data-testid="tab-notifications">{t("profile.tabs.notifications")}</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.tabs.notifications")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="waitingList" data-testid="tab-waiting-list">{t("profile.tabs.waitingList")}</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.tabs.waitingList")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="vehicles" data-testid="tab-vehicles">{t("profile.tabs.vehicles")}</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.tabs.vehicles")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="appSettings" data-testid="tab-app-settings">{t("profile.tabs.appSettings")}</TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.tabs.appSettings")}</p>
                </TooltipContent>
              </Tooltip>
            </TabsList>
            
            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t("notifications.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingPreferences ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-sm text-muted-foreground">{t("profile.loadingPreferences")}</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <Label>{t("notifications.emailNotifications")}</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("notifications.emailNotifications.description")}
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Switch 
                              checked={notificationPreferences?.emailNotifications ?? true}
                              onCheckedChange={(checked) => handlePreferenceChange({ emailNotifications: checked })}
                              data-testid="switch-email-notifications"
                              disabled={updateNotificationPreferencesMutation.isPending}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("tooltip.notifications.emailToggle")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      {(notificationPreferences?.emailNotifications ?? true) && (
                        <>
                          <Separator />
                          <div className="space-y-4 pl-6">
                            <h4 className="font-medium text-sm text-muted-foreground">{t("profile.emailNotificationTypes")}</h4>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="booking-confirmations">{t("notifications.bookingConfirmations")}</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch 
                                      id="booking-confirmations" 
                                      checked={notificationPreferences?.bookingConfirmations ?? true}
                                      onCheckedChange={(checked) => handlePreferenceChange({ bookingConfirmations: checked })}
                                      data-testid="switch-booking-confirmations"
                                      disabled={updateNotificationPreferencesMutation.isPending}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.notifications.bookingConfirmations")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="payment-reminders">{t("notifications.paymentReminders")}</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch 
                                      id="payment-reminders" 
                                      checked={notificationPreferences?.paymentReminders ?? true}
                                      onCheckedChange={(checked) => handlePreferenceChange({ paymentReminders: checked })}
                                      data-testid="switch-payment-reminders"
                                      disabled={updateNotificationPreferencesMutation.isPending}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.notifications.paymentReminders")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="spot-availability">{t("notifications.spotAvailability")}</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch 
                                      id="spot-availability" 
                                      checked={notificationPreferences?.spotAvailability ?? true}
                                      onCheckedChange={(checked) => handlePreferenceChange({ spotAvailability: checked })}
                                      data-testid="switch-spot-availability"
                                      disabled={updateNotificationPreferencesMutation.isPending}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.notifications.spotAvailability")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="weekly-reports">Weekly Summary Reports</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch 
                                      id="weekly-reports" 
                                      checked={notificationPreferences?.weeklyReports ?? true}
                                      onCheckedChange={(checked) => handlePreferenceChange({ weeklyReports: checked })}
                                      data-testid="switch-weekly-reports"
                                      disabled={updateNotificationPreferencesMutation.isPending}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.notifications.weeklyReports")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="system-maintenance">System Maintenance Alerts</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Switch 
                                      id="system-maintenance" 
                                      checked={notificationPreferences?.systemMaintenance ?? true}
                                      onCheckedChange={(checked) => handlePreferenceChange({ systemMaintenance: checked })}
                                      data-testid="switch-system-maintenance"
                                      disabled={updateNotificationPreferencesMutation.isPending}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.notifications.systemMaintenance")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {updateNotificationPreferencesMutation.isPending && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                          <span>Saving preferences...</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Waiting List Tab */}
            <TabsContent value="waitingList" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t("waitingList.title")}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("waitingList.description")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingWaitingList ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
                    </div>
                  ) : !waitingListEntry ? (
                    <Button 
                      onClick={() => setIsEnrolledInWaitingList(true)}
                      className="w-full"
                      data-testid="button-join-waiting-list"
                    >
                      {t("waitingList.enrollButton")}
                    </Button>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                            {t("waitingList.enrolled")}
                          </h4>
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Priority: {waitingListEntry.priority}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vehicles Tab */}
            <TabsContent value="vehicles" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CarIcon className="h-5 w-5" />
                      {t("vehicles.title")}
                    </CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            setEditingVehicle(null);
                            vehicleForm.reset();
                            setShowAddVehicleDialog(true);
                          }}
                          size="sm"
                          data-testid="button-add-vehicle"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {t("vehicles.addVehicle")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("tooltip.vehicles.add")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingVehicles ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
                    </div>
                  ) : userVehicles && userVehicles.length > 0 ? (
                    <div className="space-y-3">
                      {userVehicles.map((vehicle: any) => (
                        <div 
                          key={vehicle.id} 
                          className="border rounded-lg p-4 hover-elevate"
                          data-testid={`card-vehicle-${vehicle.id}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{vehicle.make} {vehicle.model}</h4>
                                {vehicle.isElectric && <Zap className="h-4 w-4 text-green-600" />}
                                {vehicle.isDefault && <Badge variant="secondary">Primary</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {vehicle.year} • {vehicle.licensePlate}
                                {vehicle.color && ` • ${vehicle.color}`}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditVehicle(vehicle)}
                                    data-testid={`button-edit-vehicle-${vehicle.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t("tooltip.vehicles.edit")}</p>
                                </TooltipContent>
                              </Tooltip>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteVehicle(vehicle)}
                                      data-testid={`button-delete-vehicle-${vehicle.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.vehicles.delete")}</p>
                                  </TooltipContent>
                                </Tooltip>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      data-testid={`info-delete-vehicle-${vehicle.id}`}
                                    >
                                      <Info className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" data-testid={`popover-delete-vehicle-${vehicle.id}`}>
                                    <div className="space-y-2">
                                      <h4 className="font-semibold text-destructive">{t("info.vehicles.delete.title")}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {t("info.vehicles.delete.content")}
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">{t("vehicles.noVehicles")}</h3>
                      <p className="text-muted-foreground mb-4">{t("vehicles.addFirst")}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              setEditingVehicle(null);
                              vehicleForm.reset();
                              setShowAddVehicleDialog(true);
                            }}
                            data-testid="button-add-first-vehicle"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {t("vehicles.addVehicle")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.vehicles.add")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* App Settings Tab */}
            <TabsContent value="appSettings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t("profile.tabs.appSettings")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("appSettings.language")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("appSettings.language.description")}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="w-[150px]" data-testid="select-language">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">{t("appSettings.language.english")}</SelectItem>
                              <SelectItem value="fr">{t("appSettings.language.french")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.settings.language")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("appSettings.theme")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("appSettings.theme.description")}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Select value={theme} onValueChange={setTheme}>
                            <SelectTrigger className="w-[150px]" data-testid="select-theme">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">{t("appSettings.theme.light")}</SelectItem>
                              <SelectItem value="dark">{t("appSettings.theme.dark")}</SelectItem>
                              <SelectItem value="system">{t("appSettings.theme.system")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.settings.theme")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

          {/* Vehicle Dialog */}
          <Dialog open={showAddVehicleDialog} onOpenChange={setShowAddVehicleDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingVehicle ? t("vehicles.editVehicle") : t("vehicles.addVehicle")}
                </DialogTitle>
              </DialogHeader>
              <Form {...vehicleForm}>
                <form onSubmit={vehicleForm.handleSubmit(handleSubmitVehicle)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={vehicleForm.control}
                      name="make"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("vehicles.make")}</FormLabel>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input placeholder="e.g., Tesla" {...field} data-testid="input-vehicle-make" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.make")}</p>
                              </TooltipContent>
                            </Tooltip>
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
                          <FormLabel>{t("vehicles.model")}</FormLabel>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input placeholder="e.g., Model 3" {...field} data-testid="input-vehicle-model" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.model")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={vehicleForm.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("vehicles.year")}</FormLabel>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                                  data-testid="input-vehicle-year" 
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.year")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={vehicleForm.control}
                      name="licensePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("vehicles.licensePlate")}</FormLabel>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input {...field} data-testid="input-vehicle-license" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.licensePlate")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={vehicleForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("vehicles.color")} (Optional)</FormLabel>
                        <FormControl>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input {...field} data-testid="input-vehicle-color" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("tooltip.vehicles.color")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <FormField
                      control={vehicleForm.control}
                      name="isElectric"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>{t("vehicles.isElectric")}</FormLabel>
                          </div>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-vehicle-electric"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.isElectric")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vehicleForm.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>{t("vehicles.isDefault")}</FormLabel>
                          </div>
                          <FormControl>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Switch 
                                  checked={field.value} 
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-vehicle-default"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.vehicles.isDefault")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" onClick={() => setShowAddVehicleDialog(false)} data-testid="button-cancel-vehicle">
                          {t("vehicles.cancel")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("tooltip.profile.editCancel")}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="submit" 
                          disabled={addVehicleMutation.isPending || updateVehicleMutation.isPending}
                          data-testid="button-save-vehicle"
                        >
                          {(addVehicleMutation.isPending || updateVehicleMutation.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {t("vehicles.save")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("tooltip.profile.editSave")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div>
                          <Label>{t("profile.profileVisibility")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.profileVisibilityDesc")}
                          </p>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid="info-profile-visibility" aria-label={t("info.security.profileVisibility.title")}>
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.info.profileVisibility")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" data-testid="popover-profile-visibility">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{t("info.security.profileVisibility.title")}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.profileVisibility.content")}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Select defaultValue="colleagues">
                            <SelectTrigger className="w-[200px]" data-testid="select-profile-visibility">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="colleagues">{t("profile.bciEmployeesOnly")}</SelectItem>
                              <SelectItem value="private">{t("profile.private")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.security.profileVisibility")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div>
                          <Label>{t("profile.contactSharing")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.contactSharingDesc")}
                          </p>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid="info-contact-sharing" aria-label={t("info.security.contactSharing.title")}>
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.info.contactSharing")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" data-testid="popover-contact-sharing">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{t("info.security.contactSharing.title")}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.contactSharing.content")}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Switch defaultChecked data-testid="switch-contact-sharing" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.security.dataSharing")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("profile.bookingHistory")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("profile.bookingHistoryDesc")}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Switch data-testid="switch-booking-history" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.security.dataSharing")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">{t("profile.securitySettings")}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div>
                          <Label>{t("profile.twoFactor")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.twoFactorDesc")}
                          </p>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid="info-2fa" aria-label={t("info.security.twoFactor.title")}>
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.info.twoFactor")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" data-testid="popover-2fa">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{t("info.security.twoFactor.title")}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.twoFactor.content")}
                              </p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" data-testid="badge-2fa-status">{t("profile.notEnabled")}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.security.twoFactor")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" className="flex-1" data-testid="button-enable-2fa">
                            <Key className="h-4 w-4 mr-2" />
                            {t("profile.enableTwoFactor")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("tooltip.security.twoFactor")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("profile.recentActivity")}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{t("profile.lastLogin", { date: "January 15, 2024", time: "9:30 AM" })}</p>
                      <p>{t("profile.previousLogin", { date: "January 14, 2024", time: "8:15 AM" })}</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">{t("profile.accountActions")}</h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t("profile.changePassword")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.changePasswordDesc")}
                          </p>
                        </div>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" onClick={handleChangePassword} data-testid="button-change-password" aria-label={t("profile.changePassword")}>
                                  <Key className="h-4 w-4 mr-2" />
                                  {t("profile.changePassword")}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.profile.changePassword")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" data-testid="hovercard-change-password">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{t("info.security.changePassword.title")}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.changePassword.content")}
                              </p>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t("profile.exportData")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.exportDataDesc")}
                          </p>
                        </div>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" onClick={handleExportData} data-testid="button-export-data" aria-label={t("profile.exportData")}>
                                  <Download className="h-4 w-4 mr-2" />
                                  {t("profile.exportData")}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.profile.exportData")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" data-testid="hovercard-export-data">
                            <div className="space-y-2">
                              <h4 className="font-semibold">{t("info.security.exportData.title")}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.exportData.content")}
                              </p>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-destructive">{t("profile.deleteAccount")}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t("profile.deleteAccountDesc")}
                          </p>
                        </div>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="destructive" onClick={handleDeleteAccount} data-testid="button-delete-account" aria-label={t("profile.deleteAccount")}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("profile.deleteAccount")}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("tooltip.profile.deleteAccount")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80" data-testid="hovercard-delete-account">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <h4 className="font-semibold text-destructive">{t("info.security.deleteAccount.title")}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {t("info.security.deleteAccount.content")}
                              </p>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-6">
          {/* Parking Waiting List Sidebar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                {t("waitingList.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingWaitingList ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm">{t("common.loading")}</span>
                </div>
              ) : waitingListEntry?.status === "active" ? (
                <div className="space-y-3">
                  {!editWaitingListMode ? (
                    <>
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                              {t("waitingList.enrolled")}
                            </h4>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              {t("waitingList.priority")}: {priorityLevels[waitingListEntry?.priority?.toString() as keyof typeof priorityLevels]?.label}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p><strong>Spot Type:</strong> {waitingListEntry?.preferredSpotType}</p>
                        <p><strong>Building:</strong> {waitingListEntry?.preferredBuilding}</p>
                      </div>
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setEditWaitingListMode(true);
                                waitingListForm.reset({
                                  preferredSpotType: waitingListEntry?.preferredSpotType as any,
                                  preferredBuilding: waitingListEntry?.preferredBuilding || "",
                                  priority: waitingListEntry?.priority?.toString() as any,
                                  reason: waitingListEntry?.reason || ""
                                });
                              }}
                              data-testid="button-edit-waiting-list"
                            >
                              {t("waitingList.edit")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("tooltip.waitingList.cancel")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="text-xs"
                              onClick={() => cancelWaitingListMutation.mutate()}
                              disabled={cancelWaitingListMutation.isPending}
                              data-testid="button-leave-waiting-list"
                            >
                              {cancelWaitingListMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              {t("waitingList.leave")}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("tooltip.waitingList.cancel")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </>
                  ) : (
                    <Form {...waitingListForm}>
                      <form 
                        onSubmit={waitingListForm.handleSubmit((data) => updateWaitingListMutation.mutate(data))}
                        className="space-y-4"
                      >
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                            {t("waitingList.editPreferences")}
                          </h4>
                        </div>
                        
                        <FormField
                          control={waitingListForm.control}
                          name="preferredSpotType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t("waitingList.form.preferredSpotType")}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SelectTrigger className="h-8" data-testid="select-spot-type">
                                        <SelectValue placeholder={t("placeholder.selectSpotType")} />
                                      </SelectTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t("tooltip.waitingList.spotType")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="regular">{t("spotType.regular")}</SelectItem>
                                  <SelectItem value="electric">{t("spotType.electric")}</SelectItem>
                                  <SelectItem value="accessible">{t("spotType.accessible")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={waitingListForm.control}
                          name="preferredBuilding"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t("waitingList.form.preferredBuilding")}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SelectTrigger className="h-8" data-testid="select-building">
                                        <SelectValue placeholder={t("placeholder.selectBuilding")} />
                                      </SelectTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t("tooltip.waitingList.building")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormControl>
                                <SelectContent>
                                  {buildingOptions.map((building) => (
                                    <SelectItem key={building.value} value={building.value}>
                                      {building.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={waitingListForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center gap-2">
                                <FormLabel className="text-xs">{t("waitingList.form.priority")}</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="ghost" data-testid="info-priority-guidelines">
                                      <Info className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" data-testid="popover-priority-guidelines">
                                    <div className="space-y-2">
                                      <h4 className="font-semibold">{t("info.waitingList.priority.title")}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {t("info.waitingList.priority.content")}
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <SelectTrigger className="h-8" data-testid="select-priority">
                                        <SelectValue placeholder={t("placeholder.selectPriority")} />
                                      </SelectTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t("tooltip.waitingList.priority")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(priorityLevels).map(([value, config]) => (
                                    <SelectItem key={value} value={value}>
                                      {config.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={waitingListForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t("waitingList.form.reason")} ({t("common.optional")})</FormLabel>
                              <FormControl>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Textarea 
                                      placeholder={t("placeholder.briefReason")}
                                      className="resize-none h-16 text-xs"
                                      data-testid="textarea-reason"
                                      {...field}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t("tooltip.waitingList.reason")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                type="button"
                                variant="outline" 
                                size="sm"
                                className="text-xs flex-1"
                                onClick={() => setEditWaitingListMode(false)}
                                data-testid="button-cancel-edit-waiting-list"
                              >
                                {t("waitingList.form.cancel")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("tooltip.waitingList.cancel")}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                type="submit"
                                size="sm"
                                className="text-xs flex-1"
                                disabled={updateWaitingListMutation.isPending}
                                data-testid="button-save-waiting-list"
                              >
                                {updateWaitingListMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : null}
                                {t("waitingList.form.save")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("tooltip.waitingList.save")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </form>
                    </Form>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {t("waitingList.joinTitle")}
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {t("waitingList.joinDescription")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => createWaitingListMutation.mutate({
                          preferredSpotType: "regular",
                          preferredBuilding: "Building A",
                          priority: "2",
                          reason: "Daily commute"
                        })}
                        disabled={createWaitingListMutation.isPending}
                        data-testid="button-join-waiting-list"
                      >
                        {createWaitingListMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        {t("waitingList.enrollButton")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("tooltip.waitingList.enroll")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profile Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("profile.editProfile")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-lg">
                  {getInitials(user?.name || 'User')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-change-photo">
                      {t("profile.changePhoto")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltip.profile.changePhoto")}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground">
                  {t("profile.photoFormat")}
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full-name">{t("profile.fullName")}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input id="full-name" defaultValue={user?.name} data-testid="input-full-name" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltip.profile.fullName")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Label htmlFor="email">{t("profile.emailAddress")}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input id="email" defaultValue={user?.email} disabled data-testid="input-email" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltip.profile.email")}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("profile.managedByIT")}
                </p>
              </div>
              <div>
                <Label htmlFor="phone">{t("profile.phoneNumber")}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input id="phone" defaultValue={user?.phone || "(555) 000-0000"} data-testid="input-phone" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltip.profile.phone")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Label htmlFor="department">{t("profile.department")}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input id="department" defaultValue={user?.department || "Unknown"} disabled data-testid="input-department" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("tooltip.profile.department")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">{t("profile.bio")}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Textarea 
                    id="bio" 
                    placeholder={t("profile.bioPlaceholder")}
                    className="mt-1"
                    data-testid="textarea-bio"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.profile.bio")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex justify-end gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-profile-edit">
                    {t("common.cancel")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.profile.editCancel")}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                    {t("profile.saveChanges")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.profile.editSave")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
