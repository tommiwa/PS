import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Car, Calendar, Clock, Users, TrendingUp, MapPin, AlertTriangle, DollarSign, TrendingDown } from "lucide-react"
import { UserRole, DashboardStatsResponse, RenterDashboardStatsResponse, OwnerStatisticsResponse, RenterStatsPeriod, RenterStatsStatus } from "@shared/schema"
import { useQuery } from "@tanstack/react-query"

export interface DashboardStat {
  id: string
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  changePercent?: number | null
}

interface DashboardStatsProps {
  userRole: UserRole
  onCardClick?: (statId: string) => void
  renterPeriod?: RenterStatsPeriod
  renterStatus?: RenterStatsStatus
}

export function DashboardStats({ userRole, onCardClick, renterPeriod = 'month', renterStatus = 'all' }: DashboardStatsProps) {
  const { 
    data: dashboardStats, 
    isLoading: adminLoading, 
    error: adminError 
  } = useQuery<DashboardStatsResponse>({
    queryKey: ["/api/admin/dashboard-stats"],
    enabled: userRole === "admin",
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { 
    data: renterStats, 
    isLoading: renterLoading, 
    error: renterError 
  } = useQuery<RenterDashboardStatsResponse>({
    queryKey: ["/api/renter/dashboard-stats", { period: renterPeriod, status: renterStatus }],
    queryFn: async () => {
      const params = new URLSearchParams({ period: renterPeriod, status: renterStatus });
      const res = await fetch(`/api/renter/dashboard-stats?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: userRole === "renter",
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { 
    data: ownerStats, 
    isLoading: ownerLoading, 
    error: ownerError 
  } = useQuery<OwnerStatisticsResponse>({
    queryKey: ["/api/owner/statistics"],
    enabled: userRole === "owner",
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const isLoading = adminLoading || renterLoading || ownerLoading;
  const error = adminError || renterError || ownerError;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  const formatPercentage = (percentage: number): string => `${percentage}%`;

  const createColorfulIcon = (IconComponent: React.ComponentType<any>, bgColor: string, tooltipText: string, iconColor: string = "text-white") => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`${bgColor} ${iconColor} rounded-lg p-2 w-10 h-10 flex items-center justify-center`}>
          <IconComponent className="h-5 w-5" />
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  )

  const getStatsForRole = () => {
    switch (userRole) {
      case "admin":
        if (error) return [{ id: "error-state", title: "Data Unavailable", value: "--", icon: createColorfulIcon(AlertTriangle, "bg-red-500", "Alert indicator"), description: "Error loading stats" }];
        if (!dashboardStats) return [];
        return [
          { id: "total-spots", title: "Total Spots", value: dashboardStats.totalSpots, icon: createColorfulIcon(Car, "bg-blue-500", "Parking spot metrics"), description: `${dashboardStats.allocatedSpots} allocated, ${dashboardStats.availableSpots} available` },
          { id: "active-users", title: "Active Users", value: dashboardStats.activeUsers, icon: createColorfulIcon(Users, "bg-green-500", "User account metrics"), description: "Registered employees" },
          { id: "todays-bookings", title: "Today's Bookings", value: dashboardStats.todaysBookings, icon: createColorfulIcon(Calendar, "bg-purple-500", "Booking metrics"), description: `${formatPercentage(dashboardStats.occupancyPercentage)} occupancy` },
          { id: "revenue-month", title: "Revenue This Month", value: formatCurrency(dashboardStats.revenueThisMonth), icon: createColorfulIcon(TrendingUp, "bg-orange-500", "Financial metrics"), description: "From spot rentals" }
        ]

      case "owner":
        if (ownerError) return [{ id: "error-state", title: "Data Unavailable", value: "--", icon: createColorfulIcon(AlertTriangle, "bg-red-500", "Alert indicator"), description: "Error loading stats" }];
        if (!ownerStats) return [];
        return [
          { id: "month-income", title: "This Month Income", value: formatCurrency(ownerStats.thisMonthIncome), icon: createColorfulIcon(TrendingUp, "bg-green-500", "Income from your spots"), description: `${ownerStats.thisMonthIncomeBookings} booking${ownerStats.thisMonthIncomeBookings !== 1 ? 's' : ''}` },
          { id: "month-spent", title: "This Month Spent", value: formatCurrency(ownerStats.thisMonthSpent), icon: createColorfulIcon(DollarSign, "bg-orange-500", "Spending on rented spots"), description: `${ownerStats.thisMonthSpentBookings} booking${ownerStats.thisMonthSpentBookings !== 1 ? 's' : ''}` },
          { id: "year-income", title: "Past Year Income", value: formatCurrency(ownerStats.pastYearIncome), icon: createColorfulIcon(Calendar, "bg-blue-500", "Total income past 12 months"), description: `${ownerStats.pastYearIncomeBookings} booking${ownerStats.pastYearIncomeBookings !== 1 ? 's' : ''}` },
          { id: "year-spent", title: "Past Year Spent", value: formatCurrency(ownerStats.pastYearSpent), icon: createColorfulIcon(Car, "bg-purple-500", "Total spending past 12 months"), description: `${ownerStats.pastYearSpentBookings} booking${ownerStats.pastYearSpentBookings !== 1 ? 's' : ''}` }
        ]

      case "renter":
        if (renterError) return [{ id: "error-state", title: "Data Unavailable", value: "--", icon: createColorfulIcon(AlertTriangle, "bg-red-500", "Alert indicator"), description: "Error loading stats" }];
        if (!renterStats) return [];
        const periodLabel = renterStats.periodLabel || 'Period';
        return [
          {
            id: "period-bookings",
            title: `${periodLabel} Bookings`,
            value: renterStats.bookings,
            icon: createColorfulIcon(Calendar, "bg-purple-500", "Total bookings in the selected period"),
            description: renterStats.status !== 'all' ? renterStats.status : 'all statuses',
            changePercent: renterStats.bookingsChange
          },
          {
            id: "period-spent",
            title: `${periodLabel} Spent`,
            value: formatCurrency(renterStats.spent),
            icon: createColorfulIcon(TrendingUp, "bg-orange-500", "Total amount spent in the selected period"),
            description: `${renterStats.bookings} booking${renterStats.bookings !== 1 ? 's' : ''}`,
            changePercent: renterStats.spentChange
          },
          {
            id: "period-confirmed",
            title: `${periodLabel} Confirmed`,
            value: renterStats.periodConfirmedCount,
            icon: createColorfulIcon(Clock, "bg-blue-500", "Confirmed bookings in the selected period"),
            description: `${periodLabel} confirmed`,
            changePercent: renterStats.periodConfirmedChange
          },
          {
            id: "period-completed",
            title: `${periodLabel} Completed`,
            value: renterStats.periodCompletedCount,
            icon: createColorfulIcon(Car, "bg-green-600", "Completed bookings in the selected period"),
            description: `${periodLabel} completed`,
            changePercent: renterStats.periodCompletedChange
          },
          {
            id: "avg-cost",
            title: `${periodLabel} Avg / Booking`,
            value: formatCurrency(renterStats.averageCostPerBooking),
            icon: createColorfulIcon(DollarSign, "bg-green-500", "Average cost per booking in the selected period"),
            description: periodLabel,
            changePercent: renterStats.averageCostChange
          },
        ]

      default:
        return []
    }
  }

  const stats = getStatsForRole()

  const handleKeyDown = (event: React.KeyboardEvent, statId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCardClick?.(statId)
    }
  }

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
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

  if (userRole === "admin" && isLoading) return <LoadingSkeleton />;

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

  const getStatTooltip = (stat: DashboardStat) => {
    const base = "Click to view detailed information about this metric"
    switch (stat.id) {
      case "total-spots": return `Total parking spots in the system. ${base}. Currently ${stat.description}`
      case "active-users": return `Active registered users. ${base}`
      case "todays-bookings": return `Parking bookings for today. ${base}`
      case "revenue-month": return `Total revenue this month. ${base}`
      case "period-bookings": return `Number of bookings in the selected period. ${base}`
      case "period-spent": return `Amount spent in the selected period. ${base}`
      case "active-bookings": return `Your upcoming confirmed reservations. ${base}`
      case "avg-cost": return `Average cost per booking in the selected period. ${base}`
      case "error-state": return "Error loading statistics. Please refresh the page"
      default: return base
    }
  }

  const gridCols = userRole === 'renter'
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-4`} data-testid="dashboard-stats">
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
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div>{stat.icon}</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`text-stat-value-${stat.id}`}>
                  {stat.value}
                </div>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                )}
                {'changePercent' in stat && stat.changePercent !== undefined && stat.changePercent !== null && (
                  <div className={`text-xs mt-2 flex items-center gap-1 ${stat.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {stat.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{stat.changePercent >= 0 ? '+' : ''}{stat.changePercent}% vs prev period</span>
                  </div>
                )}
                {'changePercent' in stat && stat.changePercent === null && (
                  <div className="text-xs mt-2 text-muted-foreground">No previous data</div>
                )}
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{getStatTooltip(stat)}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
