import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Car, 
  Calendar,
  Download,
  Filter,
  AlertCircle,
  Clock
} from "lucide-react"

export default function AdminAnalytics() {
  //todo: remove mock functionality
  const analyticsData = {
    overview: {
      totalRevenue: 45780,
      totalBookings: 1247,
      activeUsers: 863,
      utilizationRate: 78.5,
      averageBookingValue: 36.7,
      monthlyGrowth: 12.3
    },
    revenueData: [
      { month: "Jan", revenue: 3500, bookings: 95 },
      { month: "Feb", revenue: 4200, bookings: 114 },
      { month: "Mar", revenue: 3800, bookings: 103 },
      { month: "Apr", revenue: 4500, bookings: 122 },
      { month: "May", revenue: 5100, bookings: 138 },
      { month: "Jun", revenue: 4800, bookings: 130 },
      { month: "Jul", revenue: 5300, bookings: 144 },
      { month: "Aug", revenue: 5600, bookings: 152 },
      { month: "Sep", revenue: 5200, bookings: 141 },
      { month: "Oct", revenue: 5800, bookings: 157 },
      { month: "Nov", revenue: 6100, bookings: 166 },
      { month: "Dec", revenue: 5980, bookings: 163 }
    ],
    topPerformers: {
      spots: [
        { id: "A-15", location: "Main Building - Level 2", earnings: 1850, utilization: 92 },
        { id: "B-08", location: "North Parking Lot", earnings: 1630, utilization: 87 },
        { id: "C-12", location: "South Parking Lot", earnings: 1420, utilization: 78 },
        { id: "A-22", location: "Main Building - Level 1", earnings: 1380, utilization: 82 },
        { id: "D-05", location: "East Parking Garage", earnings: 1260, utilization: 75 }
      ],
      owners: [
        { name: "Sarah Chen", earnings: 3420, spots: 3, rating: 4.9 },
        { name: "Mike Johnson", earnings: 2890, spots: 2, rating: 4.8 },
        { name: "Lisa Anderson", earnings: 2340, spots: 2, rating: 4.7 },
        { name: "David Park", earnings: 1980, spots: 1, rating: 4.6 },
        { name: "Emma Wilson", earnings: 1750, spots: 1, rating: 4.5 }
      ]
    },
    issues: [
      {
        id: "ISS-001",
        type: "Payment Dispute",
        description: "Booking B-234 payment disputed by renter",
        priority: "high",
        created: "2024-01-15",
        assignee: "Admin Team"
      },
      {
        id: "ISS-002",
        type: "Spot Conflict",
        description: "Double booking reported for spot A-15",
        priority: "critical",
        created: "2024-01-14",
        assignee: "Sarah Chen"
      },
      {
        id: "ISS-003",
        type: "Technical Issue",
        description: "User unable to complete booking payment",
        priority: "medium",
        created: "2024-01-13",
        assignee: "IT Support"
      }
    ]
  }

  const getIssueColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-analytics">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into parking system performance and usage.
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="last-30-days">
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 days</SelectItem>
              <SelectItem value="last-30-days">Last 30 days</SelectItem>
              <SelectItem value="last-3-months">Last 3 months</SelectItem>
              <SelectItem value="last-year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analyticsData.overview.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-green-600">+{analyticsData.overview.monthlyGrowth}% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.overview.totalBookings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.overview.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Monthly active</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Utilization Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.overview.utilizationRate}%</div>
            <p className="text-xs text-green-600">Above target (75%)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Avg Booking Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analyticsData.overview.averageBookingValue}</div>
            <p className="text-xs text-muted-foreground">Per booking</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Growth Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{analyticsData.overview.monthlyGrowth}%</div>
            <p className="text-xs text-green-600">Month over month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="usage">Usage Patterns</TabsTrigger>
          <TabsTrigger value="performance">Top Performers</TabsTrigger>
          <TabsTrigger value="issues">Issues & Alerts</TabsTrigger>
        </TabsList>

        {/* Revenue Analysis */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.revenueData.slice(-6).map((month, index) => (
                    <div key={month.month} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 text-sm font-medium">{month.month}</div>
                        <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary"
                            style={{ width: `${(month.revenue / 6100) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium">${month.revenue.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spot Owner Earnings</span>
                  <span className="font-medium">$32,460 (71%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fees</span>
                  <span className="font-medium">$9,140 (20%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing Fees</span>
                  <span className="font-medium">$2,740 (6%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Revenue</span>
                  <span className="font-medium">$1,440 (3%)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Patterns */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { time: "8:00 AM", usage: 95, label: "Morning Rush" },
                    { time: "12:00 PM", usage: 78, label: "Lunch Break" },
                    { time: "5:00 PM", usage: 88, label: "Evening Rush" },
                    { time: "9:00 PM", usage: 23, label: "Night" }
                  ].map((period) => (
                    <div key={period.time} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{period.time}</div>
                        <div className="text-sm text-muted-foreground">{period.label}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500"
                            style={{ width: `${period.usage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{period.usage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Location Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { location: "Main Building", spots: 45, utilization: 92 },
                    { location: "North Parking Lot", spots: 38, utilization: 78 },
                    { location: "South Parking Lot", spots: 42, utilization: 65 },
                    { location: "East Parking Garage", spots: 25, utilization: 58 }
                  ].map((loc) => (
                    <div key={loc.location} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{loc.location}</div>
                        <div className="text-sm text-muted-foreground">{loc.spots} spots</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500"
                            style={{ width: `${loc.utilization}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{loc.utilization}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Performers */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Spots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.topPerformers.spots.map((spot, index) => (
                    <div key={spot.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div>
                          <div className="font-medium">Spot {spot.id}</div>
                          <div className="text-sm text-muted-foreground">{spot.location}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${spot.earnings}</div>
                        <div className="text-sm text-muted-foreground">{spot.utilization}% utilized</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Earning Owners</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.topPerformers.owners.map((owner, index) => (
                    <div key={owner.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{owner.name}</div>
                          <div className="text-sm text-muted-foreground">{owner.spots} spots • {owner.rating} rating</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${owner.earnings}</div>
                        <div className="text-sm text-muted-foreground">This year</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Issues & Alerts */}
        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Active Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.issues.map((issue) => (
                  <div key={issue.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge className={getIssueColor(issue.priority)}>
                          {issue.priority}
                        </Badge>
                        <div>
                          <div className="font-medium">{issue.type}</div>
                          <div className="text-sm text-muted-foreground">#{issue.id}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Created {issue.created}</div>
                        <div className="text-sm">Assigned to: {issue.assignee}</div>
                      </div>
                    </div>
                    <p className="text-sm">{issue.description}</p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline">View Details</Button>
                      <Button size="sm" variant="outline">Assign</Button>
                      <Button size="sm" variant="outline">Resolve</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}