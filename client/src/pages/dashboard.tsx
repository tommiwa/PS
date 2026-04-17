import { DashboardStats } from "@/components/dashboard-stats"
import { BookingCard } from "@/components/booking-card"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Calendar, MapPin, Clock, Plus, Users, Car, TrendingUp, BarChart3, PieChart, Target, DollarSign, AlertTriangle, Download, RefreshCw, Loader2, Eye, EyeOff, AlertCircle, Bell, ParkingSquare } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { useState, useEffect } from "react"
import { Link } from "wouter"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { 
  Booking, 
  ParkingSpot, 
  WaitingList, 
  User, 
  AdminDashboardMetrics,
  AnalyticsOverviewResponse,
  AnalyticsRevenueResponse,
  AnalyticsTopPerformersResponse,
  AnalyticsIssuesResponse,
  AnalyticsUsageResponse,
  RenterStatisticsResponse,
  OwnerStatisticsResponse,
  RenterStatsPeriod,
  RenterStatsStatus
} from "@shared/schema"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
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
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"

interface DashboardProps {
  userRole?: "admin" | "owner" | "renter"
}

const PERIOD_OPTIONS: { value: RenterStatsPeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: '6months', label: 'Last 6 Months' },
  { value: 'year', label: 'This Year' },
];

const STATUS_OPTIONS: { value: RenterStatsStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'hsl(var(--chart-1))',
  completed: 'hsl(var(--chart-2))',
  cancelled: 'hsl(var(--chart-3))',
  pending: 'hsl(var(--chart-4))',
};

