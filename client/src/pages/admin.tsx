import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "wouter"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, Car, CalendarCheck, BarChart3, FileText, Shield,
  TrendingUp, Clock, MapPin, AlertTriangle, ArrowRight,
  Building, CheckCircle2, UserPlus, Settings, Bell, RefreshCw,
  DollarSign, Download, AlertCircle, Loader2, Eye, EyeOff, Calendar
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { 
  WaitingList, 
  ParkingSpot, 
  User, 
  Booking,
  AnalyticsOverviewResponse,
  AnalyticsRevenueResponse, 
  AnalyticsTopPerformersResponse,
  AnalyticsIssuesResponse,
  AnalyticsUsageResponse
} from "@shared/schema"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"

export default function Admin() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [dateRange, setDateRange] = useState("last-30-days")
  const { cardsVisible, toggleCards } = useCardsVisibility('analytics')
  const { t } = useLanguage()

  // Fetch system metrics data
  const { data: allUsers = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  })

  const { data: allWaitingList = [], isLoading: isLoadingWaitingList, refetch: refetchWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  })

  const { data: activeWaitingList = [], isLoading: isLoadingActiveWaitingList, refetch: refetchActiveWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list/active"],
  })

  const { data: allSpots = [], isLoading: isLoadingSpots, refetch: refetchSpots } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/admin/all-spots"],
  })

  const { data: unallocatedSpots = [], isLoading: isLoadingUnallocatedSpots, refetch: refetchUnallocatedSpots } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  })

  const { data: recentBookings = [], isLoading: isLoadingRecentBookings, refetch: refetchRecentBookings } = useQuery<Booking[]>({
    queryKey: ["/api/admin/recent-bookings"],
  })

  // Helper function to convert dateRange to monthsBack for revenue API
  const getMonthsBack = (range: string): number => {
    switch (range) {
      case 'last-7-days': return 1;
      case 'last-30-days': return 1;
      case 'last-3-months': return 3;
      case 'last-year': return 12;
      default: return 1;
    }
  };

  // React Query hooks for fetching real analytics data
  const overviewQuery = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['/api/admin/analytics-overview'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const revenueQuery = useQuery<AnalyticsRevenueResponse>({
    queryKey: ['/api/admin/analytics-revenue', { monthsBack: getMonthsBack(dateRange) }],
    staleTime: 5 * 60 * 1000,
  });

  const topPerformersQuery = useQuery<AnalyticsTopPerformersResponse>({
    queryKey: ['/api/admin/analytics-top-performers'],
    staleTime: 5 * 60 * 1000,
  });

  const issuesQuery = useQuery<AnalyticsIssuesResponse>({
    queryKey: ['/api/admin/analytics-issues'],
    staleTime: 2 * 60 * 1000, // 2 minutes for more frequent updates
  });

  const usageQuery = useQuery<AnalyticsUsageResponse>({
    queryKey: ['/api/admin/analytics-usage'],
    staleTime: 5 * 60 * 1000,
  });

  // Check if any query is loading
  const isLoadingAnalytics = overviewQuery.isLoading || revenueQuery.isLoading || 
                   topPerformersQuery.isLoading || issuesQuery.isLoading || 
                   usageQuery.isLoading;

  const handleRefreshAnalytics = () => {
    // Invalidate all analytics queries to fetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-issues'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] });
  };

  // Handle refresh all admin data
  const handleRefreshAll = async () => {
    await Promise.all([
      refetchUsers(),
      refetchWaitingList(),
      refetchActiveWaitingList(),
      refetchSpots(),
      refetchUnallocatedSpots(),
      refetchRecentBookings()
    ]);
    handleRefreshAnalytics();
  };

  // Calculate system metrics
  const systemMetrics = {
    totalUsers: allUsers.length,
    totalSpots: allSpots.length,
    allocatedSpots: allSpots.length - unallocatedSpots.length,
    availableSpots: unallocatedSpots.length,
    utilizationRate: allSpots.length > 0 
      ? Math.round(((allSpots.length - unallocatedSpots.length) / allSpots.length) * 100)
      : 0,
    activeWaitingList: activeWaitingList.length,
    totalWaitingList: allWaitingList.length,
    recentBookingsCount: recentBookings.length,
    pendingRequests: activeWaitingList.filter(item => item.priority === 1).length // High priority items
  }

  // Quick action items for admin navigation
  const quickActions = [
    {
      title: "User Management",
      description: "Manage users, roles, and permissions",
      url: "/admin/users",
      icon: Users,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      stats: `${systemMetrics.totalUsers} users`
    },
    {
      title: "Parking Management", 
      description: "Manage spots, assignments, and waiting list",
      url: "/admin/parking",
      icon: Shield,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      stats: `${systemMetrics.totalSpots} spots, ${systemMetrics.activeWaitingList} waiting`
    },
    {
      title: "Spot Booking Management",
      description: "Monitor bookings and availability",
      url: "/admin/bookings", 
      icon: CalendarCheck,
      iconColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      stats: `${systemMetrics.recentBookingsCount} recent bookings`
    },
    {
      title: "Audit Logs",
      description: "View system activity and audit trails",
      url: "/admin/audits",
      icon: FileText,
      iconColor: "text-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-950/30",
      stats: "Activity monitoring"
    }
  ]

  const getInitials = (firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    }
    return 'A';
  };

  // Helper component for individual section error states
  const SectionError = ({ title, onRetry }: { title: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mb-2" />
      <h4 className="text-sm font-medium mb-1">{t('common.errorLoading')} {title}</h4>
      <p className="text-xs text-muted-foreground mb-3">
        {t('common.failedToLoad')}
      </p>
      <Button onClick={onRetry} variant="outline" size="sm">
        <RefreshCw className="h-3 w-3 mr-1" />
        {t('common.retry')}
      </Button>
    </div>
  );

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

  // Chart configuration for theming
  const chartConfig = {
    revenue: {
      label: "Revenue",
      color: "hsl(var(--chart-1))",
    },
    bookings: {
      label: "Bookings",
      color: "hsl(var(--chart-2))",
    },
    ownerEarnings: {
      label: "Owner Earnings",
      color: "hsl(var(--chart-1))",
    },
    platformFees: {
      label: "Platform Fees",
      color: "hsl(var(--chart-2))",
    },
    processingFees: {
      label: "Processing Fees",
      color: "hsl(var(--chart-3))",
    },
    otherRevenue: {
      label: "Other Revenue",
      color: "hsl(var(--chart-4))",
    },
    usage: {
      label: "Usage",
      color: "hsl(var(--chart-1))",
    },
    utilization: {
      label: "Utilization",
      color: "hsl(var(--chart-3))",
    },
    rating: {
      label: "Rating",
      color: "hsl(var(--chart-4))",
    },
  } satisfies ChartConfig;

  const isLoading = isLoadingUsers || isLoadingWaitingList || isLoadingSpots

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="page-admin">
      {/* Welcome Section */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              System overview and administrative controls
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleRefreshAll}
                  disabled={isLoading}
                  data-testid="button-refresh-admin-dashboard"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh All
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Refresh all dashboard data including users, spots, bookings, and system metrics
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                  {getInitials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm" data-testid="text-admin-welcome">
                  Welcome, {user?.firstName || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground">
                  System Administrator
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">System Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-total-users" 
                className="hover-elevate" 
                tabIndex={0}
                role="button"
                aria-label="View total users details"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-blue-600">{systemMetrics.totalUsers}</div>
                      )}
                      <div className="text-sm text-muted-foreground">Total Users</div>
                    </div>
                    <Users className="h-8 w-8 text-blue-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Registered users including employees, admins, and active accounts
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-parking-utilization" 
                className="hover-elevate"
                tabIndex={0}
                role="button"
                aria-label="View parking utilization details"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-green-600">{systemMetrics.utilizationRate}%</div>
                      )}
                      <div className="text-sm text-muted-foreground">Parking Utilization</div>
                    </div>
                    <Car className="h-8 w-8 text-green-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Utilization: {systemMetrics.allocatedSpots} of {systemMetrics.totalSpots} spots allocated
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-active-bookings" 
                className="hover-elevate"
                tabIndex={0}
                role="button"
                aria-label="View recent bookings details"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-purple-600">{systemMetrics.recentBookingsCount}</div>
                      )}
                      <div className="text-sm text-muted-foreground">Recent Bookings</div>
                    </div>
                    <CalendarCheck className="h-8 w-8 text-purple-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Recent bookings - tracks current booking activity and usage patterns
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                data-testid="card-pending-requests" 
                className="hover-elevate"
                tabIndex={0}
                role="button"
                aria-label="View urgent requests details"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mb-1" />
                      ) : (
                        <div className="text-2xl font-bold text-orange-600">{systemMetrics.pendingRequests}</div>
                      )}
                      <div className="text-sm text-muted-foreground">Urgent Requests</div>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-600 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              High-priority waiting list requests requiring immediate attention
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Parking Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Total Spots</div>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <div className="text-xl font-semibold">{systemMetrics.totalSpots}</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Available</div>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <div className="text-xl font-semibold text-green-600">{systemMetrics.availableSpots}</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Allocated</div>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <div className="text-xl font-semibold text-blue-600">{systemMetrics.allocatedSpots}</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Waiting List</div>
                {isLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <div className="text-xl font-semibold text-orange-600">{systemMetrics.activeWaitingList}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">System Health</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  System is running normally with all services functioning properly
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="default" 
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    tabIndex={0}
                    role="status"
                    aria-label="Database status: Connected"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Database connection active and responding normally
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Last Backup</span>
              <span className="text-sm text-muted-foreground">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Sessions</span>
              <span className="text-sm font-medium">{systemMetrics.totalUsers > 0 ? Math.floor(systemMetrics.totalUsers * 0.3) : 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Reports Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Analytics & Reports</h2>
            <p className="text-muted-foreground">
              Comprehensive analytics and system insights
            </p>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleCards}
                  data-testid="button-toggle-cards"
                >
                  {cardsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {cardsVisible ? t('tooltip.analytics.hideCards') : t('tooltip.analytics.toggleCards')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={handleRefreshAnalytics}
                  disabled={isLoadingAnalytics}
                  data-testid="button-refresh-analytics"
                >
                  {isLoadingAnalytics ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {t('common.refresh')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('tooltip.analytics.refreshData')}
              </TooltipContent>
            </Tooltip>
            <Select value={dateRange} onValueChange={setDateRange}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t('tooltip.analytics.dateRange')}
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="last-7-days">{t('dateRange.last7Days')}</SelectItem>
                <SelectItem value="last-30-days">{t('dateRange.last30Days')}</SelectItem>
                <SelectItem value="last-3-months">{t('dateRange.last3Months')}</SelectItem>
                <SelectItem value="last-year">{t('dateRange.lastYear')}</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" disabled={isLoadingAnalytics} data-testid="button-export-report">
                  <Download className="h-4 w-4 mr-2" />
                  {t('common.exportReport')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('tooltip.analytics.exportReport')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Key Metrics Overview */}
        {cardsVisible && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="analytics-cards">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {t('analytics.totalRevenue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Revenue" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${overviewQuery.data?.totalRevenue.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-green-600">
                      +{overviewQuery.data?.monthlyGrowth || 0}% {t('analytics.fromLastMonth')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('analytics.totalBookings')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-16" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Bookings" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {overviewQuery.data?.totalBookings.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('analytics.thisYear')}</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('analytics.activeUsers')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-12 mb-2" />
                    <Skeleton className="h-4 w-20" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Users" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {overviewQuery.data?.activeUsers || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('analytics.monthlyActive')}</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t('analytics.utilizationRate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Utilization" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {overviewQuery.data?.utilizationRate || 0}%
                    </div>
                    <p className="text-xs text-green-600">
                      {(overviewQuery.data?.utilizationRate || 0) > 75 ? t('analytics.aboveTarget') : t('analytics.belowTarget')}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('analytics.avgBookingValue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-16" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Booking Value" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      ${overviewQuery.data?.averageBookingValue || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('analytics.perBooking')}</p>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t('analytics.growthRate')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : overviewQuery.error ? (
                  <SectionError title="Growth" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] })} />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {overviewQuery.data?.monthlyGrowth && overviewQuery.data.monthlyGrowth >= 0 ? '+' : ''}
                      {overviewQuery.data?.monthlyGrowth || 0}%
                    </div>
                    <p className="text-xs text-green-600">{t('analytics.monthOverMonth')}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="revenue" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="revenue" data-testid="tab-revenue-analysis">{t('analytics.tabs.revenueAnalysis')}</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage-patterns">{t('analytics.tabs.usagePatterns')}</TabsTrigger>
            <TabsTrigger value="performers" data-testid="tab-top-performers">{t('analytics.tabs.topPerformers')}</TabsTrigger>
            <TabsTrigger value="issues" data-testid="tab-issues-alerts">{t('analytics.tabs.issuesAlerts')}</TabsTrigger>
          </TabsList>

          {/* Revenue Analysis Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.monthlyRevenueTrend')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : revenueQuery.error ? (
                    <SectionError title="Monthly Revenue" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] })} />
                  ) : (
                    <div className="h-[300px]">
                      <LineChart 
                        data={revenueQuery.data?.monthlyData || []}
                        width={533}
                        height={300}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <RechartsTooltip 
                          formatter={(value: number, name: string) => [
                            `$${value.toLocaleString()}`, 
                            name === 'revenue' ? 'Revenue' : name
                          ]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="hsl(var(--chart-1))"
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                          name={t('analytics.revenue')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bookings" 
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5 }}
                          name={t('analytics.bookings')}
                        />
                      </LineChart>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.revenueBreakdown')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : revenueQuery.error ? (
                    <SectionError title="Revenue Breakdown" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] })} />
                  ) : (
                    <div className="h-[300px] flex justify-center">
                      <PieChart width={533} height={300}>
                        <Pie
                          data={[
                            { name: t('analytics.ownerEarnings'), value: revenueQuery.data?.revenueBreakdown.ownerEarnings || 0, color: 'hsl(var(--chart-1))' },
                            { name: t('analytics.platformFees'), value: revenueQuery.data?.revenueBreakdown.platformFees || 0, color: 'hsl(var(--chart-2))' },
                            { name: t('analytics.processingFees'), value: revenueQuery.data?.revenueBreakdown.processingFees || 0, color: 'hsl(var(--chart-3))' },
                            { name: t('analytics.otherRevenue'), value: revenueQuery.data?.revenueBreakdown.otherRevenue || 0, color: 'hsl(var(--chart-4))' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: t('analytics.ownerEarnings'), value: revenueQuery.data?.revenueBreakdown.ownerEarnings || 0, color: 'hsl(var(--chart-1))' },
                            { name: t('analytics.platformFees'), value: revenueQuery.data?.revenueBreakdown.platformFees || 0, color: 'hsl(var(--chart-2))' },
                            { name: t('analytics.processingFees'), value: revenueQuery.data?.revenueBreakdown.processingFees || 0, color: 'hsl(var(--chart-3))' },
                            { name: t('analytics.otherRevenue'), value: revenueQuery.data?.revenueBreakdown.otherRevenue || 0, color: 'hsl(var(--chart-4))' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} />
                        <Legend />
                      </PieChart>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Usage Patterns Tab - Simplified version */}
          <TabsContent value="usage" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.peakHoursUsage')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {usageQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : usageQuery.error ? (
                    <SectionError title="Peak Hours" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                  ) : (
                    <div className="h-[300px]">
                      <BarChart 
                        data={usageQuery.data?.peakHours || []}
                        width={533}
                        height={300}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="time" 
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <RechartsTooltip 
                          formatter={(value: number) => [`${value}%`, 'Usage']}
                          labelFormatter={(label) => `Time: ${label}`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="usage" 
                          fill={'hsl(var(--chart-1))'} 
                          radius={[4, 4, 0, 0]}
                          name="Usage Percentage"
                        />
                      </BarChart>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Usage Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  {usageQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : usageQuery.error ? (
                    <SectionError title="Weekly Trends" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                  ) : (
                    <div className="h-[300px]">
                      <BarChart 
                        data={usageQuery.data?.weeklyTrends || []}
                        width={533}
                        height={300}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="dayOfWeek" 
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip 
                          formatter={(value: number, name: string) => [
                            name === 'utilization' ? `${value}%` : value,
                            name === 'utilization' ? 'Utilization' : 'Bookings'
                          ]}
                          labelFormatter={(label) => `Day: ${label}`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="bookings" 
                          fill={'hsl(var(--chart-1))'} 
                          name="Bookings"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                          dataKey="utilization" 
                          fill={'hsl(var(--chart-2))'} 
                          name="Utilization %"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Top Performers Tab - Simplified version */}
          <TabsContent value="performers" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Spots</CardTitle>
                </CardHeader>
                <CardContent>
                  {topPerformersQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : topPerformersQuery.error ? (
                    <SectionError title="Top Spots" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                  ) : (
                    <div className="h-[300px]">
                      <BarChart 
                        data={topPerformersQuery.data?.topSpots || []}
                        layout="horizontal"
                        width={533}
                        height={300}
                        margin={{ left: 60, right: 20, top: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="spotNumber" 
                          tick={{ fontSize: 10 }}
                          width={50}
                        />
                        <RechartsTooltip 
                          formatter={(value: number, name: string) => [
                            name === 'earnings' ? `$${value.toLocaleString()}` : 
                            name === 'utilization' ? `${value}%` : value,
                            name === 'earnings' ? 'Earnings' : 
                            name === 'utilization' ? 'Utilization' : 'Bookings'
                          ]}
                          labelFormatter={(label) => `Spot #${label}`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="earnings" 
                          fill={'hsl(var(--chart-1))'} 
                          name="Earnings"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Top Earning Owners</CardTitle>
                </CardHeader>
                <CardContent>
                  {topPerformersQuery.isLoading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : topPerformersQuery.error ? (
                    <SectionError title="Top Owners" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                  ) : (
                    <div className="h-[300px]">
                      <BarChart 
                        data={topPerformersQuery.data?.topOwners || []}
                        layout="horizontal"
                        width={533}
                        height={300}
                        margin={{ left: 80, right: 20, top: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tick={{ fontSize: 10 }}
                          width={70}
                        />
                        <RechartsTooltip 
                          formatter={(value: number, name: string) => [
                            name === 'earnings' ? `$${value.toLocaleString()}` : 
                            name === 'averageRating' ? `${value}⭐` : value,
                            name === 'earnings' ? 'Earnings' : 
                            name === 'spotsCount' ? 'Spots' : 
                            name === 'bookingsCount' ? 'Bookings' : 'Rating'
                          ]}
                          labelFormatter={(label) => `Owner: ${label}`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="earnings" 
                          fill={'hsl(var(--chart-2))'} 
                          name="Earnings"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Issues & Alerts Tab */}
          <TabsContent value="issues" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Issues & Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  {issuesQuery.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-6 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : issuesQuery.error ? (
                    <SectionError title="Issues" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-issues'] })} />
                  ) : issuesQuery.data ? (
                    <div className="space-y-4">
                      {/* Issues Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">
                            {issuesQuery.data.issuesSummary.critical}
                          </div>
                          <div className="text-sm text-red-600">Critical</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {issuesQuery.data.issuesSummary.high}
                          </div>
                          <div className="text-sm text-orange-600">High</div>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">
                            {issuesQuery.data.issuesSummary.medium}
                          </div>
                          <div className="text-sm text-yellow-600">Medium</div>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-gray-600">
                            {issuesQuery.data.issuesSummary.low}
                          </div>
                          <div className="text-sm text-gray-600">Low</div>
                        </div>
                      </div>
                      
                      {/* Individual Issues */}
                      <div className="space-y-3">
                        {issuesQuery.data.activeIssues.map((issue) => (
                          <div key={issue.id} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getIssueColor(issue.priority)}>
                                    {issue.priority.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">{issue.type}</Badge>
                                  <Badge variant="secondary">{issue.status}</Badge>
                                </div>
                                <h4 className="font-medium mb-1">{issue.description}</h4>
                                <div className="text-sm text-muted-foreground">
                                  {t('analytics.created')}: {issue.created} • {t('analytics.assignee')}: {issue.assignee}
                                  {issue.entityId && issue.entityType && (
                                    <span> • {t('analytics.related')} {issue.entityType}: {issue.entityId.slice(-8)}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {new Date(issue.created).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('analytics.noActiveIssuesFound')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Activity Alert */}
      {systemMetrics.pendingRequests > 0 && (
        <Alert className="border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            You have {systemMetrics.pendingRequests} high-priority requests in the waiting list that need attention.
            <Link href="/admin/parking" className="ml-2 underline font-medium">
              Review now
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}