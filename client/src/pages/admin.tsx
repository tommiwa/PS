import { useState, useEffect } from "react"
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
import { useToast } from "@/hooks/use-toast"
import { exportToExcel, type ExportData } from "@/utils/export-utils"
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
  AnalyticsUsageResponse,
  ReportUtilizationResponse
} from "@shared/schema"
import { UtilizationReport } from '@/components/reports/UtilizationReport'
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"

// Define DashboardScope type
type DashboardScope = 'all' | 'bci';

export default function Admin() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [dateRange, setDateRange] = useState("last-30-days")
  const [scope, setScope] = useState<DashboardScope>('all')
  const { cardsVisible, toggleCards, setCardsVisible } = useCardsVisibility('analytics')
  const { t } = useLanguage()
  const { toast } = useToast()

  // Ensure analytics cards are visible by default on Admin Dashboard
  useEffect(() => {
    setCardsVisible(true)
  }, [setCardsVisible])

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

  // Helper to get date range for queries
  const getDateRange = (range: string) => {
    const toDate = new Date().toISOString().split('T')[0];
    let fromDate: string;
    
    switch (range) {
      case 'last-7-days': {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        fromDate = date.toISOString().split('T')[0];
        break;
      }
      case 'last-30-days': {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        fromDate = date.toISOString().split('T')[0];
        break;
      }
      case 'last-3-months': {
        const date = new Date();
        date.setMonth(date.getMonth() - 3);
        fromDate = date.toISOString().split('T')[0];
        break;
      }
      case 'last-year': {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        fromDate = date.toISOString().split('T')[0];
        break;
      }
      default: {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        fromDate = date.toISOString().split('T')[0];
      }
    }
    return { fromDate, toDate };
  };

  // Get computed date range for all queries
  const { fromDate, toDate } = getDateRange(dateRange);

  // React Query hooks for fetching real analytics data with scope and date range parameters
  const overviewQuery = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['/api/admin/analytics-overview', { scope, from: fromDate, to: toDate }],
    queryFn: async () => {
      const params = new URLSearchParams({
        scope,
        from: fromDate,
        to: toDate
      });
      const response = await fetch(`/api/admin/analytics-overview?${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics overview');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const revenueQuery = useQuery<AnalyticsRevenueResponse>({
    queryKey: ['/api/admin/analytics-revenue', { monthsBack: getMonthsBack(dateRange), scope }],
    staleTime: 5 * 60 * 1000,
  });

  const topPerformersQuery = useQuery<AnalyticsTopPerformersResponse>({
    queryKey: ['/api/admin/analytics-top-performers', { scope }],
    staleTime: 5 * 60 * 1000,
  });

  const issuesQuery = useQuery<AnalyticsIssuesResponse>({
    queryKey: ['/api/admin/analytics-issues', { scope }],
    staleTime: 2 * 60 * 1000, // 2 minutes for more frequent updates
  });

  const usageQuery = useQuery<AnalyticsUsageResponse>({
    queryKey: ['/api/admin/analytics-usage', { scope }],
    staleTime: 5 * 60 * 1000,
  });

  const utilizationQuery = useQuery<ReportUtilizationResponse>({
    queryKey: ['/api/admin/reports/utilization', fromDate, toDate, scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        scope: scope
      });
      const response = await fetch(`/api/admin/reports/utilization?${params}`);
      if (!response.ok) throw new Error('Failed to fetch utilization report');
      return response.json();
    },
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
    queryClient.invalidateQueries({ queryKey: ['/api/admin/reports/utilization'] });
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

  // Handle export analytics report
  const handleExportReport = () => {
    try {
      // Check if data is available
      if (isLoadingAnalytics) {
        toast({
          title: "Please wait",
          description: "Analytics data is still loading. Please try again in a moment.",
          variant: "default"
        });
        return;
      }

      // Prepare comprehensive export data with all analytics sections
      const allData: any[] = [];

      // Add Summary Section with system metrics
      allData.push({ section: "SYSTEM METRICS" });
      allData.push({ metric: "Total Users", value: systemMetrics.totalUsers });
      allData.push({ metric: "Total Spots", value: systemMetrics.totalSpots });
      allData.push({ metric: "Allocated Spots", value: systemMetrics.allocatedSpots });
      allData.push({ metric: "Available Spots", value: systemMetrics.availableSpots });
      allData.push({ metric: "Utilization Rate", value: `${systemMetrics.utilizationRate}%` });
      allData.push({ metric: "Active Waiting List", value: systemMetrics.activeWaitingList });
      allData.push({ metric: "Recent Bookings", value: systemMetrics.recentBookingsCount });
      allData.push({});

      // Add Overview Metrics
      if (overviewQuery.data) {
        allData.push({ section: "OVERVIEW METRICS" });
        allData.push({ metric: "Total Revenue", value: `$${overviewQuery.data.totalRevenue.toLocaleString()}` });
        allData.push({ metric: "Total Bookings", value: overviewQuery.data.totalBookings.toLocaleString() });
        allData.push({ metric: "Active Users", value: overviewQuery.data.activeUsers });
        allData.push({ metric: "Utilization Rate", value: `${overviewQuery.data.utilizationRate}%` });
        allData.push({ metric: "Average Booking Value", value: `$${overviewQuery.data.averageBookingValue}` });
        allData.push({ metric: "Monthly Growth", value: `${overviewQuery.data.monthlyGrowth}%` });
        allData.push({});
      }

      // Add Revenue Breakdown
      if (revenueQuery.data?.revenueBreakdown) {
        allData.push({ section: "REVENUE BREAKDOWN" });
        allData.push({ category: "BCI Earnings", amount: `$${revenueQuery.data.revenueBreakdown.bciRevenue.toLocaleString()}` });
        allData.push({ category: "Owner Earnings", amount: `$${revenueQuery.data.revenueBreakdown.ownerEarnings.toLocaleString()}` });
        allData.push({});
      }

      // Add Monthly Revenue Data
      if (revenueQuery.data?.monthlyData && revenueQuery.data.monthlyData.length > 0) {
        allData.push({ section: "MONTHLY REVENUE TREND" });
        revenueQuery.data.monthlyData.forEach(item => {
          allData.push({
            month: item.month,
            revenue: `$${item.revenue.toLocaleString()}`,
            bookings: item.bookings
          });
        });
        allData.push({});
      }

      // Add Top Performing Spots
      if (topPerformersQuery.data?.topSpots && topPerformersQuery.data.topSpots.length > 0) {
        allData.push({ section: "TOP PERFORMING SPOTS" });
        topPerformersQuery.data.topSpots.forEach(spot => {
          allData.push({
            spotNumber: spot.spotNumber,
            earnings: `$${spot.earnings.toLocaleString()}`,
            bookingsCount: spot.bookingsCount,
            utilization: `${spot.utilization}%`
          });
        });
        allData.push({});
      }

      // Add Top Earning Owners
      if (topPerformersQuery.data?.topOwners && topPerformersQuery.data.topOwners.length > 0) {
        allData.push({ section: "TOP EARNING OWNERS" });
        topPerformersQuery.data.topOwners.forEach(owner => {
          allData.push({
            name: owner.name,
            earnings: `$${owner.earnings.toLocaleString()}`,
            spotsCount: owner.spotsCount,
            bookingsCount: owner.bookingsCount,
            averageRating: owner.averageRating
          });
        });
        allData.push({});
      }

      // Add System Issues
      if (issuesQuery.data?.activeIssues && issuesQuery.data.activeIssues.length > 0) {
        allData.push({ section: "ACTIVE SYSTEM ISSUES" });
        issuesQuery.data.activeIssues.forEach(issue => {
          allData.push({
            priority: issue.priority,
            type: issue.type,
            status: issue.status,
            description: issue.description,
            assignee: issue.assignee,
            created: issue.created
          });
        });
        allData.push({});
      }

      // Add Usage Patterns - Location Performance
      if (usageQuery.data?.locationPerformance && usageQuery.data.locationPerformance.length > 0) {
        allData.push({ section: "LOCATION PERFORMANCE" });
        usageQuery.data.locationPerformance.forEach(item => {
          allData.push({
            location: item.location,
            spotsCount: item.spotsCount,
            utilization: `${item.utilization}%`,
            earnings: `$${item.earnings.toLocaleString()}`,
            averageRate: `$${item.averageRate.toFixed(2)}`
          });
        });
        allData.push({});
      }

      // Add Usage Patterns - Weekly Trends
      if (usageQuery.data?.weeklyTrends && usageQuery.data.weeklyTrends.length > 0) {
        allData.push({ section: "WEEKLY USAGE TRENDS" });
        usageQuery.data.weeklyTrends.forEach(item => {
          allData.push({
            dayOfWeek: item.dayOfWeek,
            bookings: item.bookings,
            utilization: `${item.utilization}%`
          });
        });
        allData.push({});
      }

      // Guard: Check if we have any data to export
      if (allData.length <= 1) {
        toast({
          title: "No Data Available",
          description: "There is no analytics data available to export. Please wait for data to load or check your filters.",
          variant: "default"
        });
        return;
      }

      // Collect all unique keys across all data rows to ensure comprehensive columns
      const allKeys = new Set<string>();
      allData.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
      });

      // Generate columns from all unique keys
      const columns = Array.from(allKeys).map(key => ({
        header: key === 'section' ? 'Section' : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        dataKey: key
      }));

      const exportData: ExportData = {
        title: "Analytics & Reports - Comprehensive Dashboard",
        subtitle: `Date Range: ${dateRange} | Generated on ${new Date().toLocaleDateString()}`,
        data: allData,
        columns: columns,
        filename: `analytics-report-${dateRange}-${new Date().toISOString().split('T')[0]}`
      };

      exportToExcel(exportData);

      toast({
        title: "Export Successful",
        description: "Analytics report has been exported successfully.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics report. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter spots based on scope
  const filteredSpots = scope === 'bci' 
    ? allSpots.filter(spot => spot.isBciManaged) 
    : allSpots;
  
  const filteredUnallocatedSpots = scope === 'bci'
    ? unallocatedSpots.filter(spot => spot.isBciManaged)
    : unallocatedSpots;

  // Calculate system metrics based on filtered data
  const systemMetrics = {
    totalUsers: allUsers.length,
    totalSpots: filteredSpots.length,
    allocatedSpots: filteredSpots.length - filteredUnallocatedSpots.length,
    availableSpots: filteredUnallocatedSpots.length,
    utilizationRate: filteredSpots.length > 0 
      ? Math.round(((filteredSpots.length - filteredUnallocatedSpots.length) / filteredSpots.length) * 100)
      : 0,
    activeWaitingList: activeWaitingList.length,
    totalWaitingList: allWaitingList.length,
    recentBookingsCount: recentBookings.length,
    pendingRequests: activeWaitingList.length // Total active waiting list entries
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
          <div className="flex items-center gap-3 flex-wrap">
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
                <Button 
                  variant="outline" 
                  disabled={isLoadingAnalytics} 
                  onClick={handleExportReport}
                  data-testid="button-export-report"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t('common.exportReport')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('tooltip.analytics.exportReport')}
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

      {/* Key Metrics Overview */}
      <div className="space-y-6">
        {cardsVisible && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="analytics-cards">
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
          </div>
        )}

        {/* Utilization Section */}
        <UtilizationReport
          data={utilizationQuery.data}
          isLoading={utilizationQuery.isLoading}
          hideStatCards
        />
      </div>
    </div>
  )
}