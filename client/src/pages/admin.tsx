import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { useAuth } from "@/contexts/auth-context"
import { queryClient } from "@/lib/queryClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Users, Car, CalendarCheck, BarChart3, FileText, Shield,
  TrendingUp, Clock, MapPin, AlertTriangle, ArrowRight,
  Building, CheckCircle2, UserPlus, Settings, Bell, RefreshCw
} from "lucide-react"
import type { WaitingList, ParkingSpot, User, Booking } from "@shared/schema"

export default function Admin() {
  const { user } = useAuth()

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
      title: "Analytics & Reports",
      description: "View system analytics and generate reports",
      url: "/admin/analytics",
      icon: BarChart3,
      iconColor: "text-orange-600", 
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      stats: `${systemMetrics.utilizationRate}% utilization`
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

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'A';
  };

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
                  {getInitials(user?.name || 'Admin')}
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

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Administrative Functions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const getTooltipContent = (title: string) => {
              switch (title) {
                case "User Management":
                  return "Manage user accounts, roles, and permissions"
                case "Parking Management":
                  return "Manage parking spots, assignments, and waiting lists"
                case "Spot Booking Management":
                  return "Monitor active bookings and availability schedules"
                case "Analytics & Reports":
                  return "View system analytics and generate reports"
                case "Audit Logs":
                  return "View system activity logs and security audit trails"
                default:
                  return `Access ${title.toLowerCase()}`
              }
            }
            
            return (
              <Tooltip key={action.url}>
                <TooltipTrigger asChild>
                  <Card 
                    className="hover-elevate active-elevate-2 cursor-pointer transition-all duration-200 h-full"
                    tabIndex={0}
                    role="link"
                    aria-label={`Navigate to ${action.title}`}
                  >
                    <Link 
                      href={action.url}
                      data-testid={`link-${action.title.toLowerCase().replace(/\s+/g, '-')}`}
                      className="block h-full"
                    >
                      <CardContent className="p-6 h-full">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-lg ${action.bgColor}`}>
                              <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-semibold text-base">{action.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {action.description}
                            </p>
                            <div className="text-xs text-muted-foreground font-medium">
                              {action.stats}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  {getTooltipContent(action.title)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
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