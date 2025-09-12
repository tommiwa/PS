import { useState } from "react"
import { useLocation } from "wouter"
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
import { useToast } from "@/hooks/use-toast"
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
  XCircle
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"

export default function Profile() {
  const { user, isOwner, isRenter } = useAuth()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  
  // State for various settings
  const [darkMode, setDarkMode] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("notifications")
  const [isEnrolledInWaitingList, setIsEnrolledInWaitingList] = useState(false)
  const [availabilityAlertsEnabled, setAvailabilityAlertsEnabled] = useState(false)

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
    name: user.name,
    email: user.email,
    phone: user.phone || "(555) 000-0000",
    department: user.department || "Unknown",
    role: user.role,
    vehicleInfo: {
      make: "Tesla",
      model: "Model 3", 
      licensePlate: "ABC-123"
    },
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

  const handleDeleteAccount = () => {
    console.log('Delete account request')
    // Show confirmation dialog for account deletion
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
          <UserProfileCard user={userProfile} onEditProfile={handleEditProfile} />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
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
                  {getInitials(user.name)}
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