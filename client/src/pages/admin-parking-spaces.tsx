import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
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
  Map,
  UserPlus,
  UsersIcon,
  ListOrdered,
  Bell,
  CheckCircle2
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

interface WaitingList {
  id: string
  userId: string
  userName: string
  userEmail: string
  userDepartment: string
  preferredSpotType: SpotType
  preferredBuilding?: Building
  priority: "high" | "medium" | "low"
  status: "waiting" | "assigned" | "declined" | "expired"
  reason: string
  enrolledDate: string
  assignedDate?: string
  assignedSpotId?: string
  enrolledBy: string
  adminNotes: string
}

export default function AdminParkingSpaces() {
  const { toast } = useToast()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBuilding, setFilterBuilding] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([])
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showLocationMap, setShowLocationMap] = useState(false)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false)
  const [selectedAssignSpace, setSelectedAssignSpace] = useState<string | null>(null)
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignFromWaitingDialog, setShowAssignFromWaitingDialog] = useState(false)
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [waitingListFilterStatus, setWaitingListFilterStatus] = useState("all")
  const [waitingListFilterPriority, setWaitingListFilterPriority] = useState("all")
  const [selectedWaitingListItems, setSelectedWaitingListItems] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "unallocated" | "waiting-list">("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  // Query waiting list data
  const { data: waitingListData = [], refetch: refetchWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  });

  // Query unallocated parking spots
  const { data: unallocatedSpotsData = [], refetch: refetchUnallocatedSpots } = useQuery<ParkingSpace[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  });

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
        email: "sarah.chen@bci.ca"
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
        email: "m.rodriguez@bci.ca"
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
        email: "j.kim@bci.ca"
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
    },
    // Unallocated spots (no owners assigned yet)
    {
      id: "space-009",
      spotNumber: "B-301",
      building: "B",
      floor: 3,
      zone: "North",
      type: "standard",
      status: "available",
      isIndoor: true,
      currentRate: 15.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered"],
      lastMaintenance: "2024-01-01",
      nextMaintenance: "2024-04-01",
      totalRevenue: 0,
      occupancyRate: 0,
      averageBookingDuration: 0,
      notes: "Unallocated - awaiting assignment",
      dateAdded: "2024-01-01",
      isActive: true
    },
    {
      id: "space-010",
      spotNumber: "C-202",
      building: "C",
      floor: 2,
      zone: "East",
      type: "electric",
      status: "available",
      isIndoor: true,
      currentRate: 22.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["EV Charging", "Covered"],
      lastMaintenance: "2024-01-01",
      nextMaintenance: "2024-04-01",
      totalRevenue: 0,
      occupancyRate: 0,
      averageBookingDuration: 0,
      notes: "Unallocated electric spot",
      dateAdded: "2024-01-01",
      isActive: true
    },
    {
      id: "space-011",
      spotNumber: "D-101",
      building: "D",
      floor: 1,
      zone: "West",
      type: "accessible",
      status: "available",
      isIndoor: true,
      currentRate: 20.00,
      dimensions: { length: 20, width: 12 },
      features: ["Accessible", "Covered", "Near Elevator"],
      lastMaintenance: "2024-01-01",
      nextMaintenance: "2024-04-01",
      totalRevenue: 0,
      occupancyRate: 0,
      averageBookingDuration: 0,
      notes: "Unallocated accessible spot",
      dateAdded: "2024-01-01",
      isActive: true
    },
    {
      id: "space-012",
      spotNumber: "A-301",
      building: "A",
      floor: 3,
      zone: "South",
      type: "standard",
      status: "available",
      isIndoor: true,
      currentRate: 18.00,
      dimensions: { length: 18, width: 8.5 },
      features: ["Covered", "Premium Level"],
      lastMaintenance: "2024-01-01",
      nextMaintenance: "2024-04-01",
      totalRevenue: 0,
      occupancyRate: 0,
      averageBookingDuration: 0,
      notes: "Unallocated premium spot",
      dateAdded: "2024-01-01",
      isActive: true
    }
  ]

  // Mock users for assignment
  const mockUsers = [
    { id: "user-001", name: "Sarah Chen", email: "sarah.chen@bci.ca", department: "Engineering" },
    { id: "user-002", name: "Michael Rodriguez", email: "m.rodriguez@bci.ca", department: "Marketing" },
    { id: "user-003", name: "Jennifer Kim", email: "j.kim@bci.ca", department: "Finance" },
    { id: "user-004", name: "David Thompson", email: "d.thompson@bci.ca", department: "IT" },
    { id: "user-005", name: "Emma Wilson", email: "e.wilson@bci.ca", department: "HR" },
    { id: "user-006", name: "John Park", email: "j.park@bci.ca", department: "Operations" },
    { id: "user-007", name: "Lisa Anderson", email: "l.anderson@bci.ca", department: "Legal" },
    { id: "user-008", name: "Robert Johnson", email: "r.johnson@bci.ca", department: "Sales" }
  ]

  // Mock waiting list data
  const mockWaitingList: WaitingList[] = [
    {
      id: "wait-001",
      userId: "user-009",
      userName: "Alex Turner",
      userEmail: "a.turner@bci.ca",
      userDepartment: "Engineering",
      preferredSpotType: "electric",
      preferredBuilding: "A",
      priority: "high",
      status: "waiting",
      reason: "New hire - requires EV charging",
      enrolledDate: "2024-01-15",
      enrolledBy: "admin",
      adminNotes: "Priority due to role requirements"
    },
    {
      id: "wait-002",
      userId: "user-010",
      userName: "Maria Gonzalez",
      userEmail: "m.gonzalez@bci.ca",
      userDepartment: "Finance",
      preferredSpotType: "accessible",
      priority: "high",
      status: "waiting",
      reason: "Accessibility accommodation required",
      enrolledDate: "2024-01-12",
      enrolledBy: "hr",
      adminNotes: "ADA compliance requirement"
    },
    {
      id: "wait-003",
      userId: "user-011",
      userName: "Brian Williams",
      userEmail: "b.williams@bci.ca",
      userDepartment: "IT",
      preferredSpotType: "standard",
      preferredBuilding: "B",
      priority: "medium",
      status: "waiting",
      reason: "Office relocation to Building B",
      enrolledDate: "2024-01-10",
      enrolledBy: "admin",
      adminNotes: "Can wait until Building B spot available"
    },
    {
      id: "wait-004",
      userId: "user-012",
      userName: "Rachel Brown",
      userEmail: "r.brown@bci.ca",
      userDepartment: "Marketing",
      preferredSpotType: "electric",
      priority: "medium",
      status: "waiting",
      reason: "Purchased electric vehicle",
      enrolledDate: "2024-01-08",
      enrolledBy: "self",
      adminNotes: "Can use standard spot temporarily"
    },
    {
      id: "wait-005",
      userId: "user-013",
      userName: "Steve Miller",
      userEmail: "s.miller@bci.ca",
      userDepartment: "Operations",
      preferredSpotType: "standard",
      preferredBuilding: "C",
      priority: "low",
      status: "waiting",
      reason: "Convenience - closer to department",
      enrolledDate: "2024-01-05",
      enrolledBy: "self",
      adminNotes: "Non-urgent request"
    },
    {
      id: "wait-006",
      userId: "user-014",
      userName: "Amanda Davis",
      userEmail: "a.davis@bci.ca",
      userDepartment: "Legal",
      preferredSpotType: "standard",
      preferredBuilding: "D",
      priority: "low",
      status: "waiting",
      reason: "Prefer premium level parking",
      enrolledDate: "2024-01-03",
      enrolledBy: "self",
      adminNotes: "Low priority - aesthetic preference"
    },
    {
      id: "wait-007",
      userId: "user-015",
      userName: "Kevin Lee",
      userEmail: "k.lee@bci.ca",
      userDepartment: "Sales",
      preferredSpotType: "electric",
      priority: "medium",
      status: "assigned",
      reason: "Company vehicle upgrade to electric",
      enrolledDate: "2023-12-20",
      assignedDate: "2024-01-14",
      assignedSpotId: "space-008",
      enrolledBy: "admin",
      adminNotes: "Assigned to A-205 for company EV"
    }
  ]

  const filteredSpaces = mockParkingSpaces.filter(space => {
    // Filter by tab
    if (activeTab === "unallocated" && space.owner) return false
    if (activeTab === "all" && !space.owner && activeTab !== "unallocated") return true
    
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

  // Filtered waiting list
  const filteredWaitingList = mockWaitingList.filter(item => {
    const matchesSearch = item.userName.toLowerCase().includes(waitingListSearchTerm.toLowerCase()) ||
                         item.userEmail.toLowerCase().includes(waitingListSearchTerm.toLowerCase()) ||
                         item.userDepartment.toLowerCase().includes(waitingListSearchTerm.toLowerCase()) ||
                         item.reason.toLowerCase().includes(waitingListSearchTerm.toLowerCase())
    
    const matchesStatus = waitingListFilterStatus === "all" || item.status === waitingListFilterStatus
    const matchesPriority = waitingListFilterPriority === "all" || item.priority === waitingListFilterPriority
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Get unallocated spots
  const unallocatedSpaces = mockParkingSpaces.filter(space => !space.owner)
  const allocatedSpaces = mockParkingSpaces.filter(space => space.owner)

  // Waiting list stats
  const activeWaitingList = mockWaitingList.filter(item => item.status === "waiting")
  const waitingListByPriority = {
    high: mockWaitingList.filter(item => item.priority === "high" && item.status === "waiting").length,
    medium: mockWaitingList.filter(item => item.priority === "medium" && item.status === "waiting").length,
    low: mockWaitingList.filter(item => item.priority === "low" && item.status === "waiting").length
  }

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

  const handleAssignSpace = (spaceId: string, userId: string) => {
    console.log('Assign space:', spaceId, 'to user:', userId)
    // In real app, would call API endpoint to assign space
    setShowAssignDialog(false)
    setSelectedAssignSpace(null)
  }

  const handleBulkAssignSpaces = (userId: string) => {
    console.log('Bulk assign spaces:', selectedSpaces, 'to user:', userId)
    // In real app, would call API endpoint to bulk assign spaces
    setShowBulkAssignDialog(false)
    setSelectedSpaces([])
  }

  // Mutation for assigning waiting list user to parking spot
  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ waitingListId, spotId, spotDetails }: { 
      waitingListId: string; 
      spotId: string; 
      spotDetails: { spotNumber: string; location: string; building: string }
    }) => {
      const response = await apiRequest("POST", `/api/waiting-list/${waitingListId}/assign`, {
        spotId,
        spotDetails
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Refresh data queries
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      
      // Show success message
      toast({
        title: "🎉 Assignment Successful!",
        description: `User has been assigned to the parking spot. ${
          data.notificationsSent?.emailSent ? 'Email notification sent.' : ''
        } ${data.notificationsSent?.inAppSent ? 'In-app notification sent.' : ''}`,
        variant: "default"
      });
      
      // Close dialog
      setShowAssignFromWaitingDialog(false);
      setSelectedWaitingListItem(null);
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign waiting list user. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Waiting list handlers
  const handleAssignFromWaitingList = (waitingListId: string, spaceId: string) => {
    // Find the selected spot details for notifications
    const selectedSpot = unallocatedSpotsData.find(spot => spot.id === spaceId);
    const spotDetails = {
      spotNumber: selectedSpot?.spotNumber || `Spot-${spaceId.slice(-3)}`,
      location: selectedSpot?.location || `Building A, Floor 1`, 
      building: selectedSpot?.building ? `Building ${selectedSpot.building}` : 'Building A'
    };

    assignFromWaitingListMutation.mutate({
      waitingListId,
      spotId: spaceId,
      spotDetails
    });
  }

  const handleOpenAssignFromWaitingDialog = (waitingListId: string) => {
    setSelectedWaitingListItem(waitingListId)
    setShowAssignFromWaitingDialog(true)
  }

  const handleSelectWaitingListItem = (itemId: string) => {
    setSelectedWaitingListItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSelectAllWaitingList = () => {
    if (selectedWaitingListItems.length === filteredWaitingList.length) {
      setSelectedWaitingListItems([])
    } else {
      setSelectedWaitingListItems(filteredWaitingList.map(item => item.id))
    }
  }

  const handleBulkWaitingListAction = (action: string) => {
    console.log('Bulk waiting list action:', action, 'on items:', selectedWaitingListItems)
    setSelectedWaitingListItems([])
  }

  const handleRemoveFromWaitingList = (itemId: string) => {
    console.log('Remove from waiting list:', itemId)
  }

  const handleUpdateWaitingListPriority = (itemId: string, priority: string) => {
    console.log('Update waiting list priority:', itemId, 'to', priority)
  }

  const handleOpenAssignDialog = (spaceId: string) => {
    setSelectedAssignSpace(spaceId)
    setShowAssignDialog(true)
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
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Unallocated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="stat-unallocated-spaces">{unallocatedSpaces.length}</div>
            <div className="text-xs text-muted-foreground">Need assignment</div>
          </CardContent>
        </Card>
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
            <div className="text-2xl font-bold text-green-600" data-testid="stat-total-revenue">{totalRevenue.toLocaleString()}</div>
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

      {/* Tabs for All/Unallocated */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "unallocated" | "waiting-list")} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" data-testid="tab-all-spaces">
            All Spaces ({mockParkingSpaces.length})
          </TabsTrigger>
          <TabsTrigger value="unallocated" data-testid="tab-unallocated-spaces">
            <UsersIcon className="h-4 w-4 mr-2" />
            Unallocated ({unallocatedSpaces.length})
          </TabsTrigger>
          <TabsTrigger value="waiting-list" data-testid="tab-waiting-list">
            <ListOrdered className="h-4 w-4 mr-2" />
            Waiting List ({activeWaitingList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* All Spaces Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>All Parking Spaces</span>
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
                        {space.currentRate}/day
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
                        {space.totalRevenue.toLocaleString()}
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
        </TabsContent>

        <TabsContent value="unallocated" className="space-y-4">
          {/* Unallocated Spaces Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Unallocated Spaces ({unallocatedSpaces.length})
                </span>
                <div className="flex gap-2">
                  {selectedSpaces.length > 0 && (
                    <Button
                      onClick={() => setShowBulkAssignDialog(true)}
                      className="flex items-center gap-2"
                      data-testid="button-bulk-assign"
                    >
                      <UserPlus className="h-4 w-4" />
                      Bulk Assign ({selectedSpaces.length})
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unallocatedSpaces.length === 0 ? (
                <div className="text-center py-8">
                  <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">All spaces allocated</h3>
                  <p className="text-muted-foreground">All parking spaces have been assigned to owners.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedSpaces.length === unallocatedSpaces.length && unallocatedSpaces.length > 0}
                            onCheckedChange={handleSelectAll}
                            data-testid="checkbox-select-all-unallocated"
                          />
                        </TableHead>
                        <TableHead>Spot</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Suggested Rate</TableHead>
                        <TableHead>Features</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unallocatedSpaces.map((space) => (
                        <TableRow key={space.id} data-testid={`row-unallocated-${space.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSpaces.includes(space.id)}
                              onCheckedChange={() => handleSelectSpace(space.id)}
                              data-testid={`checkbox-select-unallocated-${space.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium" data-testid={`text-unallocated-spot-${space.id}`}>
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
                              <span>Building {space.building}</span>
                              {space.isIndoor && (
                                <Badge variant="outline" className="text-xs">Indoor</Badge>
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
                            <span className="font-medium text-green-600">
                              {space.currentRate}/day
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {space.features.slice(0, 2).map((feature, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                              {space.features.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{space.features.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleOpenAssignDialog(space.id)}
                              className="flex items-center gap-2"
                              data-testid={`button-assign-${space.id}`}
                            >
                              <UserPlus className="h-4 w-4" />
                              Assign
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waiting-list" className="space-y-4">
          {/* Waiting List Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  Waiting List ({activeWaitingList.length})
                </span>
                <div className="flex gap-2">
                  {selectedWaitingListItems.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkWaitingListAction('priority_high')}
                        data-testid="button-bulk-priority-high"
                      >
                        Set High Priority
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkWaitingListAction('remove')}
                        data-testid="button-bulk-remove"
                      >
                        Remove ({selectedWaitingListItems.length})
                      </Button>
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Search and Filters for Waiting List */}
              <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name, email, department..."
                      value={waitingListSearchTerm}
                      onChange={(e) => setWaitingListSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-waiting-list"
                    />
                  </div>
                  <Select value={waitingListFilterStatus} onValueChange={setWaitingListFilterStatus} data-testid="select-filter-status">
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="waiting">Waiting</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={waitingListFilterPriority} onValueChange={setWaitingListFilterPriority} data-testid="select-filter-priority">
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredWaitingList.length === 0 ? (
                <div className="text-center py-8">
                  <ListOrdered className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No waiting list entries</h3>
                  <p className="text-muted-foreground">No users are currently waiting for parking spaces.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedWaitingListItems.length === filteredWaitingList.length && filteredWaitingList.length > 0}
                            onCheckedChange={handleSelectAllWaitingList}
                            data-testid="checkbox-select-all-waiting-list"
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Preferred Type</TableHead>
                        <TableHead>Building</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enrolled</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWaitingList.map((item) => (
                        <TableRow key={item.id} data-testid={`row-waiting-list-${item.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedWaitingListItems.includes(item.id)}
                              onCheckedChange={() => handleSelectWaitingListItem(item.id)}
                              data-testid={`checkbox-select-waiting-${item.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm" data-testid={`text-user-name-${item.id}`}>
                                {item.userName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.userEmail}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.userDepartment}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(item.preferredSpotType)}
                              {getTypeBadge(item.preferredSpotType)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.preferredBuilding ? (
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span>Building {item.preferredBuilding}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Any</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.status === 'waiting' ? 'outline' : item.status === 'assigned' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {item.status === 'waiting' && <Clock className="h-3 w-3 mr-1" />}
                              {item.status === 'assigned' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm" data-testid={`text-enrolled-date-${item.id}`}>
                              {new Date(item.enrolledDate).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground" title={item.reason}>
                              {item.reason.length > 30 ? item.reason.substring(0, 30) + '...' : item.reason}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-actions-waiting-${item.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {item.status === 'waiting' && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenAssignFromWaitingDialog(item.id)} 
                                      data-testid={`action-assign-waiting-${item.id}`}
                                    >
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Assign Space
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleUpdateWaitingListPriority(item.id, 'high')} 
                                      data-testid={`action-priority-high-${item.id}`}
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      Set High Priority
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleUpdateWaitingListPriority(item.id, 'medium')} 
                                      data-testid={`action-priority-medium-${item.id}`}
                                    >
                                      <Bell className="h-4 w-4 mr-2" />
                                      Set Medium Priority
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleUpdateWaitingListPriority(item.id, 'low')} 
                                      data-testid={`action-priority-low-${item.id}`}
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      Set Low Priority
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleViewDetails(item.id)} 
                                  data-testid={`action-view-waiting-${item.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleRemoveFromWaitingList(item.id)} 
                                  className="text-red-600" 
                                  data-testid={`action-remove-waiting-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from List
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialogs */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Parking Space</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="assign-user">Select User</Label>
              <Select data-testid="select-assign-user">
                <SelectTrigger>
                  <SelectValue placeholder="Choose user to assign space to..." />
                </SelectTrigger>
                <SelectContent>
                  {mockUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleAssignSpace(selectedAssignSpace || '', 'user-001')}>
                Assign Space
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Parking Spaces</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Assign {selectedSpaces.length} selected spaces to a user
              </p>
              <Label htmlFor="bulk-assign-user">Select User</Label>
              <Select data-testid="select-bulk-assign-user">
                <SelectTrigger>
                  <SelectValue placeholder="Choose user to assign spaces to..." />
                </SelectTrigger>
                <SelectContent>
                  {mockUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} - {user.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleBulkAssignSpaces('user-001')}>
                Assign All Spaces
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                                {buildingRevenue.toLocaleString()}
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

      {/* Assign from Waiting List Dialog */}
      <Dialog open={showAssignFromWaitingDialog} onOpenChange={setShowAssignFromWaitingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Parking Space to Waiting List User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedWaitingListItem && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <strong>Assigning to:</strong> {mockWaitingList.find(item => item.id === selectedWaitingListItem)?.userName}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Preferred: {mockWaitingList.find(item => item.id === selectedWaitingListItem)?.preferredSpotType} 
                  {mockWaitingList.find(item => item.id === selectedWaitingListItem)?.preferredBuilding && 
                    ` in Building ${mockWaitingList.find(item => item.id === selectedWaitingListItem)?.preferredBuilding}`
                  }
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="assign-space">Select Available Space</Label>
              <Select data-testid="select-assign-space-from-waiting">
                <SelectTrigger>
                  <SelectValue placeholder="Choose available space..." />
                </SelectTrigger>
                <SelectContent>
                  {unallocatedSpaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.spotNumber} - Building {space.building} ({space.type} - ${space.currentRate}/day)
                    </SelectItem>
                  ))}
                  {unallocatedSpaces.length === 0 && (
                    <SelectItem value="none" disabled>
                      No unallocated spaces available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignFromWaitingDialog(false)} data-testid="button-cancel-assign-waiting">
                Cancel
              </Button>
              <Button 
                onClick={() => handleAssignFromWaitingList(selectedWaitingListItem || '', 'space-001')}
                disabled={unallocatedSpaces.length === 0}
                data-testid="button-confirm-assign-waiting"
              >
                Assign Space
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}