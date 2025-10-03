import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AdminUsersTable } from "@/components/admin-users-table"
import { UserActivityList } from "@/components/user-activity-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { insertUserSchema, type InsertUser, type User, type ParkingSpot } from "@shared/schema"
import { quickExportUsersPDF, quickExportUsersExcel } from "@/utils/export-utils"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Download, 
 
  Mail, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Clock,
  RefreshCw,
  Shield,
  Car,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  Building,
  Phone,
  Calendar,
  Trash2,
  MapPin,
  FileText,
  Info
} from "lucide-react"

// Extend shared schema with UI validation refinements
const createUserFormSchema = insertUserSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  department: z.string().min(1, "Department is required"),
}).omit({
  roles: true // Remove roles from schema since we'll use 'role' (singular) in the form
}).extend({
  role: z.string().optional() // Add singular 'role' field for the form
});

type CreateUserFormData = z.infer<typeof createUserFormSchema>;

// Admin-specific interfaces for extended user data
interface UserActivity {
  id: string;
  type: 'user_created' | 'user_suspended' | 'user_activated' | 'role_changed' | 'login_failed' | 'booking_created';
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersThisWeek: number;
  suspendedUsers: number;
  adminUsers: number;
  ownerUsers: number;
  renterUsers: number;
  averageBookingsPerUser: number;
  mostActiveDepartment: string;
  recentSignups: number;
}

