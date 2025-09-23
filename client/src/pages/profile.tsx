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
import { useLanguage } from "@/contexts/language-context"
import { spotTypes, type SpotType, type WaitingList, type InsertWaitingList, type ParkingSpot, type NotificationPreferences, type UpdateNotificationPreferences } from "@shared/schema"

// Waiting list form validation schema
const waitingListSchema = z.object({
  preferredSpotType: z.enum(["regular", "electric", "accessible"], {
    required_error: "Please select a preferred spot type"
  }),
  preferredBuilding: z.string().min(1, "Please select a preferred building"),
  priority: z.enum(["1", "2", "3"], {
    required_error: "Please select a priority level"
  }),
  reason: z.string().min(10, "Please provide a reason (at least 10 characters)")
});

// Vehicle form validation schema
const vehicleSchema = z.object({
  make: z.string().min(1, "Vehicle make is required"),
  model: z.string().min(1, "Vehicle model is required"),
  year: z.number().min(1990, "Year must be 1990 or later").max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  licensePlate: z.string().min(1, "License plate is required"),
  color: z.string().optional(),
  isElectric: z.boolean().default(false),
  isDefault: z.boolean().default(false)
});

type WaitingListForm = z.infer<typeof waitingListSchema>;
type VehicleForm = z.infer<typeof vehicleSchema>;

// Priority levels with descriptions
const priorityLevels = {
  "1": { label: "High Priority", description: "Urgent need due to accessibility, pregnancy, or medical reasons" },
  "2": { label: "Medium Priority", description: "Regular commuter with consistent parking needs" },
  "3": { label: "Low Priority", description: "Occasional use or flexible parking requirements" }
};

// Building options
const buildingOptions = [
  { value: "Building A", label: "Building A - Main Campus" },
  { value: "Building B", label: "Building B - East Wing" },
  { value: "Building C", label: "Building C - West Wing" },
  { value: "Building D", label: "Building D - Annex" }
];

