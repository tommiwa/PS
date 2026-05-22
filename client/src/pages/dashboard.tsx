import { DashboardStats } from "@/components/dashboard-stats"
import { OwnerStatistics } from "@/components/owner-statistics"
import { BookingCard } from "@/components/booking-card"
import { ParkingSpotCard } from "@/components/parking-spot-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Calendar, MapPin, Clock, Plus, Users, Car, TrendingUp, BarChart3, PieChart, Target, DollarSign, AlertTriangle, Download, RefreshCw, Loader2, Eye, EyeOff, AlertCircle, Bell, ParkingSquare, Building2, Award, Trophy, Medal, Flame } from "lucide-react"
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
  RenterStatsPeriod,
  RenterStatsStatus,
  RenterBookingRank
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
  // City parking comparison toggle
  const [showCityParking, setShowCityParking] = useState(false);

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

  // Renter booking rank query — all-time, no filters
  const renterBookingRankQuery = useQuery<RenterBookingRank | null>({
    queryKey: ['/api/renter/booking-rank'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/renter/booking-rank', { credentials: 'include' });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: effectiveRole === "renter",
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
    queryClient.invalidateQueries({ queryKey: ['/api/renter/booking-rank'] });
    queryClient.invalidateQueries({ queryKey: ['/api/renter/dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/owner/statistics/v2'] });
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

    const rows = [
      [`Period: ${periodLabel}`],
      [],
      ['Date', 'Bookings', 'Amount Spent'],
      ...data.map(d => [d.label, String(d.bookings), d.spent.toFixed(2)])
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spending-${renterPeriod}.csv`;
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
            <OwnerStatistics />
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
                {/* Booking Rank Widget */}
                <RenterBookingRankWidget
                  data={renterBookingRankQuery.data ?? null}
                  isLoading={renterBookingRankQuery.isLoading}
                />

                {/* Spending Trends Chart with Bar/Line toggle */}
                <Card data-testid="card-monthly-spending">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Spending Trends — {renterStatsQuery.data.stats.periodLabel}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={showCityParking ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setShowCityParking(v => !v)}
                          data-testid="button-toggle-city-parking"
                        >
                          <Building2 className="h-4 w-4 mr-1" />
                          Compare with city parking
                        </Button>
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
                    </div>
                    {showCityParking && (
                      <p className="text-xs text-muted-foreground mt-1">
                        City parking equivalent at ${renterStatsQuery.data.cityParkingDailyRate}/day
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        {spendingChartType === 'bar' ? (
                          <BarChart data={renterStatsQuery.data.spendingData.map(d => ({
                            ...d,
                            cityParking: Number((d.bookedDays * renterStatsQuery.data!.cityParkingDailyRate).toFixed(2))
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <RechartsTooltip {...tooltipStyle} formatter={(value: number | string) => [`$${value}`, undefined]} />
                            {showCityParking && <Legend />}
                            <Bar dataKey="spent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Amount Spent ($)" />
                            {showCityParking && (
                              <Bar dataKey="cityParking" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="City Parking Equiv. ($)" />
                            )}
                          </BarChart>
                        ) : (
                          <LineChart data={renterStatsQuery.data.spendingData.map(d => ({
                            ...d,
                            cityParking: Number((d.bookedDays * renterStatsQuery.data!.cityParkingDailyRate).toFixed(2))
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <RechartsTooltip {...tooltipStyle} formatter={(value: number | string) => [`$${value}`, undefined]} />
                            {showCityParking && <Legend />}
                            <Line type="monotone" dataKey="spent" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Amount Spent ($)" />
                            {showCityParking && (
                              <Line type="monotone" dataKey="cityParking" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" name="City Parking Equiv. ($)" />
                            )}
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                    {showCityParking && (() => {
                      const totalSpent = renterStatsQuery.data!.spendingData.reduce((sum, d) => sum + d.spent, 0);
                      const totalCityParking = renterStatsQuery.data!.spendingData.reduce((sum, d) => sum + d.bookedDays * renterStatsQuery.data!.cityParkingDailyRate, 0);
                      const savings = totalCityParking - totalSpent;
                      const saved = savings >= 0;
                      const { indoorSpotsCount, bciManagedCount, totalUniqueSpotsUsed } = renterStatsQuery.data!.convenienceStats;
                      return (
                        <div
                          className="mt-4 rounded-md border bg-muted/40 p-4 space-y-4"
                          data-testid="section-city-parking-savings-summary"
                        >
                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">ParkShare Spent</span>
                              <span className="text-lg font-semibold">${totalSpent.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">City Parking Equiv.</span>
                              <span className="text-lg font-semibold">${totalCityParking.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">
                                {saved ? 'You Saved' : 'Extra Cost'}
                              </span>
                              <span className={`text-lg font-semibold ${saved ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                {saved ? '+' : '-'}${Math.abs(savings).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {totalUniqueSpotsUsed > 0 && (
                            <>
                              <Separator />
                              <div className="grid grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Spots Used</span>
                                  <span className="text-base font-medium">{totalUniqueSpotsUsed}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Covered / Indoor</span>
                                  <span className="text-base font-medium">
                                    {indoorSpotsCount > 0 ? `${indoorSpotsCount} of ${totalUniqueSpotsUsed}` : 'None'}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Reserved Spots</span>
                                  <span className="text-base font-medium">
                                    {bciManagedCount > 0 ? `${bciManagedCount} of ${totalUniqueSpotsUsed}` : 'None'}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
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
                        <>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={renterStatsQuery.data.topSpots.map(s => ({
                                name: s.spotNumber.length > 20 ? s.spotNumber.substring(0, 18) + '…' : s.spotNumber,
                                fullName: s.spotNumber,
                                spent: s.totalSpent,
                                bookings: s.bookingsCount,
                                isIndoor: s.isIndoor,
                                isBciManaged: s.isBciManaged,
                              }))}
                              margin={{ left: 8, right: 16 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis type="category" dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={80} />
                              <RechartsTooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0].payload as { fullName: string; spent: number; bookings: number; isIndoor: boolean; isBciManaged: boolean };
                                  return (
                                    <div style={tooltipStyle.contentStyle} className="p-2 text-xs space-y-1">
                                      <p style={tooltipStyle.labelStyle} className="font-medium mb-1">{d.fullName}</p>
                                      <p style={{ color: 'hsl(var(--muted-foreground))' }}>Spent: <span style={tooltipStyle.labelStyle} className="font-semibold">${d.spent.toFixed(2)}</span></p>
                                      <p style={{ color: 'hsl(var(--muted-foreground))' }}>Bookings: <span style={tooltipStyle.labelStyle} className="font-semibold">{d.bookings}</span></p>
                                      {(d.isIndoor || d.isBciManaged) && (
                                        <div className="flex gap-1 pt-1 flex-wrap">
                                          {d.isIndoor && (
                                            <span style={{ backgroundColor: 'hsl(217 91% 90%)', color: 'hsl(217 91% 30%)', borderRadius: '9999px', padding: '1px 7px', fontSize: '10px', fontWeight: 500 }}>
                                              Indoor
                                            </span>
                                          )}
                                          {d.isBciManaged && (
                                            <span style={{ backgroundColor: 'hsl(270 60% 90%)', color: 'hsl(270 60% 30%)', borderRadius: '9999px', padding: '1px 7px', fontSize: '10px', fontWeight: 500 }}>
                                              Reserved
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="spent" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Spent ($)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {renterStatsQuery.data.topSpots.some(s => s.isIndoor || s.isBciManaged) && (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                            {renterStatsQuery.data.topSpots.filter(s => s.isIndoor || s.isBciManaged).map(s => (
                              <div key={s.spotId} className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">{s.spotNumber.length > 16 ? s.spotNumber.substring(0, 14) + '…' : s.spotNumber}:</span>
                                {s.isIndoor && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-auto no-default-active-elevate">Indoor</Badge>}
                                {s.isBciManaged && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-auto no-default-active-elevate">Reserved</Badge>}
                              </div>
                            ))}
                          </div>
                        )}
                        </>
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

      {effectiveRole !== "owner" && (
        <DashboardStats
          userRole={effectiveRole}
          onCardClick={handleStatCardClick}
          renterPeriod={renterPeriod}
          renterStatus={renterStatus}
        />
      )}
      
      {renderRoleSpecificContent()}
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

interface RankTierConfig {
  Icon: React.ElementType
  gradient: string
  borderColor: string
  iconBg: string
  iconColor: string
  rankColor: string
  label: string
  message: string
}

function getRenterRankTier(rank: number): RankTierConfig {
  if (rank === 1) return {
    Icon: Trophy,
    gradient: 'from-amber-400/25 via-yellow-300/15 to-transparent dark:from-amber-500/30 dark:via-yellow-400/15 dark:to-transparent',
    borderColor: 'border-amber-400/50 dark:border-amber-500/40',
    iconBg: 'bg-amber-400/20 dark:bg-amber-500/25',
    iconColor: 'text-amber-600 dark:text-amber-400',
    rankColor: 'text-amber-600 dark:text-amber-400',
    label: 'Champion',
    message: "You're the #1 most active parker — keep leading the way!",
  }
  if (rank <= 3) return {
    Icon: Medal,
    gradient: 'from-slate-400/20 via-gray-300/10 to-transparent dark:from-slate-400/25 dark:via-gray-400/15 dark:to-transparent',
    borderColor: 'border-slate-400/40 dark:border-slate-400/35',
    iconBg: 'bg-slate-300/30 dark:bg-slate-400/20',
    iconColor: 'text-slate-600 dark:text-slate-300',
    rankColor: 'text-slate-600 dark:text-slate-300',
    label: 'Elite',
    message: "You're in the top 3 — an elite performer in the parking program!",
  }
  if (rank <= 10) return {
    Icon: Flame,
    gradient: 'from-orange-400/20 via-red-300/10 to-transparent dark:from-orange-500/25 dark:via-red-400/15 dark:to-transparent',
    borderColor: 'border-orange-400/40 dark:border-orange-500/35',
    iconBg: 'bg-orange-400/20 dark:bg-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    rankColor: 'text-orange-600 dark:text-orange-400',
    label: 'Top Performer',
    message: "You're in the top 10 — momentum is building!",
  }
  if (rank <= 25) return {
    Icon: TrendingUp,
    gradient: 'from-blue-400/20 via-sky-300/10 to-transparent dark:from-blue-500/25 dark:via-sky-400/15 dark:to-transparent',
    borderColor: 'border-blue-400/40 dark:border-blue-500/35',
    iconBg: 'bg-blue-400/20 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    rankColor: 'text-blue-600 dark:text-blue-400',
    label: 'Rising Star',
    message: "You're in the top 25 — rising through the ranks!",
  }
  return {
    Icon: Award,
    gradient: 'from-muted/60 to-transparent',
    borderColor: 'border-border',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    rankColor: 'text-foreground',
    label: 'Active Contributor',
    message: "Every booking counts — keep using the shared parking program!",
  }
}

function RenterBookingRankWidget({ data, isLoading }: { data: RenterBookingRank | null; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full" data-testid="booking-rank-skeleton" />
  }

  const hasBookings = !!data && data.rank !== null && data.totalBookings > 0

  if (!hasBookings) {
    return (
      <div
        className="flex items-center gap-4 rounded-md border bg-muted/30 px-5 py-4"
        data-testid="booking-rank-widget"
      >
        <div className="rounded-lg bg-muted p-2 text-muted-foreground shrink-0">
          <Award className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Booking Leaderboard</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Make your first booking to join the renter leaderboard and start climbing the ranks!
          </p>
        </div>
      </div>
    )
  }

  const tier = getRenterRankTier(data.rank!)
  const { Icon } = tier

  return (
    <div
      className={`rounded-md border ${tier.borderColor} bg-gradient-to-r ${tier.gradient} px-5 py-4`}
      data-testid="booking-rank-widget"
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0 text-center">
          <p className={`text-3xl font-extrabold leading-none ${tier.rankColor}`}>
            {ordinal(data.rank!)}
          </p>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mt-1 ${tier.iconColor}`}>
            {tier.label}
          </p>
        </div>
        <div className={`rounded-lg ${tier.iconBg} p-2 ${tier.iconColor} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Booking Rank</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tier.message}</p>
        </div>
      </div>
    </div>
  )
}