export default function Dashboard({ userRole = "owner" }: DashboardProps) {
  const { user, getCurrentViewRole } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  
  const effectiveRole = getCurrentViewRole() || userRole;
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("last-30-days");
  const { cardsVisible, toggleCards } = useCardsVisibility('analytics');

  // Renter filter state
  const [renterPeriod, setRenterPeriod] = useState<RenterStatsPeriod>('month');
  const [renterStatus, setRenterStatus] = useState<RenterStatsStatus>('all');
  // Chart type toggle for spending trend
  const [spendingChartType, setSpendingChartType] = useState<'bar' | 'line'>('bar');

  const { data: adminMetrics, isLoading: isLoadingMetrics } = useQuery<AdminDashboardMetrics>({
    queryKey: ['/api/admin/dashboard-metrics'],
    enabled: effectiveRole === "admin",
    staleTime: 2 * 60 * 1000,
  });
  
  const getMonthsBack = (range: string): number => {
    switch (range) {
      case 'last-7-days': return 1;
      case 'last-30-days': return 1;
      case 'last-3-months': return 3;
      case 'last-year': return 12;
      default: return 1;
    }
  };

  const overviewQuery = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['/api/admin/analytics-overview'],
    enabled: effectiveRole === "admin",
    staleTime: 5 * 60 * 1000,
  });

  const revenueQuery = useQuery<AnalyticsRevenueResponse>({
    queryKey: ['/api/admin/analytics-revenue', { monthsBack: getMonthsBack(dateRange) }],
    enabled: effectiveRole === "admin",
    staleTime: 5 * 60 * 1000,
  });

  const topPerformersQuery = useQuery<AnalyticsTopPerformersResponse>({
    queryKey: ['/api/admin/analytics-top-performers'],
    enabled: effectiveRole === "admin",
    staleTime: 5 * 60 * 1000,
  });

  const issuesQuery = useQuery<AnalyticsIssuesResponse>({
    queryKey: ['/api/admin/analytics-issues'],
    enabled: effectiveRole === "admin",
    staleTime: 2 * 60 * 1000,
  });

  const usageQuery = useQuery<AnalyticsUsageResponse>({
    queryKey: ['/api/admin/analytics-usage'],
    enabled: effectiveRole === "admin",
    staleTime: 5 * 60 * 1000,
  });

  // Renter statistics query — reacts to period and status
  const renterStatsQuery = useQuery<RenterStatisticsResponse>({
    queryKey: ['/api/renter/statistics', { period: renterPeriod, status: renterStatus }],
    queryFn: async () => {
      const params = new URLSearchParams({ period: renterPeriod, status: renterStatus });
      const res = await fetch(`/api/renter/statistics?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch renter statistics');
      return res.json();
    },
    enabled: effectiveRole === "renter",
    staleTime: 5 * 60 * 1000,
  });

  const ownerStatsQuery = useQuery<OwnerStatisticsResponse>({
    queryKey: ['/api/owner/statistics'],
    enabled: effectiveRole === "owner",
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = overviewQuery.isLoading || revenueQuery.isLoading || 
                   topPerformersQuery.isLoading || issuesQuery.isLoading || 
                   usageQuery.isLoading || renterStatsQuery.isLoading;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-overview'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-revenue'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-top-performers'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-issues'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics-usage'] });
    queryClient.invalidateQueries({ queryKey: ['/api/renter/statistics'] });
    queryClient.invalidateQueries({ queryKey: ['/api/renter/dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/owner/statistics'] });
  };

  const SectionError = ({ title, onRetry }: { title: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mb-2" />
      <h4 className="text-sm font-medium mb-1">{t('common.errorLoading')} {title}</h4>
      <p className="text-xs text-muted-foreground mb-3">{t('common.failedToLoad')}</p>
      <Button onClick={onRetry} variant="outline" size="sm">
        <RefreshCw className="h-3 w-3 mr-1" />
        {t('common.retry')}
      </Button>
    </div>
  );

  const getIssueColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  };

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
    bookings: { label: "Bookings", color: "hsl(var(--chart-2))" },
    ownerEarnings: { label: "Owner Earnings", color: "hsl(var(--chart-1))" },
    platformFees: { label: "Platform Fees", color: "hsl(var(--chart-2))" },
    processingFees: { label: "Processing Fees", color: "hsl(var(--chart-3))" },
    otherRevenue: { label: "Other Revenue", color: "hsl(var(--chart-4))" },
    usage: { label: "Usage", color: "hsl(var(--chart-1))" },
    utilization: { label: "Utilization", color: "hsl(var(--chart-3))" },
    rating: { label: "Rating", color: "hsl(var(--chart-4))" },
  } satisfies ChartConfig;
  
  const handleStatCardClick = (statId: string) => {
    if (activeFilter === statId) {
      setActiveFilter(null);
    } else {
      setActiveFilter(statId);
    }
  };

  useEffect(() => {
    setActiveFilter(null);
  }, [effectiveRole]);

  // CSV export for renter spending data
  const handleDownloadCSV = () => {
    if (!renterStatsQuery.data) return;
    const data = renterStatsQuery.data.spendingData;
    const periodLabel = renterStatsQuery.data.stats.periodLabel;
    const statusFilter = STATUS_OPTIONS.find(s => s.value === renterStatus)?.label || renterStatus;

    const rows = [
      ['period', 'bucket', 'status_filter', 'bookings', 'amount_spent'],
      ...data.map(d => [periodLabel, d.label, statusFilter, String(d.bookings), d.spent.toFixed(2)])
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spending-${renterPeriod}-${renterStatus}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '6px'
    },
    labelStyle: { color: 'hsl(var(--popover-foreground))' }
  };

  const mockUpcomingBookings = [
    { id: "B-001", spotNumber: "A-15", location: "Victoria - 750 Pandora Ave, Parking Level 2", date: "2024-01-16", startTime: "8:00 AM", endTime: "6:00 PM", price: 25, status: "confirmed" as const, paymentStatus: "received" as const, owner: "Sarah Chen", canCancel: true, canEdit: false },
    { id: "B-002", spotNumber: "B-08", location: "North Parking Lot", date: "2024-01-17", startTime: "9:00 AM", endTime: "5:00 PM", price: 20, status: "confirmed" as const, paymentStatus: "sent" as const, owner: "Mike Johnson", canCancel: true, canEdit: true }
  ]

  const mockAvailableSpots = [
    { id: "P-003", spotNumber: "C-12", location: "South Parking Lot", spotType: "regular" as const, isIndoor: false, isBciManaged: false, ownerId: "user-owner-002", description: "Regular parking spot in South Parking Lot", isActive: true, isBookable: true, createdAt: new Date("2023-12-01T10:00:00Z") },
    { id: "P-004", spotNumber: "A-22", location: "Victoria - 750 Pandora Ave, Parking Level 1", spotType: "accessible" as const, isIndoor: true, isBciManaged: true, ownerId: "user-owner-003", description: "Accessible parking spot with convenient access", isActive: true, isBookable: true, createdAt: new Date("2023-12-01T11:00:00Z") }
  ]

  const renderRoleSpecificContent = () => {
    return (
      <div className="space-y-6">
        {effectiveRole === "admin" && (
          <div className="space-y-4" data-testid="section-admin-dashboard">
            <h2 className="text-xl font-semibold">Admin Dashboard</h2>
            <p className="text-muted-foreground">
              Admin-specific dashboard content would go here. Currently, admins use the dedicated /admin page for analytics and management.
            </p>
          </div>
        )}

        {effectiveRole === "owner" && (
          <div className="space-y-6" data-testid="section-owner-dashboard">
            <h2 className="text-2xl font-semibold">Detailed Statistics</h2>
            {ownerStatsQuery.isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[300px]" data-testid="skeleton-chart-1" />
              </div>
            ) : ownerStatsQuery.error ? (
              <Card className="border-destructive" data-testid="card-stats-error">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Failed to Load Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">We couldn't load your statistics. Please refresh the page or try again later.</p>
                </CardContent>
              </Card>
            ) : ownerStatsQuery.data ? (
              <Card data-testid="card-monthly-earnings">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Monthly Income & Spending Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ownerStatsQuery.data.monthlyEarnings}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip {...tooltipStyle} />
                        <Legend />
                        <Bar dataKey="earned" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Income ($)" />
                        <Bar dataKey="spent" fill="hsl(24, 94%, 50%)" radius={[4, 4, 0, 0]} name="Spent ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {effectiveRole === "renter" && (
          <div className="space-y-6" data-testid="section-renter-dashboard">
            {renterStatsQuery.isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[300px]" data-testid="skeleton-chart-1" />
                <Skeleton className="h-[300px]" data-testid="skeleton-chart-2" />
              </div>
            ) : renterStatsQuery.error ? (
              <Card className="border-destructive" data-testid="card-stats-error">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Failed to Load Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">We couldn't load your statistics. Please refresh the page or try again later.</p>
                </CardContent>
              </Card>
            ) : renterStatsQuery.data ? (
              <>
                {/* Spending Trends Chart with Bar/Line toggle */}
                <Card data-testid="card-monthly-spending">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Spending Trends — {renterStatsQuery.data.stats.periodLabel}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={spendingChartType === 'bar' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSpendingChartType('bar')}
                          data-testid="button-chart-type-bar"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={spendingChartType === 'line' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSpendingChartType('line')}
                          data-testid="button-chart-type-line"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {spendingChartType === 'bar' ? (
                          <BarChart data={renterStatsQuery.data.spendingData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <RechartsTooltip {...tooltipStyle} />
                            <Bar dataKey="spent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Amount Spent ($)" />
                          </BarChart>
                        ) : (
                          <LineChart data={renterStatsQuery.data.spendingData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <RechartsTooltip {...tooltipStyle} />
                            <Line type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Amount Spent ($)" />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Bottom row: Spending by Location + Status Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Spots by Spend */}
                  <Card data-testid="card-top-spots-by-spend">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ParkingSquare className="h-5 w-5 text-primary" />
                        Top Spots by Spend
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renterStatsQuery.data.topSpots.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No spot data for this period</p>
                      ) : (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={renterStatsQuery.data.topSpots.map(s => ({
                                name: s.spotNumber.length > 20 ? s.spotNumber.substring(0, 18) + '…' : s.spotNumber,
                                fullName: s.spotNumber,
                                spent: s.totalSpent,
                                bookings: s.bookingsCount
                              }))}
                              margin={{ left: 8, right: 16 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis type="category" dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={80} />
                              <RechartsTooltip
                                contentStyle={tooltipStyle.contentStyle}
                                labelStyle={tooltipStyle.labelStyle}
                                formatter={(value: number | string, _name: string, item: object) => {
                                  const pl = (item as { payload?: { fullName?: string } }).payload;
                                  return [`$${value}`, pl?.fullName ?? ''];
                                }}
                              />
                              <Bar dataKey="spent" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Spent ($)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Booking Status Breakdown */}
                  <Card data-testid="card-status-breakdown">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Booking Status Breakdown
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Booking status breakdown for selected period
                      </p>
                    </CardHeader>
                    <CardContent>
                      {(renterStatsQuery.data.statusDistribution ?? []).every(s => s.count === 0) ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No bookings in this period</p>
                      ) : (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                              <Pie
                                data={renterStatsQuery.data.statusDistribution ?? []}
                                dataKey="count"
                                nameKey="status"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={3}
                              >
                                {(renterStatsQuery.data.statusDistribution ?? []).map((entry, index) => (
                                  <Cell
                                    key={entry.status}
                                    fill={STATUS_COLORS[entry.status] || `hsl(var(--chart-${(index % 4) + 1}))`}
                                  />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={tooltipStyle.contentStyle}
                                labelStyle={tooltipStyle.labelStyle}
                                formatter={(value: number | string, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                              />
                              <Legend
                                formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {effectiveRole === "admin" ? "Dashboard" : "Statistics"}
          </h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your parking.
          </p>
        </div>
      </div>
      
      {effectiveRole === "renter" && (
        <div className="flex flex-wrap items-center justify-between gap-3" data-testid="renter-filter-bar">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={renterPeriod} onValueChange={(v) => setRenterPeriod(v as RenterStatsPeriod)}>
              <SelectTrigger className="w-40" data-testid="select-renter-period">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={renterStatus} onValueChange={(v) => setRenterStatus(v as RenterStatsStatus)}>
              <SelectTrigger className="w-40" data-testid="select-renter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="default"
              onClick={handleDownloadCSV}
              disabled={!renterStatsQuery.data}
              data-testid="button-download-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </div>
      )}

      <DashboardStats
        userRole={effectiveRole}
        onCardClick={handleStatCardClick}
        renterPeriod={renterPeriod}
        renterStatus={renterStatus}
      />
      
      {renderRoleSpecificContent()}
    </div>
  )
}