export default function AdminUserManagement() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [showAddUser, setShowAddUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [activeTab, setActiveTab] = useState("users")
  
  // Cards visibility toggle hook
  const { cardsVisible, toggleCards } = useCardsVisibility("user-management")
  
  // Auto-refresh data when switching tabs
  useEffect(() => {
    const tabDataMap: Record<string, string[]> = {
      'users': ['/api/admin/users'],
      'activity': ['/api/admin/user-activity'], 
      'reports': ['/api/admin/users', '/api/admin/analytics-overview']
    };

    const queriesToRefresh = tabDataMap[activeTab];
    if (queriesToRefresh) {
      // Invalidate queries for the active tab to get fresh data
      queriesToRefresh.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    }
  }, [activeTab])

  // Form setup for creating users
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

  // Form setup for editing users
  const editForm = useForm<CreateUserFormData>({
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

  // Query for user analytics
  const { 
    data: userAnalytics, 
    isLoading: isLoadingAnalytics 
  } = useQuery<{
    totalUsers: number;
    activeUsers: number;
    newUsersThisWeek: number;
    mostActiveDepartment: string;
    generatedAt: string;
  }>({
    queryKey: ['/api/admin/user-analytics'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserFormData): Promise<User> => {
      // Transform role (singular string) to roles (array) for API
      const apiData = {
        ...userData,
        roles: userData.role ? [userData.role] : ['renter'],
      };
      // Remove the singular 'role' field
      delete (apiData as any).role;
      
      const response = await apiRequest('/api/users', { method: 'POST', body: apiData });
      return await response.json();
    },
    onSuccess: (newUser: User) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-analytics"] });
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
  const displayUsers = allUsers.map((user: any) => ({
    id: user.id,
    name: user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email || 'Unknown User'),
    email: user.email || 'No email',
    department: user.department || "Unknown",
    role: user.roles?.[0] || "renter", // Primary role for display
    roles: user.roles || ["renter"], // Keep full roles array for filtering
    spotsOwned: user.spotsOwned || 0, // Real count from backend
    bookingsCount: user.bookingsCount || 0, // Real count from backend  
    status: user.status || "active",
    lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never",
    memberSince: user.memberSince ? new Date(user.memberSince).toLocaleDateString() : "Unknown",
    totalSpent: 0, // TODO: Calculate from bookings when needed
    phoneNumber: user.phone || "No phone",
    vehicleInfo: "Not configured" // TODO: Add vehicle info to schema if needed
  }));

  // Filter configuration for EnhancedFilters
  const filterConfigs: FilterConfig[] = [
    {
      key: 'role',
      label: 'Role',
      type: 'select',
      options: [
        {value: 'all', label: 'All Roles'},
        {value: 'admin', label: 'Admin'},
        {value: 'owner', label: 'Owner'},
        {value: 'renter', label: 'Renter'}
      ]
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        {value: 'all', label: 'All Status'},
        {value: 'active', label: 'Active'},
        {value: 'suspended', label: 'Suspended'},
        {value: 'pending', label: 'Pending'}
      ]
    }
  ];

  // Handler for filter changes
  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handler to clear all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterValues({});
  };

  // Handler for role card clicks to sync with EnhancedFilters
  const handleRoleCardClick = (role: string) => {
    handleFilterChange('role', role === 'all' ? undefined : role);
  };

  // Memoized filtered users for performance
  const filteredUsers = useMemo(() => (isLoadingUsers ? [] : displayUsers).filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Check if user's roles array includes the selected role (supports multi-role users)
    const matchesRole = !filterValues.role || filterValues.role === 'all' || user.roles?.includes(filterValues.role)
    const matchesStatus = !filterValues.status || filterValues.status === 'all' || user.status === filterValues.status
    
    return matchesSearch && matchesRole && matchesStatus
  }), [isLoadingUsers, displayUsers, searchTerm, filterValues])

  // Sorting functionality for users - moved from AdminUsersTable to enable export access
  const { sortState, sortedData: sortedUsers, handleSort } = useTableSort(
    filteredUsers,
    "name", // Default sort by name
    "asc" // Alphabetical order
  )

  // Fetch user's assigned spots when editing
  const { data: userAssignedSpots = [], isLoading: isLoadingSpots, refetch: refetchUserSpots } = useQuery<ParkingSpot[]>({
    queryKey: ["/api/admin/users", editingUser?.id, "spots"],
    enabled: !!editingUser?.id && showEditUser,
  });

  // Unassign spot mutation
  const unassignSpotMutation = useMutation({
    mutationFn: async (spotId: string): Promise<ParkingSpot> => {
      const response = await apiRequest(`/api/admin/spots/${spotId}/unassign`, { method: 'PUT' });
      return await response.json();
    },
    onSuccess: (updatedSpot: ParkingSpot) => {
      // Invalidate and refetch user spots
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", editingUser?.id, "spots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] });
      
      toast({
        title: "Spot Unassigned",
        description: `Successfully unassigned parking spot ${updatedSpot.spotNumber}`,
      });
    },
    onError: (error: any) => {
      console.error('Error unassigning spot:', error);
      toast({
        variant: "destructive",
        title: "Error Unassigning Spot",
        description: error.message || "Failed to unassign parking spot. Please try again.",
      });
    }
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string, userData: Partial<InsertUser> }): Promise<User> => {
      // Transform role (singular string) to roles (array) for API
      const apiData = {
        ...userData,
        roles: (userData as any).role ? [(userData as any).role] : undefined,
      };
      // Remove the singular 'role' field
      delete (apiData as any).role;
      
      const response = await apiRequest(`/api/users/${userId}`, { method: 'PUT', body: apiData });
      return await response.json();
    },
    onSuccess: (updatedUser: User) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-analytics"] });
      setShowEditUser(false);
      setEditingUser(null);
      editForm.reset();
      const updatedUserName = [updatedUser?.firstName, updatedUser?.lastName].filter(Boolean).join(' ') || updatedUser?.email || 'Unknown User';
      toast({
        title: "User Updated",
        description: `Successfully updated user ${updatedUserName}`,
      });
    },
    onError: (error: any) => {
      console.error('Error updating user:', error);
      const isUnauthorized = error.message?.includes('Unauthorized') || error.status === 401;
      toast({
        variant: "destructive",
        title: "Error Updating User",
        description: isUnauthorized 
          ? "You need administrator privileges to edit users. Please contact an admin or use the 'Promote to Admin' button below for testing."
          : error.message || "Failed to update user. Please try again.",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string): Promise<{ success: boolean; message: string }> => {
      const response = await apiRequest(`/api/users/${userId}`, { method: 'DELETE' });
      return await response.json();
    },
    onSuccess: (result: { success: boolean; message: string }, userId: string) => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-analytics"] });
      const user = displayUsers.find(u => u.id === userId);
      const userName = user?.name || 'Unknown User';
      toast({
        title: "User Deleted",
        description: `Successfully deleted user ${userName}`,
      });
    },
    onError: (error: any) => {
      console.error('Error deleting user:', error);
      let errorMessage = "Failed to delete user. Please try again.";
      
      // Parse the error message to extract details
      if (error.message) {
        const message = error.message;
        
        if (message.includes('401') || message.includes('Unauthorized')) {
          errorMessage = "You need administrator privileges to delete users.";
        } else if (message.includes('400')) {
          // Extract the JSON error details from the error message
          try {
            const jsonStart = message.indexOf('{');
            if (jsonStart !== -1) {
              const jsonStr = message.substring(jsonStart);
              const errorData = JSON.parse(jsonStr);
              errorMessage = errorData.details || errorData.error || message;
            } else {
              errorMessage = message;
            }
          } catch (e) {
            errorMessage = message;
          }
        } else {
          errorMessage = message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Cannot Delete User",
        description: errorMessage,
      });
    }
  });


  const handleEditUser = (userId: string) => {
    console.log('Edit user:', userId)
    const user = allUsers.find(u => u.id === userId)
    if (!user) return

    // Populate edit form with user data
    setEditingUser(user)
    editForm.reset({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      department: user.department ?? "",
      role: user.roles?.[0] ?? "renter", // Convert roles array to single role for form
      memberSince: user.memberSince ?? new Date().toISOString().split('T')[0]
    })
    setShowEditUser(true)
  }

  const handleDeleteUser = async (userId: string) => {
    // No need for confirmation here as AdminUsersTable already handles it
    console.log('Delete user:', userId)
    deleteUserMutation.mutate(userId);
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

  // Handle edit form submission
  const onEditSubmit = (data: CreateUserFormData) => {
    if (!editingUser) return;
    editUserMutation.mutate({ userId: editingUser.id, userData: data });
  };

  // Handle create form submission
  const onSubmit = (data: CreateUserFormData) => {
    createUserMutation.mutate(data);
  };

  const roleStats = {
    admin: allUsers.filter((u: User) => u.roles?.includes("admin")).length,
    owner: allUsers.filter((u: User) => u.roles?.includes("owner")).length,
    renter: allUsers.filter((u: User) => u.roles?.includes("renter")).length,
  }

  // Mock data for Activity and Reports tabs (would come from API in production)
  const mockUserActivity: UserActivity[] = [
    {
      id: "activity-001",
      type: "user_created",
      user: "System Admin",
      action: "Created new user Michael Rodriguez",
      timestamp: "2024-01-15T08:30:00Z",
      details: "Role: Renter, Department: Marketing"
    },
    {
      id: "activity-002",
      type: "role_changed",
      user: "David Thompson",
      action: "Changed role for Sarah Chen from Renter to Owner",
      timestamp: "2024-01-15T07:45:00Z",
      details: "Previous role: Renter, New role: Owner"
    },
    {
      id: "activity-003",
      type: "user_suspended",
      user: "System Admin",
      action: "Suspended user Emma Wilson",
      timestamp: "2024-01-15T06:15:00Z",
      details: "Reason: Policy violation"
    },
    {
      id: "activity-004",
      type: "booking_created",
      user: "Jennifer Kim",
      action: "Created first parking booking",
      timestamp: "2024-01-14T16:30:00Z",
      details: "Spot: B-08, Date: 2024-01-15"
    },
    {
      id: "activity-005",
      type: "user_activated",
      user: "System Admin",
      action: "Activated user Alex Thompson",
      timestamp: "2024-01-14T14:20:00Z",
      details: "Account verification completed"
    }
  ];

  // Use real analytics data or fallback to calculated values
  const analytics = userAnalytics || {
    totalUsers: allUsers.length,
    activeUsers: allUsers.filter((u: User) => u.lastLogin).length,
    newUsersThisWeek: 0,
    mostActiveDepartment: "N/A"
  };

  const getActivityIcon = (type: string) => {
    const iconMap = {
      user_created: <UserPlus className="h-4 w-4 text-green-600" />,
      user_suspended: <UserX className="h-4 w-4 text-red-600" />,
      user_activated: <UserCheck className="h-4 w-4 text-green-600" />,
      role_changed: <Shield className="h-4 w-4 text-blue-600" />,
      login_failed: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
      booking_created: <Car className="h-4 w-4 text-purple-600" />
    };
    
    return iconMap[type as keyof typeof iconMap] || <Activity className="h-4 w-4 text-gray-600" />;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-users">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.userManagement.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.userManagement.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleCards}
                data-testid="button-toggle-cards"
                aria-label={cardsVisible ? "Hide analytics cards" : "Show analytics cards"}
              >
                {cardsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {cardsVisible ? "Hide analytics cards" : "Show analytics cards"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => refetchUsers()}
                disabled={isLoadingUsers}
                data-testid="button-refresh-users"
                aria-label="Refresh all user data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                {t("common.refresh")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh all user data from database
            </TooltipContent>
          </Tooltip>
          <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t("admin.userManagement.addUser")}
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Create new user account with role assignment and department allocation
              </TooltipContent>
            </Tooltip>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SelectTrigger data-testid="select-role">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Admin: Full system access | Owner: Can list spots for rent | Renter: Can book available spots
                                </TooltipContent>
                              </Tooltip>
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

          {/* Edit User Dialog */}
          <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("admin.editUser")}</DialogTitle>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.firstName")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-edit-first-name" placeholder="First name" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.lastName")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-edit-last-name" placeholder="Last name" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.emailAddress")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-edit-email" placeholder="email@company.com" type="email" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.phoneNumber")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-edit-phone" placeholder="+1 (555) 123-4567" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.department")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value ?? ""} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-edit-department">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Engineering">Engineering</SelectItem>
                              <SelectItem value="Marketing">Marketing</SelectItem>
                              <SelectItem value="Sales">Sales</SelectItem>
                              <SelectItem value="HR">HR</SelectItem>
                              <SelectItem value="Finance">Finance</SelectItem>
                              <SelectItem value="Operations">Operations</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("admin.role")}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value ?? ""} value={field.value ?? ""}>
                            <FormControl>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SelectTrigger data-testid="select-edit-role">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Changing roles affects user permissions and system access immediately
                                </TooltipContent>
                              </Tooltip>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="renter">Renter</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Assigned Parking Spots Section */}
                  {editingUser && (
                    <div className="border-t pt-6 mt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Car className="h-5 w-5" />
                        <h3 className="text-lg font-semibold">Assigned Parking Spots</h3>
                        <Badge variant="secondary" data-testid="badge-spots-count">
                          {isLoadingSpots ? "..." : userAssignedSpots.length}
                        </Badge>
                      </div>
                      
                      {isLoadingSpots ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 w-full" />
                          <Skeleton className="h-16 w-full" />
                        </div>
                      ) : userAssignedSpots.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-spots">
                          <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No parking spots currently assigned to this user.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {userAssignedSpots.map((spot) => (
                            <div
                              key={spot.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                              data-testid={`spot-card-${spot.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                                  <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium" data-testid={`spot-number-${spot.id}`}>
                                    Spot {spot.spotNumber}
                                  </div>
                                  <div className="text-sm text-muted-foreground" data-testid={`spot-location-${spot.id}`}>
                                    {spot.location}
                                  </div>
                                  {spot.spotType && (
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {spot.spotType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      unassignSpotMutation.mutate(spot.id);
                                    }}
                                    disabled={unassignSpotMutation.isPending}
                                    data-testid={`button-unassign-${spot.id}`}
                                  >
                                    {unassignSpotMutation.isPending ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <><Trash2 className="h-4 w-4 mr-1" />Unassign</>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Remove parking spot assignment and return spot to available pool
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowEditUser(false)}
                      data-testid="button-cancel-edit-user"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={editUserMutation.isPending}
                      data-testid="button-save-edit-user"
                    >
                      {editUserMutation.isPending ? 'Updating...' : 'Update User'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Analytics Cards */}
      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Total users information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View total registered user accounts across all roles
                </TooltipContent>
              </Tooltip>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {isLoadingUsers || isLoadingAnalytics ? "..." : analytics.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Active users information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View users logged in within the last 30 days
                </TooltipContent>
              </Tooltip>
            </div>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-users">
              {isLoadingUsers || isLoadingAnalytics ? "..." : analytics.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Recently logged in
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">New This Week</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="New users information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View new user registrations in the past 7 days
                </TooltipContent>
              </Tooltip>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-new-users">
              {isLoadingUsers || isLoadingAnalytics ? "..." : analytics.newUsersThisWeek}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent signups
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Most Active Dept</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Most active department information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View department with highest user engagement
                </TooltipContent>
              </Tooltip>
            </div>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-department">
              {isLoadingUsers || isLoadingAnalytics ? "..." : analytics.mostActiveDepartment}
            </div>
            <p className="text-xs text-muted-foreground">
              Department activity
            </p>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4">
          {/* Role Filter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card 
              className={`cursor-pointer hover-elevate ${
                filterValues.role === 'admin' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleRoleCardClick('admin')}
              data-testid="card-filter-admin"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRoleCardClick('admin');
                }
              }}
              aria-describedby="admin-card-description"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.userManagement.administrators")}</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Administrator filter information"
                      >
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Filter users with full system access and management privileges
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingUsers ? "..." : roleStats.admin}
                </div>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{t("admin.userManagement.systemAccess")}</Badge>
              </CardContent>
              <div id="admin-card-description" className="sr-only">
                Filter to show only administrators with full system access and user management privileges
              </div>
            </Card>
            
            <Card 
              className={`cursor-pointer hover-elevate ${
                filterValues.role === 'owner' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleRoleCardClick('owner')}
              data-testid="card-filter-owner"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRoleCardClick('owner');
                }
              }}
              aria-describedby="owner-card-description"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.userManagement.spotOwners")}</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Spot owner filter information"
                      >
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Filter users who can list parking spaces for rental
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingUsers ? "..." : roleStats.owner}
                </div>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">{t("admin.userManagement.revenueGenerators")}</Badge>
              </CardContent>
              <div id="owner-card-description" className="sr-only">
                Filter to show only spot owners who can list parking spaces for rental and earn revenue
              </div>
            </Card>
            
            <Card 
              className={`cursor-pointer hover-elevate ${
                filterValues.role === 'renter' ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleRoleCardClick('renter')}
              data-testid="card-filter-renter"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRoleCardClick('renter');
                }
              }}
              aria-describedby="renter-card-description"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.userManagement.renters")}</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Renter filter information"
                      >
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Filter users who book parking spaces
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingUsers ? "..." : roleStats.renter}
                </div>
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">{t("admin.userManagement.regularUsers")}</Badge>
              </CardContent>
              <div id="renter-card-description" className="sr-only">
                Filter to show only renters who book parking spaces but don't own spots
              </div>
            </Card>
          </div>

          {/* Enhanced Filters */}
          <EnhancedFilters
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterConfigs={filterConfigs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            searchPlaceholder="Search users by name, email, or department..."
            data-testid="enhanced-filters-users"
          />

          {/* Users Table */}
          <Card>
            <CardContent>
              {isLoadingUsers ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <AdminUsersTable 
                  users={sortedUsers} 
                  isLoading={isLoadingUsers}
                  sortState={sortState}
                  onSort={handleSort}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                  onSuspendUser={handleSuspendUser}
                  onAssignSpot={handleAssignSpot}
                  onSendNotification={handleSendNotification}
                />
              )}
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {showBulkActions && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">Bulk Actions:</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleBulkAction('send-notification')} 
                        data-testid="button-bulk-send-notification"
                        aria-label="Send email notifications to selected users"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Send Notification
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Send email notifications to selected users
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleBulkAction('suspend-users')} 
                        data-testid="button-bulk-suspend"
                        aria-label="Suspend selected users"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Suspend Selected
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Suspend selected users and block system access
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleBulkAction('activate-users')} 
                        data-testid="button-bulk-activate"
                        aria-label="Activate selected users"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activate Selected
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Activate selected users and restore access
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleBulkAction('export-data')} 
                        data-testid="button-bulk-export"
                        aria-label="Export selected user data"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export Data
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export selected user data to Excel or PDF
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setShowBulkActions(false)} 
                        data-testid="button-bulk-close"
                        aria-label="Close bulk actions panel"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Close
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Close bulk actions panel
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  )
}