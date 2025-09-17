import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Car, Calendar, Clock, Users, TrendingUp, MapPin } from "lucide-react"
import { UserRole } from "@shared/schema"

export interface DashboardStat {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

interface DashboardStatsProps {
  userRole: UserRole
}

export function DashboardStats({ userRole }: DashboardStatsProps) {
  // Helper function to create colorful icons with backgrounds
  const createColorfulIcon = (IconComponent: React.ComponentType<any>, bgColor: string, iconColor: string = "text-white") => (
    <div className={`${bgColor} ${iconColor} rounded-lg p-2 w-10 h-10 flex items-center justify-center`}>
      <IconComponent className="h-5 w-5" />
    </div>
  )

  // Mock data - in real app this would come from API
  const getStatsForRole = () => {
    switch (userRole) {
      case "admin":
        return [
          {
            title: "Total Spots",
            value: 150,
            icon: createColorfulIcon(Car, "bg-blue-500"),
            description: "Across 4 locations",
            trend: { value: 0, isPositive: true }
          },
          {
            title: "Active Users",
            value: 1000,
            icon: createColorfulIcon(Users, "bg-green-500"),
            description: "Registered employees",
            trend: { value: 5, isPositive: true }
          },
          {
            title: "Today's Bookings",
            value: 89,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: "59% occupancy",
            trend: { value: 12, isPositive: true }
          },
          {
            title: "Revenue This Month",
            value: "$12,340",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "From spot rentals",
            trend: { value: 18, isPositive: true }
          }
        ]
      case "owner":
        return [
          {
            title: "My Spots",
            value: 2,
            icon: createColorfulIcon(Car, "bg-blue-500"),
            description: "Owned parking spots"
          },
          {
            title: "This Month's Earnings",
            value: "$450",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "18 bookings",
            trend: { value: 15, isPositive: true }
          },
          {
            title: "Upcoming Bookings",
            value: 6,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: "Next 7 days"
          },
          {
            title: "Availability Listed",
            value: "85%",
            icon: createColorfulIcon(Clock, "bg-yellow-500"),
            description: "This month"
          }
        ]
      case "renter":
        return [
          {
            title: "Active Bookings",
            value: 3,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: "Confirmed reservations"
          },
          {
            title: "This Month Spent",
            value: "$75",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "3 bookings"
          },
          {
            title: "Favorite Locations",
            value: 2,
            icon: createColorfulIcon(MapPin, "bg-red-500"),
            description: "Saved preferences"
          },
          {
            title: "Booking History",
            value: 23,
            icon: createColorfulIcon(Clock, "bg-yellow-500"),
            description: "Total bookings"
          }
        ]
      default:
        return []
    }
  }

  const stats = getStatsForRole()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
      {stats.map((stat, index) => (
        <Card key={index} className="hover-elevate" data-testid={`stat-card-${index}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div>
              {stat.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`stat-value-${index}`}>
              {stat.value}
            </div>
            {stat.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            )}
            {stat.trend && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${
                stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className={`h-3 w-3 ${!stat.trend.isPositive ? 'rotate-180' : ''}`} />
                {stat.trend.isPositive ? '+' : '-'}{Math.abs(stat.trend.value)}% from last month
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}