export default function Profile() {
  const { user, isOwner, isRenter, isAdmin } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { confirm } = useConfirm()
  
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
        title: "🎉 Successfully Enrolled!",
        description: "You've been added to the waiting list. You'll be notified when a spot becomes available.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Enrollment Failed",
        description: error instanceof Error ? error.message : "Failed to join waiting list. Please try again.",
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
        title: "Preferences Updated",
        description: "Your waiting list preferences have been successfully updated.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update preferences. Please try again.",
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
        title: "Removed from Waiting List",
        description: "You've been successfully removed from the waiting list.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to remove from waiting list. Please try again.",
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
        title: "Vehicle Deleted",
        description: "Your vehicle has been successfully removed.",
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
        title: "Failed to Update Preferences",
        description: "Your notification preferences could not be saved. Please try again.",
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
          <h1 className="text-2xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">Please log in to view your profile.</p>
        </div>
      </div>
    )
  }

  // Create user profile object compatible with UserProfileCard
  const userProfile = {
    id: user.id,
    name: user.name || "User",
    email: user.email,
    phone: user.phone || "(555) 000-0000",
    department: user.department || "Unknown",
    role: user.role,
    vehicles: userVehicles,
    assignedSpots: assignedSpots,
    spotCount: assignedSpots.length || 0,
    memberSince: user.memberSince || "Recently"
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
      title: "Delete Vehicle",
      description: `Are you sure you want to delete ${vehicle.year} ${vehicle.make} ${vehicle.model}?`,
      confirmText: "Delete",
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
      title: "Reports Available",
      description: "View your booking history and parking analytics.",
      variant: "default"
    })
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-profile">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile & Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings, preferences, and personal information.
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
              <TabsTrigger value="notifications">{t("profile.tabs.notifications")}</TabsTrigger>
              <TabsTrigger value="waitingList">{t("profile.tabs.waitingList")}</TabsTrigger>
              <TabsTrigger value="vehicles">{t("profile.tabs.vehicles")}</TabsTrigger>
              <TabsTrigger value="appSettings">{t("profile.tabs.appSettings")}</TabsTrigger>
            </TabsList>
            
            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingPreferences ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-sm text-muted-foreground">Loading preferences...</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <Label>Email Notifications</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Receive booking confirmations and updates via email
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
                        <>
                          <Separator />
                          <div className="space-y-4 pl-6">
                            <h4 className="font-medium text-sm text-muted-foreground">Email Notification Types</h4>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="booking-confirmations">Booking Confirmations</Label>
                                <Switch 
                                  id="booking-confirmations" 
                                  checked={notificationPreferences?.bookingConfirmations ?? true}
                                  onCheckedChange={(checked) => handlePreferenceChange({ bookingConfirmations: checked })}
                                  data-testid="switch-booking-confirmations"
                                  disabled={updateNotificationPreferencesMutation.isPending}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="payment-reminders">Payment Reminders</Label>
                                <Switch 
                                  id="payment-reminders" 
                                  checked={notificationPreferences?.paymentReminders ?? true}
                                  onCheckedChange={(checked) => handlePreferenceChange({ paymentReminders: checked })}
                                  data-testid="switch-payment-reminders"
                                  disabled={updateNotificationPreferencesMutation.isPending}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="spot-availability">Spot Availability Updates</Label>
                                <Switch 
                                  id="spot-availability" 
                                  checked={notificationPreferences?.spotAvailability ?? true}
                                  onCheckedChange={(checked) => handlePreferenceChange({ spotAvailability: checked })}
                                  data-testid="switch-spot-availability"
                                  disabled={updateNotificationPreferencesMutation.isPending}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="weekly-reports">Weekly Summary Reports</Label>
                                <Switch 
                                  id="weekly-reports" 
                                  checked={notificationPreferences?.weeklyReports ?? true}
                                  onCheckedChange={(checked) => handlePreferenceChange({ weeklyReports: checked })}
                                  data-testid="switch-weekly-reports"
                                  disabled={updateNotificationPreferencesMutation.isPending}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="system-maintenance">System Maintenance Alerts</Label>
                                <Switch 
                                  id="system-maintenance" 
                                  checked={notificationPreferences?.systemMaintenance ?? true}
                                  onCheckedChange={(checked) => handlePreferenceChange({ systemMaintenance: checked })}
                                  data-testid="switch-system-maintenance"
                                  disabled={updateNotificationPreferencesMutation.isPending}
                                />
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditVehicle(vehicle)}
                                data-testid={`button-edit-vehicle-${vehicle.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteVehicle(vehicle)}
                                data-testid={`button-delete-vehicle-${vehicle.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">{t("appSettings.language.english")}</SelectItem>
                          <SelectItem value="fr">{t("appSettings.language.french")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("appSettings.theme")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t("appSettings.theme.description")}
                        </p>
                      </div>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">{t("appSettings.theme.light")}</SelectItem>
                          <SelectItem value="dark">{t("appSettings.theme.dark")}</SelectItem>
                          <SelectItem value="system">{t("appSettings.theme.system")}</SelectItem>
                        </SelectContent>
                      </Select>
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
                                <p>Enter vehicle manufacturer</p>
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
                                <p>Enter vehicle model</p>
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
                                <p>Enter vehicle year (1990 or later)</p>
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
                                <p>Enter license plate number</p>
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
                              <p>Enter vehicle color (optional)</p>
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
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              data-testid="switch-vehicle-electric"
                            />
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
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              data-testid="switch-vehicle-default"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddVehicleDialog(false)}>
                      {t("vehicles.cancel")}
                    </Button>
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
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Profile Visibility</Label>
                        <p className="text-sm text-muted-foreground">
                          Who can see your profile information
                        </p>
                      </div>
                      <Select defaultValue="colleagues">
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="colleagues">BCI Employees Only</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Contact Information Sharing</Label>
                        <p className="text-sm text-muted-foreground">
                          Share your contact info with spot owners/renters
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Booking History Visibility</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow others to see your booking statistics
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Security Settings</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <Badge variant="outline">Not Enabled</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      <Key className="h-4 w-4 mr-2" />
                      Enable Two-Factor Authentication
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Login Activity</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Last login: January 15, 2024 at 9:30 AM (Current session)</p>
                      <p>Previous login: January 14, 2024 at 8:15 AM</p>
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
                Parking Waiting List
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingWaitingList ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm">Loading...</span>
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
                              You're on the list!
                            </h4>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              Priority: {priorityLevels[waitingListEntry?.priority?.toString() as keyof typeof priorityLevels]?.label}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p><strong>Spot Type:</strong> {waitingListEntry?.preferredSpotType}</p>
                        <p><strong>Building:</strong> {waitingListEntry?.preferredBuilding}</p>
                      </div>
                      <div className="flex gap-1">
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
                          Edit
                        </Button>
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
                          Leave
                        </Button>
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
                            Edit Waiting List Preferences
                          </h4>
                        </div>
                        
                        <FormField
                          control={waitingListForm.control}
                          name="preferredSpotType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Preferred Spot Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select spot type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="regular">Regular</SelectItem>
                                  <SelectItem value="electric">Electric</SelectItem>
                                  <SelectItem value="accessible">Accessible</SelectItem>
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
                              <FormLabel className="text-xs">Preferred Building</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select building" />
                                  </SelectTrigger>
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
                              <FormLabel className="text-xs">Priority Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
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
                              <FormLabel className="text-xs">Reason (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Brief reason for parking need..."
                                  className="resize-none h-16 text-xs"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-2">
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            className="text-xs flex-1"
                            onClick={() => setEditWaitingListMode(false)}
                            data-testid="button-cancel-edit-waiting-list"
                          >
                            Cancel
                          </Button>
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
                            Save Changes
                          </Button>
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
                          Join the Waiting List
                        </h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Get notified when spots become available.
                        </p>
                      </div>
                    </div>
                  </div>
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
                  >
                    {createWaitingListMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Join List
                  </Button>
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
              Edit Profile
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
                <Button variant="outline" size="sm">
                  Change Photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max size 2MB.
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" defaultValue={user?.name} />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" defaultValue={user?.email} disabled />
                <p className="text-xs text-muted-foreground mt-1">
                  Contact IT to change your email address
                </p>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" defaultValue={user?.phone || "(555) 000-0000"} />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" defaultValue={user?.department || "Unknown"} disabled />
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">Bio (Optional)</Label>
              <Textarea 
                id="bio" 
                placeholder="Tell others about yourself..."
                className="mt-1"
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
