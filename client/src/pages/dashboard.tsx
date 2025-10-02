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
import { Calendar, MapPin, Clock, Plus, Users, Car, TrendingUp, BarChart3, PieChart, Target, DollarSign, AlertTriangle, Download, RefreshCw, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react"
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
  AnalyticsUsageResponse
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
  const { getCurrentViewRole } = useAuth();
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

  const isLoading = overviewQuery.isLoading || revenueQuery.isLoading || 
                   topPerformersQuery.isLoading || issuesQuery.isLoading || 
                   usageQuery.isLoading;

  const handleRefresh = () => {
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
  //todo: remove mock functionality
  const mockUpcomingBookings = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "750 Pandora Ave, Victoria BC - Level 2",
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
      ownerId: "user-owner-002", // Changed from owner to ownerId with proper format
      description: "Regular parking spot in South Parking Lot",
      isActive: true, // Changed from isAvailable to isActive
      isBookable: true,
      createdAt: new Date("2023-12-01T10:00:00Z")
    },
    {
      id: "P-004",
      spotNumber: "A-22",
      location: "750 Pandora Ave, Victoria BC - Level 1",
      spotType: "accessible" as const,
      isIndoor: true,
      ownerId: "user-owner-003", // Changed from owner to ownerId with proper format
      description: "Accessible parking spot with convenient access",
      isActive: true, // Changed from isAvailable to isActive
      isBookable: true,
      createdAt: new Date("2023-12-01T11:00:00Z")
    }
  ]


  const renderRoleSpecificContent = () => {
    switch (effectiveRole) {
      case "renter":
        return (
          <div className="space-y-6">
            {/* Simplified Spending Overview */}
            {(!activeFilter || activeFilter === "month-spent") && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Spending Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-monthly-spending">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          This Month
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">$75</div>
                        <div className="text-xs text-muted-foreground mb-2">8 bookings • $25 avg per day</div>
                        <div className="text-xs text-green-600">$20 saved vs last month</div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your total parking expenses for this month, including active and completed bookings</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-monthly-budget">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Monthly Budget
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">$100</div>
                        <div className="text-xs text-muted-foreground mb-2">Budget limit</div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 w-full hover:bg-transparent"
                              data-testid="progress-budget-utilization"
                            >
                              <Progress value={75} className="h-2 w-full" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Budget utilization: 75% used ($75 of $100) - you have $25 remaining this month</p>
                          </TooltipContent>
                        </Tooltip>
                        <div className="text-xs text-green-600 mt-1">$25 remaining</div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your monthly parking budget limit. Set and track your spending to manage expenses</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            )}

            {/* Location & Usage Patterns */}
            {(!activeFilter || activeFilter === "favorite-locations") && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Usage Patterns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-favorite-locations">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Favorite Locations
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">750 Pandora Ave, Victoria BC</div>
                              <div className="text-xs text-muted-foreground">Level 2 - Indoor</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">67%</div>
                              <div className="text-xs text-muted-foreground">15 bookings</div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 w-full hover:bg-transparent"
                                data-testid="progress-location-usage-main"
                              >
                                <Progress value={67} className="h-2 w-full" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>67% of your bookings at this location - your most preferred parking spot</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">North Parking Lot</div>
                              <div className="text-xs text-muted-foreground">Outdoor - Budget</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">33%</div>
                              <div className="text-xs text-muted-foreground">8 bookings</div>
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 w-full hover:bg-transparent"
                                data-testid="progress-location-usage-north"
                              >
                                <Progress value={33} className="h-2 w-full" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>33% of your bookings at this budget-friendly outdoor location</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your most frequently booked parking locations with usage statistics</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-peak-booking-days">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Peak Booking Days
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Tuesday</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:bg-transparent"
                                  data-testid="badge-tuesday-popularity"
                                >
                                  <Badge variant="default">Most Popular</Badge>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tuesday is your most frequent booking day - consider booking early for this day</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Wednesday</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:bg-transparent"
                                  data-testid="badge-wednesday-popularity"
                                >
                                  <Badge variant="secondary">High Demand</Badge>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Wednesday has high booking demand - spots may fill up quickly</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Monday</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:bg-transparent"
                                  data-testid="badge-monday-popularity"
                                >
                                  <Badge variant="outline">Moderate</Badge>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Monday has moderate booking activity - good availability expected</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="pt-3 border-t">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                                data-testid="text-booking-tip"
                              >
                                💡 Book 2+ days ahead for better availability
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Pro tip: Booking 2+ days in advance gives you more spot options and better prices</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Days of the week when you book parking most often - helps you plan ahead</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            )}

            {/* Simple Performance Summary */}
            {(!activeFilter || activeFilter === "active-bookings" || activeFilter === "booking-history") && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Booking Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-advance-booking">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Advance Booking
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">2.3 days</div>
                        <div className="text-xs text-muted-foreground">Average notice given</div>
                        <div className="mt-2 text-xs text-blue-600">
                          Great for securing preferred spots
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How far in advance you typically book parking. Booking ahead helps secure better spots and prices</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card tabIndex={0} role="button" className="cursor-help focus:ring-2 focus:ring-primary focus:outline-none" data-testid="card-success-rate">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Success Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">94%</div>
                        <div className="text-xs text-muted-foreground">Bookings completed successfully</div>
                        <div className="mt-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 hover:bg-transparent"
                                data-testid="badge-performance-rating"
                              >
                                <Badge variant="secondary" className="text-xs text-green-600">
                                  Excellent performance
                                </Badge>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>You have an excellent booking completion rate - reliable renter status</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Percentage of your bookings that were completed without cancellation or issues</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            )}
          </div>
        )
        
      case "owner":
        return (
          <div className="space-y-6">
            {/* Owner's Rental Business Section */}
            {(!activeFilter || activeFilter === "my-spots" || activeFilter === "month-earnings") && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Spots - Recent Bookings</h2>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  List Availability
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockUpcomingBookings.map((booking) => (
                  <BookingCard 
                    key={booking.id} 
                    booking={booking} 
                    showRenterInfo={true}
                  />
                ))}
              </div>
            </div>
            )}
            
            {/* Owner Quick Actions */}
            {(!activeFilter || activeFilter === "availability-listed") && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Spot Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">List Spot</h3>
                    <p className="text-sm text-muted-foreground">Make your spot available</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">Set Recurring</h3>
                    <p className="text-sm text-muted-foreground">Weekly availability</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-medium">Manage Spots</h3>
                    <p className="text-sm text-muted-foreground">Edit spot details</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}

            {/* Renter Functionality for Owners */}
            {(!activeFilter || activeFilter === "upcoming-bookings") && (
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Car className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Your Bookings - When You Need Parking</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Your Upcoming Bookings</h3>
                    <Button size="sm" variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mockUpcomingBookings.slice(0, 2).map((booking) => (
                      <BookingCard key={`renter-${booking.id}`} booking={booking} />
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Available Spots to Book</h3>
                    <Button size="sm" variant="outline">
                      <MapPin className="h-4 w-4 mr-2" />
                      Search All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mockAvailableSpots.map((spot) => (
                      <ParkingSpotCard key={spot.id} spot={spot} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )
        
      case "admin":
        return null
        
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {userRole === "admin" ? "Dashboard" : "Statistics"}
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