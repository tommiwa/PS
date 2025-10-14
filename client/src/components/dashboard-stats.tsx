import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Car, Calendar, Clock, Users, TrendingUp, MapPin, AlertTriangle } from "lucide-react"
import { UserRole, DashboardStatsResponse, RenterDashboardStatsResponse } from "@shared/schema"
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
    isLoading: adminLoading, 
    error: adminError 
  } = useQuery<DashboardStatsResponse>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: userRole === "admin", // Only fetch for admin users
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Fetch real dashboard stats for renter users
  const { 
    data: renterStats, 
    isLoading: renterLoading, 
    error: renterError 
  } = useQuery<RenterDashboardStatsResponse>({
    queryKey: ["/api/renter/dashboard-stats"],
    enabled: userRole === "renter", // Only fetch for renter users
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const isLoading = adminLoading || renterLoading;
  const error = adminError || renterError;

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
  const createColorfulIcon = (IconComponent: React.ComponentType<any>, bgColor: string, tooltipText: string, iconColor: string = "text-white") => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`${bgColor} ${iconColor} rounded-lg p-2 w-10 h-10 flex items-center justify-center`}>
          <IconComponent className="h-5 w-5" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {tooltipText}
      </TooltipContent>
    </Tooltip>
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
              icon: createColorfulIcon(AlertTriangle, "bg-red-500", "Alert indicator - shows system errors or important notifications"),
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
            icon: createColorfulIcon(Car, "bg-blue-500", "Parking spot metrics - tracks available and occupied spaces"),
            description: `${dashboardStats.allocatedSpots} allocated, ${dashboardStats.availableSpots} available`
          },
          {
            id: "active-users",
            title: "Active Users",
            value: dashboardStats.activeUsers,
            icon: createColorfulIcon(Users, "bg-green-500", "User account metrics - shows active registered users"),
            description: "Registered employees"
          },
          {
            id: "todays-bookings",
            title: "Today's Bookings",
            value: dashboardStats.todaysBookings,
            icon: createColorfulIcon(Calendar, "bg-purple-500", "Booking metrics - tracks reservations and appointments"),
            description: `${formatPercentage(dashboardStats.occupancyPercentage)} occupancy`
          },
          {
            id: "revenue-month",
            title: "Revenue This Month",
            value: formatCurrency(dashboardStats.revenueThisMonth),
            icon: createColorfulIcon(TrendingUp, "bg-orange-500", "Financial metrics - shows revenue and performance trends"),
            description: "From spot rentals"
          }
        ]
      case "owner":
        return [
          {
            id: "my-spots",
            title: "My Spots",
            value: 2,
            icon: createColorfulIcon(Car, "bg-blue-500", "Parking spot metrics - tracks available and occupied spaces"),
            description: "Owned parking spots"
          },
          {
            id: "month-earnings",
            title: "This Month's Earnings",
            value: "$450",
            icon: createColorfulIcon(TrendingUp, "bg-orange-500", "Financial metrics - shows revenue and performance trends"),
            description: "18 bookings",
            trend: { value: 15, isPositive: true }
          },
          {
            id: "upcoming-bookings",
            title: "Upcoming Bookings",
            value: 6,
            icon: createColorfulIcon(Calendar, "bg-purple-500", "Booking metrics - tracks reservations and appointments"),
            description: "Next 7 days"
          },
          {
            id: "availability-listed",
            title: "Availability Listed",
            value: "85%",
            icon: createColorfulIcon(Clock, "bg-yellow-500", "Time-based metrics - tracks schedules and availability patterns"),
            description: "This month"
          }
        ]
      case "renter":
        if (renterError) {
          // Return error state stats
          return [
            {
              id: "error-state",
              title: "Data Unavailable",
              value: "--",
              icon: createColorfulIcon(AlertTriangle, "bg-red-500", "Alert indicator - shows system errors or important notifications"),
              description: "Error loading stats"
            }
          ];
        }
        
        if (!renterStats) {
          // Return empty stats while loading or no data
          return [];
        }
        
        return [
          {
            id: "month-bookings",
            title: "This Month Bookings",
            value: renterStats.thisMonthBookings,
            icon: createColorfulIcon(Calendar, "bg-purple-500", "Booking metrics - tracks reservations and appointments"),
            description: "This month"
          },
          {
            id: "month-spent",
            title: "This Month Spent",
            value: formatCurrency(renterStats.thisMonthSpent),
            icon: createColorfulIcon(TrendingUp, "bg-orange-500", "Financial metrics - shows revenue and performance trends"),
            description: `${renterStats.thisMonthBookings} booking${renterStats.thisMonthBookings !== 1 ? 's' : ''}`
          },
          {
            id: "favorite-locations",
            title: "Favorite Locations",
            value: renterStats.favoriteLocations,
            icon: createColorfulIcon(MapPin, "bg-red-500", "Location-based metrics - shows geographic preferences and usage"),
            description: "Unique locations"
          },
          {
            id: "booking-history",
            title: "Booking History",
            value: renterStats.totalBookings,
            icon: createColorfulIcon(Clock, "bg-yellow-500", "Time-based metrics - tracks schedules and availability patterns"),
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

  // Helper function to get detailed tooltip content for each stat
  const getStatTooltip = (stat: DashboardStat) => {
    const baseMessage = "Click to view detailed information and insights about this metric"
    
    switch (stat.id) {
      case "total-spots":
        return `Total parking spots in the system. ${baseMessage}. Currently ${stat.description}`
      case "active-users":
        return `Number of active registered users in the system. ${baseMessage}. These are employees who can book parking spots`
      case "todays-bookings":
        return `Parking bookings made for today. ${baseMessage}. Shows current occupancy level and usage patterns`
      case "revenue-month":
        return `Total revenue generated this month from parking spot rentals. ${baseMessage}. Tracks financial performance`
      case "my-spots":
        return `Number of parking spots you own and can rent out. ${baseMessage}. Manage your spot listings and availability`
      case "month-earnings":
        return `Your total earnings this month from renting out parking spots. ${baseMessage}. Track your rental income`
      case "upcoming-bookings":
        return `Number of confirmed bookings for your parking spots in the next 7 days. ${baseMessage}`
      case "availability-listed":
        return `Percentage of time your spots have been listed as available this month. ${baseMessage}. Higher availability increases booking potential`
      case "active-bookings":
        return `Your current active parking reservations. ${baseMessage}. Manage your bookings and view details`
      case "month-spent":
        return `Total amount you've spent on parking this month. ${baseMessage}. Track your parking expenses`
      case "favorite-locations":
        return `Number of parking locations you've saved as favorites. ${baseMessage}. Quick access to preferred spots`
      case "booking-history":
        return `Total number of parking bookings you've made historically. ${baseMessage}. View your complete booking record`
      case "error-state":
        return "There was an error loading dashboard statistics. Please refresh the page or contact support if the problem persists"
      default:
        return baseMessage
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
      {stats.map((stat) => (
        <Tooltip key={stat.id}>
          <TooltipTrigger asChild>
            <Card 
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`text-xs mt-1 flex items-center gap-1 ${
                        stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <TrendingUp className={`h-3 w-3 ${!stat.trend.isPositive ? 'rotate-180' : ''}`} />
                        {stat.trend.isPositive ? '+' : '-'}{Math.abs(stat.trend.value)}% from last month
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {stat.trend.isPositive 
                        ? `Performance increased by ${stat.trend.value}% compared to last month - showing positive growth` 
                        : `Performance decreased by ${Math.abs(stat.trend.value)}% compared to last month - indicating decline`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            {getStatTooltip(stat)}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}