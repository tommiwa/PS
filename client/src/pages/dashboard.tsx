import { DashboardStats } from "@/components/dashboard-stats"
import { BookingCard } from "@/components/booking-card"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, MapPin, Clock, Plus, Users, Car, TrendingUp, BarChart3, PieChart, Target, DollarSign, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

interface DashboardProps {
  userRole?: "admin" | "owner" | "renter"
}

export default function Dashboard({ userRole = "owner" }: DashboardProps) {
  const { getCurrentViewRole } = useAuth();
  
  // Use current view role for admins, otherwise use the actual user role
  const effectiveRole = getCurrentViewRole() || userRole;
  //todo: remove mock functionality
  const mockUpcomingBookings = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-01-16",
      startTime: "8:00 AM",
      endTime: "6:00 PM",
      price: 25,
      status: "confirmed" as const,
      paymentStatus: "received" as const,
      owner: "Sarah Chen",
      canCancel: true,
      canEdit: false
    },
    {
      id: "B-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      date: "2024-01-17",
      startTime: "9:00 AM",
      endTime: "5:00 PM",
      price: 20,
      status: "confirmed" as const,
      paymentStatus: "sent" as const,
      owner: "Mike Johnson",
      canCancel: true,
      canEdit: true
    }
  ]

  const mockAvailableSpots = [
    {
      id: "P-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      type: "regular" as const,
      isInside: false,
      price: 15,
      availability: {
        date: "2024-01-18",
        startTime: "7:00 AM",
        endTime: "7:00 PM"
      },
      owner: "Lisa Anderson",
      isAvailable: true
    },
    {
      id: "P-004",
      spotNumber: "A-22",
      location: "Main Building - Level 1",
      type: "accessible" as const,
      isInside: true,
      price: 30,
      availability: {
        date: "2024-01-18",
        startTime: "8:00 AM",
        endTime: "6:00 PM"
      },
      owner: "David Park",
      isAvailable: true
    }
  ]


  const renderRoleSpecificContent = () => {
    switch (effectiveRole) {
      case "renter":
        return (
          <div className="space-y-6">
            {/* Spending Analytics */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Spending Analytics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Monthly Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>This Month</span>
                        <span className="font-medium">$75</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Last Month</span>
                        <span className="font-medium">$95</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Savings</span>
                        <span className="font-medium text-green-600">$20</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Cost Per Booking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$25</div>
                    <div className="text-xs text-muted-foreground">Average this month</div>
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        15% below company average
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Budget Goal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Used: $75</span>
                        <span className="text-sm">Budget: $100</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <div className="text-xs text-green-600">$25 remaining this month</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Location & Usage Patterns */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Usage Patterns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Favorite Locations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Main Building</div>
                          <div className="text-xs text-muted-foreground">Level 2 - Indoor</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">67%</div>
                          <div className="text-xs text-muted-foreground">15 bookings</div>
                        </div>
                      </div>
                      <Progress value={67} className="h-2" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">North Parking Lot</div>
                          <div className="text-xs text-muted-foreground">Outdoor - Budget</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">33%</div>
                          <div className="text-xs text-muted-foreground">8 bookings</div>
                        </div>
                      </div>
                      <Progress value={33} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Peak Booking Times
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Morning (7-9 AM)</span>
                        <Badge variant="default">Most Active</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Afternoon (12-2 PM)</span>
                        <Badge variant="secondary">Moderate</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Evening (5-7 PM)</span>
                        <Badge variant="outline">Light</Badge>
                      </div>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        💡 Book 2+ days ahead for 20% better rates
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Booking Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <PieChart className="h-4 w-4" />
                      Success Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">94%</div>
                    <div className="text-xs text-muted-foreground">Bookings completed</div>
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs text-green-600">
                        Above average
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Advance Planning
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2.3</div>
                    <div className="text-xs text-muted-foreground">Days average notice</div>
                    <div className="mt-2 text-xs text-blue-600">
                      Great for getting preferred spots!
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Wait List Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-blue-600">Active</div>
                    <div className="text-xs text-muted-foreground">Position #12 for Main Building</div>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        Avg 3-day wait
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Quick Insights */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Insights & Recommendations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-green-700">Smart Savings</div>
                        <div className="text-sm text-muted-foreground">
                          You've saved $45 this month by booking outdoor spots during off-peak times.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-blue-700">Booking Tip</div>
                        <div className="text-sm text-muted-foreground">
                          Tuesday mornings have the highest spot availability at your preferred location.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )
        
      case "owner":
        return (
          <div className="space-y-6">
            {/* Owner's Rental Business Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Spots - Recent Bookings</h2>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  List Availability
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockUpcomingBookings.map((booking) => (
                  <BookingCard 
                    key={booking.id} 
                    booking={booking} 
                    showRenterInfo={true}
                  />
                ))}
              </div>
            </div>
            
            {/* Owner Quick Actions */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Spot Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">List Spot</h3>
                    <p className="text-sm text-muted-foreground">Make your spot available</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">Set Recurring</h3>
                    <p className="text-sm text-muted-foreground">Weekly availability</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">Manage Spots</h3>
                    <p className="text-sm text-muted-foreground">Edit spot details</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Renter Functionality for Owners */}
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Car className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Your Bookings - When You Need Parking</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Your Upcoming Bookings</h3>
                    <Button size="sm" variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mockUpcomingBookings.slice(0, 2).map((booking) => (
                      <BookingCard key={`renter-${booking.id}`} booking={booking} />
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Available Spots to Book</h3>
                    <Button size="sm" variant="outline">
                      <MapPin className="h-4 w-4 mr-2" />
                      Search All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mockAvailableSpots.map((spot) => (
                      <ParkingSpotCard key={spot.id} spot={spot} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
        
      case "admin":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Today's Occupancy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">89/150</div>
                  <p className="text-xs text-green-600">59% utilization</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-xs text-yellow-600">Require attention</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$1,890</div>
                  <p className="text-xs text-green-600">+12% vs yesterday</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    New Registrations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">7</div>
                  <p className="text-xs text-muted-foreground">This week</p>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Users className="h-6 w-6" />
                  Manage Users
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Car className="h-6 w-6" />
                  Assign Spots
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Clock className="h-6 w-6" />
                  View Reports
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <MapPin className="h-6 w-6" />
                  Generate Report
                </Button>
              </div>
            </div>
          </div>
        )
        
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {userRole === "admin" ? "Dashboard" : "Statistics"}
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your parking.
          </p>
        </div>
      </div>
      
      <DashboardStats userRole={userRole} />
      
      {renderRoleSpecificContent()}
    </div>
  )
}