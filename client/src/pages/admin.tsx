import { AdminUsersTable } from "@/components/admin-users-table"
import { DashboardStats } from "@/components/dashboard-stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays, UserPlus, ArrowRight,
  Timer, Target, CheckCircle2
} from "lucide-react"
import type { WaitingList } from "@shared/schema"

export default function Admin() {
  // Fetch waiting list data for metrics
  const { data: allWaitingList, isLoading: isLoadingWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  });

  const { data: activeWaitingList, isLoading: isLoadingActiveWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list/active"],
  });

  // Calculate waiting list metrics
  const waitingListMetrics = {
    total: allWaitingList?.length || 0,
    active: activeWaitingList?.length || 0,
    assigned: allWaitingList?.filter(entry => entry.status === "assigned").length || 0,
    highPriority: activeWaitingList?.filter(entry => entry.priority === 1).length || 0,
    mediumPriority: activeWaitingList?.filter(entry => entry.priority === 2).length || 0,
    lowPriority: activeWaitingList?.filter(entry => entry.priority === 3).length || 0,
    averageWaitTime: activeWaitingList?.length > 0 
      ? Math.round(activeWaitingList.reduce((sum, entry) => {
          const daysSinceEnrollment = Math.floor((Date.now() - new Date(entry.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysSinceEnrollment;
        }, 0) / activeWaitingList.length)
      : 0,
    recentAssignments: allWaitingList?.filter(entry => {
      if (!entry.assignedDate) return false;
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return new Date(entry.assignedDate).getTime() > thirtyDaysAgo;
    }).length || 0
  };

  const mockUsers = [
    {
      id: "user-001",
      name: "Sarah Chen",
      email: "sarah.chen@bci.ca",
      department: "Engineering",
      role: "owner" as const,
      spotsOwned: 2,
      bookingsCount: 15,
      status: "active" as const,
      lastLogin: "2024-01-15",
      memberSince: "Jan 2023"
    },
    {
      id: "user-002", 
      name: "Michael Rodriguez",
      email: "m.rodriguez@bci.ca",
      department: "Marketing",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 8,
      status: "active" as const,
      lastLogin: "2024-01-14",
      memberSince: "Mar 2023"
    },
    {
      id: "user-003",
      name: "Jennifer Kim",
      email: "j.kim@bci.ca", 
      department: "Finance",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 3,
      status: "active" as const,
      lastLogin: "2024-01-12",
      memberSince: "Dec 2023"
    },
    {
      id: "user-004",
      name: "David Thompson",
      email: "d.thompson@bci.ca",
      department: "IT",
      role: "admin" as const,
      spotsOwned: 0,
      bookingsCount: 0,
      status: "active" as const,
      lastLogin: "2024-01-15",
      memberSince: "Jan 2022"
    },
    {
      id: "user-005",
      name: "Emma Wilson",
      email: "e.wilson@bci.ca",
      department: "HR",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 12,
      status: "active" as const,
      lastLogin: "2024-01-13",
      memberSince: "Jun 2023"
    }
  ]

  const handleEditUser = (userId: string) => {
    console.log('Edit user:', userId)
    // Navigate to user edit form
  }

  const handleDeleteUser = (userId: string) => {
    console.log('Delete user:', userId)
    // Show confirmation dialog
  }

  const handleAssignSpot = (userId: string) => {
    console.log('Assign spot to user:', userId)
    // Open spot assignment dialog
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Manage users, parking spots, waiting list, and system settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users">
            <Button data-testid="button-manage-users">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
          </Link>
          <Link href="/admin/parking-spaces">
            <Button variant="outline" data-testid="button-manage-spots">
              <Car className="h-4 w-4 mr-2" />
              Manage Spots
            </Button>
          </Link>
        </div>
      </div>

      {/* Admin Dashboard Stats */}
      <DashboardStats userRole="admin" />

      {/* Waiting List Metrics */}
      <Card data-testid="card-waiting-list-metrics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Waiting List Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingWaitingList || isLoadingActiveWaitingList ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 border rounded-lg" data-testid="metric-total-waiting">
                  <div className="text-2xl font-bold text-blue-600">{waitingListMetrics.total}</div>
                  <div className="text-sm text-muted-foreground">Total Entries</div>
                </div>
                <div className="text-center p-4 border rounded-lg" data-testid="metric-active-waiting">
                  <div className="text-2xl font-bold text-orange-600">{waitingListMetrics.active}</div>
                  <div className="text-sm text-muted-foreground">Active Waiting</div>
                </div>
                <div className="text-center p-4 border rounded-lg" data-testid="metric-average-wait">
                  <div className="text-2xl font-bold text-purple-600">{waitingListMetrics.averageWaitTime}</div>
                  <div className="text-sm text-muted-foreground">Avg. Wait Days</div>
                </div>
                <div className="text-center p-4 border rounded-lg" data-testid="metric-recent-assignments">
                  <div className="text-2xl font-bold text-green-600">{waitingListMetrics.recentAssignments}</div>
                  <div className="text-sm text-muted-foreground">Assignments (30d)</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Priority Breakdown */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Priority Breakdown
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <span className="text-sm font-medium">High Priority</span>
                      <Badge variant="destructive" data-testid="badge-high-priority">{waitingListMetrics.highPriority}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span className="text-sm font-medium">Medium Priority</span>
                      <Badge variant="secondary" data-testid="badge-medium-priority">{waitingListMetrics.mediumPriority}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium">Low Priority</span>
                      <Badge variant="outline" data-testid="badge-low-priority">{waitingListMetrics.lowPriority}</Badge>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Quick Actions
                  </h4>
                  <div className="space-y-2">
                    <Link href="/admin/parking-spaces">
                      <Button variant="outline" className="w-full justify-between" data-testid="button-view-waiting-list">
                        <span>View Waiting List</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full justify-between" data-testid="button-process-assignments">
                      <span>Process Assignments</span>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Link href="/admin/analytics">
                      <Button variant="outline" className="w-full justify-between" data-testid="button-waiting-analytics">
                        <span>View Analytics</span>
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* System Status - Updated with waiting list context */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {waitingListMetrics.highPriority > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20" data-testid="alert-high-priority-waiting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                High Priority Waiting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">{waitingListMetrics.highPriority}</div>
              <p className="text-xs text-red-700 dark:text-red-300">Urgent assignments needed</p>
              <div className="mt-2">
                <Badge variant="destructive" className="text-xs">Requires immediate attention</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-system-status">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Average Wait Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{waitingListMetrics.averageWaitTime}</div>
            <p className="text-xs text-muted-foreground">Days in waiting list</p>
            <div className="mt-2">
              <Badge variant={waitingListMetrics.averageWaitTime > 14 ? "destructive" : "default"} className="text-xs">
                {waitingListMetrics.averageWaitTime > 14 ? "Above target" : "Within target"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-assignment-rate">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Assignment Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{waitingListMetrics.recentAssignments}</div>
            <p className="text-xs text-muted-foreground">Assignments last 30 days</p>
            <div className="mt-2">
              <Badge variant="default" className="text-xs">Processing active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Management Table */}
      <AdminUsersTable 
        users={mockUsers}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        onAssignSpot={handleAssignSpot}
      />

      {/* Recent Activity - Updated with waiting list activities */}
      <Card data-testid="card-recent-activity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4" data-testid="recent-activity-list">
            {/* Waiting list activities */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid="activity-waiting-enrollment">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Waiting list enrollment</p>
                  <p className="text-xs text-muted-foreground">Maria Santos enrolled for accessible spot</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">3 days ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid="activity-spot-assignment">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Spot assignment completed</p>
                  <p className="text-xs text-muted-foreground">David Park assigned to spot A-15 from waiting list</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">5 days ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid="activity-priority-update">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Priority update</p>
                  <p className="text-xs text-muted-foreground">Jennifer Wilson priority elevated due to pregnancy</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">1 week ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid="activity-enrollment-review">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Admin enrollment</p>
                  <p className="text-xs text-muted-foreground">Admin enrolled Alex Johnson for client meeting needs</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">2 weeks ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}