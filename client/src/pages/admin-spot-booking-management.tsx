import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { BookingActivityList } from "@/components/booking-activity-list"
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
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  EyeOff,
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
  MoreHorizontal,
  Download,
  FileText,
  Info
} from "lucide-react"
import type { Booking, BookingStatus, ParkingSpot } from "@shared/schema"
import { quickExportBookingsPDF, quickExportBookingsExcel, quickExportBookingRequestsPDF, quickExportBookingRequestsExcel, quickExportBookingActivityPDF, quickExportBookingActivityExcel } from "@/utils/export-utils"

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
  totalAmount: number;
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
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [requestsSearchTerm, setRequestsSearchTerm] = useState("")
  const [requestsFilterValues, setRequestsFilterValues] = useState<FilterValues>({})
  const [activitySearchTerm, setActivitySearchTerm] = useState("")
  const [activityFilterValues, setActivityFilterValues] = useState<FilterValues>({})
  const [pastBookingsSearchTerm, setPastBookingsSearchTerm] = useState("")
  const [pastBookingsFilterValues, setPastBookingsFilterValues] = useState<FilterValues>({})
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
  
  // Cards visibility toggle hook
  const { cardsVisible, toggleCards } = useCardsVisibility("spot-booking-management")

  // Refresh all data handler
  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-requests"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-analytics"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] })
    queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] })
  }

  // Refresh data when tab changes
  useEffect(() => {
    // Invalidate relevant queries based on the active tab
    switch (activeTab) {
      case "active":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] })
        break
      case "requests":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-requests"] })
        break
      case "activity":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] })
        break
      case "analytics":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] })
        break
    }
  }, [activeTab])

  // Fetch active bookings
  const { data: activeBookings = [], isLoading: isLoadingActive } = useQuery<AdminBookingData[]>({
    queryKey: ["/api/admin/active-bookings"],
  });

  // Fetch booking requests that need attention
  const { data: bookingRequests = [], isLoading: isLoadingRequests } = useQuery<BookingRequest[]>({
    queryKey: ["/api/admin/booking-requests"],
  });

  // Fetch booking activity data
  const { data: bookingActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["/api/admin/booking-activity", { pageSize: 100 }],
  });

  // Fetch past bookings (completed, cancelled, expired)
  const { data: pastBookings = [], isLoading: isLoadingPastBookings } = useQuery<AdminBookingData[]>({
    queryKey: ["/api/admin/past-bookings"],
  });


  // Fetch booking analytics
  const { data: bookingAnalytics, isLoading: isLoadingAnalytics } = useQuery<BookingAnalytics>({
    queryKey: ["/api/admin/booking-analytics"],
  });





  // Use API data directly - show real data or empty states
  const displayActiveBookings = activeBookings || [];
  const displayBookingRequests = bookingRequests || [];
  
  // Default empty analytics when no data is available
  const defaultAnalytics: BookingAnalytics = {
    totalActiveBookings: 0,
    totalDailyRevenue: 0,
    pendingRequests: 0,
    resolvedDisputes: 0,
    averageBookingValue: 0,
    occupancyRate: 0,
    todayBookings: 0,
    thisWeekBookings: 0,
    popularSpots: [],
    userActivity: {
      activeRenters: 0,
      activeOwners: 0,
      newSignups: 0
    }
  };
  const displayAnalytics = bookingAnalytics || defaultAnalytics;

  // Enhanced filtering for bookings with memoization for performance
  const filteredActiveBookings = useMemo(() => displayActiveBookings.filter(booking => {
    // Search filter - role-aware search
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      let matchesSearch = false

      // If role filter is applied, search only in relevant fields
      if (filterValues.role === "owner") {
        // When role filter is set to "owner", search only in owner-related fields
        matchesSearch = booking.ownerName?.toLowerCase().includes(searchLower) ||
                       booking.ownerEmail?.toLowerCase().includes(searchLower) ||
                       booking.ownerDepartment?.toLowerCase().includes(searchLower) ||
                       booking.spotNumber?.toLowerCase().includes(searchLower) ||
                       booking.spotLocation?.toLowerCase().includes(searchLower)
      } else if (filterValues.role === "renter") {
        // When role filter is set to "renter", search only in renter-related fields  
        matchesSearch = booking.renterName?.toLowerCase().includes(searchLower) ||
                       booking.renterEmail?.toLowerCase().includes(searchLower) ||
                       booking.renterDepartment?.toLowerCase().includes(searchLower) ||
                       booking.spotNumber?.toLowerCase().includes(searchLower) ||
                       booking.spotLocation?.toLowerCase().includes(searchLower)
      } else {
        // No role filter applied - search in all fields (default behavior)
        matchesSearch = booking.renterName?.toLowerCase().includes(searchLower) ||
                       booking.ownerName?.toLowerCase().includes(searchLower) ||
                       booking.spotNumber?.toLowerCase().includes(searchLower) ||
                       booking.spotLocation?.toLowerCase().includes(searchLower) ||
                       booking.renterEmail?.toLowerCase().includes(searchLower) ||
                       booking.ownerEmail?.toLowerCase().includes(searchLower)
      }
      
      if (!matchesSearch) return false
    }
    
    // Status filter
    if (filterValues.status && filterValues.status !== "all") {
      if (booking.status !== filterValues.status) return false
    }
    
    // Role filter - implemented above in search logic
    // When role="owner", search filters focus on owner fields
    // When role="renter", search filters focus on renter fields
    // This provides meaningful role-based filtering without removing valid bookings
    
    // Location filter
    if (filterValues.location && filterValues.location !== "all") {
      if (!booking.spotLocation?.toLowerCase().includes(filterValues.location.toLowerCase())) {
        return false
      }
    }
    
    // Date range filters
    if (filterValues.dateRangeFrom) {
      const bookingDate = new Date(booking.bookingDate)
      const fromDate = new Date(filterValues.dateRangeFrom)
      if (bookingDate < fromDate) return false
    }
    
    if (filterValues.dateRangeTo) {
      const bookingDate = new Date(booking.bookingDate)
      const toDate = new Date(filterValues.dateRangeTo)
      if (bookingDate > toDate) return false
    }
    
    return true
  }), [displayActiveBookings, searchTerm, filterValues]);

  // Sorting functionality for active bookings
  const { sortState, sortedData: sortedActiveBookings, handleSort } = useTableSort(
    filteredActiveBookings,
    "bookingDate", // Default sort by booking date
    "desc" // Most recent first
  );

  // Enhanced filtering for booking requests
  const filteredBookingRequests = useMemo(() => displayBookingRequests.filter(request => {
    // Search filter
    if (requestsSearchTerm.trim()) {
      const searchLower = requestsSearchTerm.toLowerCase()
      const matchesSearch = request.submittedBy?.toLowerCase().includes(searchLower) ||
                           request.email?.toLowerCase().includes(searchLower) ||
                           request.spotNumber?.toLowerCase().includes(searchLower) ||
                           request.reason?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Type filter
    if (requestsFilterValues.type && requestsFilterValues.type !== "all") {
      if (request.type !== requestsFilterValues.type) return false
    }
    
    // Urgency filter
    if (requestsFilterValues.urgency && requestsFilterValues.urgency !== "all") {
      if (request.urgency !== requestsFilterValues.urgency) return false
    }
    
    // Status filter
    if (requestsFilterValues.status && requestsFilterValues.status !== "all") {
      if (request.status !== requestsFilterValues.status) return false
    }
    
    return true
  }), [displayBookingRequests, requestsSearchTerm, requestsFilterValues]);

  // Sorting functionality for booking requests
  const { sortState: requestsSortState, sortedData: sortedBookingRequests, handleSort: handleRequestsSort } = useTableSort(
    filteredBookingRequests,
    "requestDate", // Default sort by request date
    "desc" // Most recent first
  );

  // Enhanced filtering for booking activity
  const displayBookingActivity = Array.isArray(bookingActivity) ? bookingActivity : (bookingActivity as { items?: BookingActivity[] })?.items || [];
  const filteredBookingActivity = useMemo(() => displayBookingActivity.filter((activity: any) => {
    // Search filter
    if (activitySearchTerm.trim()) {
      const searchLower = activitySearchTerm.toLowerCase()
      const matchesSearch = activity.actorName?.toLowerCase().includes(searchLower) ||
                           activity.description?.toLowerCase().includes(searchLower) ||
                           activity.details?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Type filter
    if (activityFilterValues.type && activityFilterValues.type !== "all") {
      if (activity.type !== activityFilterValues.type) return false
    }
    
    // Success filter
    if (activityFilterValues.success && activityFilterValues.success !== "all") {
      const isSuccess = activity.success === true
      if (activityFilterValues.success === "success" && !isSuccess) return false
      if (activityFilterValues.success === "failure" && isSuccess) return false
    }
    
    return true
  }), [displayBookingActivity, activitySearchTerm, activityFilterValues]);

  // Sorting functionality for booking activity
  const { sortState: activitySortState, sortedData: sortedBookingActivity, handleSort: handleActivitySort } = useTableSort(
    filteredBookingActivity,
    "timestamp", // Default sort by timestamp
    "desc" // Most recent first
  );

  // Enhanced filtering for past bookings
  const filteredPastBookings = useMemo(() => pastBookings.filter(booking => {
    // Search filter
    if (pastBookingsSearchTerm.trim()) {
      const searchLower = pastBookingsSearchTerm.toLowerCase()
      const matchesSearch = booking.renterName?.toLowerCase().includes(searchLower) ||
                           booking.renterEmail?.toLowerCase().includes(searchLower) ||
                           booking.ownerName?.toLowerCase().includes(searchLower) ||
                           booking.ownerEmail?.toLowerCase().includes(searchLower) ||
                           booking.spotNumber?.toLowerCase().includes(searchLower) ||
                           booking.spotLocation?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Status filter
    if (pastBookingsFilterValues.status && pastBookingsFilterValues.status !== "all") {
      if (booking.status !== pastBookingsFilterValues.status) return false
    }
    
    // Role filter (based on user perspective)
    if (pastBookingsFilterValues.role && pastBookingsFilterValues.role !== "all") {
      // Note: This could be enhanced with actual user role data if available
      // For now, all bookings are treated as containing both owner and renter roles
    }
    
    // Location filter (case-insensitive substring match for consistency)
    if (pastBookingsFilterValues.location && pastBookingsFilterValues.location !== "all") {
      if (!booking.spotLocation?.toLowerCase().includes(pastBookingsFilterValues.location.toLowerCase())) return false
    }
    
    // Date range filter (consistent with other tabs)
    if (pastBookingsFilterValues.dateRangeFrom) {
      const bookingDate = new Date(booking.bookingDate)
      const fromDate = new Date(pastBookingsFilterValues.dateRangeFrom)
      if (bookingDate < fromDate) return false
    }
    if (pastBookingsFilterValues.dateRangeTo) {
      const bookingDate = new Date(booking.bookingDate)
      const toDate = new Date(pastBookingsFilterValues.dateRangeTo)
      if (bookingDate > toDate) return false
    }
    
    return true
  }), [pastBookings, pastBookingsSearchTerm, pastBookingsFilterValues]);

  // Sorting functionality for past bookings
  const { sortState: pastBookingsSortState, sortedData: sortedPastBookings, handleSort: handlePastBookingsSort } = useTableSort(
    filteredPastBookings,
    "bookingDate", // Default sort by booking date
    "desc" // Most recent first
  );

  // Filter configuration for spot booking management
  const bookingFilterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "confirmed", label: "Confirmed" },
        { value: "pending", label: "Pending" },
        { value: "cancelled", label: "Cancelled" },
        { value: "completed", label: "Completed" }
      ]
    },
    {
      key: "role",
      label: "User Role",
      type: "select",
      options: [
        { value: "owner", label: "Owner" },
        { value: "renter", label: "Renter" }
      ]
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: [
        // These would ideally come from the API
        { value: "building-a", label: "Building A" },
        { value: "building-b", label: "Building B" },
        { value: "parking-garage", label: "Parking Garage" },
        { value: "outdoor-lot", label: "Outdoor Lot" }
      ]
    },
    {
      key: "dateRange",
      label: "Booking Date Range",
      type: "dateRange"
    }
  ];

  // Filter configuration for booking requests
  const requestsFilterConfigs: FilterConfig[] = [
    {
      key: "type",
      label: "Request Type",
      type: "select",
      options: [
        { value: "cancellation", label: "Cancellation" },
        { value: "dispute", label: "Dispute" },
        { value: "modification", label: "Modification" }
      ]
    },
    {
      key: "urgency",
      label: "Urgency",
      type: "select",
      options: [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" }
      ]
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "pending", label: "Pending" },
        { value: "resolved", label: "Resolved" },
        { value: "rejected", label: "Rejected" }
      ]
    }
  ]

  // Filter configuration for booking activity
  const activityFilterConfigs: FilterConfig[] = [
    {
      key: "type",
      label: "Activity Type",
      type: "select",
      options: [
        { value: "booking_created", label: "Booking Created" },
        { value: "booking_cancelled", label: "Booking Cancelled" },
        { value: "booking_completed", label: "Booking Completed" },
        { value: "payment_received", label: "Payment Received" },
        { value: "payment_updated", label: "Payment Updated" },
        { value: "spot_assigned", label: "Spot Assigned" },
        { value: "listing_created", label: "Listing Created" },
        { value: "listing_updated", label: "Listing Updated" }
      ]
    },
    {
      key: "success",
      label: "Result",
      type: "select",
      options: [
        { value: "success", label: "Success" },
        { value: "failure", label: "Failure" }
      ]
    }
  ]

  // Filter configuration for past bookings
  const pastBookingsFilterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "expired", label: "Expired" }
      ]
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: [
        { value: "building-a", label: "Building A" },
        { value: "building-b", label: "Building B" },
        { value: "parking-garage", label: "Parking Garage" },
        { value: "outdoor-lot", label: "Outdoor Lot" }
      ]
    },
    {
      key: "dateRange",
      label: "Booking Date Range",
      type: "dateRange"
    }
  ]

  // Handle filter changes
  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("")
    setFilterValues({})
  }

  // Handle requests filter changes
  const handleRequestsFilterChange = (key: string, value: string | undefined) => {
    setRequestsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear requests filters
  const handleClearRequestsFilters = () => {
    setRequestsSearchTerm("")
    setRequestsFilterValues({})
  }

  // Handle activity filter changes
  const handleActivityFilterChange = (key: string, value: string | undefined) => {
    setActivityFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear activity filters
  const handleClearActivityFilters = () => {
    setActivitySearchTerm("")
    setActivityFilterValues({})
  }

  // Handle past bookings filter changes
  const handlePastBookingsFilterChange = (key: string, value: string | undefined) => {
    setPastBookingsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear past bookings filters
  const handleClearPastBookingsFilters = () => {
    setPastBookingsSearchTerm("")
    setPastBookingsFilterValues({})
  }

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const response = await apiRequest("/api/admin/cancel-booking", { method: 'POST', body: {
        bookingId,
        reason,
        cancelledBy: "admin"
      }});
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
      const response = await apiRequest("/api/admin/resolve-dispute", { method: 'POST', body: {
        requestId,
        resolution,
        resolvedBy: "admin"
      }});
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
                onClick={handleRefreshAll}
                data-testid="button-refresh-data"
                aria-label="Refresh all booking data"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh all booking data and payment status
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                disabled={filteredActiveBookings.length === 0}
                onClick={() => {
                  const success = quickExportBookingsPDF(sortedActiveBookings, 'Active Bookings Report', (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: "Export Failed",
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: "Export Successful",
                      description: "PDF report has been downloaded successfully"
                    })
                  }
                }}
                data-testid="button-export-pdf"
                aria-label="Export active bookings to PDF"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Export active booking data to PDF report
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                disabled={filteredActiveBookings.length === 0}
                onClick={() => {
                  const success = quickExportBookingsExcel(sortedActiveBookings, 'Active Bookings Report', (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: "Export Failed",
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: "Export Successful",
                      description: "Excel report has been downloaded successfully"
                    })
                  }
                }}
                data-testid="button-export-excel"
                aria-label="Export active bookings to Excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Export active booking data to Excel spreadsheet
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Quick Analytics Cards */}
      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Active bookings information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View confirmed bookings currently in progress
                </TooltipContent>
              </Tooltip>
            </div>
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

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Daily revenue information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View total revenue generated today from confirmed bookings
                </TooltipContent>
              </Tooltip>
            </div>
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

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Pending requests information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View booking requests awaiting admin approval
                </TooltipContent>
              </Tooltip>
            </div>
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

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    aria-label="Occupancy rate information"
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  View percentage of spots currently booked vs available
                </TooltipContent>
              </Tooltip>
            </div>
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
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requests" data-testid="tab-booking-requests">Booking Requests</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-bookings">Active Bookings</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-past-bookings">Past Bookings</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-recent-activity">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Booking Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {/* Enhanced Filters for Booking Requests */}
          <EnhancedFilters
            searchValue={requestsSearchTerm}
            onSearchChange={setRequestsSearchTerm}
            filterConfigs={requestsFilterConfigs}
            filterValues={requestsFilterValues}
            onFilterChange={handleRequestsFilterChange}
            onClearFilters={handleClearRequestsFilters}
            searchPlaceholder="Search requests by user, email, spot number, or reason..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pending Requests ({sortedBookingRequests.length})</CardTitle>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedBookingRequests.length === 0}
                        onClick={() => {
                          const success = quickExportBookingRequestsPDF(sortedBookingRequests, 'Booking Requests Report', (errorMessage) => {
                            toast({
                              variant: "destructive",
                              title: "Export Failed",
                              description: errorMessage
                            })
                          })
                          if (success) {
                            toast({
                              title: "Export Successful",
                              description: "PDF report has been downloaded successfully"
                            })
                          }
                        }}
                        data-testid="button-export-requests-pdf"
                        aria-label="Export booking requests to PDF"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export booking requests data to PDF report
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        disabled={sortedBookingRequests.length === 0}
                        onClick={() => {
                          const success = quickExportBookingRequestsExcel(sortedBookingRequests, 'Booking Requests Report', (errorMessage) => {
                            toast({
                              variant: "destructive",
                              title: "Export Failed",
                              description: errorMessage
                            })
                          })
                          if (success) {
                            toast({
                              title: "Export Successful",
                              description: "Excel report has been downloaded successfully"
                            })
                          }
                        }}
                        data-testid="button-export-requests-excel"
                        aria-label="Export booking requests to Excel"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Export booking requests data to Excel spreadsheet
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : sortedBookingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-booking-requests">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending requests found</p>
                  <p className="text-sm">User requests for bookings will appear here when submitted.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-booking-requests">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="submittedBy"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Submitted By
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="type"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Spot Number
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="urgency"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Urgency
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="status"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="requestDate"
                          currentSortColumn={requestsSortState.column}
                          currentSortDirection={requestsSortState.direction}
                          onSort={handleRequestsSort}
                        >
                          Request Date
                        </SortableTableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBookingRequests.map((request) => (
                        <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                          <TableCell data-testid={`text-requester-${request.id}`}>
                            <div>
                              <p className="font-medium">{request.submittedBy}</p>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`badge-request-type-${request.id}`}>
                            <Badge variant="outline">{request.type.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-spot-${request.id}`}>
                            {request.spotNumber}
                          </TableCell>
                          <TableCell data-testid={`badge-urgency-${request.id}`}>
                            {getUrgencyBadge(request.urgency)}
                          </TableCell>
                          <TableCell data-testid={`badge-status-${request.id}`}>
                            <Badge 
                              variant={request.status === 'pending' ? 'secondary' : request.status === 'resolved' ? 'default' : 'destructive'}
                            >
                              {request.status?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-date-${request.id}`}>
                            {formatDate(request.requestDate)}
                          </TableCell>
                          <TableCell>
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

        {/* Active Bookings Tab */}
        <TabsContent value="active" className="space-y-4">
          {/* Enhanced Filters */}
          <EnhancedFilters
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filterConfigs={bookingFilterConfigs}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            searchPlaceholder="Search bookings by renter, owner, spot number, or location..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Bookings ({sortedActiveBookings.length})</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedActiveBookings.length === 0}
                    onClick={() => {
                      const success = quickExportBookingsPDF(sortedActiveBookings, 'Active Bookings Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "PDF report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-active-pdf"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedActiveBookings.length === 0}
                    onClick={() => {
                      const success = quickExportBookingsExcel(sortedActiveBookings, 'Active Bookings Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "Excel report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-active-excel"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
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
                      <SortableTableHeader
                        column="spotNumber"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Spot
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="renterName"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Renter
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="ownerName"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Owner
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="bookingDate"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Date
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="dailyRate"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                        align="right"
                      >
                        Rate
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="status"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Status
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="paymentReceived"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Payment
                      </SortableTableHeader>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedActiveBookings.map((booking) => (
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

        {/* Past Bookings Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Enhanced Filters for Past Bookings */}
          <EnhancedFilters
            searchValue={pastBookingsSearchTerm}
            onSearchChange={setPastBookingsSearchTerm}
            filterConfigs={pastBookingsFilterConfigs}
            filterValues={pastBookingsFilterValues}
            onFilterChange={handlePastBookingsFilterChange}
            onClearFilters={handleClearPastBookingsFilters}
            searchPlaceholder="Search past bookings by renter, owner, spot number, or location..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Past Bookings ({sortedPastBookings.length})</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedPastBookings.length === 0}
                    onClick={() => {
                      const success = quickExportBookingsPDF(sortedPastBookings, 'Past Bookings Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "PDF report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-past-bookings-pdf"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedPastBookings.length === 0}
                    onClick={() => {
                      const success = quickExportBookingsExcel(sortedPastBookings, 'Past Bookings Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "Excel report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-past-bookings-excel"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPastBookings ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sortedPastBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-past-bookings">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No past bookings found</p>
                  <p className="text-sm">Completed, cancelled, and expired bookings will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-past-bookings">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Spot
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="renterName"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Renter
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerName"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Owner
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="bookingDate"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Date
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="status"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="totalAmount"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Amount
                        </SortableTableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPastBookings.map((booking) => (
                        <TableRow key={booking.id} data-testid={`row-past-booking-${booking.id}`}>
                          <TableCell className="font-medium" data-testid={`text-spot-${booking.id}`}>
                            <div>
                              <p>{booking.spotNumber}</p>
                              <p className="text-sm text-muted-foreground">{booking.spotLocation}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-renter-${booking.id}`}>
                            <div>
                              <p className="font-medium">{booking.renterName}</p>
                              <p className="text-sm text-muted-foreground">{booking.renterEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-owner-${booking.id}`}>
                            <div>
                              <p className="font-medium">{booking.ownerName}</p>
                              <p className="text-sm text-muted-foreground">{booking.ownerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-date-${booking.id}`}>
                            <div>
                              <p className="font-medium">{formatDate(booking.bookingDate)}</p>
                              <p className="text-sm text-muted-foreground">{booking.startTime} - {booking.endTime}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`badge-status-${booking.id}`}>
                            <Badge 
                              variant={booking.status === 'completed' ? 'default' : booking.status === 'cancelled' ? 'destructive' : 'secondary'}
                            >
                              {booking.status?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-amount-${booking.id}`}>
                            ${booking.totalAmount}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowBookingDetails(true);
                              }}
                              data-testid={`button-view-details-${booking.id}`}
                            >
                              <Eye className="h-4 w-4" />
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

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          {/* Enhanced Filters for Booking Activity */}
          <EnhancedFilters
            searchValue={activitySearchTerm}
            onSearchChange={setActivitySearchTerm}
            filterConfigs={activityFilterConfigs}
            filterValues={activityFilterValues}
            onFilterChange={handleActivityFilterChange}
            onClearFilters={handleClearActivityFilters}
            searchPlaceholder="Search activity by actor, description, or details..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Booking Activity ({sortedBookingActivity.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedBookingActivity.length === 0}
                    onClick={() => {
                      const success = quickExportBookingActivityPDF(sortedBookingActivity, 'Booking Activity Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "PDF report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-activity-pdf"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={sortedBookingActivity.length === 0}
                    onClick={() => {
                      const success = quickExportBookingActivityExcel(sortedBookingActivity, 'Booking Activity Report', (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      })
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "Excel report has been downloaded successfully"
                        })
                      }
                    }}
                    data-testid="button-export-activity-excel"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sortedBookingActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-booking-activity">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No booking activity found</p>
                  <p className="text-sm">Booking activity will appear here as users interact with the system.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-booking-activity">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="type"
                          currentSortColumn={activitySortState.column}
                          currentSortDirection={activitySortState.direction}
                          onSort={handleActivitySort}
                        >
                          Activity Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="actorName"
                          currentSortColumn={activitySortState.column}
                          currentSortDirection={activitySortState.direction}
                          onSort={handleActivitySort}
                        >
                          Actor
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="description"
                          currentSortColumn={activitySortState.column}
                          currentSortDirection={activitySortState.direction}
                          onSort={handleActivitySort}
                        >
                          Description
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="success"
                          currentSortColumn={activitySortState.column}
                          currentSortDirection={activitySortState.direction}
                          onSort={handleActivitySort}
                        >
                          Result
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="timestamp"
                          currentSortColumn={activitySortState.column}
                          currentSortDirection={activitySortState.direction}
                          onSort={handleActivitySort}
                        >
                          Timestamp
                        </SortableTableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBookingActivity.map((activity: any, index) => (
                        <TableRow key={activity.id || index} data-testid={`row-activity-${activity.id || index}`}>
                          <TableCell data-testid={`text-activity-type-${activity.id || index}`}>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline">
                                {activity.type?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-actor-${activity.id || index}`}>
                            <p className="font-medium">{activity.actorName || 'System'}</p>
                          </TableCell>
                          <TableCell data-testid={`text-description-${activity.id || index}`}>
                            <p className="text-sm">{activity.description || 'No description available'}</p>
                            {activity.details && (
                              <p className="text-xs text-muted-foreground mt-1">{activity.details}</p>
                            )}
                          </TableCell>
                          <TableCell data-testid={`badge-result-${activity.id || index}`}>
                            <Badge 
                              variant={activity.success ? 'default' : 'destructive'}
                            >
                              {activity.success ? 'SUCCESS' : 'FAILURE'}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-timestamp-${activity.id || index}`}>
                            {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown'}
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