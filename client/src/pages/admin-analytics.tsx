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
  Loader2
} from "lucide-react"
import type { 
  AnalyticsOverviewResponse,
  AnalyticsRevenueResponse, 
  AnalyticsTopPerformersResponse,
  AnalyticsIssuesResponse,
  AnalyticsUsageResponse
} from "@shared/schema"

export default function AdminAnalytics() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState("last-30-days");
  
  // React Query hooks for fetching real analytics data
  const overviewQuery = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['/api/admin/analytics-overview'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const revenueQuery = useQuery<AnalyticsRevenueResponse>({
    queryKey: ['/api/admin/analytics-revenue'],
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
      <h4 className="text-sm font-medium mb-1">Error Loading {title}</h4>
      <p className="text-xs text-muted-foreground mb-3">
        Failed to load this section. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline" size="sm">
        <RefreshCw className="h-3 w-3 mr-1" />
        Retry
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
            Refresh
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
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
          <Button variant="outline" disabled={isLoading}>
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
                  +{overviewQuery.data?.monthlyGrowth || 0}% from last month
                </p>
              </>
            )}
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
                <p className="text-xs text-muted-foreground">This year</p>
              </>
            )}
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
                <p className="text-xs text-muted-foreground">Monthly active</p>
              </>
            )}
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
                  {(overviewQuery.data?.utilizationRate || 0) > 75 ? 'Above target (75%)' : 'Below target (75%)'}
                </p>
              </>
            )}
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
                <p className="text-xs text-muted-foreground">Per booking</p>
              </>
            )}
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
                <p className="text-xs text-green-600">Month over month</p>
              </>
            )}
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
                {revenueQuery.isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-2 flex-1" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : revenueQuery.error ? (
                  <SectionError title="Revenue Trend" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] })} />
                ) : revenueQuery.data ? (
                  <div className="space-y-4">
                    {revenueQuery.data.monthlyData.slice(-6).map((month, index) => {
                      const maxRevenue = Math.max(...revenueQuery.data!.monthlyData.map(m => m.revenue));
                      const percentage = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                      return (
                        <div key={`${month.month}-${month.year}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 text-sm font-medium">{month.month}</div>
                            <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm font-medium">${month.revenue.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {revenueQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))
                ) : revenueQuery.error ? (
                  <SectionError title="Revenue Breakdown" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] })} />
                ) : revenueQuery.data ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Spot Owner Earnings</span>
                      <span className="font-medium">
                        ${revenueQuery.data.revenueBreakdown.ownerEarnings.toLocaleString()} 
                        ({revenueQuery.data.revenueBreakdown.ownerEarningsPercentage}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fees</span>
                      <span className="font-medium">
                        ${revenueQuery.data.revenueBreakdown.platformFees.toLocaleString()} 
                        ({revenueQuery.data.revenueBreakdown.platformFeesPercentage}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Fees</span>
                      <span className="font-medium">
                        ${revenueQuery.data.revenueBreakdown.processingFees.toLocaleString()} 
                        ({revenueQuery.data.revenueBreakdown.processingFeesPercentage}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other Revenue</span>
                      <span className="font-medium">
                        ${revenueQuery.data.revenueBreakdown.otherRevenue.toLocaleString()} 
                        ({revenueQuery.data.revenueBreakdown.otherRevenuePercentage}%)
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No breakdown data available
                  </div>
                )}
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
                {usageQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-2 w-20" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : usageQuery.error ? (
                  <SectionError title="Peak Hours" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                ) : usageQuery.data ? (
                  <div className="space-y-3">
                    {usageQuery.data.peakHours.map((period) => (
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No peak hours data available
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
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-2 w-20" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : usageQuery.error ? (
                  <SectionError title="Location Performance" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] })} />
                ) : usageQuery.data ? (
                  <div className="space-y-3">
                    {usageQuery.data.locationPerformance.map((loc) => (
                      <div key={loc.location} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{loc.location}</div>
                          <div className="text-sm text-muted-foreground">{loc.spotsCount} spots</div>
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No location performance data available
                  </div>
                )}
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
                {topPerformersQuery.isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-8" />
                          <div>
                            <Skeleton className="h-4 w-20 mb-1" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-16 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topPerformersQuery.error ? (
                  <SectionError title="Top Performing Spots" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                ) : topPerformersQuery.data ? (
                  <div className="space-y-4">
                    {topPerformersQuery.data.topSpots.map((spot, index) => (
                      <div key={spot.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <div className="font-medium">Spot {spot.spotNumber}</div>
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No top performing spots data available
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
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-8" />
                          <div>
                            <Skeleton className="h-4 w-24 mb-1" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-16 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : topPerformersQuery.error ? (
                  <SectionError title="Top Earning Owners" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] })} />
                ) : topPerformersQuery.data ? (
                  <div className="space-y-4">
                    {topPerformersQuery.data.topOwners.map((owner, index) => (
                      <div key={owner.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{owner.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {owner.spotsCount} spots • {owner.averageRating} rating
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${owner.earnings}</div>
                          <div className="text-sm text-muted-foreground">This year</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No top earning owners data available
                  </div>
                )}
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
                {issuesQuery.data && (
                  <Badge variant="outline" className="ml-auto">
                    {issuesQuery.data.issuesSummary.total} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issuesQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-6 w-16" />
                          <div>
                            <Skeleton className="h-4 w-24 mb-1" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-3 w-20 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-full mb-3" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : issuesQuery.error ? (
                <SectionError title="Issues & Alerts" onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-issues'] })} />
              ) : issuesQuery.data ? (
                <div className="space-y-4">
                  {issuesQuery.data.activeIssues.length > 0 ? (
                    issuesQuery.data.activeIssues.map((issue) => (
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
                          <Button size="sm" variant="outline" disabled>
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" disabled>
                            Assign
                          </Button>
                          <Button size="sm" variant="outline" disabled>
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Active Issues</h3>
                      <p className="text-muted-foreground">
                        All systems are operating normally. No issues or alerts to display.
                      </p>
                    </div>
                  )}
                  
                  {/* Issues Summary */}
                  {issuesQuery.data.issuesSummary.total > 0 && (
                    <div className="border-t pt-4 mt-6">
                      <h4 className="font-medium mb-3">Issues Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {issuesQuery.data.issuesSummary.critical}
                          </div>
                          <div className="text-sm text-muted-foreground">Critical</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {issuesQuery.data.issuesSummary.high}
                          </div>
                          <div className="text-sm text-muted-foreground">High</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {issuesQuery.data.issuesSummary.medium}
                          </div>
                          <div className="text-sm text-muted-foreground">Medium</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {issuesQuery.data.issuesSummary.low}
                          </div>
                          <div className="text-sm text-muted-foreground">Low</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Unable to load issues data
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}