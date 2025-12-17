import { DashboardStats } from "@/components/dashboard-stats"
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
import { Calendar, MapPin, Clock, Plus, Users, Car, TrendingUp, BarChart3, PieChart, Target, DollarSign, AlertTriangle, Download, RefreshCw, Loader2, Eye, EyeOff, AlertCircle, Bell } from "lucide-react"
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
  OwnerStatisticsResponse
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

export default function Dashboard({ userRole = "owner" }: DashboardProps) {
  const { user, getCurrentViewRole } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  
  // Use current view role for admins, otherwise use the actual user role
  const effectiveRole = getCurrentViewRole() || userRole;
  
  // State for managing active filter from stat card clicks
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  
  // Analytics state
  const [dateRange, setDateRange] = useState("last-30-days");
  const { cardsVisible, toggleCards } = useCardsVisibility('analytics');

  // Fetch admin metrics from the new endpoint
  const { data: adminMetrics, isLoading: isLoadingMetrics } = useQuery<AdminDashboardMetrics>({
    queryKey: ['/api/admin/dashboard-metrics'],
    enabled: effectiveRole === "admin",
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
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

  // Analytics query hooks
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

  // Renter statistics query
  const renterStatsQuery = useQuery<RenterStatisticsResponse>({
    queryKey: ['/api/renter/statistics', { monthsBack: 6 }],
    enabled: effectiveRole === "renter",
    staleTime: 5 * 60 * 1000,
  });

  // Owner statistics query
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
  };

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
  
  // Handle stat card clicks for filtering
  const handleStatCardClick = (statId: string) => {
    // Toggle filter - if same card clicked, clear filter; otherwise set new filter
    if (activeFilter === statId) {
      setActiveFilter(null);
    } else {
      setActiveFilter(statId);
    }
  };

  // Reset active filter when role changes
  useEffect(() => {
    setActiveFilter(null);
  }, [effectiveRole]);

  //todo: remove mock functionality - used by Owner section only
  const mockUpcomingBookings = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "Victoria - 750 Pandora Ave, Parking Level 2",
      date: "2024-01-16",
      startTime: "8:00 AM",
      endTime: "6:00 PM",
      price: 25,
      status: "confirmed" as const,
      paymentStatus: "received" as const,
      owner: "Sarah Chen",
      canCancel: true,
      canEdit: false
    },
    {
      id: "B-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      date: "2024-01-17",
      startTime: "9:00 AM",
      endTime: "5:00 PM",
      price: 20,
      status: "confirmed" as const,
      paymentStatus: "sent" as const,
      owner: "Mike Johnson",
      canCancel: true,
      canEdit: true
    }
  ]

  const mockAvailableSpots = [
    {
      id: "P-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      spotType: "regular" as const,
      isIndoor: false,
      isBciManaged: false,
      ownerId: "user-owner-002",
      description: "Regular parking spot in South Parking Lot",
      isActive: true,
      isBookable: true,
      createdAt: new Date("2023-12-01T10:00:00Z")
    },
    {
      id: "P-004",
      spotNumber: "A-22",
      location: "Victoria - 750 Pandora Ave, Parking Level 1",
      spotType: "accessible" as const,
      isIndoor: true,
      isBciManaged: true,
      ownerId: "user-owner-003",
      description: "Accessible parking spot with convenient access",
      isActive: true,
      isBookable: true,
      createdAt: new Date("2023-12-01T11:00:00Z")
    }
  ]

  const renderRoleSpecificContent = () => {
    return (
      <div className="space-y-6">
        {/* Admin section - show only if viewing as admin */}
        {effectiveRole === "admin" && (
          <div className="space-y-4" data-testid="section-admin-dashboard">
            <h2 className="text-xl font-semibold">Admin Dashboard</h2>
            <p className="text-muted-foreground">
              Admin-specific dashboard content would go here. Currently, admins use the dedicated /admin page for analytics and management.
            </p>
          </div>
        )}

        {/* Owner section - show only if viewing as owner */}
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
                  <p className="text-muted-foreground">
                    We couldn't load your statistics. Please refresh the page or try again later.
                  </p>
                </CardContent>
              </Card>
            ) : ownerStatsQuery.data ? (
              <>
                {/* Monthly Earnings Trends Chart */}
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
                          <XAxis 
                            dataKey="month" 
                            className="text-xs" 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                          <Legend />
                          <Bar 
                            dataKey="earned" 
                            fill="hsl(142, 76%, 36%)" 
                            radius={[4, 4, 0, 0]}
                            name="Income ($)"
                          />
                          <Bar 
                            dataKey="spent" 
                            fill="hsl(24, 94%, 50%)" 
                            radius={[4, 4, 0, 0]}
                            name="Spent ($)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        )}

        {/* Renter section - show only if viewing as renter */}
        {effectiveRole === "renter" && (
          <div className="space-y-6" data-testid="section-renter-dashboard">
            <h2 className="text-2xl font-semibold">Detailed Statistics</h2>
            
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
                  <p className="text-muted-foreground">
                    We couldn't load your statistics. Please refresh the page or try again later.
                  </p>
                </CardContent>
              </Card>
            ) : renterStatsQuery.data ? (
              <>
                {/* Monthly Spending Trends Chart */}
                <Card data-testid="card-monthly-spending">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Monthly Spending Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={renterStatsQuery.data.monthlySpending}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            className="text-xs" 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                          />
                          <Bar 
                            dataKey="spent" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                            name="Amount Spent ($)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
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
      
      <DashboardStats userRole={effectiveRole} onCardClick={handleStatCardClick} />
      
      {renderRoleSpecificContent()}
    </div>
  )
}