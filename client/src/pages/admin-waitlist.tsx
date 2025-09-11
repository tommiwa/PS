import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  Clock, 
  Users, 
  Search, 
  Filter, 
  Download, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  TrendingUp,
  UserPlus,
  Pause,
  Play,
  Trash2,
  BarChart3
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function AdminWaitlist() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDepartment, setFilterDepartment] = useState("all")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [contactUserId, setContactUserId] = useState<string | null>(null)

  // Mock waitlist data
  const mockWaitlistUsers = [
    {
      id: "wait-001",
      position: 1,
      name: "Alex Chen",
      email: "alex.chen@bci.com",
      department: "Engineering",
      joinDate: "2023-12-15",
      daysWaiting: 28,
      status: "active" as const,
      phoneNumber: "(555) 123-4567",
      vehicleInfo: "Tesla Model Y (XYZ-123)",
      notes: "High priority - senior engineer"
    },
    {
      id: "wait-002", 
      position: 2,
      name: "Maria Rodriguez",
      email: "m.rodriguez@bci.com",
      department: "Marketing",
      joinDate: "2023-12-10",
      daysWaiting: 33,
      status: "active" as const,
      phoneNumber: "(555) 234-5678",
      vehicleInfo: "Honda Accord (ABC-789)",
      notes: ""
    },
    {
      id: "wait-003",
      position: 3,
      name: "David Kim",
      email: "d.kim@bci.com", 
      department: "Finance",
      joinDate: "2023-12-05",
      daysWaiting: 38,
      status: "paused" as const,
      phoneNumber: "(555) 345-6789",
      vehicleInfo: "BMW 3 Series (DEF-456)",
      notes: "Temporarily working remote"
    },
    {
      id: "wait-004",
      position: 4,
      name: "Sarah Thompson",
      email: "s.thompson@bci.com",
      department: "HR",
      joinDate: "2023-11-28",
      daysWaiting: 45,
      status: "active" as const,
      phoneNumber: "(555) 456-7890",
      vehicleInfo: "Toyota Camry (GHI-123)",
      notes: ""
    },
    {
      id: "wait-005",
      position: 5,
      name: "Michael Johnson",
      email: "m.johnson@bci.com",
      department: "IT",
      joinDate: "2023-11-20",
      daysWaiting: 53,
      status: "active" as const,
      phoneNumber: "(555) 567-8901",
      vehicleInfo: "Ford F-150 (JKL-789)",
      notes: "Prefers spots near building entrance"
    },
    {
      id: "wait-006",
      position: 6,
      name: "Jennifer Lee",
      email: "j.lee@bci.com",
      department: "Design",
      joinDate: "2023-11-15",
      daysWaiting: 58,
      status: "active" as const,
      phoneNumber: "(555) 678-9012",
      vehicleInfo: "Subaru Outback (MNO-456)",
      notes: ""
    },
    {
      id: "wait-007",
      position: 7,
      name: "Robert Wilson",
      email: "r.wilson@bci.com",
      department: "Sales",
      joinDate: "2023-11-10",
      daysWaiting: 63,
      status: "paused" as const,
      phoneNumber: "(555) 789-0123",
      vehicleInfo: "Audi A4 (PQR-123)",
      notes: "On extended business travel"
    },
    {
      id: "wait-008",
      position: 8,
      name: "Lisa Wang",
      email: "l.wang@bci.com",
      department: "Engineering",
      joinDate: "2023-11-05",
      daysWaiting: 68,
      status: "active" as const,
      phoneNumber: "(555) 890-1234",
      vehicleInfo: "Mercedes C-Class (STU-789)",
      notes: ""
    },
    {
      id: "wait-009",
      position: 9,
      name: "James Brown",
      email: "j.brown@bci.com",
      department: "Operations",
      joinDate: "2023-10-28",
      daysWaiting: 76,
      status: "active" as const,
      phoneNumber: "(555) 901-2345",
      vehicleInfo: "Chevrolet Tahoe (VWX-456)",
      notes: "Large vehicle - needs oversized spot"
    },
    {
      id: "wait-010",
      position: 10,
      name: "Amanda Davis",
      email: "a.davis@bci.com",
      department: "Legal",
      joinDate: "2023-10-20",
      daysWaiting: 84,
      status: "active" as const,
      phoneNumber: "(555) 012-3456",
      vehicleInfo: "Lexus RX 350 (YZA-123)",
      notes: ""
    }
  ]

  const filteredUsers = mockWaitlistUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || user.status === filterStatus
    const matchesDepartment = filterDepartment === "all" || user.department === filterDepartment
    
    return matchesSearch && matchesStatus && matchesDepartment
  })

  // Statistics calculations
  const totalWaitingUsers = mockWaitlistUsers.length
  const averageWaitTime = Math.round(mockWaitlistUsers.reduce((sum, user) => sum + user.daysWaiting, 0) / totalWaitingUsers)
  const recentAdditions = mockWaitlistUsers.filter(user => {
    const joinDate = new Date(user.joinDate)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return joinDate >= weekAgo
  }).length
  const conversionRate = 78 // Mock conversion rate percentage

  const departmentStats = {
    engineering: mockWaitlistUsers.filter(u => u.department === "Engineering").length,
    marketing: mockWaitlistUsers.filter(u => u.department === "Marketing").length,
    finance: mockWaitlistUsers.filter(u => u.department === "Finance").length,
    hr: mockWaitlistUsers.filter(u => u.department === "HR").length,
    it: mockWaitlistUsers.filter(u => u.department === "IT").length,
    other: mockWaitlistUsers.filter(u => !["Engineering", "Marketing", "Finance", "HR", "IT"].includes(u.department)).length
  }

  const handleMoveUp = (userId: string) => {
    console.log('Move up:', userId)
    // Implementation for moving user up in queue
  }

  const handleMoveDown = (userId: string) => {
    console.log('Move down:', userId)
    // Implementation for moving user down in queue
  }

  const handleRemoveFromWaitlist = (userId: string) => {
    console.log('Remove from waitlist:', userId)
    // Implementation for removing user from waitlist
  }

  const handlePauseUser = (userId: string) => {
    console.log('Pause user:', userId)
    // Implementation for pausing user
  }

  const handleResumeUser = (userId: string) => {
    console.log('Resume user:', userId)
    // Implementation for resuming user
  }

  const handleContactUser = (userId: string) => {
    setContactUserId(userId)
    setShowContactDialog(true)
  }

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action, 'on users:', selectedUsers)
    setSelectedUsers([])
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="text-xs">Active</Badge>
      case "paused":
        return <Badge variant="secondary" className="text-xs">Paused</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-waitlist">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waiting List Administration</h1>
          <p className="text-muted-foreground">
            Manage the parking spot waiting list and queue positions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export List
          </Button>
          <Button variant="outline" onClick={() => setShowBulkActions(!showBulkActions)}>
            <Filter className="h-4 w-4 mr-2" />
            Bulk Actions
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Waiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWaitingUsers}</div>
            <p className="text-xs text-muted-foreground">People in queue</p>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {mockWaitlistUsers.filter(u => u.status === "active").length} active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Average Wait Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageWaitTime} days</div>
            <p className="text-xs text-muted-foreground">Current queue average</p>
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">~{Math.round(averageWaitTime/30)} months</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Recent Additions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentAdditions}</div>
            <p className="text-xs text-muted-foreground">This week</p>
            <div className="mt-2">
              <Badge variant="default" className="text-xs">New joiners</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Waitlist to spot assignment</p>
            <div className="mt-2">
              <Badge variant="default" className="text-xs">Last 6 months</Badge>
            </div>
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
                  placeholder="Search by name, email, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-waitlist"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-department">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Legal">Legal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {showBulkActions && selectedUsers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected:
              </span>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('pause')}>
                <Pause className="h-4 w-4 mr-1" />
                Pause Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('resume')}>
                <Play className="h-4 w-4 mr-1" />
                Resume Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('contact')}>
                <Mail className="h-4 w-4 mr-1" />
                Contact Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                <Download className="h-4 w-4 mr-1" />
                Export Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedUsers([])}>
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waitlist Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Waiting List ({filteredUsers.length} users)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 w-12">
                    <input
                      type="checkbox"
                      checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="p-4 font-medium">Position</th>
                  <th className="p-4 font-medium">User Details</th>
                  <th className="p-4 font-medium">Wait Time</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Vehicle Info</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-gray-300"
                        data-testid={`checkbox-select-${user.id}`}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-lg text-primary">#{user.position}</div>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleMoveUp(user.id)}
                            disabled={user.position === 1}
                            data-testid={`button-move-up-${user.id}`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleMoveDown(user.id)}
                            disabled={user.position === mockWaitlistUsers.length}
                            data-testid={`button-move-down-${user.id}`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium" data-testid={`text-name-${user.id}`}>{user.name}</div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-email-${user.id}`}>{user.email}</div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-department-${user.id}`}>{user.department}</div>
                        {user.notes && (
                          <div className="text-xs text-blue-600 mt-1" data-testid={`text-notes-${user.id}`}>
                            Note: {user.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium" data-testid={`text-days-waiting-${user.id}`}>{user.daysWaiting} days</div>
                        <div className="text-sm text-muted-foreground">
                          Since {new Date(user.joinDate).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ~{Math.round(user.daysWaiting/30)} months
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(user.status)}
                        {getStatusBadge(user.status)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium">{user.vehicleInfo}</div>
                        <div className="text-xs text-muted-foreground">{user.phoneNumber}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleContactUser(user.id)} data-testid={`action-contact-${user.id}`}>
                            <Mail className="h-4 w-4 mr-2" />
                            Contact User
                          </DropdownMenuItem>
                          {user.status === "active" ? (
                            <DropdownMenuItem onClick={() => handlePauseUser(user.id)} data-testid={`action-pause-${user.id}`}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleResumeUser(user.id)} data-testid={`action-resume-${user.id}`}>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleMoveUp(user.id)} disabled={user.position === 1} data-testid={`action-move-up-${user.id}`}>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Move Up
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMoveDown(user.id)} disabled={user.position === mockWaitlistUsers.length} data-testid={`action-move-down-${user.id}`}>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Move Down
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleRemoveFromWaitlist(user.id)} 
                            className="text-red-600"
                            data-testid={`action-remove-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from List
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Department Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Department Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.engineering}</div>
              <div className="text-xs text-muted-foreground">Engineering</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.marketing}</div>
              <div className="text-xs text-muted-foreground">Marketing</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.finance}</div>
              <div className="text-xs text-muted-foreground">Finance</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.hr}</div>
              <div className="text-xs text-muted-foreground">HR</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.it}</div>
              <div className="text-xs text-muted-foreground">IT</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{departmentStats.other}</div>
              <div className="text-xs text-muted-foreground">Other</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact User Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {contactUserId && (() => {
              const user = mockWaitlistUsers.find(u => u.id === contactUserId)
              return user ? (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div className="text-sm text-muted-foreground">Position #{user.position} • {user.department}</div>
                </div>
              ) : null
            })()}
            
            <div>
              <Label htmlFor="contact-subject">Subject</Label>
              <Input id="contact-subject" placeholder="Waiting list update" />
            </div>
            
            <div>
              <Label htmlFor="contact-message">Message</Label>
              <Textarea 
                id="contact-message" 
                placeholder="Hi [Name], I wanted to update you on your parking spot waiting list position..."
                rows={6}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowContactDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowContactDialog(false)}>
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}