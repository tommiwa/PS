import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Edit, Trash2, Undo2, Users, Car, Clock, FileText, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { quickExportUsersPDF, quickExportUsersExcel } from "@/utils/export-utils"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useLanguage } from "@/hooks/use-language"

export interface AdminUser {
  id: string
  name: string
  email: string
  department: string
  role: "admin" | "owner" | "renter"
  spotsOwned: number
  bookingsCount: number
  status: "active" | "inactive"
  lastLogin: string
  memberSince: string
}

interface AdminUsersTableProps {
  users: AdminUser[]
  isLoading?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  filterValues?: FilterValues
  onFilterChange?: (key: string, value: string | undefined) => void
  onClearFilters?: () => void
  onEditUser?: (userId: string) => void
  onDeleteUser?: (userId: string) => void
  onRestoreUser?: (userId: string) => void
  onSuspendUser?: (userId: string) => void
  onAssignSpot?: (userId: string) => void
  onSendNotification?: (userId: string) => void
  sortState?: any
  onSort?: (column: string) => void
}

export function AdminUsersTable({ 
  users, 
  isLoading,
  searchValue = "",
  onSearchChange,
  filterValues = {},
  onFilterChange,
  onClearFilters,
  onEditUser, 
  onDeleteUser, 
  onRestoreUser,
  onSuspendUser,
  onAssignSpot,
  onSendNotification 
}: AdminUsersTableProps) {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { t } = useLanguage()
  
  // Internal state for backward compatibility if no external state provided
  const [internalSearchTerm, setInternalSearchTerm] = useState("")
  const [internalFilterValues, setInternalFilterValues] = useState<FilterValues>({})
  
  const currentSearchTerm = onSearchChange ? searchValue : internalSearchTerm
  const currentFilterValues = onFilterChange ? filterValues : internalFilterValues
  
  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchTerm(value)
    }
  }
  
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (onFilterChange) {
      onFilterChange(key, value)
    } else {
      setInternalFilterValues(prev => ({ ...prev, [key]: value }))
    }
  }
  
  const handleClearFilters = () => {
    if (onClearFilters) {
      onClearFilters()
    } else {
      setInternalSearchTerm("")
      setInternalFilterValues({})
    }
  }

  // Enhanced filtering for users
  const filteredUsers = users.filter(user => {
    // Search filter
    if (currentSearchTerm.trim()) {
      const searchLower = currentSearchTerm.toLowerCase()
      const matchesSearch = user.name.toLowerCase().includes(searchLower) ||
                           user.email.toLowerCase().includes(searchLower) ||
                           user.department.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Role filter (supports multi-role users)
    if (currentFilterValues.role && currentFilterValues.role !== "all") {
      const userRoles = (user as any).roles || [user.role];
      if (!userRoles.includes(currentFilterValues.role)) return false
    }
    
    // Department filter
    if (currentFilterValues.department && currentFilterValues.department !== "all") {
      if (!user.department.toLowerCase().includes(currentFilterValues.department.toLowerCase())) {
        return false
      }
    }
    
    // Status filter
    if (currentFilterValues.status && currentFilterValues.status !== "all") {
      if (user.status !== currentFilterValues.status) return false
    }
    
    // Location filter (could be based on department or other criteria)
    if (currentFilterValues.location && currentFilterValues.location !== "all") {
      // This would need implementation based on user location data
      // For now, we'll use department as a proxy for location
      if (!user.department.toLowerCase().includes(currentFilterValues.location.toLowerCase())) {
        return false
      }
    }
    
    return true
  })
  
  // Sorting functionality for users
  const { sortState, sortedData: sortedUsers, handleSort } = useTableSort(
    filteredUsers,
    "name", // Default sort by name
    "asc" // Alphabetical order
  )
  
  // Filter configuration for user management
  const userFilterConfigs: FilterConfig[] = [
    {
      key: "role",
      label: t("common.role"),
      type: "select",
      options: [
        { value: "admin", label: t("role.admin") },
        { value: "owner", label: t("role.owner") },
        { value: "renter", label: t("role.renter") }
      ]
    },
    {
      key: "department",
      label: t("common.department"),
      type: "select",
      options: [
        // These would ideally come from API or be dynamic
        { value: "engineering", label: t("department.engineering") },
        { value: "marketing", label: t("department.marketing") },
        { value: "sales", label: t("department.sales") },
        { value: "hr", label: t("department.hr") },
        { value: "finance", label: t("department.finance") },
        { value: "operations", label: t("department.operations") }
      ]
    },
    {
      key: "status",
      label: t("common.status"),
      type: "select",
      options: [
        { value: "active", label: t("common.active") },
        { value: "inactive", label: t("common.inactive") }
      ]
    },
    {
      key: "location",
      label: t("common.location"),
      type: "select",
      options: [
        { value: "building-a", label: t("building.a") },
        { value: "building-b", label: t("building.b") },
        { value: "remote", label: t("location.remote") },
        { value: "satellite", label: t("location.satellite") }
      ]
    }
  ]

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { variant: "default" as const, label: t("role.admin") },
      owner: { variant: "secondary" as const, label: t("role.owner") },
      renter: { variant: "outline" as const, label: t("role.renter") },
    }
    
    const config = roleConfig[role as keyof typeof roleConfig]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getRoleBadges = (roles: string[] | string) => {
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const roleConfig = {
      admin: { variant: "default" as const, label: t("role.admin") },
      owner: { variant: "secondary" as const, label: t("role.owner") },
      renter: { variant: "outline" as const, label: t("role.renter") },
    }
    
    return (
      <div className="flex gap-1 flex-wrap">
        {rolesArray.map((role, index) => {
          const config = roleConfig[role as keyof typeof roleConfig];
          return config ? (
            <Badge key={index} variant={config.variant}>{config.label}</Badge>
          ) : null;
        })}
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "active" ? "default" : "secondary"}>
        {status === "active" ? t("common.active") : t("common.inactive")}
      </Badge>
    )
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const humanizeEmail = (email: string) => {
    const localPart = email.split('@')[0]
    return localPart
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const getDisplayName = (user: any) => {
    if (user.name && !user.name.includes('@')) {
      return user.name
    }
    return humanizeEmail(user.email)
  }

  const handleEdit = (userId: string) => {
    console.log('Edit user:', userId)
    onEditUser?.(userId)
  }

  const handleDelete = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    const confirmed = await confirm(confirmations.deleteUser(user.name))
    if (confirmed) {
      console.log('Delete user:', userId)
      onDeleteUser?.(userId)
    }
  }

  const handleRestore = (userId: string) => {
    console.log('Restore user:', userId)
    onRestoreUser?.(userId)
  }

  const handleAssignSpot = (userId: string) => {
    console.log('Assign spot to user:', userId)
    onAssignSpot?.(userId)
  }

  const stats = {
    total: users.length,
    filtered: sortedUsers.length,
    active: users.filter(u => u.status === "active").length,
    owners: users.filter(u => (u as any).roles?.includes("owner") || u.role === "owner").length,
  }

  return (
    <div className="space-y-4">      
      <Card data-testid="card-admin-users">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("admin.userDirectory")}
              </CardTitle>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{stats.total} {t("admin.totalUsers")}</span>
                <span>{stats.filtered} {t("admin.shown")}</span>
                <span>{stats.active} {t("admin.active")}</span>
                <span>{stats.owners} {t("admin.spotOwners")}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm"
                variant="outline" 
                disabled={users.length === 0}
                onClick={() => {
                  const success = quickExportUsersPDF(users, t("admin.userDirectoryReport"), (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: t("export.failed"),
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: t("export.successful"),
                      description: t("export.pdfDownloaded")
                    })
                  }
                }}
                data-testid="button-export-users-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t("admin.exportPDF")}
              </Button>
              <Button 
                size="sm"
                variant="outline" 
                disabled={users.length === 0}
                onClick={() => {
                  const success = quickExportUsersExcel(users, t("admin.userDirectoryReport"), (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: t("export.failed"),
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: t("export.successful"),
                      description: t("export.excelDownloaded")
                    })
                  }
                }}
                data-testid="button-export-users-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                {t("admin.exportExcel")}
              </Button>
            </div>
          </div>
        </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHeader
                  column="name"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("common.user")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="department"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("common.department")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="role"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("common.role")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="spotsOwned"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("admin.spots")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="bookingsCount"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("admin.bookings")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="status"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("common.status")}
                </SortableTableHeader>
                <SortableTableHeader
                  column="lastLogin"
                  currentSortColumn={sortState.column}
                  currentSortDirection={sortState.direction}
                  onSort={handleSort}
                >
                  {t("admin.lastLogin")}
                </SortableTableHeader>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(getDisplayName(user))}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{getDisplayName(user)}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>{getRoleBadges((user as any).roles || user.role)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {user.spotsOwned}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {user.bookingsCount}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(user as any).status === 'deleted' ? (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRestore(user.id)}
                          data-testid={`button-restore-${user.id}`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(user.id)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {sortedUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {t("admin.noUsersFound")}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}