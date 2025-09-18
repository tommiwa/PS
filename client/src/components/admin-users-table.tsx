import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Edit, Trash2, Users, Car, Clock } from "lucide-react"
import { useConfirm, confirmations } from "@/hooks/use-confirm"

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
  onEditUser?: (userId: string) => void
  onDeleteUser?: (userId: string) => void
  onSuspendUser?: (userId: string) => void
  onAssignSpot?: (userId: string) => void
  onSendNotification?: (userId: string) => void
}

export function AdminUsersTable({ 
  users, 
  isLoading,
  onEditUser, 
  onDeleteUser, 
  onSuspendUser,
  onAssignSpot,
  onSendNotification 
}: AdminUsersTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const { confirm } = useConfirm()

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { variant: "default" as const, label: "Admin" },
      owner: { variant: "secondary" as const, label: "Owner" },
      renter: { variant: "outline" as const, label: "Renter" },
    }
    
    const config = roleConfig[role as keyof typeof roleConfig]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "active" ? "default" : "secondary"}>
        {status}
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

  const handleAssignSpot = (userId: string) => {
    console.log('Assign spot to user:', userId)
    onAssignSpot?.(userId)
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    owners: users.filter(u => u.role === "owner").length,
  }

  return (
    <Card data-testid="card-admin-users">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{stats.total} total users</span>
              <span>{stats.active} active</span>
              <span>{stats.owners} spot owners</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-users"
              />
            </div>
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
              data-testid="select-role-filter"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="renter">Renter</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Spots</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
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
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No users found matching your criteria.
          </div>
        )}
      </CardContent>
    </Card>
  )
}