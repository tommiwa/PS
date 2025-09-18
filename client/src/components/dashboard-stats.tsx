import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Car, Calendar, Clock, Users, TrendingUp, MapPin, AlertTriangle } from "lucide-react"
import { UserRole, DashboardStatsResponse } from "@shared/schema"
import { useQuery } from "@tanstack/react-query"

export interface DashboardStat {
  id: string
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
  onCardClick?: (statId: string) => void
}

export function DashboardStats({ userRole, onCardClick }: DashboardStatsProps) {
  // Fetch real dashboard stats for admin users
  const { 
    data: dashboardStats, 
    isLoading, 
    error 
  } = useQuery<DashboardStatsResponse>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: userRole === "admin", // Only fetch for admin users
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Helper function to format currency consistently
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Helper function to format percentage consistently
  const formatPercentage = (percentage: number): string => {
    return `${percentage}%`;
  }

  // Helper function to create colorful icons with backgrounds
  const createColorfulIcon = (IconComponent: React.ComponentType<any>, bgColor: string, iconColor: string = "text-white") => (
    <div className={`${bgColor} ${iconColor} rounded-lg p-2 w-10 h-10 flex items-center justify-center`}>
      <IconComponent className="h-5 w-5" />
    </div>
  )

  // Get stats based on role and API data
  const getStatsForRole = () => {
    switch (userRole) {
      case "admin":
        if (error) {
          // Return error state stats
          return [
            {
              id: "error-state",
              title: "Data Unavailable",
              value: "--",
              icon: createColorfulIcon(AlertTriangle, "bg-red-500"),
              description: "Error loading stats"
            }
          ];
        }
        
        if (!dashboardStats) {
          // Return empty stats while loading or no data
          return [];
        }
        
        return [
          {
            id: "total-spots",
            title: "Total Spots",
            value: dashboardStats.totalSpots,
            icon: createColorfulIcon(Car, "bg-blue-500"),
            description: `${dashboardStats.allocatedSpots} allocated, ${dashboardStats.availableSpots} available`
          },
          {
            id: "active-users",
            title: "Active Users",
            value: dashboardStats.activeUsers,
            icon: createColorfulIcon(Users, "bg-green-500"),
            description: "Registered employees"
          },
          {
            id: "todays-bookings",
            title: "Today's Bookings",
            value: dashboardStats.todaysBookings,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: `${formatPercentage(dashboardStats.occupancyPercentage)} occupancy`
          },
          {
            id: "revenue-month",
            title: "Revenue This Month",
            value: formatCurrency(dashboardStats.revenueThisMonth),
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "From spot rentals"
          }
        ]
      case "owner":
        return [
          {
            id: "my-spots",
            title: "My Spots",
            value: 2,
            icon: createColorfulIcon(Car, "bg-blue-500"),
            description: "Owned parking spots"
          },
          {
            id: "month-earnings",
            title: "This Month's Earnings",
            value: "$450",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "18 bookings",
            trend: { value: 15, isPositive: true }
          },
          {
            id: "upcoming-bookings",
            title: "Upcoming Bookings",
            value: 6,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: "Next 7 days"
          },
          {
            id: "availability-listed",
            title: "Availability Listed",
            value: "85%",
            icon: createColorfulIcon(Clock, "bg-yellow-500"),
            description: "This month"
          }
        ]
      case "renter":
        return [
          {
            id: "active-bookings",
            title: "Active Bookings",
            value: 3,
            icon: createColorfulIcon(Calendar, "bg-purple-500"),
            description: "Confirmed reservations"
          },
          {
            id: "month-spent",
            title: "This Month Spent",
            value: "$75",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500"),
            description: "3 bookings"
          },
          {
            id: "favorite-locations",
            title: "Favorite Locations",
            value: 2,
            icon: createColorfulIcon(MapPin, "bg-red-500"),
            description: "Saved preferences"
          },
          {
            id: "booking-history",
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

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent, statId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCardClick?.(statId)
    }
  }

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  // Show loading skeleton for admin users while data is loading
  if (userRole === "admin" && isLoading) {
    return <LoadingSkeleton />;
  }

  // Show error message for admin users if there's an error
  if (userRole === "admin" && error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats-error">
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-muted-foreground">Failed to load dashboard statistics</p>
              <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
      {stats.map((stat) => (
        <Card 
          key={stat.id} 
          className="hover-elevate cursor-pointer" 
          data-testid={`button-stat-card-${stat.id}`}
          role="button"
          tabIndex={0}
          aria-label={`View ${stat.title} details`}
          onClick={() => onCardClick?.(stat.id)}
          onKeyDown={(e) => handleKeyDown(e, stat.id)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div>
              {stat.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`text-stat-value-${stat.id}`}>
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