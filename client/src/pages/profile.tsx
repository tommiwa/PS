import { UserProfileCard } from "@/components/user-profile-card"
import { BookingCard } from "@/components/booking-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Car, Clock, Settings, Bell, Shield, MapPin, DollarSign, Star, Users } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function Profile() {
  const { user, isOwner, isRenter } = useAuth()

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

  const mockBookingHistory = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-01-10",
      startTime: "8:00 AM",
      endTime: "6:00 PM",
      price: 25,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      renter: "Mike Johnson",
      canCancel: false,
      canEdit: false
    },
    {
      id: "B-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      date: "2024-01-12",
      startTime: "9:00 AM",
      endTime: "5:00 PM",
      price: 20,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      renter: "Lisa Anderson",
      canCancel: false,
      canEdit: false
    }
  ]

  return (
    <div className="p-6 space-y-6" data-testid="page-profile">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings and view your activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <UserProfileCard user={userProfile} />
          
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bookings">Booking History</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="bookings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {isRenter() ? "My Booking History" : "Recent Spot Rentals"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isRenter() && (
                      <div className="text-sm text-muted-foreground mb-4">
                        Track your parking bookings and history. Your most recent bookings are shown below.
                      </div>
                    )}
                    {isOwner() && (
                      <div className="text-sm text-muted-foreground mb-4">
                        Recent rentals of your parking spots. View who booked your spots and earnings.
                      </div>
                    )}
                    
                    {mockBookingHistory.map((booking) => (
                      <BookingCard 
                        key={booking.id} 
                        booking={booking}
                        showRenterInfo={isOwner()}
                      />
                    ))}
                    
                    {mockBookingHistory.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        {isRenter() ? "No bookings yet. Start by searching for available spots!" : "No rentals yet. Consider listing your spots when available."}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Booking Confirmations</h4>
                      <p className="text-sm text-muted-foreground">Get notified when bookings are confirmed</p>
                    </div>
                    <Badge variant="default">Email + SMS</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Payment Reminders</h4>
                      <p className="text-sm text-muted-foreground">Reminders for pending payments</p>
                    </div>
                    <Badge variant="default">Email</Badge>
                  </div>
                  
                  {isRenter() && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Waiting List Updates</h4>
                          <p className="text-sm text-muted-foreground">Get notified when spots become available from waiting list</p>
                        </div>
                        <Badge variant="secondary">Off</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Preferred Location Alerts</h4>
                          <p className="text-sm text-muted-foreground">Get notified when spots open in your favorite locations</p>
                        </div>
                        <Badge variant="default">Email</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Last-Minute Availability</h4>
                          <p className="text-sm text-muted-foreground">Get notified about same-day spot cancellations</p>
                        </div>
                        <Badge variant="outline">Email</Badge>
                      </div>
                    </>
                  )}
                  
                  {isOwner() && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Spot Availability Alerts</h4>
                          <p className="text-sm text-muted-foreground">Get notified when preferred spots become available</p>
                        </div>
                        <Badge variant="default">Email</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Rental Requests</h4>
                          <p className="text-sm text-muted-foreground">Get notified when someone wants to book your spot</p>
                        </div>
                        <Badge variant="default">Email + SMS</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Earnings Reports</h4>
                          <p className="text-sm text-muted-foreground">Monthly summary of your parking spot earnings</p>
                        </div>
                        <Badge variant="secondary">Email</Badge>
                      </div>
                    </>
                  )}
                  
                  <Button className="w-full" data-testid="button-update-notification-preferences">Update Preferences</Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="privacy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacy & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Sharing</h4>
                    <p className="text-sm text-muted-foreground">
                      Your contact information is only shared with spot owners when you book their spots.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Activity Visibility</h4>
                    <p className="text-sm text-muted-foreground">
                      Your booking history is private and only visible to you and administrators.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Account Security</h4>
                    <p className="text-sm text-muted-foreground">
                      Last login: January 15, 2024 at 9:30 AM
                    </p>
                  </div>
                  <Button variant="outline" className="w-full">Change Password</Button>
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
                    <Badge variant="outline">Not Enrolled</Badge>
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
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-update-vehicle">
                <Car className="h-4 w-4 mr-2" />
                Update Vehicle Info
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-notification-settings">
                <Bell className="h-4 w-4 mr-2" />
                Notification Settings
              </Button>
              
              {isRenter() && (
                <>
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-enroll-waiting-list">
                    <Users className="h-4 w-4 mr-2" />
                    Enroll in Waiting List
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-enable-notifications">
                    <Bell className="h-4 w-4 mr-2" />
                    Availability Alerts
                  </Button>
                </>
              )}
              
              {isOwner() && (
                <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-manage-spots">
                  <MapPin className="h-4 w-4 mr-2" />
                  Manage My Spots
                </Button>
              )}
              
              <Button variant="outline" className="w-full justify-start" size="sm" data-testid="button-download-history">
                <Clock className="h-4 w-4 mr-2" />
                Download History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}