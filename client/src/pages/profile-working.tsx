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
  Globe
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { useLanguage } from "@/contexts/language-context"
import type { Vehicle, WaitingList, NotificationPreferences, UpdateNotificationPreferences, PaymentPreferences, UpdatePaymentPreferences, ParkingSpot } from "@shared/schema"
import { insertPaymentPreferencesSchema } from "@shared/schema"

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

// Payment preferences form validation schema - use shared schema
const paymentPreferencesSchema = insertPaymentPreferencesSchema;

// Profile edit form validation schema
const profileEditSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  department: z.string().min(1, "Department is required")
});

type VehicleForm = z.infer<typeof vehicleSchema>;
type PaymentPreferencesForm = z.infer<typeof paymentPreferencesSchema>;
type ProfileEditForm = z.infer<typeof profileEditSchema>;

export default function Profile() {
  const { user, isOwner, isRenter, isAdmin } = useAuth()
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
      department: ""
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
    mutationFn: async () => {
      if (!user) throw new Error("User not found");
      const response = await apiRequest(`/api/waiting-list`, { 
        method: 'POST' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user?.id] });
      toast({
        title: "Joined Waiting List",
        description: "You've been successfully added to the parking waiting list.",
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
      licensePlate: vehicle.licensePlate,
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

  const handleJoinWaitingList = () => {
    createWaitingListMutation.mutate();
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
      department: user?.department || ""
    });
    setShowProfileEditDrawer(true);
  };

  const handleSubmitProfile = (data: ProfileEditForm) => {
    // Split name into firstName and lastName for backend
    const nameParts = data.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const backendData = {
      firstName,
      lastName,
      email: data.email,
      phone: data.phone,
      department: data.department
    };
    
    updateProfileMutation.mutate(backendData);
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{user?.name || "Profile"}</h1>
              <p className="text-sm text-muted-foreground">Manage your account settings</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9"
                data-testid="button-theme-toggle"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Mobile First */}
      <div className="container mx-auto px-4 pb-8">
        {/* User Profile Summary */}
        <div className="py-6">
          <UserProfileCard 
            user={{
              id: user?.id || "",
              name: user?.name || "",
              email: user?.email || "",
              phone: user?.phone || "",
              department: user?.department || "",
              role: user?.role || "renter",
              assignedSpots: assignedSpots,
              memberSince: new Date().getFullYear().toString()
            }}
            onEditProfile={handleEditProfile}
            showEditButton={true}
          />
        </div>

        {/* Mobile Accordion Layout */}
        <div className="md:hidden">
          <Accordion type="multiple" className="space-y-4" defaultValue={["waiting-list"]}>
            
            {/* Waiting List Section */}
            <AccordionItem value="waiting-list" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-medium">Parking Waiting List</h3>
                    <p className="text-sm text-muted-foreground">
                      {isLoadingWaitingList ? "Loading..." : 
                       waitingListEntry ? `Enrolled • Priority ${waitingListEntry.priority}` : 
                       "Not enrolled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {waitingListEntry && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
                {isLoadingWaitingList ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !waitingListEntry ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">Join the waiting list to be notified when parking spots become available.</p>
                    <Button 
                      className="w-full h-12" 
                      onClick={handleJoinWaitingList}
                      disabled={createWaitingListMutation.isPending}
                      data-testid="button-join-waiting-list"
                    >
                      {createWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Join Waiting List
                    </Button>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-medium text-green-900 dark:text-green-100">
                          Successfully Enrolled
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Priority: {waitingListEntry.priority} • Enrolled: {waitingListEntry.enrolledDate ? new Date(waitingListEntry.enrolledDate).toLocaleDateString() : 'N/A'}
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
                          Leave Waiting List
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Payment Preferences Section */}
          <AccordionItem value="payment-preferences" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-medium">Payment Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      {isLoadingPaymentPreferences ? "Loading..." : 
                       paymentPreferences ? 
                       `${paymentPreferences.paymentType === "interac_transfer" ? "Interac Transfer" : "Cash"}` : 
                       "Not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {paymentPreferences && (
                    <Badge variant="outline">
                      {paymentPreferences.paymentType === "interac_transfer" ? "Interac" : "Cash"}
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set your preferred payment method for when others book your parking spots.
                </p>
{/* Mobile Payment Form - Always Drawer in accordion */}
                <Drawer open={showPaymentPreferencesDrawer} onOpenChange={setShowPaymentPreferencesDrawer}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" className="w-full h-12" data-testid="button-edit-payment-preferences">
                      <CreditCard className="h-4 w-4 mr-2" />
                      {paymentPreferences ? "Update Payment Preferences" : "Set Payment Preferences"}
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Payment Preferences</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4">
                      <Form {...paymentForm}>
                        <form onSubmit={paymentForm.handleSubmit(handleSubmitPaymentPreferences)} className="space-y-4">
                          <FormField
                            control={paymentForm.control}
                            name="paymentType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Payment Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                    placeholder="Enter payment instructions (e.g., email for Interac transfer, meeting location for cash, etc.)"
                                    className="resize-none"
                                    rows={3}
                                    {...field}
                                    value={field.value || ''}
                                    data-testid="textarea-payment-instructions"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </form>
                      </Form>
                    </div>
                    <DrawerFooter>
                      <Button 
                        onClick={paymentForm.handleSubmit(handleSubmitPaymentPreferences)}
                        disabled={updatePaymentPreferencesMutation.isPending}
                        className="w-full h-12"
                        data-testid="button-save-payment-preferences"
                      >
                        {updatePaymentPreferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Preferences
                      </Button>
                      <DrawerClose asChild>
                        <Button variant="outline" className="w-full h-12">Cancel</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          {/* Vehicles Section */}
          <AccordionItem value="vehicles" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-medium">My Vehicles</h3>
                    <p className="text-sm text-muted-foreground">
                      {isLoadingVehicles ? "Loading..." : 
                       userVehicles?.length ? `${userVehicles.length} vehicle${userVehicles.length > 1 ? 's' : ''} registered` : 
                       "No vehicles added"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userVehicles?.length && (
                    <Badge variant="outline">{userVehicles.length}</Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
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
                                {vehicle.licensePlate} {vehicle.color && `• ${vehicle.color}`}
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
            <AccordionTrigger className="hover:no-underline py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-medium">Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      {isLoadingPreferences ? "Loading..." : 
                       notificationPreferences?.emailNotifications ? "Email notifications enabled" : 
                       "Email notifications disabled"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notificationPreferences?.emailNotifications && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      On
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
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

          {/* App Settings Section */}
          <AccordionItem value="app-settings" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <h3 className="font-medium">App Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Theme: {theme} • Language: {language === 'en' ? 'English' : 'Français'}
                    </p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      <Label>Theme</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred theme
                    </p>
                  </div>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-32" data-testid="select-theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <Label>Language</Label>
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
            </AccordionContent>
          </AccordionItem>
          
          </Accordion>
        </div>

        {/* Desktop Tabs Layout */}
        <div className="hidden md:block">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="waiting-list" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Waiting List
              </TabsTrigger>
              <TabsTrigger value="payment-preferences" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicles
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="app-settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Waiting List Tab */}
            <TabsContent value="waiting-list" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Parking Waiting List
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Join the waiting list to be notified when parking spots become available.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingWaitingList ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : !waitingListEntry ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">Join the waiting list to be notified when parking spots become available.</p>
                      <Button 
                        className="w-full h-12" 
                        onClick={handleJoinWaitingList}
                        disabled={createWaitingListMutation.isPending}
                        data-testid="button-join-waiting-list"
                      >
                        {createWaitingListMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Join Waiting List
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="font-medium text-green-900 dark:text-green-100">
                            Successfully Enrolled
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Priority: {waitingListEntry.priority} • Enrolled: {waitingListEntry.enrolledDate ? new Date(waitingListEntry.enrolledDate).toLocaleDateString() : 'N/A'}
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
                            Leave Waiting List
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Preferences Tab */}
            <TabsContent value="payment-preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Preferences
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Set your preferred payment method for when others book your parking spots.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingPaymentPreferences ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
{/* Desktop Payment Form - Dialog */}
                      <Dialog open={showPaymentPreferencesDrawer} onOpenChange={setShowPaymentPreferencesDrawer}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full h-12" data-testid="button-edit-payment-preferences-desktop">
                            <CreditCard className="h-4 w-4 mr-2" />
                            {paymentPreferences ? "Update Payment Preferences" : "Set Payment Preferences"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl">Payment Preferences</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <Form {...paymentForm}>
                              <form onSubmit={paymentForm.handleSubmit(handleSubmitPaymentPreferences)} className="space-y-6">
                                <FormField
                                  control={paymentForm.control}
                                  name="paymentType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">Payment Type</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="h-11" data-testid="select-payment-type-desktop">
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
                                      <FormLabel className="text-sm font-medium">Payment Instructions</FormLabel>
                                      <FormControl>
                                        <Textarea 
                                          placeholder="Enter payment instructions (e.g., email for Interac transfer, meeting location for cash, etc.)"
                                          className="resize-none min-h-24"
                                          rows={4}
                                          {...field}
                                          value={field.value || ''}
                                          data-testid="textarea-payment-instructions-desktop"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                      <div className="text-xs text-muted-foreground mt-2">
                                        <p>Examples:</p>
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                          <li>Interac: "Send to email@example.com"</li>
                                          <li>Cash: "Meet at Building A lobby"</li>
                                        </ul>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              </form>
                            </Form>
                          </div>
                          <DialogFooter className="gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowPaymentPreferencesDrawer(false)}
                              className="h-11"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={paymentForm.handleSubmit(handleSubmitPaymentPreferences)}
                              disabled={updatePaymentPreferencesMutation.isPending}
                              className="h-11"
                              data-testid="button-save-payment-preferences-desktop"
                            >
                              {updatePaymentPreferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Save Preferences
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      {paymentPreferences && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Payment Type:</span>
                              <Badge variant="outline">
                                {paymentPreferences.paymentType === "interac_transfer" ? "Interac Transfer" : "Cash"}
                              </Badge>
                            </div>
                            {paymentPreferences.paymentInstructions && (
                              <div className="space-y-1">
                                <span className="text-sm font-medium">Instructions:</span>
                                <p className="text-sm text-muted-foreground">{paymentPreferences.paymentInstructions}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
                      <Car className="h-5 w-5" />
                      My Vehicles
                    </CardTitle>
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
                              <form onSubmit={vehicleForm.handleSubmit(handleSubmitVehicle)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={vehicleForm.control}
                                    name="make"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Make</FormLabel>
                                        <FormControl>
                                          <Input placeholder="e.g., Toyota" {...field} data-testid="input-vehicle-make" />
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
                                          <Input placeholder="e.g., Camry" {...field} data-testid="input-vehicle-model" />
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
                                        <FormLabel>Year</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
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
                                          <Input placeholder="e.g., Blue" {...field} data-testid="input-vehicle-color" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <FormField
                                  control={vehicleForm.control}
                                  name="licensePlate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>License Plate</FormLabel>
                                      <FormControl>
                                        <Input placeholder="e.g., ABC-123" {...field} data-testid="input-vehicle-license" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
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
                          <Button data-testid="button-add-vehicle-desktop">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Vehicle
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl">{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <Form {...vehicleForm}>
                              <form onSubmit={vehicleForm.handleSubmit(handleSubmitVehicle)} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
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
                                <div className="grid grid-cols-2 gap-6">
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
                                <FormField
                                  control={vehicleForm.control}
                                  name="licensePlate"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">License Plate</FormLabel>
                                      <FormControl>
                                        <Input 
                                          placeholder="e.g., ABC-123" 
                                          {...field} 
                                          className="h-11"
                                          data-testid="input-vehicle-license-desktop" 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
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
                          <DialogFooter className="gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowAddVehicleDrawer(false)}
                              className="h-11"
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={vehicleForm.handleSubmit(handleSubmitVehicle)}
                              disabled={addVehicleMutation.isPending}
                              className="h-11"
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
                <CardContent>
                  {isLoadingVehicles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : userVehicles?.length === 0 ? (
                    <div className="text-center py-8">
                      <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No vehicles added</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add your vehicle information to complete your parking profile.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
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
                                    {vehicle.licensePlate} {vehicle.color && `• ${vehicle.color}`}
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
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* App Settings Tab */}
            <TabsContent value="app-settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    App Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          <Label>Theme</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Choose your preferred theme
                        </p>
                      </div>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-32" data-testid="select-theme">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <Label>Language</Label>
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
            <DrawerTitle>Edit Profile</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleSubmitProfile)} className="space-y-6">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} data-testid="input-profile-name" />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" {...field} data-testid="input-profile-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your phone number" {...field} data-testid="input-profile-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your department" {...field} data-testid="input-profile-department" />
                      </FormControl>
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
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" data-testid="button-cancel-profile">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
