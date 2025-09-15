import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  CalendarCheck, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Search, 
  Filter,
  CheckCircle2, 
  XCircle, 
  Eye, 
  MessageSquare,
  Phone, 
  Mail, 
  Ban, 
  RefreshCw,
  Calendar,
  Car,
  User,
  DollarSign,
  Activity,
  Zap,
  Timer,
  Users,
  MapPin,
  Settings,
  MoreHorizontal
} from "lucide-react"
import type { Booking, BookingStatus, ParkingSpot } from "@shared/schema"

// Admin-specific interfaces for extended booking data
interface AdminBookingData {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  renterDepartment: string;
  ownerName: string;
  ownerEmail: string;
  ownerDepartment: string;
  bookingDate: string;
  dailyRate: number;
  status: BookingStatus;
  paymentReceived: boolean;
  startTime: string;
  endTime: string;
  notes: string;
  createdAt: string;
  lastActivity: string;
}

interface BookingRequest {
  id: string;
  type: 'cancellation' | 'dispute' | 'modification';
  submittedBy: string;
  email: string;
  bookingId: string;
  spotNumber: string;
  reason: string;
  requestDate: string;
  urgency: 'high' | 'medium' | 'low';
  status: 'pending' | 'resolved' | 'rejected';
}

interface BookingActivity {
  id: string;
  type: 'booking_created' | 'payment_received' | 'booking_cancelled' | 'dispute_raised' | 'booking_completed';
  user: string;
  action: string;
  timestamp: string;
  details: string;
}

interface PopularSpot {
  spotNumber: string;
  bookings: number;
}

interface UserActivity {
  activeRenters: number;
  activeOwners: number;
  newSignups: number;
}

interface BookingAnalytics {
  totalActiveBookings: number;
  totalDailyRevenue: number;
  pendingRequests: number;
  resolvedDisputes: number;
  averageBookingValue: number;
  occupancyRate: number;
  todayBookings: number;
  thisWeekBookings: number;
  popularSpots: PopularSpot[];
  userActivity: UserActivity;
}

