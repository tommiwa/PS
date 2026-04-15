import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
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
  Clock,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff
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
  AnalyticsOverviewResponse,
  AnalyticsRevenueResponse, 
  AnalyticsTopPerformersResponse,
  AnalyticsIssuesResponse,
  AnalyticsUsageResponse
} from "@shared/schema"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLanguage } from "@/hooks/use-language"
import { getDateRangeLabel } from "@/lib/date-utils"

export default function AdminAnalytics() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState("last-30-days");
  const { cardsVisible, toggleCards } = useCardsVisibility('analytics');
  const { t } = useLanguage();

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

  const { fromDate, toDate } = getDateRange(dateRange);

  // React Query hooks for fetching real analytics data
  const overviewQuery = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['/api/admin/analytics-overview', { from: fromDate, to: toDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const response = await fetch(`/api/admin/analytics-overview?${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics overview');
      return response.json();
    },
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
  const isLoading = overviewQuery.isLoading || revenueQuery.isLoading || 
                   topPerformersQuery.isLoading || issuesQuery.isLoading || 
                   usageQuery.isLoading;

  const handleRefresh = () => {
    // Invalidate all analytics queries to fetch fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-issues'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] });
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
    bciRevenue: {
      label: "BCI Revenue",
      color: "hsl(var(--chart-2))",
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

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-analytics">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">
            {t('analytics.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <UITooltip>
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
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isLoading}
                data-testid="button-refresh-analytics"
              >
                {isLoading ? (
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
          </UITooltip>
          <Select value={dateRange} onValueChange={setDateRange}>
            <UITooltip>
              <TooltipTrigger asChild>
                <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {t('tooltip.analytics.dateRange')}
              </TooltipContent>
            </UITooltip>
            <SelectContent>
              <SelectItem value="last-7-days">{t('dateRange.last7Days')}</SelectItem>
              <SelectItem value="last-30-days">{t('dateRange.last30Days')}</SelectItem>
              <SelectItem value="last-3-months">{t('dateRange.last3Months')}</SelectItem>
              <SelectItem value="last-year">{t('dateRange.lastYear')}</SelectItem>
            </SelectContent>
          </Select>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled={isLoading} data-testid="button-export-report">
                <Download className="h-4 w-4 mr-2" />
                {t('common.exportReport')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('tooltip.analytics.exportReport')}
            </TooltipContent>
          </UITooltip>
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
                <p className="text-xs text-muted-foreground">{getDateRangeLabel(dateRange, t)}</p>
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
                <p className="text-xs text-muted-foreground">{getDateRangeLabel(dateRange, t)}</p>
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
                          { name: t('analytics.bciRevenue'), value: revenueQuery.data?.revenueBreakdown.bciRevenue || 0, color: 'hsl(var(--chart-2))' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 25;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="currentColor" 
                              textAnchor={x > cx ? 'start' : 'end'} 
                              dominantBaseline="central"
                              className="text-sm font-medium"
                            >
                              {`${(percent * 100).toFixed(1)}%`}
                            </text>
                          );
                        }}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: t('analytics.ownerEarnings'), value: revenueQuery.data?.revenueBreakdown.ownerEarnings || 0, color: 'hsl(var(--chart-1))' },
                          { name: t('analytics.bciRevenue'), value: revenueQuery.data?.revenueBreakdown.bciRevenue || 0, color: 'hsl(var(--chart-2))' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} />
                      <Legend 
                        payload={[
                          { value: t('analytics.ownerEarnings'), type: 'square', color: 'hsl(var(--chart-1))' },
                          { value: t('analytics.bciRevenue'), type: 'square', color: 'hsl(var(--chart-2))' }
                        ]}
                      />
                    </PieChart>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Patterns Tab */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Booking Duration Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {usageQuery.isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : usageQuery.error ? (
                  <SectionError title="Booking Duration" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                ) : (
                  <div className="h-[300px]">
                    <BarChart 
                      data={usageQuery.data?.bookingDuration || []}
                      width={533}
                      height={300}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="duration" 
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                      />
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [
                          name === 'count' ? `${value} bookings` : `${value}%`,
                          name === 'count' ? 'Bookings' : 'Percentage'
                        ]}
                        labelFormatter={(label) => `Duration: ${label}`}
                      />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        fill={'hsl(var(--chart-1))'}
                        radius={[4, 4, 0, 0]}
                        name="Booking Count"
                      />
                    </BarChart>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Location Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {usageQuery.isLoading ? (
                  <div className="h-[300px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : usageQuery.error ? (
                  <SectionError title="Location Performance" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                ) : (
                  <div className="h-[300px]">
                    <BarChart 
                      data={usageQuery.data?.locationPerformance || []}
                      layout="horizontal"
                      width={533}
                      height={300}
                      margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="location" 
                        tick={{ fontSize: 12 }}
                        width={60}
                      />
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [
                          name === 'utilization' ? `${value}%` : `$${value.toLocaleString()}`,
                          name === 'utilization' ? 'Utilization' : name === 'earnings' ? 'Earnings' : name
                        ]}
                        labelFormatter={(label) => `Location: ${label}`}
                      />
                      <Legend />
                      <Bar 
                        dataKey="utilization" 
                        fill={'hsl(var(--chart-1))'} 
                        name="Utilization %"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Weekly Trends Chart */}
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
        </TabsContent>

        {/* Top Performers Tab */}
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
          
          {/* Additional Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Spot Utilization Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {topPerformersQuery.isLoading ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : topPerformersQuery.error ? (
                  <SectionError title="Utilization" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                ) : (
                  <div className="h-[200px]">
                    <BarChart 
                      data={topPerformersQuery.data?.topSpots?.map(spot => ({ 
                        spot: spot.spotNumber, 
                        utilization: spot.utilization 
                      })) || []}
                      width={350}
                      height={200}
                    >
                      <XAxis 
                        dataKey="spot" 
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <RechartsTooltip 
                        formatter={(value: number) => [`${value}%`, 'Utilization']}
                      />
                      <Bar 
                        dataKey="utilization" 
                        fill={'hsl(var(--chart-3))'} 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Owner Performance Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                {topPerformersQuery.isLoading ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : topPerformersQuery.error ? (
                  <SectionError title="Ratings" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                ) : (
                  <div className="h-[200px]">
                    <BarChart 
                      data={topPerformersQuery.data?.topOwners?.map(owner => ({ 
                        name: owner.name.split(' ')[0], 
                        rating: owner.averageRating 
                      })) || []}
                      width={350}
                      height={200}
                    >
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        domain={[0, 5]}
                      />
                      <RechartsTooltip 
                        formatter={(value: number) => [`${value}⭐`, 'Rating']}
                      />
                      <Bar 
                        dataKey="rating" 
                        fill={'hsl(var(--chart-4))'} 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Booking Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {topPerformersQuery.isLoading ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : topPerformersQuery.error ? (
                  <SectionError title="Bookings" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                ) : (
                  <div className="h-[200px]">
                    <BarChart 
                      data={topPerformersQuery.data?.topOwners?.map(owner => ({ 
                        name: owner.name.split(' ')[0], 
                        bookings: owner.bookingsCount 
                      })) || []}
                      width={350}
                      height={200}
                    >
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                      />
                      <RechartsTooltip 
                        formatter={(value: number) => [value, 'Bookings']}
                      />
                      <Bar 
                        dataKey="bookings" 
                        fill={'hsl(var(--chart-5))'} 
                        radius={[4, 4, 0, 0]}
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
  )
}