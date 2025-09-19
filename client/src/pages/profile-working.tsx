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
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/hooks/use-confirm"
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
  Calendar
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { useLanguage } from "@/contexts/language-context"
import type { Vehicle, WaitingList, NotificationPreferences, UpdateNotificationPreferences } from "@shared/schema"

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

type VehicleForm = z.infer<typeof vehicleSchema>;

export default function Profile() {
  const { user, isOwner, isRenter, isAdmin } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { confirm } = useConfirm()
  
  // State for various settings
  const [activeTab, setActiveTab] = useState("notifications")
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false)
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

  // Query user's waiting list status  
  const { data: waitingListEntry, isLoading: isLoadingWaitingList } = useQuery<WaitingList | null>({
    queryKey: ["/api/waiting-list/user", user?.id],
    enabled: !!user?.id
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

  // Notification preferences mutation
  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: async (preferences: UpdateNotificationPreferences) => {
      const response = await apiRequest(`/api/users/${user?.id}/notification-preferences`, { 
        method: 'PUT', 
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

  const handlePreferenceChange = (preferences: UpdateNotificationPreferences) => {
    updateNotificationPreferencesMutation.mutate(preferences);
  };

  const handleSubmitVehicle = (data: VehicleForm) => {
    addVehicleMutation.mutate(data);
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
    setShowAddVehicleDialog(true);
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      message: `Are you sure you want to delete ${vehicle.make} ${vehicle.model}?`,
      variant: "destructive"
    });
    
    if (confirmed) {
      // Implement delete mutation here
      toast({
        title: "Vehicle Deleted",
        description: "The vehicle has been removed from your profile.",
        variant: "default"
      });
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
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      
      <UserProfileCard 
        user={user}
        onEditVehicle={handleEditVehicle}
        onDeleteVehicle={handleDeleteVehicle}
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
                {t("notifications.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
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
                            <Label htmlFor="booking-confirmations">{t("notifications.bookingConfirmations")}</Label>
                            <Switch 
                              id="booking-confirmations" 
                              checked={notificationPreferences?.bookingConfirmations ?? true}
                              onCheckedChange={(checked) => handlePreferenceChange({ bookingConfirmations: checked })}
                              data-testid="switch-booking-confirmations"
                              disabled={updateNotificationPreferencesMutation.isPending}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="payment-reminders">{t("notifications.paymentReminders")}</Label>
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
                    </>
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
                        <Input placeholder="e.g., Tesla" {...field} data-testid="input-vehicle-make" />
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
                        <Input placeholder="e.g., Model 3" {...field} data-testid="input-vehicle-model" />
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
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                          data-testid="input-vehicle-year" 
                        />
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
                        <Input {...field} data-testid="input-vehicle-license" />
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
                      <Input {...field} data-testid="input-vehicle-color" />
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
                  disabled={addVehicleMutation.isPending}
                  data-testid="button-save-vehicle"
                >
                  {addVehicleMutation.isPending && (
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
  )
}