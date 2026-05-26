import { useState, useEffect, useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useLocation, useSearch, Link } from "wouter"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  Info,
  AlertCircle,
  Loader2,
  Building2,
  Globe,
  Banknote,
  X,
  Heart,
  RotateCcw,
  Sparkles
} from "lucide-react"
import type { Booking, BookingStatus, ParkingSpot } from "@shared/schema"
import { quickExportBookingsPDF, quickExportBookingsExcel, generateParkingReceiptPDF, type ParkingReceiptData } from "@/utils/export-utils"
import { exportPayrollSummaryReport } from "@/utils/report-export"

// Define BookingScope type
type BookingScope = 'all' | 'bci';

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
  paymentStatus: 'pending' | 'paid' | 'received';
  notes: string;
  createdAt: string;
  lastActivity: string;
  ownerPaymentType?: string;
  ownerPaymentInstructions?: string;
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
  pendingDisputes: number;
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
  saleEventId?: number | null;
  saleCalendarLabel?: string | null;
  originalDailyRate?: string | null;
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
  paymentStatus?: 'pending' | 'paid' | 'received';
}

interface DisputeData {
  id: string;
  bookingId: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  spotNumber?: string;
  spotLocation?: string;
  createdAt: string;
  resolutionNotes?: string;
  refundAmount?: number;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface AuditLogData {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  success: boolean;
  message: string | null;
  before: any;
  after: any;
}

// Payroll summary interfaces for BCI-managed spots
interface PayrollBooking {
  id: string;
  spotNumber: string;
  spotLocation: string;
  spotType: string;
  renterName: string;
  renterEmail: string;
  renterDepartment: string;
  bookingDate: string;
  dailyRate: number;
  totalAmount: number;
  status: BookingStatus;
  deductionMonth: number;
  deductionYear: number;
  deductionPeriod: string;
  createdAt: string;
  excludedFromPayroll: boolean;
  donateToCharity: boolean;
}

interface PayrollPeriodSummary {
  period: string;
  periodLabel: string;
  totalBookings: number;
  totalAmount: number;
  confirmedBookings: number;
  completedBookings: number;
  bookings: PayrollBooking[];
}

interface PayrollSummaryData {
  currentPeriod: string;
  periods: PayrollPeriodSummary[];
}

export default function AdminSpotBookingManagement() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const { t } = useLanguage()
  const [location, setLocation] = useLocation()
  const searchParams = useSearch()
  
  // Initialize scope from URL parameter, defaulting to 'bci' (Shared Pool) if not specified
  const urlScope = new URLSearchParams(searchParams).get('scope') as BookingScope | null
  const [scope, setScope] = useState<BookingScope>(
    urlScope === 'all' ? 'all' : 'bci'
  )
  
