import { AdminUsersTable } from "@/components/admin-users-table"
import { DashboardStats } from "@/components/dashboard-stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Car, Clock, AlertTriangle, TrendingUp, Plus } from "lucide-react"

export default function Admin() {
  //todo: remove mock functionality
  const mockUsers = [
    {
      id: "user-001",
      name: "Sarah Chen",
      email: "sarah.chen@bci.com",
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
      email: "m.rodriguez@bci.com",
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
      email: "j.kim@bci.com", 
      department: "Finance",
      role: "waitlist" as const,
      spotsOwned: 0,
      bookingsCount: 3,
      status: "active" as const,
      lastLogin: "2024-01-12",
      memberSince: "Dec 2023"
    },
    {
      id: "user-004",
      name: "David Thompson",
      email: "d.thompson@bci.com",
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
      email: "e.wilson@bci.com",
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
            Manage users, parking spots, and system settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Button variant="outline">
            <Car className="h-4 w-4 mr-2" />
            Add Spot
          </Button>
        </div>
      </div>

      {/* Admin Dashboard Stats */}
      <DashboardStats userRole="admin" />

      {/* System Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pending Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">3</div>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">Require immediate attention</p>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">2 Payment disputes</Badge>
              <Badge variant="secondary" className="text-xs ml-1">1 Spot conflict</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              System Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98.5%</div>
            <p className="text-xs text-muted-foreground">Uptime this month</p>
            <div className="mt-2">
              <Badge variant="default" className="text-xs">All systems operational</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Waitlist Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">245</div>
            <p className="text-xs text-muted-foreground">People waiting for spots</p>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">Avg wait: 6 months</Badge>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">New user registration</p>
                  <p className="text-xs text-muted-foreground">Emma Wilson joined the waitlist</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">2 hours ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Spot assignment</p>
                  <p className="text-xs text-muted-foreground">Assigned spot A-15 to Michael Rodriguez</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">4 hours ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium">Payment dispute</p>
                  <p className="text-xs text-muted-foreground">Dispute reported for booking B-008</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">6 hours ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}