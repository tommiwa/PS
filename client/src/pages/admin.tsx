import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Users, Car, Clock, AlertTriangle, TrendingUp, Plus, 
  ListOrdered, CalendarDays, UserPlus, ArrowRight,
  Timer, Target, CheckCircle2, Search, Filter,
  Zap, Accessibility, Building, MoreHorizontal
} from "lucide-react"
import type { WaitingList } from "@shared/schema"

type ParkingSpace = {
  id: string
  spotNumber: string
  building: string
  type: "standard" | "electric" | "accessible"
  status: "available" | "occupied" | "maintenance"
  owner?: { name: string; email: string; department: string }
  floor?: number
  zone?: string
  isIndoor?: boolean
  currentRate?: number
  features?: string[]
  notes?: string
  dateAdded?: string
  isActive?: boolean
}

export default function Admin() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAddSpotDialog, setShowAddSpotDialog] = useState(false)
  const [showEditSpotDialog, setShowEditSpotDialog] = useState(false)
  const [showAddToWaitingDialog, setShowAddToWaitingDialog] = useState(false)
  const [showDirectAssignDialog, setShowDirectAssignDialog] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpace | null>(null)
  const [selectedSpotForAssign, setSelectedSpotForAssign] = useState<ParkingSpace | null>(null)
  const [activeSpotTab, setActiveSpotTab] = useState("all")
  
  // Fetch waiting list data for metrics
  const { data: allWaitingList, isLoading: isLoadingWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  });

  const { data: activeWaitingList, isLoading: isLoadingActiveWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list/active"],
  });

  // Fetch unallocated spots
  const { data: unallocatedSpots = [] } = useQuery<ParkingSpace[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  });

  // Mock all spots data for demonstration
  const allSpots: ParkingSpace[] = [
    ...unallocatedSpots,
    {
      id: "spot-1",
      spotNumber: "A-101",
      building: "A",
      type: "electric",
      status: "occupied",
      owner: { name: "Sarah Chen", email: "sarah.chen@bci.ca", department: "Engineering" },
      floor: 1,
      zone: "North",
      isIndoor: true,
      currentRate: 25,
      features: ["EV Charging", "Covered"],
      notes: "Level 2 charger",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "spot-2",
      spotNumber: "A-102",
      building: "A",
      type: "standard",
      status: "available",
      floor: 1,
      zone: "North",
      isIndoor: true,
      currentRate: 15,
      features: ["Covered"],
      notes: "",
      dateAdded: "2023-01-15",
      isActive: true
    },
    {
      id: "spot-3",
      spotNumber: "B-201",
      building: "B",
      type: "accessible",
      status: "maintenance",
      floor: 2,
      zone: "South",
      isIndoor: true,
      currentRate: 20,
      features: ["Accessible", "Near Elevator"],
      notes: "Under maintenance",
      dateAdded: "2023-02-01",
      isActive: true
    }
  ];

  // Calculate waiting list metrics
  const waitingListMetrics = {
    total: allWaitingList?.length || 0,
    active: activeWaitingList?.length || 0,
    assigned: allWaitingList?.filter(entry => entry.status === "assigned").length || 0,
    highPriority: activeWaitingList?.filter(entry => entry.priority === "high").length || 0,
    mediumPriority: activeWaitingList?.filter(entry => entry.priority === "medium").length || 0,
    lowPriority: activeWaitingList?.filter(entry => entry.priority === "low").length || 0,
    averageWaitTime: activeWaitingList && activeWaitingList.length > 0 
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

  // Filter waiting list - show all waiting list entries, not just active
  const filteredWaitingList = allWaitingList?.filter(item => {
    const matchesSearch = item.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || item.preferredSpotType === filterType
    return matchesSearch && matchesType
  }) || []

  // Assignment mutation
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
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] });
      
      toast({
        title: "Assignment Successful",
        description: `User has been assigned to the parking spot. ${data.notificationsSent?.emailSent ? 'Email notification sent.' : ''}`,
        variant: "default"
      });
      
      setShowAssignDialog(false);
      setSelectedWaitingListItem(null);
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign user. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAssignSpot = (waitingListId: string, spotId: string) => {
    const spot = unallocatedSpots.find(s => s.id === spotId);
    if (!spot) return;
    
    assignFromWaitingListMutation.mutate({
      waitingListId,
      spotId,
      spotDetails: {
        spotNumber: spot.spotNumber,
        location: `Building ${spot.building}`,
        building: spot.building
      }
    });
  }

  const handleDeleteSpot = (spotId: string) => {
    console.log('Delete spot:', spotId);
    toast({
      title: "Spot Deleted",
      description: "Parking spot has been removed from the system.",
      variant: "default"
    });
  }

  const handleAddSpot = () => {
    console.log('Add new spot');
    setShowAddSpotDialog(false);
    toast({
      title: "Spot Added",
      description: "New parking spot has been added to the system.",
      variant: "default"
    });
  }

  const handleEditSpot = () => {
    console.log('Edit spot:', selectedSpot);
    setShowEditSpotDialog(false);
    setSelectedSpot(null);
    toast({
      title: "Spot Updated",
      description: "Parking spot details have been updated.",
      variant: "default"
    });
  }

  const handleAddToWaitingList = () => {
    console.log('Add user to waiting list');
    setShowAddToWaitingDialog(false);
    toast({
      title: "User Added to Waiting List",
      description: "User has been successfully added to the waiting list.",
      variant: "default"
    });
  }

  const handleDirectAssign = () => {
    console.log('Direct assign spot:', selectedSpotForAssign);
    setShowDirectAssignDialog(false);
    setSelectedSpotForAssign(null);
    toast({
      title: "Spot Assigned",
      description: "Parking spot has been assigned to the user.",
      variant: "default"
    });
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parking Management</h1>
          <p className="text-muted-foreground">
            Manage parking spots, waiting list, and system settings.
          </p>
        </div>
        <Button data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-spots">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{allSpots.filter(spot => spot.status === "available").length}</div>
            <div className="text-sm text-muted-foreground">Available Spots</div>
          </CardContent>
        </Card>
        <Card data-testid="card-waiting-users">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{waitingListMetrics.active}</div>
            <div className="text-sm text-muted-foreground">Users Waiting</div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-wait">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{waitingListMetrics.averageWaitTime}</div>
            <div className="text-sm text-muted-foreground">Avg Wait Days</div>
          </CardContent>
        </Card>
        <Card data-testid="card-assignments">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{waitingListMetrics.recentAssignments}</div>
            <div className="text-sm text-muted-foreground">Recent Assignments</div>
          </CardContent>
        </Card>
      </div>

      {/* Parking Management */}
      <Tabs defaultValue="waiting-list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="waiting-list" data-testid="tab-waiting-list">
            <ListOrdered className="h-4 w-4 mr-2" />
            Waiting List ({waitingListMetrics.active})
          </TabsTrigger>
          <TabsTrigger value="spots" data-testid="tab-spots">
            <Car className="h-4 w-4 mr-2" />
            Available Spots ({allSpots.filter(spot => spot.status === "available").length})
          </TabsTrigger>
          <TabsTrigger value="all-spots" data-testid="tab-all-spots">
            <Building className="h-4 w-4 mr-2" />
            All Spots ({allSpots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting-list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Waiting List Management</CardTitle>
                <Button
                  onClick={() => setShowAddToWaitingDialog(true)}
                  data-testid="button-add-to-waiting"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add to Waiting List
                </Button>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search-waiting"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40" data-testid="select-filter-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingWaitingList ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Preferred Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Wait Time</TableHead>
                      <TableHead>Enrolled By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWaitingList.length > 0 ? filteredWaitingList.map((item) => {
                      const waitDays = Math.floor((Date.now() - new Date(item.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <TableRow key={item.id} data-testid={`row-waiting-${item.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.userName}</div>
                              <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>{item.userDepartment}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.preferredSpotType === "electric" && <Zap className="h-4 w-4" />}
                              {item.preferredSpotType === "accessible" && <Accessibility className="h-4 w-4" />}
                              {item.preferredSpotType === "standard" && <Car className="h-4 w-4" />}
                              <span className="capitalize">{item.preferredSpotType}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "secondary" : "outline"}
                              data-testid={`badge-priority-${item.priority}`}
                            >
                              {item.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{waitDays} days</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.enrolledBy === "self" ? "Profile" : item.enrolledBy}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedWaitingListItem(item.id);
                                setShowAssignDialog(true);
                              }}
                              data-testid={`button-assign-${item.id}`}
                            >
                              Assign Spot
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users in waiting list
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Parking Spots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allSpots
                  .filter(spot => spot.status === "available")
                  .map((spot) => (
                  <Card key={spot.id} className="p-4" data-testid={`card-spot-${spot.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{spot.spotNumber}</div>
                      <Badge variant="outline">Available</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Building {spot.building}
                      </div>
                      <div className="flex items-center gap-1">
                        {spot.type === "electric" && <Zap className="h-3 w-3" />}
                        {spot.type === "accessible" && <Accessibility className="h-3 w-3" />}
                        {spot.type === "standard" && <Car className="h-3 w-3" />}
                        <span className="capitalize">{spot.type}</span>
                      </div>
                      <div className="text-xs">
                        {spot.owner ? `Owner: ${spot.owner.name}` : "Unallocated"}
                      </div>
                      <div className="text-xs font-medium">
                        ${spot.currentRate || 0}/day
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedSpotForAssign(spot);
                          setShowDirectAssignDialog(true);
                        }}
                        data-testid={`button-assign-spot-${spot.id}`}
                      >
                        Assign to User
                      </Button>
                    </div>
                  </Card>
                ))}
                {allSpots.filter(spot => spot.status === "available").length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No available parking spots at the moment
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-spots" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Parking Spots Management</CardTitle>
                <Button
                  onClick={() => setShowAddSpotDialog(true)}
                  data-testid="button-add-spot"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Spot
                </Button>
              </div>
              <div className="flex gap-4">
                <Select value={activeSpotTab} onValueChange={setActiveSpotTab}>
                  <SelectTrigger className="w-40" data-testid="select-spot-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Spots</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Spot Number</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSpots
                    .filter(spot => activeSpotTab === "all" || spot.status === activeSpotTab)
                    .map((spot) => (
                      <TableRow key={spot.id} data-testid={`row-spot-${spot.id}`}>
                        <TableCell className="font-medium">{spot.spotNumber}</TableCell>
                        <TableCell>Building {spot.building}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {spot.type === "electric" && <Zap className="h-4 w-4 text-yellow-500" />}
                            {spot.type === "accessible" && <Accessibility className="h-4 w-4 text-blue-500" />}
                            {spot.type === "standard" && <Car className="h-4 w-4 text-gray-500" />}
                            <span className="capitalize">{spot.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              spot.status === "available" ? "default" : 
                              spot.status === "occupied" ? "secondary" : "destructive"
                            }
                            data-testid={`badge-status-${spot.status}`}
                          >
                            {spot.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {spot.owner ? (
                            <div>
                              <div className="font-medium">{spot.owner.name}</div>
                              <div className="text-xs text-muted-foreground">{spot.owner.department}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unallocated</span>
                          )}
                        </TableCell>
                        <TableCell>${spot.currentRate || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSpot(spot);
                                setShowEditSpotDialog(true);
                              }}
                              data-testid={`button-edit-${spot.id}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSpot(spot.id)}
                              data-testid={`button-delete-${spot.id}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select an available parking spot to assign to the selected user.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {unallocatedSpots.map((spot) => (
                <Button
                  key={spot.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => selectedWaitingListItem && handleAssignSpot(selectedWaitingListItem, spot.id)}
                  disabled={assignFromWaitingListMutation.isPending}
                  data-testid={`button-select-spot-${spot.id}`}
                >
                  <div className="flex items-center gap-2">
                    {spot.type === "electric" && <Zap className="h-4 w-4" />}
                    {spot.type === "accessible" && <Accessibility className="h-4 w-4" />}
                    {spot.type === "standard" && <Car className="h-4 w-4" />}
                    <span>{spot.spotNumber}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Building {spot.building}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Spot Dialog */}
      <Dialog open={showAddSpotDialog} onOpenChange={setShowAddSpotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Spot Number</label>
              <Input placeholder="e.g., A-301" data-testid="input-spot-number" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Building</label>
              <Select>
                <SelectTrigger data-testid="select-building">
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select>
                <SelectTrigger data-testid="select-spot-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate ($)</label>
              <Input type="number" placeholder="25.00" data-testid="input-rate" />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleAddSpot} className="flex-1" data-testid="button-save-spot">
                Add Spot
              </Button>
              <Button variant="outline" onClick={() => setShowAddSpotDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpotDialog} onOpenChange={setShowEditSpotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Spot Number</label>
                <Input defaultValue={selectedSpot.spotNumber} data-testid="input-edit-spot-number" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Building</label>
                <Select defaultValue={selectedSpot.building}>
                  <SelectTrigger data-testid="select-edit-building">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Building A</SelectItem>
                    <SelectItem value="B">Building B</SelectItem>
                    <SelectItem value="C">Building C</SelectItem>
                    <SelectItem value="D">Building D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select defaultValue={selectedSpot.type}>
                  <SelectTrigger data-testid="select-edit-spot-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select defaultValue={selectedSpot.status}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rate ($)</label>
                <Input type="number" defaultValue={selectedSpot.currentRate} data-testid="input-edit-rate" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleEditSpot} className="flex-1" data-testid="button-save-edit-spot">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setShowEditSpotDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Waiting List Dialog */}
      <Dialog open={showAddToWaitingDialog} onOpenChange={setShowAddToWaitingDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User to Waiting List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">User Email</label>
              <Input placeholder="user@bci.ca" data-testid="input-user-email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred Spot Type</label>
              <Select>
                <SelectTrigger data-testid="select-preferred-type">
                  <SelectValue placeholder="Select preferred type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="accessible">Accessible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select>
                <SelectTrigger data-testid="select-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Input placeholder="Reason for waiting list request" data-testid="input-reason" />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleAddToWaitingList} className="flex-1" data-testid="button-add-to-waiting">
                Add to List
              </Button>
              <Button variant="outline" onClick={() => setShowAddToWaitingDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Assign Spot Dialog */}
      <Dialog open={showDirectAssignDialog} onOpenChange={setShowDirectAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Spot to User</DialogTitle>
          </DialogHeader>
          {selectedSpotForAssign && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">Spot: {selectedSpotForAssign.spotNumber}</div>
                <div className="text-sm text-muted-foreground">
                  Building {selectedSpotForAssign.building} • {selectedSpotForAssign.type} • ${selectedSpotForAssign.currentRate}/day
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">User Email</label>
                <Input placeholder="user@bci.ca" data-testid="input-assign-user-email" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignment Duration</label>
                <Select>
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent Assignment</SelectItem>
                    <SelectItem value="temporary">Temporary (30 days)</SelectItem>
                    <SelectItem value="trial">Trial Period (7 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input placeholder="Assignment notes" data-testid="input-assign-notes" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleDirectAssign} className="flex-1" data-testid="button-confirm-assign">
                  Assign Spot
                </Button>
                <Button variant="outline" onClick={() => setShowDirectAssignDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}