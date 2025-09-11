import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { 
  Car, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  MapPin, 
  Zap,
  Accessibility,
  Building,
  DollarSign,
  TrendingUp,
  Wrench,
  MoreHorizontal,
  Edit,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  BarChart3,
  Users,
  Calendar,
  Map
} from "lucide-react"

type SpotType = "standard" | "electric" | "accessible"
type SpotStatus = "available" | "occupied" | "reserved" | "maintenance" | "disabled"
type Building = "A" | "B" | "C" | "D"

interface ParkingSpace {
  id: string
  spotNumber: string
  building: Building
  floor: number
  zone: string
  type: SpotType
  status: SpotStatus
  isIndoor: boolean
  owner?: {
    id: string
    name: string
    department: string
    email: string
  }
  currentRate: number
  dimensions: {
    length: number
    width: number
  }
  features: string[]
  lastMaintenance: string
  nextMaintenance: string
  totalRevenue: number
  occupancyRate: number
  averageBookingDuration: number
  notes: string
  dateAdded: string
  isActive: boolean
}

export default function AdminParkingSpaces() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBuilding, setFilterBuilding] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([])
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showLocationMap, setShowLocationMap] = useState(false)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  // Comprehensive mock data for parking spaces
  const mockParkingSpaces: ParkingSpace[] = [
    {
      id: "space-001",
      spotNumber: "A-101",
      building: "A",
      floor: 1,
      zone: "North",
      type: "electric",
      status: "occupied",
      isIndoor: true,
      owner: {
        id: "user-001",
        name: "Sarah Chen",
        department: "Engineering",
        email: "sarah.chen@bci.com"
      },
      currentRate: 25.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["EV Charging", "Covered", "Security Camera"],
      lastMaintenance: "2024-01-10",
      nextMaintenance: "2024-04-10",
      totalRevenue: 1250.00,
      occupancyRate: 85,
      averageBookingDuration: 8.5,
      notes: "Recently upgraded with Level 2 charger",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "space-002",
      spotNumber: "A-102",
      building: "A",
      floor: 1,
      zone: "North",
      type: "standard",
      status: "available",
      isIndoor: true,
      currentRate: 15.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered", "Security Camera"],
      lastMaintenance: "2024-01-05",
      nextMaintenance: "2024-04-05",
      totalRevenue: 890.00,
      occupancyRate: 72,
      averageBookingDuration: 7.2,
      notes: "",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "space-003",
      spotNumber: "A-103",
      building: "A",
      floor: 1,
      zone: "North",
      type: "accessible",
      status: "reserved",
      isIndoor: true,
      owner: {
        id: "user-002",
        name: "Michael Rodriguez",
        department: "Marketing",
        email: "m.rodriguez@bci.com"
      },
      currentRate: 20.00,
      dimensions: { length: 20, width: 12 },
      features: ["Accessible", "Covered", "Near Elevator"],
      lastMaintenance: "2024-01-08",
      nextMaintenance: "2024-04-08",
      totalRevenue: 980.00,
      occupancyRate: 68,
      averageBookingDuration: 8.0,
      notes: "ADA compliant space with extra width",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "space-004",
      spotNumber: "B-201",
      building: "B",
      floor: 2,
      zone: "South",
      type: "standard",
      status: "maintenance",
      isIndoor: true,
      currentRate: 15.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered"],
      lastMaintenance: "2024-01-12",
      nextMaintenance: "2024-01-15",
      totalRevenue: 750.00,
      occupancyRate: 65,
      averageBookingDuration: 6.8,
      notes: "Concrete repair in progress",
      dateAdded: "2023-02-01",
      isActive: true
    },
    {
      id: "space-005",
      spotNumber: "C-001",
      building: "C",
      floor: 0,
      zone: "East",
      type: "electric",
      status: "occupied",
      isIndoor: false,
      owner: {
        id: "user-003",
        name: "Jennifer Kim",
        department: "Finance",
        email: "j.kim@bci.com"
      },
      currentRate: 22.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["EV Charging", "Outdoor"],
      lastMaintenance: "2024-01-03",
      nextMaintenance: "2024-04-03",
      totalRevenue: 1100.00,
      occupancyRate: 78,
      averageBookingDuration: 8.2,
      notes: "Outdoor charging station",
      dateAdded: "2023-03-10",
      isActive: true
    },
    {
      id: "space-006",
      spotNumber: "D-305",
      building: "D",
      floor: 3,
      zone: "West",
      type: "standard",
      status: "available",
      isIndoor: true,
      currentRate: 18.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered", "Premium Level"],
      lastMaintenance: "2023-12-20",
      nextMaintenance: "2024-03-20",
      totalRevenue: 1340.00,
      occupancyRate: 82,
      averageBookingDuration: 7.5,
      notes: "Premium location with city view",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "space-007",
      spotNumber: "B-105",
      building: "B",
      floor: 1,
      zone: "Central",
      type: "standard",
      status: "disabled",
      isIndoor: true,
      currentRate: 15.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered"],
      lastMaintenance: "2023-11-15",
      nextMaintenance: "2024-02-15",
      totalRevenue: 450.00,
      occupancyRate: 0,
      averageBookingDuration: 0,
      notes: "Temporarily disabled due to structural concerns",
      dateAdded: "2023-01-20",
      isActive: false
    },
    {
      id: "space-008",
      spotNumber: "A-205",
      building: "A",
      floor: 2,
      zone: "South",
      type: "electric",
      status: "available",
      isIndoor: true,
      currentRate: 25.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["EV Charging", "Covered", "Fast Charging"],
      lastMaintenance: "2024-01-01",
      nextMaintenance: "2024-04-01",
      totalRevenue: 1580.00,
      occupancyRate: 91,
      averageBookingDuration: 9.1,
      notes: "Fast charging capable - 150kW",
      dateAdded: "2023-06-01",
      isActive: true
    }
  ]

  const filteredSpaces = mockParkingSpaces.filter(space => {
    const matchesSearch = space.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         space.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         space.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         space.owner?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         space.owner?.department.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBuilding = filterBuilding === "all" || space.building === filterBuilding
    const matchesType = filterType === "all" || space.type === filterType
    const matchesStatus = filterStatus === "all" || space.status === filterStatus
    
    return matchesSearch && matchesBuilding && matchesType && matchesStatus
  })

  // Statistics calculations
  const totalSpaces = mockParkingSpaces.length
  const availableSpaces = mockParkingSpaces.filter(s => s.status === "available").length
  const occupiedSpaces = mockParkingSpaces.filter(s => s.status === "occupied").length
  const maintenanceSpaces = mockParkingSpaces.filter(s => s.status === "maintenance").length
  const totalRevenue = mockParkingSpaces.reduce((sum, space) => sum + space.totalRevenue, 0)
  const averageOccupancy = Math.round(mockParkingSpaces.reduce((sum, space) => sum + space.occupancyRate, 0) / totalSpaces)

  const buildingStats = {
    A: mockParkingSpaces.filter(s => s.building === "A").length,
    B: mockParkingSpaces.filter(s => s.building === "B").length,
    C: mockParkingSpaces.filter(s => s.building === "C").length,
    D: mockParkingSpaces.filter(s => s.building === "D").length
  }

  const typeStats = {
    standard: mockParkingSpaces.filter(s => s.type === "standard").length,
    electric: mockParkingSpaces.filter(s => s.type === "electric").length,
    accessible: mockParkingSpaces.filter(s => s.type === "accessible").length
  }

  const handleEditSpace = (spaceId: string) => {
    console.log('Edit space:', spaceId)
  }

  const handleDeleteSpace = (spaceId: string) => {
    console.log('Delete space:', spaceId)
  }

  const handleMaintenanceMode = (spaceId: string) => {
    console.log('Toggle maintenance mode:', spaceId)
  }

  const handleReassignSpace = (spaceId: string) => {
    console.log('Reassign space:', spaceId)
  }

  const handleViewDetails = (spaceId: string) => {
    console.log('View space details:', spaceId)
  }

  const handleBulkAction = (action: string) => {
    console.log('Bulk action:', action, 'on spaces:', selectedSpaces)
    setSelectedSpaces([])
  }

  const handleSelectSpace = (spaceId: string) => {
    setSelectedSpaces(prev => 
      prev.includes(spaceId) 
        ? prev.filter(id => id !== spaceId)
        : [...prev, spaceId]
    )
  }

  const handleSelectAll = () => {
    if (selectedSpaces.length === filteredSpaces.length) {
      setSelectedSpaces([])
    } else {
      setSelectedSpaces(filteredSpaces.map(space => space.id))
    }
  }

  const getStatusIcon = (status: SpotStatus) => {
    switch (status) {
      case "available":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "occupied":
        return <Car className="h-4 w-4 text-blue-600" />
      case "reserved":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "maintenance":
        return <Wrench className="h-4 w-4 text-orange-600" />
      case "disabled":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: SpotStatus) => {
    switch (status) {
      case "available":
        return <Badge variant="default" className="text-xs">Available</Badge>
      case "occupied":
        return <Badge variant="secondary" className="text-xs">Occupied</Badge>
      case "reserved":
        return <Badge variant="outline" className="text-xs">Reserved</Badge>
      case "maintenance":
        return <Badge variant="destructive" className="text-xs">Maintenance</Badge>
      case "disabled":
        return <Badge variant="destructive" className="text-xs">Disabled</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>
    }
  }

  const getTypeIcon = (type: SpotType) => {
    switch (type) {
      case "electric":
        return <Zap className="h-4 w-4 text-blue-600" />
      case "accessible":
        return <Accessibility className="h-4 w-4 text-green-600" />
      default:
        return <Car className="h-4 w-4 text-gray-600" />
    }
  }

  const getTypeBadge = (type: SpotType) => {
    switch (type) {
      case "electric":
        return <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">Electric</Badge>
      case "accessible":
        return <Badge variant="outline" className="text-xs text-green-600 border-green-600">Accessible</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Standard</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-parking-spaces">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parking Space Administration</h1>
          <p className="text-muted-foreground">
            Manage parking spaces, rates, and assignments across all buildings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLocationMap(true)} data-testid="button-view-map">
            <Map className="h-4 w-4 mr-2" />
            Location Map
          </Button>
          <Button variant="outline" data-testid="button-import-spaces">
            <Upload className="h-4 w-4 mr-2" />
            Import Spaces
          </Button>
          <Dialog open={showAddSpace} onOpenChange={setShowAddSpace}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-space">
                <Plus className="h-4 w-4 mr-2" />
                Add Space
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Parking Space</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="space-number">Spot Number</Label>
                    <Input id="space-number" placeholder="A-101" data-testid="input-spot-number" />
                  </div>
                  <div>
                    <Label htmlFor="space-building">Building</Label>
                    <Select data-testid="select-building">
                      <SelectTrigger>
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Building A</SelectItem>
                        <SelectItem value="B">Building B</SelectItem>
                        <SelectItem value="C">Building C</SelectItem>
                        <SelectItem value="D">Building D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="space-floor">Floor</Label>
                    <Input id="space-floor" type="number" placeholder="1" data-testid="input-floor" />
                  </div>
                  <div>
                    <Label htmlFor="space-zone">Zone</Label>
                    <Input id="space-zone" placeholder="North" data-testid="input-zone" />
                  </div>
                  <div>
                    <Label htmlFor="space-type">Space Type</Label>
                    <Select data-testid="select-space-type">
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="electric">Electric</SelectItem>
                        <SelectItem value="accessible">Accessible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="space-rate">Daily Rate ($)</Label>
                    <Input id="space-rate" type="number" placeholder="15.00" data-testid="input-rate" />
                  </div>
                  <div>
                    <Label htmlFor="space-length">Length (ft)</Label>
                    <Input id="space-length" type="number" placeholder="18" data-testid="input-length" />
                  </div>
                  <div>
                    <Label htmlFor="space-width">Width (ft)</Label>
                    <Input id="space-width" type="number" placeholder="8.5" data-testid="input-width" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="indoor" data-testid="checkbox-indoor" />
                  <Label htmlFor="indoor">Indoor space</Label>
                </div>
                <div>
                  <Label htmlFor="space-features">Features (comma-separated)</Label>
                  <Input id="space-features" placeholder="Covered, Security Camera" data-testid="input-features" />
                </div>
                <div>
                  <Label htmlFor="space-notes">Notes</Label>
                  <Textarea id="space-notes" placeholder="Additional notes about this space" data-testid="textarea-notes" />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddSpace(false)} data-testid="button-cancel-add">
                    Cancel
                  </Button>
                  <Button onClick={() => setShowAddSpace(false)} data-testid="button-save-space">
                    Add Space
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Total Spaces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-spaces">{totalSpaces}</div>
            <div className="text-xs text-muted-foreground">Across all buildings</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-available-spaces">{availableSpaces}</div>
            <div className="text-xs text-muted-foreground">{Math.round((availableSpaces/totalSpaces)*100)}% of total</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Occupied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-occupied-spaces">{occupiedSpaces}</div>
            <div className="text-xs text-muted-foreground">{Math.round((occupiedSpaces/totalSpaces)*100)}% occupancy</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-avg-occupancy">{averageOccupancy}%</div>
            <div className="text-xs text-muted-foreground">Overall performance</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-total-revenue">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">This year</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-maintenance-spaces">{maintenanceSpaces}</div>
            <div className="text-xs text-muted-foreground">Spaces offline</div>
          </CardContent>
        </Card>
      </div>

      {/* Building Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Spaces by Building
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(buildingStats).map(([building, count]) => (
                <div key={building} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Building {building}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{count} spaces</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round((count/totalSpaces)*100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Spaces by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">Standard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{typeStats.standard} spaces</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((typeStats.standard/totalSpaces)*100)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Electric</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{typeStats.electric} spaces</span>
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                    {Math.round((typeStats.electric/totalSpaces)*100)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Accessible</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{typeStats.accessible} spaces</span>
                  <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                    {Math.round((typeStats.accessible/totalSpaces)*100)}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search spaces, owners, locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-spaces"
                />
              </div>
              <Select value={filterBuilding} onValueChange={setFilterBuilding} data-testid="select-filter-building">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buildings</SelectItem>
                  <SelectItem value="A">Building A</SelectItem>
                  <SelectItem value="B">Building B</SelectItem>
                  <SelectItem value="C">Building C</SelectItem>
                  <SelectItem value="D">Building D</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType} data-testid="select-filter-type">
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus} data-testid="select-filter-status">
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-export-spaces">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowBulkActions(!showBulkActions)}
                data-testid="button-bulk-actions"
              >
                <Filter className="h-4 w-4 mr-2" />
                Bulk Actions
              </Button>
            </div>
          </div>
          
          {showBulkActions && selectedSpaces.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  {selectedSpaces.length} space(s) selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('enable')} data-testid="button-bulk-enable">
                  Enable
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('disable')} data-testid="button-bulk-disable">
                  Disable
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('maintenance')} data-testid="button-bulk-maintenance">
                  Maintenance Mode
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('rate_update')} data-testid="button-bulk-rate-update">
                  Update Rates
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parking Spaces Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Parking Spaces</span>
            <span className="text-sm font-normal text-muted-foreground">
              Showing {filteredSpaces.length} of {totalSpaces} spaces
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSpaces.length === filteredSpaces.length && filteredSpaces.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all-spaces"
                    />
                  </TableHead>
                  <TableHead>Spot</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpaces.map((space) => (
                  <TableRow key={space.id} data-testid={`row-space-${space.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSpaces.includes(space.id)}
                        onCheckedChange={() => handleSelectSpace(space.id)}
                        data-testid={`checkbox-select-space-${space.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium" data-testid={`text-spot-number-${space.id}`}>
                          {space.spotNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Floor {space.floor}, {space.zone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span data-testid={`text-building-${space.id}`}>Building {space.building}</span>
                        {space.isIndoor ? (
                          <Badge variant="outline" className="text-xs">Indoor</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Outdoor</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(space.type)}
                        {getTypeBadge(space.type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(space.status)}
                        {getStatusBadge(space.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {space.owner ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-sm" data-testid={`text-owner-name-${space.id}`}>
                            {space.owner.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {space.owner.department}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium" data-testid={`text-rate-${space.id}`}>
                        ${space.currentRate}/day
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" data-testid={`text-occupancy-${space.id}`}>
                          {space.occupancyRate}%
                        </span>
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div 
                            className="h-2 bg-primary rounded-full" 
                            style={{width: `${space.occupancyRate}%`}}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600" data-testid={`text-revenue-${space.id}`}>
                        ${space.totalRevenue.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${space.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewDetails(space.id)} data-testid={`action-view-${space.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditSpace(space.id)} data-testid={`action-edit-${space.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Space
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleReassignSpace(space.id)} data-testid={`action-reassign-${space.id}`}>
                            <Users className="h-4 w-4 mr-2" />
                            Reassign Owner
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMaintenanceMode(space.id)} data-testid={`action-maintenance-${space.id}`}>
                            <Wrench className="h-4 w-4 mr-2" />
                            Maintenance Mode
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteSpace(space.id)} className="text-red-600" data-testid={`action-delete-${space.id}`}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Space
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Location Map Dialog */}
      <Dialog open={showLocationMap} onOpenChange={setShowLocationMap}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parking Space Location Overview</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Tabs defaultValue="grid" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="grid">Grid View</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="grid" className="space-y-4">
                {/* Simple grid layout showing building distribution */}
                <div className="grid grid-cols-2 gap-6">
                  {Object.entries(buildingStats).map(([building, count]) => (
                    <Card key={building}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Building {building}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          {mockParkingSpaces
                            .filter(space => space.building === building)
                            .slice(0, 16)
                            .map((space) => (
                              <div
                                key={space.id}
                                className={`h-8 w-8 rounded border-2 flex items-center justify-center text-xs font-medium ${
                                  space.status === 'available' ? 'bg-green-100 border-green-500 text-green-700' :
                                  space.status === 'occupied' ? 'bg-blue-100 border-blue-500 text-blue-700' :
                                  space.status === 'maintenance' ? 'bg-orange-100 border-orange-500 text-orange-700' :
                                  'bg-red-100 border-red-500 text-red-700'
                                }`}
                                title={`${space.spotNumber} - ${space.status}`}
                              >
                                {space.type === 'electric' && <Zap className="h-3 w-3" />}
                                {space.type === 'accessible' && <Accessibility className="h-3 w-3" />}
                                {space.type === 'standard' && <Car className="h-3 w-3" />}
                              </div>
                            ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {count} total spaces
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-green-100 border-2 border-green-500 rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
                    <span>Occupied</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-orange-100 border-2 border-orange-500 rounded"></div>
                    <span>Maintenance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-red-100 border-2 border-red-500 rounded"></div>
                    <span>Disabled</span>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Occupancy by Building</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(buildingStats).map(([building, count]) => {
                          const buildingSpaces = mockParkingSpaces.filter(s => s.building === building)
                          const occupancyRate = Math.round(
                            buildingSpaces.reduce((sum, space) => sum + space.occupancyRate, 0) / buildingSpaces.length
                          )
                          return (
                            <div key={building} className="flex items-center justify-between">
                              <span className="font-medium">Building {building}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-muted rounded-full h-2">
                                  <div 
                                    className="h-2 bg-primary rounded-full" 
                                    style={{width: `${occupancyRate}%`}}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground w-10">
                                  {occupancyRate}%
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Revenue by Building</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(buildingStats).map(([building]) => {
                          const buildingRevenue = mockParkingSpaces
                            .filter(s => s.building === building)
                            .reduce((sum, space) => sum + space.totalRevenue, 0)
                          return (
                            <div key={building} className="flex items-center justify-between">
                              <span className="font-medium">Building {building}</span>
                              <span className="text-sm font-medium text-green-600">
                                ${buildingRevenue.toLocaleString()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}