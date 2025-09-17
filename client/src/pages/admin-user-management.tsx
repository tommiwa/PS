import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AdminUsersTable } from "@/components/admin-users-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { insertUserSchema, type InsertUser, type User } from "@shared/schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from "lucide-react"

// Extend shared schema with UI validation refinements
const createUserFormSchema = insertUserSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  department: z.string().min(1, "Department is required"),
});

type CreateUserFormData = InsertUser;

export default function AdminUserManagement() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showAddUser, setShowAddUser] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Form setup
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      department: "",
      role: "renter",
      memberSince: new Date().toISOString().split('T')[0]
    }
  })

  // Fetch all users for admin management
  const { data: allUsers = [], isLoading: isLoadingUsers, error: usersError, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserFormData): Promise<User> => {
      const response = await apiRequest('/api/users', { method: 'POST', body: userData });
      return await response.json();
    },
    onSuccess: (newUser: User) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowAddUser(false);
      form.reset();
      const userName = [newUser?.firstName, newUser?.lastName].filter(Boolean).join(' ') || newUser?.email || 'Unknown User';
      toast({
        title: "User Created",
        description: `Successfully created user ${userName}`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating user:', error);
      toast({
        variant: "destructive",
        title: "Error Creating User",
        description: error.message || "Failed to create user. Please try again.",
      });
    }
  });

  // Convert API user data to display format with computed name
  const displayUsers = allUsers.map((user: User) => ({
    id: user.id,
    name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email || 'Unknown User',
    email: user.email || 'No email',
    department: user.department || "Unknown",
    role: user.role || "renter",
    spotsOwned: 0, // TODO: Calculate from actual data when needed
    bookingsCount: 0, // TODO: Calculate from actual data when needed
    status: "active" as const, // TODO: Add status field to schema if needed
    lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never",
    memberSince: user.memberSince || (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"),
    totalSpent: 0, // TODO: Calculate from bookings when needed
    phoneNumber: user.phone || "No phone",
    vehicleInfo: "Not configured" // TODO: Add vehicle info to schema if needed
  }));

  // Keep the original mock data for reference (commented out)
  const originalMockUsers = [
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
      memberSince: "Jan 2023",
      totalEarnings: 450,
      phoneNumber: "(555) 123-4567",
      vehicleInfo: "Tesla Model 3 (ABC-123)"
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
      memberSince: "Mar 2023",
      totalSpent: 180,
      phoneNumber: "(555) 234-5678",
      vehicleInfo: "Honda Civic (XYZ-789)"
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
      memberSince: "Dec 2023",
      totalSpent: 45,
      phoneNumber: "(555) 345-6789",
      vehicleInfo: "Toyota Camry (JKL-012)"
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
      memberSince: "Jan 2022",
      phoneNumber: "(555) 456-7890"
    },
    {
      id: "user-005",
      name: "Emma Wilson",
      email: "e.wilson@bci.ca",
      department: "HR",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 12,
      status: "suspended" as const,
      lastLogin: "2024-01-10",
      memberSince: "Jun 2023",
      totalSpent: 240,
      phoneNumber: "(555) 567-8901",
      vehicleInfo: "BMW X3 (DEF-456)"
    }
  ];

  const filteredUsers = (isLoadingUsers ? [] : displayUsers).filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = filterRole === "all" || user.role === filterRole
    const matchesStatus = filterStatus === "all" || user.status === filterStatus
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const handleEditUser = (userId: string) => {
    console.log('Edit user:', userId)
    // TODO: Open edit user dialog with form to update user information
    // For now, just show which user would be edited
    alert(`Edit functionality for user ${userId} would open here. This requires implementing a user edit dialog.`)
  }

  const handleDeleteUser = async (userId: string) => {
    const user = displayUsers.find(u => u.id === userId)
    if (!user) return

    const confirmed = await confirm(confirmations.deleteUser(user.name))
    if (confirmed) {
      console.log('Delete user:', userId)
      // TODO: Implement actual user deletion logic
    }
  }

  const handleSuspendUser = async (userId: string) => {
    const user = displayUsers.find(u => u.id === userId)
    if (!user) return

    const confirmed = await confirm({
      title: user.status === "active" ? "Suspend User" : "Activate User",
      description: user.status === "active" 
        ? `Are you sure you want to suspend ${user.name}? They will lose access to the parking system and their active bookings will be cancelled.`
        : `Are you sure you want to activate ${user.name}? They will regain access to the parking system.`,
      confirmText: user.status === "active" ? "Suspend User" : "Activate User",
      cancelText: "Cancel",
      variant: user.status === "active" ? "destructive" : "default"
    })
    
    if (confirmed) {
      console.log('Suspend/Activate user:', userId)
      // TODO: Implement actual user suspension/activation logic via API
      const action = user.status === "active" ? "suspended" : "activated"
      alert(`User ${user.name} has been ${action}! (This would be handled via API in production)`)
    }
  }

  const handleAssignSpot = (userId: string) => {
    console.log('Assign spot to user:', userId)
  }

  const handleSendNotification = async (userId: string) => {
    const user = displayUsers.find(u => u.id === userId)
    if (!user) return

    const confirmed = await confirm({
      title: "Send Email Notification",
      description: `Are you sure you want to send an email notification to ${user.name} (${user.email})? This will send a system notification to their registered email address.`,
      confirmText: "Send Email",
      cancelText: "Cancel",
      variant: "default"
    })
    
    if (confirmed) {
      console.log('Send notification to user:', userId)
      // TODO: Implement actual email sending logic via API
      alert(`Email notification sent to ${user.name} at ${user.email}!`)
    }
  }

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "suspended":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  // Handle form submission
  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  const roleStats = {
    admin: allUsers.filter((u: User) => u.role === "admin").length,
    owner: allUsers.filter((u: User) => u.role === "owner").length,
    renter: allUsers.filter((u: User) => u.role === "renter").length,
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-users">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and permissions across the parking system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetchUsers()}
            disabled={isLoadingUsers}
            data-testid="button-refresh-users"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Users
          </Button>
          <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} value={field.value || ''} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} value={field.value || ''} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="john.doe@bci.ca" {...field} value={field.value || ''} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <FormControl>
                            <Input placeholder="Engineering" {...field} value={field.value || ''} data-testid="input-department" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || 'renter'}>
                            <FormControl>
                              <SelectTrigger data-testid="select-role">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="renter">Renter</SelectItem>
                              <SelectItem value="owner">Spot Owner</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} value={field.value || ''} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => {
                        setShowAddUser(false);
                        form.reset();
                      }}
                      disabled={createUserMutation.isPending}
                      data-testid="button-cancel-add-user"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createUserMutation.isPending}
                      data-testid="button-submit-add-user"
                    >
                      {createUserMutation.isPending ? "Creating..." : "Add User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* User Role Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer hover-elevate ${
            filterRole === 'admin' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setFilterRole(filterRole === 'admin' ? 'all' : 'admin')}
          data-testid="card-filter-admin"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Administrators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingUsers ? "..." : roleStats.admin}
            </div>
            <Badge variant="secondary" className="text-xs">System access</Badge>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${
            filterRole === 'owner' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setFilterRole(filterRole === 'owner' ? 'all' : 'owner')}
          data-testid="card-filter-owner"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spot Owners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingUsers ? "..." : roleStats.owner}
            </div>
            <Badge variant="default" className="text-xs">Revenue generators</Badge>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${
            filterRole === 'renter' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setFilterRole(filterRole === 'renter' ? 'all' : 'renter')}
          data-testid="card-filter-renter"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Renters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingUsers ? "..." : roleStats.renter}
            </div>
            <Badge variant="outline" className="text-xs">Regular users</Badge>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${
            filterRole === 'all' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setFilterRole('all')}
          data-testid="card-filter-all"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingUsers ? "..." : allUsers.length}
            </div>
            <Badge variant="outline" className="text-xs">System users</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-users"
                />
              </div>
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-role">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="renter">Renter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowBulkActions(!showBulkActions)}>
              <Filter className="h-4 w-4 mr-2" />
              Bulk Actions
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {showBulkActions && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Bulk Actions:</span>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('send-notification')}>
                <Mail className="h-4 w-4 mr-1" />
                Send Notification
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('export-selected')}>
                <Download className="h-4 w-4 mr-1" />
                Export Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('suspend')}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                Suspend Users
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Activity</th>
                  <th className="p-4 font-medium">Financial</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">{user.department}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.role === "admin" ? "default" : "outline"}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(user.status)}
                        <span className="text-sm">{user.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last login: {user.lastLogin}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>Bookings: {user.bookingsCount}</div>
                        {user.spotsOwned > 0 && <div>Spots: {user.spotsOwned}</div>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {user.role === 'owner' && <div>Earnings: $0</div>}
                        {user.totalSpent && <div>Spent: ${user.totalSpent}</div>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleEditUser(user.id)} data-testid={`button-edit-${user.id}`}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSendNotification(user.id)} data-testid={`button-notify-${user.id}`}>
                          <Mail className="h-3 w-3" />
                        </Button>
                        {user.status === "active" ? (
                          <Button size="sm" variant="outline" onClick={() => handleSuspendUser(user.id)} data-testid={`button-suspend-${user.id}`}>
                            Suspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleSuspendUser(user.id)} data-testid={`button-activate-${user.id}`}>
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}