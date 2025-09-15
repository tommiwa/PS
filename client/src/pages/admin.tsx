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
}

export default function Admin() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<string | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  
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

  // Calculate waiting list metrics
  const waitingListMetrics = {
    total: allWaitingList?.length || 0,
    active: activeWaitingList?.length || 0,
    assigned: allWaitingList?.filter(entry => entry.status === "assigned").length || 0,
    highPriority: activeWaitingList?.filter(entry => entry.priority === "high").length || 0,
    mediumPriority: activeWaitingList?.filter(entry => entry.priority === "medium").length || 0,
    lowPriority: activeWaitingList?.filter(entry => entry.priority === "low").length || 0,
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

  // Filter waiting list
  const filteredWaitingList = activeWaitingList?.filter(item => {
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

  return (
    <div className="p-6 space-y-6" data-testid="page-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Manage users, parking spots, waiting list, and system settings.
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
            <div className="text-2xl font-bold text-blue-600">{unallocatedSpots.length}</div>
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
            Available Spots ({unallocatedSpots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waiting-list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Waiting List Management</CardTitle>
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
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                {unallocatedSpots.map((spot) => (
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
                    </div>
                  </Card>
                ))}
              </div>
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
    </div>
  )
}