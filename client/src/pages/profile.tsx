import { UserProfileCard } from "@/components/user-profile-card"
import { BookingCard } from "@/components/booking-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Car, Clock, Settings, Bell, Shield } from "lucide-react"

export default function Profile() {
  //todo: remove mock functionality
  const mockUser = {
    id: "user-001",
    name: "Sarah Chen",
    email: "sarah.chen@bci.com",
    phone: "(555) 123-4567",
    department: "Engineering",
    role: "owner" as const,
    vehicleInfo: {
      make: "Tesla",
      model: "Model 3",
      licensePlate: "ABC-123"
    },
    spotCount: 2,
    memberSince: "January 2023"
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
          <UserProfileCard user={mockUser} />
          
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
                    Recent Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockBookingHistory.map((booking) => (
                      <BookingCard 
                        key={booking.id} 
                        booking={booking}
                        showRenterInfo={true}
                        showBookButton={false}
                      />
                    ))}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Waitlist Updates</h4>
                      <p className="text-sm text-muted-foreground">Updates on your waitlist position</p>
                    </div>
                    <Badge variant="outline">Disabled</Badge>
                  </div>
                  <Button className="w-full">Update Preferences</Button>
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
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Car className="h-4 w-4 mr-2" />
                Update Vehicle Info
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notification Settings
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm">
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