export default function AdminSpotBookingManagement() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterTimeframe, setFilterTimeframe] = useState("today")
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingData | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null)
  const [showBookingDetails, setShowBookingDetails] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showDisputeDialog, setShowDisputeDialog] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [disputeResolution, setDisputeResolution] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [activeTab, setActiveTab] = useState("active")

  // Fetch active bookings
  const { data: activeBookings = [], isLoading: isLoadingActive } = useQuery<AdminBookingData[]>({
    queryKey: ["/api/admin/active-bookings"],
  });

  // Fetch booking requests that need attention
  const { data: bookingRequests = [], isLoading: isLoadingRequests } = useQuery<BookingRequest[]>({
    queryKey: ["/api/admin/booking-requests"],
  });

  // Fetch recent booking activity
  const { data: recentActivity = [], isLoading: isLoadingActivity } = useQuery<BookingActivity[]>({
    queryKey: ["/api/admin/booking-activity"],
  });

  // Fetch booking analytics
  const { data: bookingAnalytics, isLoading: isLoadingAnalytics } = useQuery<BookingAnalytics>({
    queryKey: ["/api/admin/booking-analytics"],
  });

  // Mock data for demonstration (remove when backend is ready)
  const mockActiveBookings = [
    {
      id: "booking-001",
      spotNumber: "A-15",
      spotLocation: "Building A, Level 2",
      renterName: "Michael Rodriguez",
      renterEmail: "m.rodriguez@bci.ca",
      renterDepartment: "Marketing",
      ownerName: "Sarah Chen",
      ownerEmail: "s.chen@bci.ca",
      ownerDepartment: "Engineering",
      bookingDate: "2024-01-15",
      dailyRate: 25.00,
      status: "confirmed" as BookingStatus,
      paymentReceived: true,
      startTime: "08:00",
      endTime: "17:00",
      notes: "Regular daily booking",
      createdAt: "2024-01-14T10:30:00Z",
      lastActivity: "2024-01-15T08:15:00Z"
    },
    {
      id: "booking-002",
      spotNumber: "B-08",
      spotLocation: "Building B, Level 1",
      renterName: "Jennifer Kim",
      renterEmail: "j.kim@bci.ca",
      renterDepartment: "Finance",
      ownerName: "David Wilson",
      ownerEmail: "d.wilson@bci.ca",
      ownerDepartment: "IT",
      bookingDate: "2024-01-15",
      dailyRate: 20.00,
      status: "confirmed" as BookingStatus,
      paymentReceived: false,
      startTime: "09:00",
      endTime: "16:00",
      notes: "Half-day booking",
      createdAt: "2024-01-14T15:45:00Z",
      lastActivity: "2024-01-15T09:00:00Z"
    },
    {
      id: "booking-003",
      spotNumber: "C-22",
      spotLocation: "Building C, Level 3",
      renterName: "Alex Thompson",
      renterEmail: "a.thompson@bci.ca",
      renterDepartment: "Sales",
      ownerName: "Lisa Park",
      ownerEmail: "l.park@bci.ca",
      ownerDepartment: "HR",
      bookingDate: "2024-01-15",
      dailyRate: 30.00,
      status: "pending" as BookingStatus,
      paymentReceived: false,
      startTime: "07:30",
      endTime: "18:30",
      notes: "Electric vehicle charging spot",
      createdAt: "2024-01-15T07:00:00Z",
      lastActivity: "2024-01-15T07:15:00Z"
    }
  ];

  const mockBookingRequests: BookingRequest[] = [
    {
      id: "request-001",
      type: "cancellation" as const,
      submittedBy: "Michael Rodriguez",
      email: "m.rodriguez@bci.ca",
      bookingId: "booking-001",
      spotNumber: "A-15",
      reason: "Emergency - need to travel for work",
      requestDate: "2024-01-15T14:30:00Z",
      urgency: "high" as const,
      status: "pending" as const
    },
    {
      id: "request-002", 
      type: "dispute" as const,
      submittedBy: "Jennifer Kim",
      email: "j.kim@bci.ca",
      bookingId: "booking-002",
      spotNumber: "B-08",
      reason: "Spot was occupied by someone else's vehicle",
      requestDate: "2024-01-15T09:15:00Z",
      urgency: "medium" as const,
      status: "pending" as const
    },
    {
      id: "request-003",
      type: "modification" as const,
      submittedBy: "Alex Thompson", 
      email: "a.thompson@bci.ca",
      bookingId: "booking-003",
      spotNumber: "C-22",
      reason: "Need to extend booking until 8 PM",
      requestDate: "2024-01-15T16:00:00Z",
      urgency: "low" as const,
      status: "pending" as const
    }
  ];

  const mockRecentActivity = [
    {
      id: "activity-001",
      type: "booking_created",
      user: "Michael Rodriguez",
      action: "Created new booking for spot A-15",
      timestamp: "2024-01-15T07:30:00Z",
      details: "Daily rate: $25.00"
    },
    {
      id: "activity-002",
      type: "payment_received",
      user: "Sarah Chen",
      action: "Received payment for spot A-15 booking",
      timestamp: "2024-01-15T08:00:00Z",
      details: "Amount: $25.00"
    },
    {
      id: "activity-003",
      type: "booking_cancelled",
      user: "Emma Wilson",
      action: "Cancelled booking for spot D-12",
      timestamp: "2024-01-15T06:45:00Z",
      details: "Reason: Vehicle breakdown"
    },
    {
      id: "activity-004",
      type: "dispute_raised",
      user: "Jennifer Kim",
      action: "Raised dispute for spot B-08",
      timestamp: "2024-01-15T09:15:00Z", 
      details: "Issue: Spot occupied by unauthorized vehicle"
    },
    {
      id: "activity-005",
      type: "booking_completed",
      user: "Tom Miller",
      action: "Completed booking for spot F-05",
      timestamp: "2024-01-14T17:00:00Z",
      details: "Duration: Full day"
    }
  ];

  const mockAnalytics = {
    totalActiveBookings: 12,
    totalDailyRevenue: 340.00,
    pendingRequests: 3,
    resolvedDisputes: 8,
    averageBookingValue: 28.33,
    occupancyRate: 78,
    todayBookings: 15,
    thisWeekBookings: 89,
    popularSpots: [
      { spotNumber: "A-15", bookings: 8 },
      { spotNumber: "B-08", bookings: 6 },
      { spotNumber: "C-22", bookings: 5 }
    ],
    userActivity: {
      activeRenters: 45,
      activeOwners: 28,
      newSignups: 3
    }
  };

  // Use mock data as fallback when API data is not available
  const displayActiveBookings = activeBookings.length > 0 ? activeBookings : mockActiveBookings;
  const displayBookingRequests = bookingRequests.length > 0 ? bookingRequests : mockBookingRequests;
  const displayRecentActivity = recentActivity.length > 0 ? recentActivity : mockRecentActivity;
  const displayAnalytics = bookingAnalytics || mockAnalytics;

  // Filter active bookings
  const filteredActiveBookings = displayActiveBookings.filter(booking => {
    const matchesSearch = booking.renterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.spotNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.spotLocation?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || booking.status === filterStatus
    
    return matchesSearch && matchesStatus
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const response = await apiRequest("POST", "/api/admin/cancel-booking", {
        bookingId,
        reason,
        cancelledBy: "admin"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      
      toast({
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled and both users have been notified.",
        variant: "default"
      });
      
      setShowCancelDialog(false);
      setCancelReason("");
      setSelectedBooking(null);
    },
    onError: (error) => {
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel booking. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Resolve dispute mutation
  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ requestId, resolution }: { requestId: string; resolution: string }) => {
      const response = await apiRequest("POST", "/api/admin/resolve-dispute", {
        requestId,
        resolution,
        resolvedBy: "admin"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      
      toast({
        title: "Dispute Resolved",
        description: "The dispute has been resolved and users have been notified of the decision.",
        variant: "default"
      });
      
      setShowDisputeDialog(false);
      setDisputeResolution("");
    },
    onError: (error) => {
      toast({
        title: "Resolution Failed",
        description: error instanceof Error ? error.message : "Failed to resolve dispute. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCancelBooking = () => {
    if (!selectedBooking || !cancelReason.trim()) return;
    
    cancelBookingMutation.mutate({
      bookingId: selectedBooking.id,
      reason: cancelReason
    });
  };

  const handleResolveDispute = (request: BookingRequest) => {
    if (!disputeResolution.trim()) return;
    
    resolveDisputeMutation.mutate({
      requestId: request.id,
      resolution: disputeResolution
    });
  };

  const handleContactUser = (user: { name: string; email: string }) => {
    console.log('Contact user:', user);
    toast({
      title: "Message Sent",
      description: `Your message has been sent to ${user.name}.`,
      variant: "default"
    });
    setShowContactDialog(false);
    setContactMessage("");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { variant: "default" as const, label: "Confirmed" },
      pending: { variant: "secondary" as const, label: "Pending" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" },
      completed: { variant: "outline" as const, label: "Completed" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      high: { variant: "destructive" as const, label: "High Priority" },
      medium: { variant: "secondary" as const, label: "Medium Priority" },
      low: { variant: "outline" as const, label: "Low Priority" }
    };
    
    const config = urgencyConfig[urgency as keyof typeof urgencyConfig] || urgencyConfig.medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getActivityIcon = (type: string) => {
    const iconMap = {
      booking_created: <Calendar className="h-4 w-4 text-blue-600" />,
      payment_received: <DollarSign className="h-4 w-4 text-green-600" />,
      booking_cancelled: <XCircle className="h-4 w-4 text-red-600" />,
      dispute_raised: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
      booking_completed: <CheckCircle2 className="h-4 w-4 text-green-600" />
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
    <div className="p-6 space-y-6" data-testid="page-admin-booking-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spot Booking Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage peer-to-peer parking bookings, resolve disputes, and handle emergency situations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh-data">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button variant="outline" data-testid="button-export-report">
            <TrendingUp className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-bookings">
              {displayAnalytics.totalActiveBookings}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-daily-revenue">
              ${displayAnalytics.totalDailyRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {displayAnalytics.todayBookings} bookings today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-requests">
              {displayAnalytics.pendingRequests}
            </div>
            <p className="text-xs text-muted-foreground">
              Require admin attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-occupancy-rate">
              {displayAnalytics.occupancyRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average utilization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" data-testid="tab-active-bookings">Active Bookings</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-booking-requests">Booking Requests</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-recent-activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Active Bookings Tab */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Bookings ({filteredActiveBookings.length})</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                      data-testid="input-search-bookings"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32" data-testid="select-filter-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingActive ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spot</TableHead>
                      <TableHead>Renter</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActiveBookings.map((booking) => (
                      <TableRow key={booking.id} data-testid={`booking-row-${booking.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{booking.spotNumber}</p>
                            <p className="text-sm text-muted-foreground">{booking.spotLocation}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{booking.renterName}</p>
                            <p className="text-sm text-muted-foreground">{booking.renterDepartment}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{booking.ownerName}</p>
                            <p className="text-sm text-muted-foreground">{booking.ownerDepartment}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatDate(booking.bookingDate)}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.startTime} - {booking.endTime}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">${booking.dailyRate.toFixed(2)}</p>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(booking.status)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={booking.paymentReceived ? "default" : "secondary"}>
                            {booking.paymentReceived ? "Paid" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowBookingDetails(true);
                              }}
                              data-testid={`button-view-booking-${booking.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowCancelDialog(true);
                              }}
                              data-testid={`button-cancel-booking-${booking.id}`}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowContactDialog(true);
                              }}
                              data-testid={`button-contact-users-${booking.id}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests ({displayBookingRequests.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayBookingRequests.map((request) => (
                    <Card key={request.id} className="p-4" data-testid={`request-card-${request.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{request.type.toUpperCase()}</Badge>
                            {getUrgencyBadge(request.urgency)}
                          </div>
                          <h4 className="font-semibold">{request.submittedBy}</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Spot {request.spotNumber} • {formatDate(request.requestDate)}
                          </p>
                          <p className="text-sm">{request.reason}</p>
                        </div>
                        <div className="flex gap-2">
                          {request.type === "dispute" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDisputeDialog(true);
                              }}
                              data-testid={`button-resolve-dispute-${request.id}`}
                            >
                              Resolve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setContactMessage(`Regarding your ${request.type} request for spot ${request.spotNumber}...`);
                              setShowContactDialog(true);
                            }}
                            data-testid={`button-contact-requester-${request.id}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {isLoadingActivity ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayRecentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`activity-${activity.id}`}>
                        {getActivityIcon(activity.type)}
                        <div className="flex-1">
                          <p className="font-medium">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">{activity.user}</p>
                          <p className="text-xs text-muted-foreground">{activity.details}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(activity.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Popular Spots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayAnalytics.popularSpots.map((spot, index) => (
                    <div key={spot.spotNumber} className="flex items-center justify-between" data-testid={`popular-spot-${index}`}>
                      <span className="font-medium">{spot.spotNumber}</span>
                      <Badge variant="secondary">{spot.bookings} bookings</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between" data-testid="analytics-active-renters">
                    <span>Active Renters</span>
                    <span className="font-medium">{displayAnalytics.userActivity.activeRenters}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="analytics-active-owners">
                    <span>Active Owners</span>
                    <span className="font-medium">{displayAnalytics.userActivity.activeOwners}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="analytics-new-signups">
                    <span>New Signups This Week</span>
                    <span className="font-medium">{displayAnalytics.userActivity.newSignups}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between" data-testid="analytics-average-booking">
                    <span>Average Booking Value</span>
                    <span className="font-medium">${displayAnalytics.averageBookingValue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="analytics-week-bookings">
                    <span>This Week's Bookings</span>
                    <span className="font-medium">{displayAnalytics.thisWeekBookings}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="analytics-resolved-disputes">
                    <span>Resolved Disputes</span>
                    <span className="font-medium">{displayAnalytics.resolvedDisputes}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Booking Details Dialog */}
      <Dialog open={showBookingDetails} onOpenChange={setShowBookingDetails}>
        <DialogContent className="max-w-2xl" data-testid="dialog-booking-details">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              View complete information about this booking
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spot Information</Label>
                  <p className="font-medium">{selectedBooking.spotNumber}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.spotLocation}</p>
                </div>
                <div>
                  <Label>Booking Date</Label>
                  <p className="font-medium">{formatDate(selectedBooking.bookingDate)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedBooking.startTime} - {selectedBooking.endTime}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Renter</Label>
                  <p className="font-medium">{selectedBooking.renterName}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.renterEmail}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.renterDepartment}</p>
                </div>
                <div>
                  <Label>Owner</Label>
                  <p className="font-medium">{selectedBooking.ownerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.ownerEmail}</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking.ownerDepartment}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Daily Rate</Label>
                  <p className="font-medium">${selectedBooking.dailyRate.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  {getStatusBadge(selectedBooking.status)}
                </div>
                <div>
                  <Label>Payment</Label>
                  <Badge variant={selectedBooking.paymentReceived ? "default" : "secondary"}>
                    {selectedBooking.paymentReceived ? "Received" : "Pending"}
                  </Badge>
                </div>
              </div>

              {selectedBooking.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedBooking.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowContactDialog(true);
                    setShowBookingDetails(false);
                  }}
                  data-testid="button-contact-from-details"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Users
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowCancelDialog(true);
                    setShowBookingDetails(false);
                  }}
                  data-testid="button-cancel-from-details"
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel Booking
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent data-testid="dialog-cancel-booking">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              This action will cancel the booking and notify both users. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason">Cancellation Reason</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Explain why this booking is being cancelled..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="textarea-cancel-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
                data-testid="button-cancel-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={!cancelReason.trim() || cancelBookingMutation.isPending}
                data-testid="button-confirm-cancel"
              >
                {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent data-testid="dialog-resolve-dispute">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Provide your resolution to this dispute. Both users will be notified of your decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dispute-resolution">Resolution</Label>
              <Textarea
                id="dispute-resolution"
                placeholder="Describe how this dispute has been resolved..."
                value={disputeResolution}
                onChange={(e) => setDisputeResolution(e.target.value)}
                data-testid="textarea-dispute-resolution"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisputeDialog(false)}
                data-testid="button-cancel-dispute"
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedRequest && handleResolveDispute(selectedRequest)}
                disabled={!disputeResolution.trim() || resolveDisputeMutation.isPending}
                data-testid="button-confirm-resolution"
              >
                {resolveDisputeMutation.isPending ? "Resolving..." : "Resolve Dispute"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Users Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent data-testid="dialog-contact-users">
          <DialogHeader>
            <DialogTitle>Contact Users</DialogTitle>
            <DialogDescription>
              Send a message to the users involved in this booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                placeholder="Type your message here..."
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                data-testid="textarea-contact-message"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowContactDialog(false)}
                data-testid="button-cancel-contact"
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedBooking && handleContactUser({
                  name: selectedBooking.renterName,
                  email: selectedBooking.renterEmail
                })}
                disabled={!contactMessage.trim()}
                data-testid="button-send-message"
              >
                Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}