  // Update URL when scope changes (without page reload)
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (scope === 'all') {
      params.delete('scope')
    } else {
      params.set('scope', scope)
    }
    const newSearch = params.toString()
    const newPath = location + (newSearch ? `?${newSearch}` : '')
    if (newPath !== location + searchParams) {
      setLocation(newPath)
    }
  }, [scope])
  
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
  const [bookingDetailsTab, setBookingDetailsTab] = useState("details")
  const [showAvailabilityDetailsDialog, setShowAvailabilityDetailsDialog] = useState(false)
  const [showCancelListingDialog, setShowCancelListingDialog] = useState(false)
  const [cancelListingReason, setCancelListingReason] = useState("")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [showMarkPaidConfirmDialog, setShowMarkPaidConfirmDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(["renter", "owner"])
  const [isSendingContact, setIsSendingContact] = useState(false)
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
  const [pendingDisputesDialogOpen, setPendingDisputesDialogOpen] = useState(false)
  
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
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-availability", scope] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments", scope] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity", scope] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-analytics", scope] })
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

  // When scope changes, switch to appropriate tab if current tab doesn't apply
  useEffect(() => {
    // If switching to BCI scope and on pending-payments tab, switch to payroll-summary
    if (scope === 'bci' && activeTab === 'pending-payments') {
      setActiveTab('payroll-summary')
    }
    // If switching to All scope and on payroll-summary tab, switch to pending-payments
    if (scope === 'all' && activeTab === 'payroll-summary') {
      setActiveTab('pending-payments')
    }
  }, [scope])

  // Reset booking details tab to "details" when dialog opens
  useEffect(() => {
    if (showBookingDetails) {
      setBookingDetailsTab("details")
    }
  }, [showBookingDetails])

  // Open booking detail dialog when ?bookingId=<id> is in the URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    const bookingId = params.get('bookingId')
    if (!bookingId) return

    fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((booking) => {
        setSelectedBooking(booking)
        setShowBookingDetails(true)
        // Remove bookingId from URL without causing a page reload
        params.delete('bookingId')
        const newSearch = params.toString()
        setLocation('/admin/bookings' + (newSearch ? `?${newSearch}` : ''))
      })
      .catch(() => {
        // Silently ignore — booking may not exist or admin lost access
      })
  }, [])

  const STALE_TIME = 2 * 60 * 1000; // 2 minutes

  // Fetch active bookings with server-side pagination and filtering — deferred until the "Active/Upcoming Bookings" tab is visited
  const activeBookingsFilters = {
    search: searchTerm,
    status: filterValues.status as string | undefined,
    location: filterValues.location as string | undefined,
    dateFrom: filterValues.dateRangeFrom as string | undefined,
    dateTo: filterValues.dateRangeTo as string | undefined,
    role: filterValues.role as string | undefined,
  };
  const { data: activeBookingsResponse, isLoading: isLoadingActive } = useQuery<{
    data: AdminBookingData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/active-bookings", scope, activeBookingsPageIndex + 1, activeBookingsPageSize, activeBookingsFilters],
    queryFn: () => {
      const params = new URLSearchParams({
        scope,
        page: String(activeBookingsPageIndex + 1),
        limit: String(activeBookingsPageSize),
      });
      if (activeBookingsFilters.search) params.set('search', activeBookingsFilters.search);
      if (activeBookingsFilters.status && activeBookingsFilters.status !== 'all') params.set('status', activeBookingsFilters.status);
      if (activeBookingsFilters.location && activeBookingsFilters.location !== 'all') params.set('location', activeBookingsFilters.location);
      if (activeBookingsFilters.dateFrom) params.set('dateFrom', activeBookingsFilters.dateFrom);
      if (activeBookingsFilters.dateTo) params.set('dateTo', activeBookingsFilters.dateTo);
      if (activeBookingsFilters.role && activeBookingsFilters.role !== 'all') params.set('role', activeBookingsFilters.role);
      return fetch(`/api/admin/active-bookings?${params.toString()}`, { credentials: 'include' }).then(r => r.json());
    },
    enabled: activeTab === 'active',
    staleTime: STALE_TIME
  });

  // Fetch booking activity data — deferred until the "Active/Upcoming Bookings" tab is visited
  const { data: bookingActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ["/api/admin/booking-activity", scope],
    queryFn: () => fetch(`/api/admin/booking-activity?scope=${scope}&pageSize=50`, { credentials: 'include' }).then(r => r.json()),
    enabled: activeTab === 'active',
    staleTime: STALE_TIME
  });

  // Fetch past bookings with server-side pagination (only when tab is active)
  // Include payroll period filter if set (only applies to BCI scope)
  const selectedPayrollPeriod = pastBookingsFilterValues.payrollPeriod as string | undefined;
  const { data: pastBookingsResponse, isLoading: isLoadingPastBookings } = useQuery<{
    data: AdminBookingData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/admin/past-bookings", scope, pastBookingsPageIndex + 1, pastBookingsPageSize, selectedPayrollPeriod],
    queryFn: () => {
      const params = new URLSearchParams({
        scope,
        page: String(pastBookingsPageIndex + 1),
        limit: String(pastBookingsPageSize)
      });
      if (selectedPayrollPeriod && scope === 'bci') {
        params.set('payrollPeriod', selectedPayrollPeriod);
      }
      return fetch(`/api/admin/past-bookings?${params.toString()}`, { credentials: 'include' }).then(r => r.json());
    },
    enabled: activeTab === 'past',
    staleTime: STALE_TIME
  });
  
  const pastBookings = pastBookingsResponse?.data ?? [];
  const pastBookingsTotal = pastBookingsResponse?.total ?? 0;

  // Fetch booking availability — loads immediately as this is the default tab
  const { data: bookingAvailability = [], isLoading: isLoadingAvailability } = useQuery<BookingAvailabilityData[]>({
    queryKey: ["/api/admin/booking-availability", scope],
    queryFn: () => fetch(`/api/admin/booking-availability?scope=${scope}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: STALE_TIME
  });

  // Fetch pending payments — deferred until the "Pending Payments" tab is visited
  const { data: pendingPayments = [], isLoading: isLoadingPendingPayments } = useQuery<PendingPaymentData[]>({
    queryKey: ["/api/admin/pending-payments", scope],
    queryFn: () => fetch(`/api/admin/pending-payments?scope=${scope}`, { credentials: 'include' }).then(r => r.json()),
    enabled: scope === 'all' && activeTab === 'pending-payments',
    staleTime: STALE_TIME
  });

  // Fetch payroll summary — loads on BCI mount (powers at-a-glance summary cards)
  const { data: payrollSummary, isLoading: isLoadingPayrollSummary } = useQuery<PayrollSummaryData>({
    queryKey: ["/api/admin/payroll-summary"],
    queryFn: () => fetch("/api/admin/payroll-summary", { credentials: 'include' }).then(r => r.json()),
    enabled: scope === 'bci',
    staleTime: STALE_TIME
  });

  // Calculate active totals for the first period (excluding removed bookings)
  const payrollActiveTotals = useMemo(() => {
    const firstPeriod = payrollSummary?.periods?.[0];
    if (!firstPeriod) return { bookings: 0, amount: 0, periodLabel: 'Current period' };
    
    const activeBookings = firstPeriod.bookings.filter(b => !b.excludedFromPayroll);
    return {
      bookings: activeBookings.length,
      amount: activeBookings.reduce((sum, b) => sum + b.totalAmount, 0),
      periodLabel: firstPeriod.periodLabel
    };
  }, [payrollSummary]);

  // Fetch available payroll periods for History tab filter (only for BCI scope)
  const { data: payrollPeriodsData } = useQuery<{ periods: { value: string; label: string }[] }>({
    queryKey: ["/api/admin/payroll-periods"],
    queryFn: () => fetch("/api/admin/payroll-periods", { credentials: 'include' }).then(r => r.json()),
    enabled: scope === 'bci',
    staleTime: STALE_TIME
  });

  const payrollPeriodFilterOptions = useMemo(() => {
    return payrollPeriodsData?.periods || [];
  }, [payrollPeriodsData]);

  // Fetch booking analytics — loads on mount (small, powers the summary cards)
  const { data: bookingAnalytics, isLoading: isLoadingAnalytics } = useQuery<BookingAnalytics>({
    queryKey: ["/api/admin/booking-analytics", scope],
    queryFn: () => fetch(`/api/admin/booking-analytics?scope=${scope}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: STALE_TIME
  });

  // Fetch pending disputes (lazy-loaded when dialog opens)
  const { data: allDisputes = [], isLoading: isLoadingDisputes } = useQuery<DisputeData[]>({
    queryKey: ["/api/admin/disputes"],
    queryFn: () => fetch("/api/admin/disputes", { credentials: 'include' }).then(r => r.json()),
    enabled: pendingDisputesDialogOpen
  });

  // Filter for pending disputes (open or investigating)
  const pendingDisputes = allDisputes.filter(d => d.status === 'open' || d.status === 'investigating');

  // Fetch audit logs for selected booking (lazy-loaded when dialog opens)
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery<AuditLogData[]>({
    queryKey: ["/api/admin/audits", { entityType: 'booking', entityId: selectedBooking?.id }],
    queryFn: async ({ queryKey }) => {
      const params = queryKey[1] as Record<string, unknown>;
      const searchParams = new URLSearchParams({ entityType: String(params.entityType), entityId: String(params.entityId) });
      const response = await fetch(`/api/admin/audits?${searchParams}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      return data.items ?? [];
    },
    enabled: showBookingDetails && !!selectedBooking?.id
  });

  // Fetch locations for filter options
  const { data: locations = [] } = useQuery<Array<{
    id: number;
    office: string;
    building: string;
    level: string;
    isActive: boolean;
  }>>({
    queryKey: ["/api/locations"],
    queryFn: () => fetch("/api/locations", { credentials: 'include' }).then(r => r.json())
  });

  // Transform locations into filter options
  const locationFilterOptions = useMemo(() => {
    return locations
      .filter(loc => loc.isActive)
      .map(loc => ({
        value: `${loc.building} - ${loc.level}`,
        label: `${loc.building} - ${loc.level}`
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [locations]);


  // Use API data directly - show real data or empty states
  const displayActiveBookings = activeBookingsResponse?.data ?? [];
  const activeBookingsTotal = activeBookingsResponse?.total ?? 0;
  
  // Default empty analytics when no data is available
  const defaultAnalytics: BookingAnalytics = {
    totalActiveBookings: 0,
    totalDailyRevenue: 0,
    pendingRequests: 0,
    pendingDisputes: 0,
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

  // Active bookings are filtered server-side; use the fetched page data directly
  const filteredActiveBookings = displayActiveBookings;

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
    "availableFrom",
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

  // Active bookings are already paginated server-side; apply client-side sort/filter on the page data
  const paginatedActiveBookings = sortedActiveBookings;


  // paginatedPastBookings removed - now using server-side pagination via pastBookings directly

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
  const bookingFilterConfigs: FilterConfig[] = useMemo(() => [
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
        { value: "owner", label: "Assigned To" },
        { value: "renter", label: "Renter" }
      ]
    },
    {
      key: "location",
      label: "Location",
      type: "select",
      options: locationFilterOptions
    },
    {
      key: "dateRange",
      label: "Usage Date Range",
      type: "dateRange"
    }
  ], [locationFilterOptions]);

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
  const pastBookingsFilterConfigs: FilterConfig[] = useMemo(() => {
    const baseConfigs: FilterConfig[] = [
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
        options: locationFilterOptions
      },
      {
        key: "dateRange",
        label: "Usage Date Range",
        type: "dateRange"
      }
    ];
    
    // Add payroll period filter for BCI scope only
    if (scope === 'bci' && payrollPeriodFilterOptions.length > 0) {
      baseConfigs.unshift({
        key: "payrollPeriod",
        label: "Payroll Period",
        type: "select",
        options: payrollPeriodFilterOptions
      });
    }
    
    return baseConfigs;
  }, [locationFilterOptions, scope, payrollPeriodFilterOptions])

  // Filter configuration for booking availability
  const availabilityFilterConfigs: FilterConfig[] = useMemo(() => [
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
      options: locationFilterOptions
    }
  ], [locationFilterOptions])

  // Filter configuration for pending payments
  const pendingPaymentsFilterConfigs: FilterConfig[] = useMemo(() => [
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
      options: locationFilterOptions
    }
  ], [locationFilterOptions])

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
    // Reset pagination when payroll period filter changes (server-side filter)
    if (key === 'payrollPeriod') {
      setPastBookingsPageIndex(0);
    }
  }
  
  // Clear past bookings filters
  const handleClearPastBookingsFilters = () => {
    setPastBookingsSearchTerm("")
    setPastBookingsFilterValues({})
    setPastBookingsPageIndex(0);
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

  // Reset active bookings and past bookings pages when scope changes
  useEffect(() => {
    setActiveBookingsPageIndex(0)
    setPastBookingsPageIndex(0)
  }, [scope])

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
      const response = await apiRequest(`/api/admin/bookings/${bookingId}/cancel`, { method: 'POST', body: {
        reason
      }});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity", scope] });
      
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

  // Cancel listing mutation (for Booking Availability tab)
  const cancelListingMutation = useMutation({
    mutationFn: async ({ listingId, reason }: { listingId: string; reason: string }) => {
      // Extract original listing ID if this is an expanded day entry (format: "listingId-YYYY-MM-DD")
      const originalListingId = listingId.includes('-') && listingId.match(/-\d{4}-\d{2}-\d{2}$/) 
        ? listingId.replace(/-\d{4}-\d{2}-\d{2}$/, '') 
        : listingId;
      const response = await apiRequest(`/api/admin/spot-listings/${originalListingId}/cancel`, { 
        method: 'POST', 
        body: { reason }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-availability", scope] });
      
      toast({
        title: "Listing Cancelled",
        description: "The spot listing has been successfully cancelled.",
        variant: "default"
      });
      
      setShowCancelListingDialog(false);
      setCancelListingReason("");
      setSelectedAvailabilityListing(null);
    },
    onError: (error) => {
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel listing. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mark payment as received mutation (admin confirms paid → received)
  const markPaidMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const response = await apiRequest(`/api/admin/bookings/${bookingId}/payment`, { 
        method: 'PATCH', 
        body: { paymentStatus: 'received' }
      });
      return response.json();
    },
    onSuccess: async (data, bookingId) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity", scope] });
      
      // Refetch the booking and update selectedBooking state
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, { credentials: 'include' });
        if (response.ok) {
          const updatedBooking = await response.json();
          // Update selectedBooking with fresh data
          setSelectedBooking(prev => prev?.id === bookingId ? updatedBooking : prev);
        }
      } catch (error) {
        console.error("Failed to refetch booking:", error);
      }
      
      toast({
        title: "Payment Marked as Received",
        description: "The payment has been successfully marked as received.",
        variant: "default"
      });
      
      setShowMarkPaidConfirmDialog(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments", scope] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity", scope] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-payments", scope] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings", scope] });
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

  // Mutation for excluding/restoring bookings from payroll
  const excludeFromPayrollMutation = useMutation({
    mutationFn: async (data: { bookingId: string; excluded: boolean }) => {
      const response = await apiRequest(`/api/admin/bookings/${data.bookingId}/payroll-exclusion`, {
        method: 'PATCH',
        body: { excluded: data.excluded }
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/shared-pool-usage"] });
      toast({
        title: data.excluded ? "Removed from Payroll" : "Restored to Payroll",
        description: data.message,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update",
        description: error instanceof Error ? error.message : "Failed to update payroll status. Please try again.",
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

  const handleContactUser = async () => {
    if (!selectedBooking || !contactMessage.trim() || selectedRecipients.length === 0) return;
    
    setIsSendingContact(true);
    try {
      const response = await apiRequest(`/api/admin/bookings/${selectedBooking.id}/contact`, {
        method: 'POST',
        body: JSON.stringify({ message: contactMessage, recipients: selectedRecipients }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      toast({
        title: "Message Sent",
        description: `Your message has been sent to ${data.emailsSent} recipient(s).`,
        variant: "default"
      });
      setShowContactDialog(false);
      setContactMessage("");
      setSelectedRecipients(["renter", "owner"]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to send contact email",
        variant: "destructive"
      });
    } finally {
      setIsSendingContact(false);
    }
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

  const getAuditIcon = (action: string) => {
    const iconMap: Record<string, JSX.Element> = {
      CREATE: <Calendar className="h-4 w-4 text-blue-600" />,
      UPDATE: <Settings className="h-4 w-4 text-amber-600" />,
      DELETE: <XCircle className="h-4 w-4 text-red-600" />,
      CANCEL: <Ban className="h-4 w-4 text-red-600" />,
      COMPLETE: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      APPROVE: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      REJECT: <XCircle className="h-4 w-4 text-red-600" />,
      ACTIVATE: <Zap className="h-4 w-4 text-green-600" />,
      DEACTIVATE: <Ban className="h-4 w-4 text-gray-600" />,
      VIEW: <Eye className="h-4 w-4 text-blue-600" />,
      EXPORT: <Download className="h-4 w-4 text-purple-600" />,
    };
    
    return iconMap[action] || <Activity className="h-4 w-4 text-gray-600" />;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    // Handle date-only strings (YYYY-MM-DD) without timezone conversion
    if (timestamp && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
      const [year, month, day] = timestamp.split('-').map(Number);
      return `${month}/${day}/${year}`;
    }
    // For full timestamps, use toLocaleDateString
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-booking-management">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.spotBookingManagement.title')}</h1>
          <p className="text-muted-foreground">
            {t('admin.spotBookingManagement.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden" data-testid="tabs-scope">
            <button
              onClick={() => setScope('all')}
              data-testid="tab-scope-all"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                scope === 'all' 
                  ? 'bg-background border-b-primary text-primary' 
                  : 'bg-muted/40 border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Users className="h-4 w-4" />
              Assigned Spots
            </button>
            <button
              onClick={() => setScope('bci')}
              data-testid="tab-scope-bci"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                scope === 'bci' 
                  ? 'bg-background border-b-primary text-primary' 
                  : 'bg-muted/40 border-b-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Building2 className="h-4 w-4" />
              Shared Pool
            </button>
          </div>
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
        </div>
      </div>

      {/* Quick Analytics Cards */}
      {cardsVisible && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card 
                className="hover-elevate cursor-pointer active-elevate-2"
                onClick={() => setActiveTab("active")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Active Bookings</CardTitle>
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

          {/* Scope-aware Revenue Card */}
          {scope === 'bci' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2"
                  onClick={() => setActiveTab("payroll-summary")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Payroll Period Revenue</CardTitle>
                    <div className="rounded-full border-2 border-green-400 p-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-payroll-revenue">
                      ${formatCurrency(payrollActiveTotals.amount)}
                    </div>
                    <p className="text-xs text-green-600">
                      {payrollActiveTotals.periodLabel}
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                View total revenue for the current payroll period
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2"
                  onClick={() => setActiveTab("active")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                    <div className="rounded-full border-2 border-green-400 p-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-daily-revenue">
                      ${formatCurrency(displayAnalytics.totalDailyRevenue)}
                    </div>
                    <p className="text-xs text-green-600">Today's revenue</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                View total daily revenue from bookings
              </TooltipContent>
            </Tooltip>
          )}

          {/* Scope-aware Bookings Count Card */}
          {scope === 'bci' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2"
                  onClick={() => setActiveTab("payroll-summary")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Payroll Period Bookings</CardTitle>
                    <div className="rounded-full border-2 border-purple-400 p-2">
                      <Banknote className="h-4 w-4 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-payroll-bookings">
                      {payrollActiveTotals.bookings}
                    </div>
                    <p className="text-xs text-purple-600">
                      {payrollActiveTotals.periodLabel}
                    </p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                View total bookings for the current payroll period
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2"
                  onClick={() => setActiveTab("pending-payments")}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                    <div className="rounded-full border-2 border-orange-400 p-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="stat-pending-requests">
                      {displayAnalytics.pendingRequests}
                    </div>
                    <p className="text-xs text-orange-600">Awaiting action</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                Click to view pending booking requests
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="availability" data-testid="tab-booking-availability" className="gap-2">
            <CalendarCheck className="h-4 w-4 !text-green-600" />
            Booking Availability
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-bookings" className="gap-2">
            <CheckCircle2 className="h-4 w-4 !text-blue-600" />
            {scope === 'bci' ? 'Upcoming Bookings' : 'Active Bookings'}
          </TabsTrigger>
          {/* Show Pending Payments for All Spots, Payroll Summary for Shared Pool */}
          {scope === 'all' ? (
            <TabsTrigger value="pending-payments" data-testid="tab-pending-payments" className="gap-2">
              <DollarSign className="h-4 w-4 !text-orange-600" />
              Pending Payments
            </TabsTrigger>
          ) : (
            <TabsTrigger value="payroll-summary" data-testid="tab-payroll-summary" className="gap-2">
              <Banknote className="h-4 w-4 !text-purple-600" />
              Payroll Summary
            </TabsTrigger>
          )}
          <TabsTrigger value="past" data-testid="tab-past-bookings" className="gap-2">
            <Calendar className="h-4 w-4 !text-slate-600" />
            History
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
                  <p className="text-sm">
                    {scope === 'bci' 
                      ? 'No shared pool spot availability listings found. Switch to "Assigned Spots" to see employee-assigned spot availability.' 
                      : 'Spot availability listings will appear here.'}
                  </p>
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
                          Assigned To
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
                            ${formatCurrency(listing.dailyRate)}
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
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
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
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setSelectedAvailabilityListing(listing);
                                      setShowCancelListingDialog(true);
                                    }}
                                    data-testid={`button-cancel-listing-${listing.id}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cancel Listing</TooltipContent>
                              </Tooltip>
                            </div>
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
                <CardTitle>Active Bookings ({activeBookingsTotal})</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={activeBookingsTotal === 0}
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
                    disabled={activeBookingsTotal === 0}
                    onClick={async () => {
                      const success = await quickExportBookingsExcel(sortedActiveBookings, 'Active Bookings Report', (errorMessage) => {
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
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center py-2">
                      <Skeleton className="h-10 w-20 flex-shrink-0" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-24 flex-shrink-0" />
                      <Skeleton className="h-10 w-20 flex-shrink-0" />
                      <Skeleton className="h-6 w-20 flex-shrink-0 rounded-full" />
                      <Skeleton className="h-6 w-16 flex-shrink-0 rounded-full" />
                      <Skeleton className="h-8 w-20 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : activeBookingsTotal === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-active-bookings">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active bookings found</p>
                  <p className="text-sm">
                    {scope === 'bci' 
                      ? 'No active shared pool bookings found. Switch to "Assigned Spots" to see employee-assigned spot bookings.' 
                      : 'Active bookings will appear here.'}
                  </p>
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
                        Assigned To
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="bookingDate"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                      >
                        Usage Date
                      </SortableTableHeader>
                      <SortableTableHeader
                        column="totalAmount"
                        currentSortColumn={sortState.column}
                        currentSortDirection={sortState.direction}
                        onSort={handleSort}
                        align="right"
                      >
                        Amount
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
                        column="paymentStatus"
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
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* Display total booking amount */}
                          <p className="font-medium">${Number(booking.totalAmount).toFixed(2)}</p>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(booking.status)}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = (booking as any).paymentStatus || 'pending';
                            return (
                              <Badge variant={status === 'received' ? 'default' : status === 'paid' ? 'secondary' : 'outline'}>
                                {status === 'pending' ? 'Pending' : status === 'paid' ? 'Paid' : 'Received'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>Cancel Booking</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>Contact Users</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={activeBookingsTotal}
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
                  <p className="text-sm">
                    {scope === 'bci' 
                      ? 'No pending payments for shared pool bookings. Switch to "Assigned Spots" to see employee-assigned spot payments.' 
                      : 'Bookings with pending payments will appear here.'}
                  </p>
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
                          Assigned To
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="bookingDate"
                          currentSortColumn={pendingPaymentsSortState.column}
                          currentSortDirection={pendingPaymentsSortState.direction}
                          onSort={handlePendingPaymentsSort}
                        >
                          Usage Date
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
                            ${formatCurrency(payment.totalAmount)}
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
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
                                        paymentStatus: payment.paymentStatus || 'pending',
                                        notes: '',
                                        createdAt: '',
                                        lastActivity: ''
                                      } as AdminBookingData);
                                      setShowContactDialog(true);
                                    }}
                                    data-testid={`button-contact-renter-${payment.id}`}
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Contact Renter</TooltipContent>
                              </Tooltip>
                              {payment.paymentStatus === 'paid' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
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
                                          paymentStatus: payment.paymentStatus || 'pending',
                                          notes: '',
                                          createdAt: '',
                                          lastActivity: ''
                                        } as AdminBookingData);
                                        setShowMarkPaidConfirmDialog(true);
                                      }}
                                      data-testid={`button-mark-paid-${payment.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Confirm Payment Received</TooltipContent>
                                </Tooltip>
                              )}
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

        {/* Payroll Summary Tab (BCI Scope Only) */}
        <TabsContent value="payroll-summary" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-purple-600" />
                  Payroll Deduction Summary
                </CardTitle>
                <div className="flex items-center gap-2">
                  {payrollSummary && payrollSummary.periods.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportPayrollSummaryReport(payrollSummary.periods)}
                      data-testid="button-export-payroll-excel"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                  )}
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    Auto-deducted from employee payroll
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Bookings are grouped by calendar month. Each booking is deducted from payroll in the same month as the parking date.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPayrollSummary ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : !payrollSummary || payrollSummary.periods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payroll data found</p>
                  <p className="text-sm">Bookings for BCI-managed spots will appear here grouped by deduction period.</p>
                </div>
              ) : (
                payrollSummary.periods.map((period) => {
                  // Calculate active bookings (exclude removed ones)
                  const activeBookings = period.bookings.filter(b => !b.excludedFromPayroll);
                  const activeBookingsCount = activeBookings.length;
                  const activeAmount = activeBookings.reduce((sum, b) => sum + b.totalAmount, 0);
                  
                  return (
                  <Card key={period.period} className="bg-purple-50/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {period.periodLabel}
                          {period.period === payrollSummary.currentPeriod && (
                            <Badge className="bg-purple-100 text-purple-700">Current Period</Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {activeBookingsCount} bookings
                          </span>
                          <span className="font-semibold text-purple-600">
                            ${activeAmount.toFixed(2)} total
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {period.confirmedBookings} upcoming
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {period.completedBookings} completed
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Spot</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Usage Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {period.bookings.map((booking) => (
                              <TableRow 
                                key={booking.id}
                                className={booking.excludedFromPayroll ? 'bg-red-50/50' : ''}
                              >
                                <TableCell>
                                  <div className={booking.excludedFromPayroll ? 'text-red-600' : ''}>
                                    <p className="font-medium">{booking.renterName}</p>
                                    <p className="text-xs text-muted-foreground">{booking.renterEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell className={`text-sm ${booking.excludedFromPayroll ? 'text-red-600' : ''}`}>
                                  {booking.renterDepartment || '-'}
                                </TableCell>
                                <TableCell className={`font-medium ${booking.excludedFromPayroll ? 'text-red-600' : ''}`}>
                                  {booking.spotNumber}
                                </TableCell>
                                <TableCell className={`text-sm ${booking.excludedFromPayroll ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {booking.spotLocation}
                                </TableCell>
                                <TableCell className={`text-sm ${booking.excludedFromPayroll ? 'text-red-600' : ''}`}>
                                  {new Date(booking.bookingDate + 'T12:00:00').toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    {booking.donateToCharity ? (
                                      <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
                                        <Heart className="h-3 w-3 mr-1 fill-pink-500" />
                                        Charity
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                        Regular
                                      </Badge>
                                    )}
                                    {(booking as any).createdByAdmin && (
                                      <Badge className="bg-blue-600 text-white border-blue-700 gap-1">
                                        <Building2 className="h-3 w-3" />
                                        WPS Managed
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className={`font-medium ${booking.excludedFromPayroll ? 'text-red-600 line-through' : ''}`}>
                                  ${booking.totalAmount.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  {booking.excludedFromPayroll ? (
                                    <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                                      Removed
                                    </Badge>
                                  ) : (
                                    <Badge 
                                      variant="outline" 
                                      className={booking.status === 'completed' 
                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                        : 'bg-blue-50 text-blue-700 border-blue-200'}
                                    >
                                      {booking.status === 'completed' ? 'Completed' : 'Upcoming'}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {booking.excludedFromPayroll ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-green-600 hover:text-green-700"
                                          onClick={async () => {
                                            const confirmed = await confirm({
                                              title: "Restore to Payroll",
                                              description: `Are you sure you want to restore this booking for ${booking.renterName} (${booking.spotNumber}) back to the payroll summary?`,
                                              confirmText: "Restore",
                                              cancelText: "Cancel",
                                              variant: "default"
                                            });
                                            if (confirmed) {
                                              excludeFromPayrollMutation.mutate({ 
                                                bookingId: booking.id, 
                                                excluded: false 
                                              });
                                            }
                                          }}
                                          disabled={excludeFromPayrollMutation.isPending}
                                          data-testid={`button-restore-payroll-${booking.id}`}
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Restore to Payroll</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          onClick={async () => {
                                            const confirmed = await confirm({
                                              title: "Remove from Payroll",
                                              description: `Are you sure you want to remove this booking for ${booking.renterName} (${booking.spotNumber}) from the payroll summary? This booking will no longer appear in payroll reports.`,
                                              confirmText: "Remove",
                                              cancelText: "Cancel",
                                              variant: "destructive"
                                            });
                                            if (confirmed) {
                                              excludeFromPayrollMutation.mutate({ 
                                                bookingId: booking.id, 
                                                excluded: true 
                                              });
                                            }
                                          }}
                                          disabled={excludeFromPayrollMutation.isPending}
                                          data-testid={`button-remove-payroll-${booking.id}`}
                                        >
                                          <Ban className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Remove from Payroll</TooltipContent>
                                    </Tooltip>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )})
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
                <CardTitle>Past Bookings ({pastBookingsTotal})</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    disabled={pastBookings.length === 0}
                    onClick={() => {
                      const success = quickExportBookingsPDF(pastBookings, `Past Bookings Report (Page ${pastBookingsPageIndex + 1})`, (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      }, scope)
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "PDF report for current page has been downloaded successfully"
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
                    disabled={pastBookings.length === 0}
                    onClick={async () => {
                      const success = await quickExportBookingsExcel(pastBookings, `Past Bookings Report (Page ${pastBookingsPageIndex + 1})`, (errorMessage) => {
                        toast({
                          variant: "destructive",
                          title: "Export Failed",
                          description: errorMessage
                        })
                      }, scope)
                      if (success) {
                        toast({
                          title: "Export Successful",
                          description: "Excel report for current page has been downloaded successfully"
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
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center py-2">
                      <Skeleton className="h-10 w-20 flex-shrink-0" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-24 flex-shrink-0" />
                      <Skeleton className="h-6 w-20 flex-shrink-0 rounded-full" />
                      <Skeleton className="h-10 w-20 flex-shrink-0" />
                      <Skeleton className="h-8 w-16 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              ) : pastBookingsTotal === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-past-bookings">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No past bookings found</p>
                  <p className="text-sm">
                    {scope === 'bci' 
                      ? 'No past shared pool bookings found. Switch to "Assigned Spots" to see employee-assigned spot history.' 
                      : 'Completed, cancelled, and expired bookings will appear here.'}
                  </p>
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
                          Assigned To
                        </SortableTableHeader>
                        <SortableTableHeader
                          column="bookingDate"
                          currentSortColumn={pastBookingsSortState.column}
                          currentSortDirection={pastBookingsSortState.direction}
                          onSort={handlePastBookingsSort}
                        >
                          Usage Date
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
                            ${formatCurrency(booking.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
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
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>
                              {booking.ownerName !== 'BCI Workplace Services' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const receiptData: ParkingReceiptData = {
                                          spotNumber: booking.spotNumber,
                                          spotLocation: booking.spotLocation,
                                          renterName: booking.renterName,
                                          renterEmail: booking.renterEmail,
                                          ownerName: booking.ownerName,
                                          status: booking.status,
                                          dailyRate: booking.dailyRate,
                                          bookingDate: booking.bookingDate,
                                          paymentStatus: booking.paymentStatus,
                                          bookingId: booking.id
                                        };
                                        generateParkingReceiptPDF(receiptData, `parking-receipt-${booking.id.slice(0, 8)}.pdf`);
                                      }}
                                      data-testid={`button-download-receipt-${booking.id}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Download Receipt</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalCount={pastBookingsTotal}
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
      </Tabs>

      {/* Booking Details Dialog */}
      <Dialog open={showBookingDetails} onOpenChange={setShowBookingDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="dialog-booking-details">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              View complete information about this booking
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <Tabs value={bookingDetailsTab} onValueChange={setBookingDetailsTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-booking-details">
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                <TabsTrigger value="audit-history" data-testid="tab-audit-history">
                  Audit History
                  {Array.isArray(auditLogs) && auditLogs.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{auditLogs.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Spot Information</Label>
                    <p className="font-medium" data-testid="text-spot-number">{selectedBooking.spotNumber}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-spot-location">{selectedBooking.spotLocation}</p>
                  </div>
                  <div>
                    <Label>Usage Date</Label>
                    <p className="font-medium" data-testid="text-booking-date">{formatDate(selectedBooking.bookingDate)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Renter</Label>
                    <p className="font-medium" data-testid="text-renter-name">{selectedBooking.renterName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-renter-email">{selectedBooking.renterEmail}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-renter-department">{selectedBooking.renterDepartment}</p>
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <p className="font-medium" data-testid="text-owner-name">{selectedBooking.ownerName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-owner-email">{selectedBooking.ownerEmail}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-owner-department">{selectedBooking.ownerDepartment}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Total Amount</Label>
                    <p className="font-medium" data-testid="text-total-amount">${Number(selectedBooking.totalAmount).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div data-testid="badge-booking-status">
                      {getStatusBadge(selectedBooking.status)}
                    </div>
                  </div>
                  <div>
                    <Label>Payment</Label>
                    {(() => {
                      const status = (selectedBooking as any).paymentStatus || 'pending';
                      const isPayrollBooking = selectedBooking.ownerName === 'BCI Workplace Services';
                      return (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={status === 'received' ? 'default' : status === 'paid' ? 'secondary' : 'outline'} 
                            data-testid="badge-payment-status"
                          >
                            {status === 'pending' ? 'Pending' : status === 'paid' ? 'Paid' : 'Received'}
                          </Badge>
                          {isPayrollBooking && status === 'received' && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200" data-testid="badge-payroll-indicator">
                              Payroll
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p className="text-sm" data-testid="text-booking-notes">{selectedBooking.notes}</p>
                  </div>
                )}

                {(selectedBooking.ownerPaymentType || selectedBooking.ownerPaymentInstructions) && (
                  <div>
                    <Label>Owner Payment Preference</Label>
                    {selectedBooking.ownerPaymentType && (
                      <p className="text-sm font-medium capitalize">
                        {selectedBooking.ownerPaymentType === 'interac_transfer' ? 'Interac e-Transfer' : selectedBooking.ownerPaymentType}
                      </p>
                    )}
                    {selectedBooking.ownerPaymentInstructions && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{selectedBooking.ownerPaymentInstructions}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
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
                  {selectedBooking.status !== 'completed' && selectedBooking.status !== 'cancelled' && (
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
                  )}
                </div>
              </TabsContent>

              <TabsContent value="audit-history" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  {isLoadingAuditLogs ? (
                    <div className="space-y-4" data-testid="audit-loading">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="audit-empty-state">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">No Audit History</p>
                      <p className="text-sm text-muted-foreground">No audit logs found for this booking</p>
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="audit-timeline">
                      {Array.isArray(auditLogs) && auditLogs
                        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                        .map((log, index) => (
                          <div 
                            key={log.id} 
                            className="flex gap-4 relative pb-4"
                            data-testid={`audit-log-${log.id}`}
                          >
                            {index < auditLogs.length - 1 && (
                              <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                            )}
                            
                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                              {getAuditIcon(log.action)}
                            </div>

                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium" data-testid={`audit-action-${log.id}`}>
                                    {log.message || `${log.action} - ${log.entityType}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground" data-testid={`audit-actor-${log.id}`}>
                                      {log.actorEmail || "System"}
                                    </p>
                                    {log.actorRole && (
                                      <Badge variant="outline" className="text-xs" data-testid={`audit-role-${log.id}`}>
                                        {log.actorRole}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium" data-testid={`audit-time-${log.id}`}>
                                    {new Date(log.occurredAt).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground" data-testid={`audit-date-${log.id}`}>
                                    {new Date(log.occurredAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={log.success ? "default" : "destructive"}
                                  className="text-xs"
                                  data-testid={`audit-status-${log.id}`}
                                >
                                  {log.success ? "SUCCESS" : "FAILED"}
                                </Badge>
                                <Badge variant="outline" className="text-xs" data-testid={`audit-action-type-${log.id}`}>
                                  {log.action}
                                </Badge>
                              </div>

                              {(log.before || log.after) && (
                                <details className="mt-2">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                    View details
                                  </summary>
                                  <div className="mt-2 space-y-2 text-xs">
                                    {log.before && (
                                      <div>
                                        <p className="font-medium">Before:</p>
                                        <pre className="bg-muted p-2 rounded overflow-auto">
                                          {JSON.stringify(log.before, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {log.after && (
                                      <div>
                                        <p className="font-medium">After:</p>
                                        <pre className="bg-muted p-2 rounded overflow-auto">
                                          {JSON.stringify(log.after, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
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

      {/* Cancel Listing Dialog */}
      <Dialog open={showCancelListingDialog} onOpenChange={setShowCancelListingDialog}>
        <DialogContent data-testid="dialog-cancel-listing">
          <DialogHeader>
            <DialogTitle>Cancel Listing</DialogTitle>
            <DialogDescription>
              This will remove the spot availability listing. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAvailabilityListing && (
              <div className="p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm"><span className="font-medium">Spot:</span> {selectedAvailabilityListing.spotNumber}</p>
                <p className="text-sm"><span className="font-medium">Location:</span> {selectedAvailabilityListing.locationName}</p>
                <p className="text-sm"><span className="font-medium">Date:</span> {formatDate(selectedAvailabilityListing.availableFrom)}</p>
              </div>
            )}
            <div>
              <Label htmlFor="cancel-listing-reason">Cancellation Reason</Label>
              <Textarea
                id="cancel-listing-reason"
                placeholder="Explain why this listing is being cancelled..."
                value={cancelListingReason}
                onChange={(e) => setCancelListingReason(e.target.value)}
                data-testid="textarea-cancel-listing-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelListingDialog(false);
                  setCancelListingReason("");
                }}
                data-testid="button-cancel-listing-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedAvailabilityListing && cancelListingReason.trim()) {
                    cancelListingMutation.mutate({
                      listingId: selectedAvailabilityListing.id,
                      reason: cancelListingReason
                    });
                  }
                }}
                disabled={!cancelListingReason.trim() || cancelListingMutation.isPending}
                data-testid="button-confirm-cancel-listing"
              >
                {cancelListingMutation.isPending ? "Cancelling..." : "Cancel Listing"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Users Dialog */}
      <Dialog open={showContactDialog} onOpenChange={(open) => {
        setShowContactDialog(open);
        if (!open) {
          setContactMessage("");
          setSelectedRecipients(["renter", "owner"]);
        }
      }}>
        <DialogContent data-testid="dialog-contact-users">
          <DialogHeader>
            <DialogTitle>Contact Users</DialogTitle>
            <DialogDescription>
              Send a message to the users involved in this booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Recipients</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recipient-renter"
                    checked={selectedRecipients.includes("renter")}
                    onCheckedChange={(checked) => {
                      setSelectedRecipients(prev =>
                        checked ? [...prev, "renter"] : prev.filter(r => r !== "renter")
                      );
                    }}
                  />
                  <Label htmlFor="recipient-renter" className="text-sm font-normal cursor-pointer">
                    Renter: {selectedBooking?.renterName} ({selectedBooking?.renterEmail})
                  </Label>
                </div>
                {selectedBooking?.ownerEmail && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="recipient-owner"
                      checked={selectedRecipients.includes("owner")}
                      onCheckedChange={(checked) => {
                        setSelectedRecipients(prev =>
                          checked ? [...prev, "owner"] : prev.filter(r => r !== "owner")
                        );
                      }}
                    />
                    <Label htmlFor="recipient-owner" className="text-sm font-normal cursor-pointer">
                      Owner/Assigned User: {selectedBooking?.ownerName} ({selectedBooking?.ownerEmail})
                    </Label>
                  </div>
                )}
              </div>
            </div>
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
                disabled={isSendingContact}
                data-testid="button-cancel-contact"
              >
                Cancel
              </Button>
              <Button
                onClick={handleContactUser}
                disabled={!contactMessage.trim() || selectedRecipients.length === 0 || isSendingContact}
                data-testid="button-send-message"
              >
                {isSendingContact ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
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
                  <Label>Assigned To</Label>
                  <p className="font-medium">{selectedAvailabilityListing.ownerName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Daily Rate</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-lg">${formatCurrency(selectedAvailabilityListing.dailyRate)}</p>
                    {selectedAvailabilityListing.originalDailyRate && (
                      <p className="text-sm text-muted-foreground line-through">${formatCurrency(selectedAvailabilityListing.originalDailyRate)}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Listing Type</Label>
                  <Badge variant="secondary">
                    {selectedAvailabilityListing.listingType === 'single' ? 'Single Day' : 
                     selectedAvailabilityListing.listingType === 'period' ? 'Period' : 'Recurring'}
                  </Badge>
                </div>
              </div>

              {selectedAvailabilityListing.saleCalendarLabel && (
                <div>
                  <Label>Active Sale Event</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="gap-1 bg-fuchsia-600 text-white border-fuchsia-700">
                      <Sparkles className="h-3 w-3" />
                      {selectedAvailabilityListing.saleCalendarLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      This listing is currently part of a discount sale event
                    </span>
                  </div>
                </div>
              )}

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
                  <span className="font-medium">${formatCurrency(selectedBooking.totalAmount)}</span>
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
                  {markPaidMutation.isPending ? "Confirming..." : "Confirm Payment Received"}
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
                  <SelectItem value="owner">Assigned To</SelectItem>
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

      {/* Pending Disputes Dialog */}
      <Dialog open={pendingDisputesDialogOpen} onOpenChange={setPendingDisputesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-pending-disputes">
          <DialogHeader>
            <DialogTitle>Pending Disputes</DialogTitle>
            <DialogDescription>
              Review and manage disputes that require attention
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDisputes ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading disputes...</p>
              </div>
            </div>
          ) : pendingDisputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No pending disputes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDisputes.map((dispute) => (
                <Card key={dispute.id} data-testid={`dispute-card-${dispute.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-base">
                            Booking #{dispute.bookingId.slice(0, 8)}
                          </CardTitle>
                          <Badge 
                            variant={dispute.status === 'open' ? 'destructive' : 'default'}
                            data-testid={`dispute-status-${dispute.id}`}
                          >
                            {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                          </Badge>
                        </div>
                        {dispute.spotNumber && dispute.spotLocation && (
                          <p className="text-sm text-muted-foreground">
                            {dispute.spotNumber} - {dispute.spotLocation}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Reporter</p>
                        <p className="text-sm text-muted-foreground" data-testid={`dispute-reporter-${dispute.id}`}>
                          {dispute.reporterName}
                        </p>
                        <p className="text-xs text-muted-foreground">{dispute.reporterEmail}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Target User</p>
                        <p className="text-sm text-muted-foreground" data-testid={`dispute-target-${dispute.id}`}>
                          {dispute.targetUserName}
                        </p>
                        <p className="text-xs text-muted-foreground">{dispute.targetUserEmail}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-1">Reason</p>
                      <p className="text-sm text-muted-foreground" data-testid={`dispute-reason-${dispute.id}`}>
                        {dispute.reason}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const booking = displayActiveBookings.find(b => b.id === dispute.bookingId) 
                            || pastBookings.find(b => b.id === dispute.bookingId);
                          if (booking) {
                            setSelectedBooking(booking);
                            setShowBookingDetails(true);
                          }
                        }}
                        data-testid={`button-view-booking-${dispute.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Booking
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setPendingDisputesDialogOpen(false);
                          setSelectedDisputeBookingId(dispute.bookingId);
                          setShowResolveDisputeDialog(true);
                        }}
                        data-testid={`button-resolve-${dispute.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}