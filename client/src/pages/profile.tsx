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
  Info
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { spotTypes, type SpotType, type WaitingList, type InsertWaitingList } from "@shared/schema"

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

type WaitingListForm = z.infer<typeof waitingListSchema>;

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
  const { user, isOwner, isRenter } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { confirm } = useConfirm()
  
  // State for various settings
  const [darkMode, setDarkMode] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
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

  // Query user's waiting list status  
  const { data: waitingListEntry, isLoading: isLoadingWaitingList, refetch: refetchWaitingList } = useQuery<WaitingList | null>({
    queryKey: ["/api/waiting-list/user", user?.id],
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
      if (user && emailNotifications) {
        apiRequest("/api/notifications/welcome", { method: 'POST', body: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          waitingListEntry: newEntry,
          preferences: {
            emailNotifications,
            pushNotifications
          }
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
    vehicles: (user as any).vehicles || [],
    spotCount: isOwner() ? 2 : undefined,
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
    setActiveTab("vehicle")
    toast({
      title: "Add Vehicle",
      description: "Go to the Vehicle tab to add a new vehicle to your profile.",
      variant: "default"
    })
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
            onAddVehicle={handleAddVehicle}
          />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
              <TabsTrigger value="waiting-list">Waiting List</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
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
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                        data-testid="switch-email-notifications"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <Label>SMS Notifications</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Get urgent updates and reminders via text message
                        </p>
                      </div>
                      <Switch 
                        checked={smsNotifications}
                        onCheckedChange={setSmsNotifications}
                        data-testid="switch-sms-notifications"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <Label>Push Notifications</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Browser notifications for real-time updates
                        </p>
                      </div>
                      <Switch 
                        checked={pushNotifications}
                        onCheckedChange={setPushNotifications}
                        data-testid="switch-push-notifications"
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Notification Types</h4>
                    <div className="space-y-3">
                      {[
                        { id: "booking-confirmations", label: "Booking Confirmations", enabled: true },
                        { id: "payment-reminders", label: "Payment Reminders", enabled: true },
                        { id: "spot-availability", label: "Spot Availability Updates", enabled: false },
                        { id: "weekly-summary", label: "Weekly Summary Reports", enabled: true },
                        { id: "system-maintenance", label: "System Maintenance Alerts", enabled: true }
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <Label htmlFor={item.id}>{item.label}</Label>
                          <Switch id={item.id} defaultChecked={item.enabled} />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button className="w-full" data-testid="button-update-notification-preferences">
                    Update Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vehicle Settings */}
            <TabsContent value="vehicle" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vehicle-make">Make</Label>
                      <Input id="vehicle-make" placeholder="e.g., Tesla" defaultValue="Tesla" />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-model">Model</Label>
                      <Input id="vehicle-model" placeholder="e.g., Model 3" defaultValue="Model 3" />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-year">Year</Label>
                      <Input id="vehicle-year" placeholder="e.g., 2023" defaultValue="2023" />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-color">Color</Label>
                      <Input id="vehicle-color" placeholder="e.g., White" defaultValue="White" />
                    </div>
                    <div>
                      <Label htmlFor="license-plate">License Plate</Label>
                      <Input id="license-plate" placeholder="e.g., ABC-123" defaultValue="ABC-123" />
                    </div>
                    <div>
                      <Label htmlFor="vehicle-type">Vehicle Type</Label>
                      <Select defaultValue="electric">
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedan">Sedan</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                          <SelectItem value="hatchback">Hatchback</SelectItem>
                          <SelectItem value="truck">Truck</SelectItem>
                          <SelectItem value="electric">Electric Vehicle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="is-electric" defaultChecked />
                    <Label htmlFor="is-electric">Electric Vehicle (requires charging spots)</Label>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button data-testid="button-save-vehicle-info">Save Vehicle Info</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacy & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
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

            {/* Waiting List Tab */}
            <TabsContent value="waiting-list" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5" />
                    Parking Waiting List
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingWaitingList ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading waiting list status...</span>
                    </div>
                  ) : waitingListEntry && waitingListEntry.status === "active" && !editWaitingListMode ? (
                    /* Enrolled State */
                    <div className="space-y-6">
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="font-medium text-green-900 dark:text-green-100">
                              You're on the Waiting List!
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              You'll be notified when a parking spot matching your preferences becomes available.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Enrollment Date</Label>
                            <p className="text-sm font-medium">
                              {waitingListEntry.enrolledDate ? new Date(waitingListEntry.enrolledDate).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Priority Level</Label>
                            <div className="flex items-center gap-2">
                              <Badge variant={waitingListEntry.priority === 1 ? "destructive" : waitingListEntry.priority === 2 ? "default" : "secondary"}>
                                {priorityLevels[waitingListEntry.priority.toString() as keyof typeof priorityLevels]?.label || 'Unknown'}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                            <Badge variant="outline" className="capitalize">
                              {waitingListEntry.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Preferred Spot Type</Label>
                            <div className="flex items-center gap-2">
                              {waitingListEntry.preferredSpotType === 'electric' && <Zap className="h-4 w-4 text-yellow-500" />}
                              {waitingListEntry.preferredSpotType === 'accessible' && <Accessibility className="h-4 w-4 text-blue-500" />}
                              {waitingListEntry.preferredSpotType === 'regular' && <CarIcon className="h-4 w-4 text-gray-500" />}
                              <span className="text-sm font-medium capitalize">
                                {waitingListEntry.preferredSpotType}
                              </span>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Preferred Building</Label>
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{waitingListEntry.preferredBuilding}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Reason for Request</Label>
                        <p className="text-sm mt-1 p-3 bg-muted/30 rounded-md">
                          {waitingListEntry.reason}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setEditWaitingListMode(true);
                            waitingListForm.setValue("preferredSpotType", waitingListEntry.preferredSpotType as "regular" | "electric" | "accessible");
                            waitingListForm.setValue("preferredBuilding", waitingListEntry.preferredBuilding || "");
                            waitingListForm.setValue("priority", waitingListEntry.priority.toString() as "1" | "2" | "3");
                            waitingListForm.setValue("reason", waitingListEntry.reason || "");
                          }}
                          data-testid="button-edit-waiting-list"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Update Preferences
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => cancelWaitingListMutation.mutate()}
                          disabled={cancelWaitingListMutation.isPending}
                          data-testid="button-cancel-waiting-list"
                        >
                          {cancelWaitingListMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Remove from List
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Not Enrolled State or Edit Mode */
                    <div className="space-y-6">
                      {!waitingListEntry && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                                Join the Parking Waiting List
                              </h4>
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                Get notified when parking spots become available that match your preferences.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {editWaitingListMode && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Edit className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="font-medium text-amber-900 dark:text-amber-100">
                                Update Your Preferences
                              </h4>
                              <p className="text-sm text-amber-700 dark:text-amber-300">
                                Modify your waiting list preferences below.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Form {...waitingListForm}>
                        <form onSubmit={waitingListForm.handleSubmit((data) => {
                          if (editWaitingListMode) {
                            updateWaitingListMutation.mutate(data);
                          } else {
                            createWaitingListMutation.mutate(data);
                          }
                        })} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={waitingListForm.control}
                              name="preferredSpotType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Preferred Spot Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-spot-type">
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select spot type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="regular">
                                        <div className="flex items-center gap-2">
                                          <CarIcon className="h-4 w-4 text-gray-500" />
                                          Regular Parking
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="electric">
                                        <div className="flex items-center gap-2">
                                          <Zap className="h-4 w-4 text-yellow-500" />
                                          Electric Vehicle
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="accessible">
                                        <div className="flex items-center gap-2">
                                          <Accessibility className="h-4 w-4 text-blue-500" />
                                          Accessible Parking
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose the type of parking spot you prefer
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={waitingListForm.control}
                              name="preferredBuilding"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Preferred Building</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-building">
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select building" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {buildingOptions.map((building) => (
                                        <SelectItem key={building.value} value={building.value}>
                                          <div className="flex items-center gap-2">
                                            <Building className="h-4 w-4 text-gray-500" />
                                            {building.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Select your preferred building location
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={waitingListForm.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority Level</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-priority">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select priority level" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Object.entries(priorityLevels).map(([value, { label, description }]) => (
                                      <SelectItem key={value} value={value}>
                                        <div className="space-y-1">
                                          <div className="font-medium">{label}</div>
                                          <div className="text-xs text-muted-foreground">{description}</div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Higher priority may result in earlier assignment
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={waitingListForm.control}
                            name="reason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reason for Request</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Please explain why you need parking (e.g., daily commute, medical appointments, etc.)"
                                    className="min-h-[100px] resize-none"
                                    data-testid="textarea-reason"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Provide details about your parking needs (minimum 10 characters)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex gap-2">
                            <Button 
                              type="submit" 
                              disabled={createWaitingListMutation.isPending || updateWaitingListMutation.isPending}
                              data-testid="button-submit-waiting-list"
                            >
                              {(createWaitingListMutation.isPending || updateWaitingListMutation.isPending) ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : editWaitingListMode ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              ) : (
                                <Users className="h-4 w-4 mr-2" />
                              )}
                              {editWaitingListMode ? "Update Preferences" : "Join Waiting List"}
                            </Button>
                            {editWaitingListMode && (
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => {
                                  setEditWaitingListMode(false);
                                  waitingListForm.reset();
                                }}
                                data-testid="button-cancel-edit"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </form>
                      </Form>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Settings */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" onClick={handleChangePassword} className="w-full">
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                  <Button variant="outline" onClick={handleExportData} className="w-full" data-testid="button-download-history">
                    <Download className="h-4 w-4 mr-2" />
                    Download My Data
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Application Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Theme</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred theme
                      </p>
                    </div>
                    <Select value={theme} onValueChange={setTheme} data-testid="select-theme">
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bci">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            BCI Corporate
                          </div>
                        </SelectItem>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Light
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            Dark
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            System
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Language</Label>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred language
                      </p>
                    </div>
                    <Select defaultValue="en">
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <CardHeader>
                  <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-red-700 dark:text-red-300">Delete Account</Label>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAccount}
                    className="w-full"
                    data-testid="button-delete-account"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete My Account
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRenter() && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Bookings Made</span>
                    <span className="font-semibold">18</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Amount Spent</span>
                    <span className="font-semibold">$420</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Favorite Location</span>
                    <span className="font-semibold">Main Building</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Wait List Status</span>
                    <Badge variant={isEnrolledInWaitingList ? "default" : "outline"}>
                      {isEnrolledInWaitingList ? "Enrolled" : "Not Enrolled"}
                    </Badge>
                  </div>
                </>
              )}
              {isOwner() && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Bookings</span>
                    <span className="font-semibold">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Spots Owned</span>
                    <span className="font-semibold">2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">This Month Earnings</span>
                    <span className="font-semibold">$450</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rating</span>
                    <Badge variant="default">4.9/5</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {isRenter() && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Waiting List Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant={isEnrolledInWaitingList ? "default" : "outline"} 
                  className="w-full justify-start" 
                  size="sm" 
                  onClick={handleEnrollWaitingList} 
                  data-testid="button-enroll-waiting-list"
                >
                  <Users className="h-4 w-4 mr-2" />
                  {isEnrolledInWaitingList ? "Leave Waiting List" : "Enroll in Waiting List"}
                </Button>
                <Button 
                  variant={availabilityAlertsEnabled ? "default" : "outline"} 
                  className="w-full justify-start" 
                  size="sm" 
                  onClick={handleAvailabilityAlerts} 
                  data-testid="button-enable-notifications"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {availabilityAlertsEnabled ? "Disable Availability Alerts" : "Enable Availability Alerts"}
                </Button>
              </CardContent>
            </Card>
          )}
          
          {isOwner() && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Spot Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={handleManageSpots} data-testid="button-manage-spots">
                  <MapPin className="h-4 w-4 mr-2" />
                  Manage My Spots
                </Button>
              </CardContent>
            </Card>
          )}
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
                  {getInitials(user.name || 'User')}
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
                <Input id="full-name" defaultValue={user.name} />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" defaultValue={user.email} disabled />
                <p className="text-xs text-muted-foreground mt-1">
                  Contact IT to change your email address
                </p>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" defaultValue={user.phone || "(555) 000-0000"} />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" defaultValue={user.department || "Unknown"} disabled />
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