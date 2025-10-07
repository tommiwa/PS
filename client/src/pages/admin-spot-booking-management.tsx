import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { useLanguage } from "@/hooks/use-language"
import { BookingActivityList } from "@/components/booking-activity-list"
import { TablePagination } from "@/components/shared/TablePagination"
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
import { quickExportBookingsPDF, quickExportBookingsExcel, quickExportBookingActivityPDF, quickExportBookingActivityExcel } from "@/utils/export-utils"

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

interface BookingAvailabilityData {
  id: string;
  spotNumber: string;
  locationName: string;
  spotTypeName: string;
  ownerName: string;
  dailyRate: number;
  listingType: 'single' | 'period' | 'recurring';
  availableFrom: string;
  availableTo: string;
  singleDate?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  recurringStartDate?: string;
  recurringEndDate?: string;
  daysOfWeek?: string[];
}

interface PendingPaymentData {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  ownerName: string;
  ownerEmail: string;
  bookingDate: string;
  totalAmount: number;
  daysOverdue: number;
  status: BookingStatus;
}

export default function AdminSpotBookingManagement() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { t } = useLanguage()
  
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [activitySearchTerm, setActivitySearchTerm] = useState("")
  const [activityFilterValues, setActivityFilterValues] = useState<FilterValues>({})
  const [pastBookingsSearchTerm, setPastBookingsSearchTerm] = useState("")
  const [pastBookingsFilterValues, setPastBookingsFilterValues] = useState<FilterValues>({})
  const [availabilitySearchTerm, setAvailabilitySearchTerm] = useState("")
  const [availabilityFilterValues, setAvailabilityFilterValues] = useState<FilterValues>({})
  const [pendingPaymentsSearchTerm, setPendingPaymentsSearchTerm] = useState("")
  const [pendingPaymentsFilterValues, setPendingPaymentsFilterValues] = useState<FilterValues>({})
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingData | null>(null)
  const [selectedAvailabilityListing, setSelectedAvailabilityListing] = useState<BookingAvailabilityData | null>(null)
  const [showBookingDetails, setShowBookingDetails] = useState(false)
  const [showAvailabilityDetailsDialog, setShowAvailabilityDetailsDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [showMarkPaidConfirmDialog, setShowMarkPaidConfirmDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [activeTab, setActiveTab] = useState("availability")
  
  // Dispute-related state
  const [showDisputeDialog, setShowDisputeDialog] = useState(false)
  const [showResolveDisputeDialog, setShowResolveDisputeDialog] = useState(false)
  const [selectedDisputeBookingId, setSelectedDisputeBookingId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState("")
  const [disputeTargetUserId, setDisputeTargetUserId] = useState("")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [selectedRefundBookingId, setSelectedRefundBookingId] = useState<string | null>(null)
  const [showAdminNotesDialog, setShowAdminNotesDialog] = useState(false)
  const [adminNotes, setAdminNotes] = useState("")
  const [selectedAdminNotesBookingId, setSelectedAdminNotesBookingId] = useState<string | null>(null)
  
  // Pagination state for Active Bookings
  const [activeBookingsPageIndex, setActiveBookingsPageIndex] = useState(0)
  const [activeBookingsPageSize, setActiveBookingsPageSize] = useState(10)

  // Pagination state for Past Bookings
  const [pastBookingsPageIndex, setPastBookingsPageIndex] = useState(0)
  const [pastBookingsPageSize, setPastBookingsPageSize] = useState(50)

  // Pagination state for Booking Activity
  const [bookingActivityPageIndex, setBookingActivityPageIndex] = useState(0)
  const [bookingActivityPageSize, setBookingActivityPageSize] = useState(25)

  // Pagination state for Booking Availability
  const [availabilityPageIndex, setAvailabilityPageIndex] = useState(0)
  const [availabilityPageSize, setAvailabilityPageSize] = useState(10)

  // Pagination state for Pending Payments
  const [pendingPaymentsPageIndex, setPendingPaymentsPageIndex] = useState(0)
  const [pendingPaymentsPageSize, setPendingPaymentsPageSize] = useState(10)
  
  // Cards visibility toggle hook
  const { cardsVisible, toggleCards } = useCardsVisibility("spot-booking-management")

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refresh all data handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-availability"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-analytics"] })
      ])
      toast({
        title: "Refreshed",
        description: "Spot booking management data has been refreshed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Refresh data when tab changes
  useEffect(() => {
    // Invalidate relevant queries based on the active tab
    switch (activeTab) {
      case "availability":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-availability"] })
        break
      case "active":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] })
        break
      case "pending-payments":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] })
        break
      case "past":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] })
        break
      case "activity":
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] })
        break
    }
  }, [activeTab])

  // Fetch active bookings
  const { data: activeBookings = [], isLoading: isLoadingActive } = useQuery<AdminBookingData[]>({
    queryKey: ["/api/admin/active-bookings"],
  });

  // Fetch booking activity data
  const { data: bookingActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["/api/admin/booking-activity", { pageSize: 100 }],
  });

  // Fetch past bookings (completed, cancelled, expired)
  const { data: pastBookings = [], isLoading: isLoadingPastBookings } = useQuery<AdminBookingData[]>({
    queryKey: ["/api/admin/past-bookings"],
  });

  // Fetch booking availability
  const { data: bookingAvailability = [], isLoading: isLoadingAvailability } = useQuery<BookingAvailabilityData[]>({
    queryKey: ["/api/admin/booking-availability"],
  });

  // Fetch pending payments
  const { data: pendingPayments = [], isLoading: isLoadingPendingPayments } = useQuery<PendingPaymentData[]>({
    queryKey: ["/api/admin/pending-payments"],
  });

  // Fetch booking analytics
  const { data: bookingAnalytics, isLoading: isLoadingAnalytics } = useQuery<BookingAnalytics>({
    queryKey: ["/api/admin/booking-analytics"],
  });





  // Use API data directly - show real data or empty states
  const displayActiveBookings = activeBookings || [];
  
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

  // Enhanced filtering for booking availability
  const filteredAvailability = useMemo(() => bookingAvailability.filter(listing => {
    // Search filter
    if (availabilitySearchTerm.trim()) {
      const searchLower = availabilitySearchTerm.toLowerCase()
      const matchesSearch = listing.spotNumber?.toLowerCase().includes(searchLower) ||
                           listing.locationName?.toLowerCase().includes(searchLower) ||
                           listing.spotTypeName?.toLowerCase().includes(searchLower) ||
                           listing.ownerName?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Listing type filter
    if (availabilityFilterValues.listingType && availabilityFilterValues.listingType !== "all") {
      if (listing.listingType !== availabilityFilterValues.listingType) return false
    }
    
    // Location filter
    if (availabilityFilterValues.location && availabilityFilterValues.location !== "all") {
      if (!listing.locationName?.toLowerCase().includes(availabilityFilterValues.location.toLowerCase())) {
        return false
      }
    }
    
    return true
  }), [bookingAvailability, availabilitySearchTerm, availabilityFilterValues]);

  // Sorting functionality for booking availability
  const { sortState: availabilitySortState, sortedData: sortedAvailability, handleSort: handleAvailabilitySort } = useTableSort(
    filteredAvailability,
    "spotNumber",
    "asc"
  );

  // Enhanced filtering for pending payments
  const filteredPendingPayments = useMemo(() => pendingPayments.filter(payment => {
    // Search filter
    if (pendingPaymentsSearchTerm.trim()) {
      const searchLower = pendingPaymentsSearchTerm.toLowerCase()
      const matchesSearch = payment.spotNumber?.toLowerCase().includes(searchLower) ||
                           payment.renterName?.toLowerCase().includes(searchLower) ||
                           payment.renterEmail?.toLowerCase().includes(searchLower) ||
                           payment.ownerName?.toLowerCase().includes(searchLower) ||
                           payment.ownerEmail?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    // Days overdue filter
    if (pendingPaymentsFilterValues.daysOverdue && pendingPaymentsFilterValues.daysOverdue !== "all") {
      const days = payment.daysOverdue || 0
      const range = pendingPaymentsFilterValues.daysOverdue
      if (range === "0-7" && (days < 0 || days > 7)) return false
      if (range === "8-30" && (days < 8 || days > 30)) return false
      if (range === "30+" && days < 30) return false
    }
    
    // Location filter
    if (pendingPaymentsFilterValues.location && pendingPaymentsFilterValues.location !== "all") {
      if (!payment.spotLocation?.toLowerCase().includes(pendingPaymentsFilterValues.location.toLowerCase())) {
        return false
      }
    }
    
    return true
  }), [pendingPayments, pendingPaymentsSearchTerm, pendingPaymentsFilterValues]);

  // Sorting functionality for pending payments
  const { sortState: pendingPaymentsSortState, sortedData: sortedPendingPayments, handleSort: handlePendingPaymentsSort } = useTableSort(
    filteredPendingPayments,
    "daysOverdue",
    "desc"
  );

  // Create paginated data arrays
  const paginatedActiveBookings = useMemo(() => {
    const startIndex = activeBookingsPageIndex * activeBookingsPageSize
    const endIndex = startIndex + activeBookingsPageSize
    return sortedActiveBookings.slice(startIndex, endIndex)
  }, [sortedActiveBookings, activeBookingsPageIndex, activeBookingsPageSize])


  const paginatedPastBookings = useMemo(() => {
    const startIndex = pastBookingsPageIndex * pastBookingsPageSize
    const endIndex = startIndex + pastBookingsPageSize
    return sortedPastBookings.slice(startIndex, endIndex)
  }, [sortedPastBookings, pastBookingsPageIndex, pastBookingsPageSize])

  const paginatedBookingActivity = useMemo(() => {
    const startIndex = bookingActivityPageIndex * bookingActivityPageSize
    const endIndex = startIndex + bookingActivityPageSize
    return sortedBookingActivity.slice(startIndex, endIndex)
  }, [sortedBookingActivity, bookingActivityPageIndex, bookingActivityPageSize])

  const paginatedAvailability = useMemo(() => {
    const startIndex = availabilityPageIndex * availabilityPageSize
    const endIndex = startIndex + availabilityPageSize
    return sortedAvailability.slice(startIndex, endIndex)
  }, [sortedAvailability, availabilityPageIndex, availabilityPageSize])

  const paginatedPendingPayments = useMemo(() => {
    const startIndex = pendingPaymentsPageIndex * pendingPaymentsPageSize
    const endIndex = startIndex + pendingPaymentsPageSize
    return sortedPendingPayments.slice(startIndex, endIndex)
  }, [sortedPendingPayments, pendingPaymentsPageIndex, pendingPaymentsPageSize])

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

  // Filter configuration for booking availability
  const availabilityFilterConfigs: FilterConfig[] = [
    {
      key: "listingType",
      label: "Listing Type",
      type: "select",
      options: [
        { value: "single", label: "Single Day" },
        { value: "period", label: "Period" },
        { value: "recurring", label: "Recurring" }
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
    }
  ]

  // Filter configuration for pending payments
  const pendingPaymentsFilterConfigs: FilterConfig[] = [
    {
      key: "daysOverdue",
      label: "Days Overdue",
      type: "select",
      options: [
        { value: "0-7", label: "0-7 days" },
        { value: "8-30", label: "8-30 days" },
        { value: "30+", label: "30+ days" }
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

  // Handle availability filter changes
  const handleAvailabilityFilterChange = (key: string, value: string | undefined) => {
    setAvailabilityFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear availability filters
  const handleClearAvailabilityFilters = () => {
    setAvailabilitySearchTerm("")
    setAvailabilityFilterValues({})
  }

  // Handle pending payments filter changes
  const handlePendingPaymentsFilterChange = (key: string, value: string | undefined) => {
    setPendingPaymentsFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  // Clear pending payments filters
  const handleClearPendingPaymentsFilters = () => {
    setPendingPaymentsSearchTerm("")
    setPendingPaymentsFilterValues({})
  }

  // Page clamping useEffects - ensure page index doesn't exceed max pages
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedActiveBookings.length / activeBookingsPageSize) - 1)
    if (activeBookingsPageIndex > maxPage) {
      setActiveBookingsPageIndex(maxPage)
    }
  }, [sortedActiveBookings.length, activeBookingsPageSize, activeBookingsPageIndex])


  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedPastBookings.length / pastBookingsPageSize) - 1)
    if (pastBookingsPageIndex > maxPage) {
      setPastBookingsPageIndex(maxPage)
    }
  }, [sortedPastBookings.length, pastBookingsPageSize, pastBookingsPageIndex])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedBookingActivity.length / bookingActivityPageSize) - 1)
    if (bookingActivityPageIndex > maxPage) {
      setBookingActivityPageIndex(maxPage)
    }
  }, [sortedBookingActivity.length, bookingActivityPageSize, bookingActivityPageIndex])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedAvailability.length / availabilityPageSize) - 1)
    if (availabilityPageIndex > maxPage) {
      setAvailabilityPageIndex(maxPage)
    }
  }, [sortedAvailability.length, availabilityPageSize, availabilityPageIndex])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedPendingPayments.length / pendingPaymentsPageSize) - 1)
    if (pendingPaymentsPageIndex > maxPage) {
      setPendingPaymentsPageIndex(maxPage)
    }
  }, [sortedPendingPayments.length, pendingPaymentsPageSize, pendingPaymentsPageIndex])

  // Reset page when filters/search change
  useEffect(() => {
    setActiveBookingsPageIndex(0)
  }, [searchTerm, filterValues])

  useEffect(() => {
    setPastBookingsPageIndex(0)
  }, [pastBookingsSearchTerm, pastBookingsFilterValues])

  useEffect(() => {
    setBookingActivityPageIndex(0)
  }, [activitySearchTerm, activityFilterValues])

  useEffect(() => {
    setAvailabilityPageIndex(0)
  }, [availabilitySearchTerm, availabilityFilterValues])

  useEffect(() => {
    setPendingPaymentsPageIndex(0)
  }, [pendingPaymentsSearchTerm, pendingPaymentsFilterValues])

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

  // Mark payment as received mutation
  const markPaidMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await apiRequest(`/api/admin/bookings/${bookingId}/payment`, { 
        method: 'PATCH', 
        body: { paymentReceived: true }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      
      toast({
        title: "Payment Marked as Received",
        description: "The payment has been successfully marked as received.",
        variant: "default"
      });
      
      setShowMarkPaidConfirmDialog(false);
      setSelectedBooking(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to mark payment as received. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create dispute mutation
  const createDisputeMutation = useMutation({
    mutationFn: async (disputeData: { bookingId: string; targetUserId: string; reason: string }) => {
      const response = await apiRequest('/api/admin/disputes', {
        method: 'POST',
        body: {
          bookingId: disputeData.bookingId,
          targetUserId: disputeData.targetUserId,
          reason: disputeData.reason,
          status: 'open'
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] });
      toast({
        title: "Dispute Created",
        description: "The dispute has been successfully flagged and is now under investigation.",
        variant: "default"
      });
      setShowDisputeDialog(false);
      setDisputeReason("");
      setDisputeTargetUserId("");
      setSelectedDisputeBookingId(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Create Dispute",
        description: error instanceof Error ? error.message : "Failed to create dispute. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Issue refund mutation
  const issueRefundMutation = useMutation({
    mutationFn: async (refundData: { bookingId: string; refundAmount: string }) => {
      const response = await apiRequest(`/api/admin/bookings/${refundData.bookingId}/refund`, {
        method: 'POST',
        body: { refundAmount: refundData.refundAmount }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      toast({
        title: "Refund Processed",
        description: "The refund has been successfully processed and recorded.",
        variant: "default"
      });
      setShowRefundDialog(false);
      setRefundAmount("");
      setSelectedRefundBookingId(null);
    },
    onError: (error) => {
      toast({
        title: "Refund Failed",
        description: error instanceof Error ? error.message : "Failed to process refund. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Add admin notes mutation
  const addAdminNotesMutation = useMutation({
    mutationFn: async (notesData: { bookingId: string; notes: string }) => {
      const response = await apiRequest(`/api/admin/bookings/${notesData.bookingId}`, {
        method: 'PATCH',
        body: { adminNotes: notesData.notes }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] });
      toast({
        title: "Admin Notes Saved",
        description: "Admin notes have been successfully saved to the booking.",
        variant: "default"
      });
      setShowAdminNotesDialog(false);
      setAdminNotes("");
      setSelectedAdminNotesBookingId(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Save Notes",
        description: error instanceof Error ? error.message : "Failed to save admin notes. Please try again.",
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
          <h1 className="text-3xl font-bold">{t('admin.spotBookingManagement.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.spotBookingManagement.description')}
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
                disabled={isRefreshing}
                data-testid="button-refresh-data"
                aria-label="Refresh all booking data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('admin.spotBookingManagement.refreshData')}
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
                {t('common.exportPDF')}
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
                {t('common.exportExcel')}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("availability")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Booking Availability</CardTitle>
                  <div className="rounded-full border-2 border-green-400 p-2">
                    <CalendarCheck className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-booking-availability">
                    {displayAnalytics.totalActiveBookings}
                  </div>
                  <p className="text-xs text-green-600">Available spots</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view available spots for booking
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("active")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
                  <div className="rounded-full border-2 border-blue-400 p-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-active-bookings">
                    {displayAnalytics.totalActiveBookings}
                  </div>
                  <p className="text-xs text-blue-600">Currently in progress</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view confirmed bookings currently in progress
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("pending-payments")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                  <div className="rounded-full border-2 border-orange-400 p-2">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-pending-payments">
                    {displayAnalytics.pendingRequests}
                  </div>
                  <p className="text-xs text-orange-600">Awaiting payment</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view bookings with pending payments
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("activity")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <div className="rounded-full border-2 border-purple-400 p-2">
                    <Activity className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-recent-activity">
                    {displayAnalytics.occupancyRate}%
                  </div>
                  <p className="text-xs text-purple-600">Recent changes</p>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              Click to view recent booking activity and changes
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="availability" data-testid="tab-booking-availability" className="gap-2">
            <CalendarCheck className="h-4 w-4 !text-green-600" />
            Booking Availability
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-bookings" className="gap-2">
            <CheckCircle2 className="h-4 w-4 !text-blue-600" />
            Active Bookings
          </TabsTrigger>
          <TabsTrigger value="pending-payments" data-testid="tab-pending-payments" className="gap-2">
            <DollarSign className="h-4 w-4 !text-orange-600" />
            Pending Payments
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past-bookings" className="gap-2">
            <Calendar className="h-4 w-4 !text-slate-600" />
            Past Bookings
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-recent-activity" className="gap-2">
            <Activity className="h-4 w-4 !text-purple-600" />
            Recent Activity
          </TabsTrigger>
        </TabsList>

        {/* Booking Availability Tab */}
        <TabsContent value="availability" className="space-y-4">
          <EnhancedFilters
            searchValue={availabilitySearchTerm}
            onSearchChange={setAvailabilitySearchTerm}
            filterConfigs={availabilityFilterConfigs}
            filterValues={availabilityFilterValues}
            onFilterChange={handleAvailabilityFilterChange}
            onClearFilters={handleClearAvailabilityFilters}
            searchPlaceholder="Search by spot number, location, owner, or spot type..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Available Spots ({sortedAvailability.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAvailability ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sortedAvailability.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-availability">
                  <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No available spots found</p>
                  <p className="text-sm">Spot availability listings will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-availability">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Spot Number
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="locationName"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Location
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="spotTypeName"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Spot Type
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerName"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Owner
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="dailyRate"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Daily Rate
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="availableFrom"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Available From
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="availableTo"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Available To
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="listingType"
                          currentSortColumn={availabilitySortState.column}
                          currentSortDirection={availabilitySortState.direction}
                          onSort={handleAvailabilitySort}
                        >
                          Listing Type
                        </SortableTableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAvailability.map((listing) => (
                        <TableRow key={listing.id} data-testid={`row-availability-${listing.id}`}>
                          <TableCell className="font-medium" data-testid={`text-spot-${listing.id}`}>
                            {listing.spotNumber}
                          </TableCell>
                          <TableCell data-testid={`text-location-${listing.id}`}>
                            {listing.locationName}
                          </TableCell>
                          <TableCell data-testid={`badge-spot-type-${listing.id}`}>
                            <Badge variant="outline">{listing.spotTypeName}</Badge>
                          </TableCell>
                          <TableCell data-testid={`text-owner-${listing.id}`}>
                            {listing.ownerName}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-rate-${listing.id}`}>
                            ${listing.dailyRate}
                          </TableCell>
                          <TableCell data-testid={`text-from-${listing.id}`}>
                            {formatDate(listing.availableFrom)}
                          </TableCell>
                          <TableCell data-testid={`text-to-${listing.id}`}>
                            {formatDate(listing.availableTo)}
                          </TableCell>
                          <TableCell data-testid={`badge-listing-type-${listing.id}`}>
                            <Badge variant="secondary">
                              {listing.listingType === 'single' ? 'Single Day' : 
                               listing.listingType === 'period' ? 'Period' : 'Recurring'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAvailabilityListing(listing);
                                setShowAvailabilityDetailsDialog(true);
                              }}
                              data-testid={`button-view-details-${listing.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={sortedAvailability.length}
                    pageSize={availabilityPageSize}
                    pageIndex={availabilityPageIndex}
                    onPageSizeChange={(size) => {
                      setAvailabilityPageSize(size)
                      setAvailabilityPageIndex(0)
                    }}
                    onPageIndexChange={setAvailabilityPageIndex}
                  />
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
            searchPlaceholder={t('admin.spotBookingManagement.searchPlaceholder')}
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
                <>
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
                    {paginatedActiveBookings.map((booking) => (
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDisputeBookingId(booking.id);
                                    setShowDisputeDialog(true);
                                  }}
                                  data-testid={`button-flag-dispute-${booking.id}`}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Flag Dispute</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={sortedActiveBookings.length}
                    pageSize={activeBookingsPageSize}
                    pageIndex={activeBookingsPageIndex}
                    onPageSizeChange={(size) => {
                      setActiveBookingsPageSize(size)
                      setActiveBookingsPageIndex(0)
                    }}
                    onPageIndexChange={setActiveBookingsPageIndex}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Payments Tab */}
        <TabsContent value="pending-payments" className="space-y-4">
          <EnhancedFilters
            searchValue={pendingPaymentsSearchTerm}
            onSearchChange={setPendingPaymentsSearchTerm}
            filterConfigs={pendingPaymentsFilterConfigs}
            filterValues={pendingPaymentsFilterValues}
            onFilterChange={handlePendingPaymentsFilterChange}
            onClearFilters={handleClearPendingPaymentsFilters}
            searchPlaceholder="Search by spot number, renter, owner, or location..."
            className="hover-elevate"
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Pending Payments ({sortedPendingPayments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPendingPayments ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sortedPendingPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-pending-payments">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending payments found</p>
                  <p className="text-sm">Bookings with pending payments will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-pending-payments">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          column="spotNumber"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Spot Number
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="renterName"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Renter
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="ownerName"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Owner
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="bookingDate"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Booking Date
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="totalAmount"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Amount
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="daysOverdue"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Days Overdue
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="status"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Status
                        </SortableTableHeader>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPendingPayments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-pending-payment-${payment.id}`}>
                          <TableCell className="font-medium" data-testid={`text-spot-${payment.id}`}>
                            <div>
                              <p>{payment.spotNumber}</p>
                              <p className="text-sm text-muted-foreground">{payment.spotLocation}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-renter-${payment.id}`}>
                            <div>
                              <p className="font-medium">{payment.renterName}</p>
                              <p className="text-sm text-muted-foreground">{payment.renterEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-owner-${payment.id}`}>
                            <div>
                              <p className="font-medium">{payment.ownerName}</p>
                              <p className="text-sm text-muted-foreground">{payment.ownerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-booking-date-${payment.id}`}>
                            {formatDate(payment.bookingDate)}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-amount-${payment.id}`}>
                            ${payment.totalAmount}
                          </TableCell>
                          <TableCell data-testid={`text-days-overdue-${payment.id}`}>
                            <Badge variant={payment.daysOverdue > 30 ? 'destructive' : payment.daysOverdue > 7 ? 'secondary' : 'outline'}>
                              {payment.daysOverdue} days
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`badge-status-${payment.id}`}>
                            {getStatusBadge(payment.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBooking({
                                    id: payment.id,
                                    spotNumber: payment.spotNumber,
                                    spotLocation: payment.spotLocation,
                                    renterName: payment.renterName,
                                    renterEmail: payment.renterEmail,
                                    renterDepartment: '',
                                    ownerName: payment.ownerName,
                                    ownerEmail: payment.ownerEmail,
                                    ownerDepartment: '',
                                    bookingDate: payment.bookingDate,
                                    dailyRate: payment.totalAmount,
                                    totalAmount: payment.totalAmount,
                                    status: payment.status,
                                    paymentReceived: false,
                                    startTime: '',
                                    endTime: '',
                                    notes: '',
                                    createdAt: '',
                                    lastActivity: ''
                                  } as AdminBookingData);
                                  setShowContactDialog(true);
                                }}
                                data-testid={`button-contact-renter-${payment.id}`}
                              >
                                Contact
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedBooking({
                                    id: payment.id,
                                    spotNumber: payment.spotNumber,
                                    spotLocation: payment.spotLocation,
                                    renterName: payment.renterName,
                                    renterEmail: payment.renterEmail,
                                    renterDepartment: '',
                                    ownerName: payment.ownerName,
                                    ownerEmail: payment.ownerEmail,
                                    ownerDepartment: '',
                                    bookingDate: payment.bookingDate,
                                    dailyRate: payment.totalAmount,
                                    totalAmount: payment.totalAmount,
                                    status: payment.status,
                                    paymentReceived: false,
                                    startTime: '',
                                    endTime: '',
                                    notes: '',
                                    createdAt: '',
                                    lastActivity: ''
                                  } as AdminBookingData);
                                  setShowMarkPaidConfirmDialog(true);
                                }}
                                data-testid={`button-mark-paid-${payment.id}`}
                              >
                                Mark Paid
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRefundBookingId(payment.id);
                                      setShowRefundDialog(true);
                                    }}
                                    data-testid={`button-issue-refund-${payment.id}`}
                                  >
                                    <DollarSign className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Issue Refund</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDisputeBookingId(payment.id);
                                      setShowDisputeDialog(true);
                                    }}
                                    data-testid={`button-flag-dispute-payment-${payment.id}`}
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Flag Dispute</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={sortedPendingPayments.length}
                    pageSize={pendingPaymentsPageSize}
                    pageIndex={pendingPaymentsPageIndex}
                    onPageSizeChange={(size) => {
                      setPendingPaymentsPageSize(size)
                      setPendingPaymentsPageIndex(0)
                    }}
                    onPageIndexChange={setPendingPaymentsPageIndex}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Past Bookings Tab */}
        <TabsContent value="past" className="space-y-4">
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
                      {paginatedPastBookings.map((booking) => (
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
                  <TablePagination
                    totalCount={sortedPastBookings.length}
                    pageSize={pastBookingsPageSize}
                    pageIndex={pastBookingsPageIndex}
                    onPageSizeChange={(size) => {
                      setPastBookingsPageSize(size)
                      setPastBookingsPageIndex(0)
                    }}
                    onPageIndexChange={setPastBookingsPageIndex}
                  />
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
                      {paginatedBookingActivity.map((activity: any, index) => (
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
                  <TablePagination
                    totalCount={sortedBookingActivity.length}
                    pageSize={bookingActivityPageSize}
                    pageIndex={bookingActivityPageIndex}
                    onPageSizeChange={(size) => {
                      setBookingActivityPageSize(size)
                      setBookingActivityPageIndex(0)
                    }}
                    onPageIndexChange={setBookingActivityPageIndex}
                  />
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

      {/* Availability Details Dialog */}
      <Dialog open={showAvailabilityDetailsDialog} onOpenChange={setShowAvailabilityDetailsDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-availability-details">
          <DialogHeader>
            <DialogTitle>Listing Details</DialogTitle>
            <DialogDescription>
              View complete information about this parking spot listing
            </DialogDescription>
          </DialogHeader>
          {selectedAvailabilityListing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spot Number</Label>
                  <p className="font-medium">{selectedAvailabilityListing.spotNumber}</p>
                </div>
                <div>
                  <Label>Location</Label>
                  <p className="font-medium">{selectedAvailabilityListing.locationName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Spot Type</Label>
                  <Badge variant="outline">{selectedAvailabilityListing.spotTypeName}</Badge>
                </div>
                <div>
                  <Label>Owner</Label>
                  <p className="font-medium">{selectedAvailabilityListing.ownerName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Daily Rate</Label>
                  <p className="font-medium text-lg">${selectedAvailabilityListing.dailyRate}</p>
                </div>
                <div>
                  <Label>Listing Type</Label>
                  <Badge variant="secondary">
                    {selectedAvailabilityListing.listingType === 'single' ? 'Single Day' : 
                     selectedAvailabilityListing.listingType === 'period' ? 'Period' : 'Recurring'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Availability</Label>
                {selectedAvailabilityListing.listingType === 'single' && selectedAvailabilityListing.singleDate && (
                  <p className="text-sm">Single Day: {formatDate(selectedAvailabilityListing.singleDate)}</p>
                )}
                {selectedAvailabilityListing.listingType === 'period' && (
                  <p className="text-sm">
                    Period: {formatDate(selectedAvailabilityListing.periodStartDate || '')} - {formatDate(selectedAvailabilityListing.periodEndDate || '')}
                  </p>
                )}
                {selectedAvailabilityListing.listingType === 'recurring' && (
                  <div className="space-y-1">
                    <p className="text-sm">
                      Recurring: {formatDate(selectedAvailabilityListing.recurringStartDate || '')} - {formatDate(selectedAvailabilityListing.recurringEndDate || '')}
                    </p>
                    {selectedAvailabilityListing.daysOfWeek && selectedAvailabilityListing.daysOfWeek.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {selectedAvailabilityListing.daysOfWeek.map(day => (
                          <Badge key={day} variant="outline" className="text-xs">{day}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowAvailabilityDetailsDialog(false)}
                  data-testid="button-close-availability-details"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Confirmation Dialog */}
      <Dialog open={showMarkPaidConfirmDialog} onOpenChange={setShowMarkPaidConfirmDialog}>
        <DialogContent data-testid="dialog-mark-paid-confirm">
          <DialogHeader>
            <DialogTitle>Confirm Payment Received</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this payment as received? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Spot:</span>
                  <span className="font-medium">{selectedBooking.spotNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Renter:</span>
                  <span className="font-medium">{selectedBooking.renterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-medium">${selectedBooking.totalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="font-medium">{formatDate(selectedBooking.bookingDate)}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMarkPaidConfirmDialog(false);
                    setSelectedBooking(null);
                  }}
                  data-testid="button-cancel-mark-paid"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => selectedBooking && markPaidMutation.mutate(selectedBooking.id)}
                  disabled={markPaidMutation.isPending}
                  data-testid="button-confirm-mark-paid"
                >
                  {markPaidMutation.isPending ? "Marking as Paid..." : "Confirm Payment Received"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Flag Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent data-testid="dialog-flag-dispute">
          <DialogHeader>
            <DialogTitle>Flag Dispute</DialogTitle>
            <DialogDescription>
              Create a dispute for this booking to investigate issues and potential resolution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dispute-target-user">Target User</Label>
              <Select value={disputeTargetUserId} onValueChange={setDisputeTargetUserId}>
                <SelectTrigger id="dispute-target-user" data-testid="select-dispute-target-user">
                  <SelectValue placeholder="Select user to flag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="renter">Renter</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dispute-reason">Dispute Reason</Label>
              <Textarea
                id="dispute-reason"
                placeholder="Describe the dispute reason in detail..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={4}
                data-testid="textarea-dispute-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisputeDialog(false);
                  setDisputeReason("");
                  setDisputeTargetUserId("");
                  setSelectedDisputeBookingId(null);
                }}
                data-testid="button-cancel-dispute"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedDisputeBookingId || !disputeReason.trim() || !disputeTargetUserId) return;
                  createDisputeMutation.mutate({
                    bookingId: selectedDisputeBookingId,
                    targetUserId: disputeTargetUserId,
                    reason: disputeReason
                  });
                }}
                disabled={!disputeReason.trim() || !disputeTargetUserId || createDisputeMutation.isPending}
                data-testid="button-submit-dispute"
              >
                {createDisputeMutation.isPending ? "Creating Dispute..." : "Create Dispute"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent data-testid="dialog-issue-refund">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Process a refund for this booking. This will mark the payment as refunded in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="refund-amount">Refund Amount ($)</Label>
              <Input
                id="refund-amount"
                type="number"
                placeholder="Enter refund amount"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                step="0.01"
                min="0"
                data-testid="input-refund-amount"
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will mark the payment as refunded. Make sure the actual refund has been processed in your payment system.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRefundDialog(false);
                  setRefundAmount("");
                  setSelectedRefundBookingId(null);
                }}
                data-testid="button-cancel-refund"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedRefundBookingId || !refundAmount) return;
                  issueRefundMutation.mutate({
                    bookingId: selectedRefundBookingId,
                    refundAmount: refundAmount
                  });
                }}
                disabled={!refundAmount || issueRefundMutation.isPending}
                data-testid="button-confirm-refund"
              >
                {issueRefundMutation.isPending ? "Processing..." : "Issue Refund"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Notes Dialog */}
      <Dialog open={showAdminNotesDialog} onOpenChange={setShowAdminNotesDialog}>
        <DialogContent data-testid="dialog-admin-notes">
          <DialogHeader>
            <DialogTitle>Add Admin Notes</DialogTitle>
            <DialogDescription>
              Add internal notes to this booking. These notes are only visible to administrators.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-notes">Notes</Label>
              <Textarea
                id="admin-notes"
                placeholder="Enter admin notes here..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={6}
                data-testid="textarea-admin-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAdminNotesDialog(false);
                  setAdminNotes("");
                  setSelectedAdminNotesBookingId(null);
                }}
                data-testid="button-cancel-admin-notes"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!selectedAdminNotesBookingId || !adminNotes.trim()) return;
                  addAdminNotesMutation.mutate({
                    bookingId: selectedAdminNotesBookingId,
                    notes: adminNotes
                  });
                }}
                disabled={!adminNotes.trim() || addAdminNotesMutation.isPending}
                data-testid="button-save-admin-notes"
              >
                {addAdminNotesMutation.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}