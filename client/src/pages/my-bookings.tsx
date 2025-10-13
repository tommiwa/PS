import { useState } from "react"
import { BookingCard } from "@/components/booking-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { SpotListingForm } from "@/components/spot-listing-form"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Calendar, Search, Filter, Download, Clock, CheckCircle, CheckCircle2, XCircle, Car, MapPin, DollarSign, AlertTriangle, Plus, Edit, Trash2, CreditCard, Info, Activity, Building, Ban, Eye, FileText } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { isPastDate } from "@/utils/date-utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { Booking, SpotListing } from "@shared/schema"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { quickExportBookingsPDF, quickExportBookingsExcel } from "@/utils/export-utils"

export default function MyBookings() {
  const { user, isOwner, getCurrentViewRole } = useAuth()
  // Use view role for admins, otherwise use actual role
  const isOwnerView = getCurrentViewRole() === 'owner' || (getCurrentViewRole() === null && isOwner())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [showListingForm, setShowListingForm] = useState(false)
  const [showEditListing, setShowEditListing] = useState(false)
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showViewDetails, setShowViewDetails] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const { confirm } = useConfirm()
  const { toast } = useToast()

  // Filter configurations for renters
  const renterFilterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "payment-pending", label: "Payment Pending" }
      ]
    },
    {
      key: "dateRange",
      label: "Booking Date",
      type: "dateRange"
    }
  ]

  // Filter configurations for owners
  const ownerFilterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" }
      ]
    },
    {
      key: "spotNumber",
      label: "Spot Number",
      type: "text"
    }
  ]

  // Filter handlers
  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleClearFilters = () => {
    setFilterValues({})
  }

  // Fetch real data based on user role
  const { data: renterBookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['/api/my-bookings'],
    enabled: !isOwnerView, // Only fetch if user is a renter
  })

  const { data: ownerListings = [], isLoading: isLoadingListings } = useQuery<SpotListing[]>({
    queryKey: ['/api/my-listings'],
    enabled: isOwnerView, // Only fetch if user is an owner
  })

  // Use appropriate data based on user role
  const mockBookings: Booking[] = isOwnerView ? [] : renterBookings
  const listings: SpotListing[] = isOwnerView ? ownerListings : []

  // Filter and sort logic for both renters and owners
  const allItems: (Booking | SpotListing)[] = isOwnerView ? listings : mockBookings

  const filteredItems = allItems.filter((item: Booking | SpotListing) => {
    // Search logic - search on fields that actually exist
    let matchesSearch = true
    if (searchTerm && searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase()
      
      if (isOwnerView) {
        // For owners (SpotListing) - search by user-facing fields
        const listing = item as any
        matchesSearch = 
          ((listing.spot?.spotNumber ?? "") as string).toLowerCase().includes(search) ||
          ((listing.spot?.location ?? "") as string).toLowerCase().includes(search) ||
          ((listing.spot?.spotType ?? "") as string).toLowerCase().includes(search) ||
          (listing.singleDate ?? "").toLowerCase().includes(search) ||
          String(listing.dailyRate ?? "").includes(search)
      } else {
        // For renters (Booking) - search by booking ID, spot ID, or date
        const booking = item as Booking
        matchesSearch = 
          (booking.id ?? "").toLowerCase().includes(search) ||
          (booking.spotId ?? "").toLowerCase().includes(search) ||
          (booking.bookingDate ?? "").toLowerCase().includes(search) ||
          String(booking.dailyRate ?? "").includes(search) ||
          (booking.notes ?? "").toLowerCase().includes(search)
      }
    }
    
    // Status filter - map filter values to actual statuses
    let matchesStatus = true
    if (filterValues.status) {
      if (isOwnerView) {
        // For owners - map filter values to actual UI statuses
        const listing = item as any
        if (filterValues.status === 'active') {
          matchesStatus = listing.status === 'available' || listing.status === 'booked'
        } else if (filterValues.status === 'completed') {
          matchesStatus = listing.status === 'used'
        } else if (filterValues.status === 'cancelled') {
          matchesStatus = listing.status === 'cancelled' || listing.status === 'unused'
        } else {
          matchesStatus = listing.status === filterValues.status
        }
      } else {
        // For renters (Booking statuses: confirmed, pending, cancelled, completed)
        const booking = item as Booking
        if (filterValues.status === 'active') {
          matchesStatus = booking.status === 'confirmed' || booking.status === 'pending'
        } else if (filterValues.status === 'completed') {
          matchesStatus = booking.status === 'completed'
        } else if (filterValues.status === 'cancelled') {
          matchesStatus = booking.status === 'cancelled'
        } else if (filterValues.status === 'payment-pending') {
          matchesStatus = booking.status === 'confirmed' && !booking.paymentReceived
        } else {
          matchesStatus = booking.status === filterValues.status
        }
      }
    }
    
    // Date range filter for renters
    let matchesDateRange = true
    if (!isOwnerView && (filterValues.dateRangeFrom || filterValues.dateRangeTo)) {
      const itemDate = 'bookingDate' in item ? item.bookingDate : null
      if (itemDate) {
        if (filterValues.dateRangeFrom && itemDate < filterValues.dateRangeFrom) {
          matchesDateRange = false
        }
        if (filterValues.dateRangeTo && itemDate > filterValues.dateRangeTo) {
          matchesDateRange = false
        }
      }
    }

    // Spot number filter for owners - search by spot.spotNumber
    let matchesSpotNumber = true
    if (isOwnerView && filterValues.spotNumber) {
      const listing = item as any
      const spotNumSearch = filterValues.spotNumber.toLowerCase()
      matchesSpotNumber = ((listing.spot?.spotNumber ?? "") as string).toLowerCase().includes(spotNumSearch)
    }
    
    return matchesSearch && matchesStatus && matchesDateRange && matchesSpotNumber
  })

  const sortedItems = [...filteredItems].sort((a: Booking | SpotListing, b: Booking | SpotListing) => {
    // Default sort by date (newest first)
    const aDate = 'bookingDate' in a ? a.bookingDate : ('singleDate' in a ? a.singleDate : null)
    const bDate = 'bookingDate' in b ? b.bookingDate : ('singleDate' in b ? b.singleDate : null)
    return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime()
  })

  // Categories for different user types
  let activeItems: (Booking | SpotListing)[], pendingItems: (Booking | SpotListing)[], paymentPendingItems: (Booking | SpotListing)[], completedItems: (Booking | SpotListing)[], cancelledItems: (Booking | SpotListing)[], unusedItems: (Booking | SpotListing)[]

  if (isOwnerView) {
    // For owners - categorize their listings using new status values
    activeItems = listings.filter((l: SpotListing) => l.status === "available" || l.status === "booked")
    pendingItems = [] // Owners don't have pending bookings in this context
    paymentPendingItems = [] // Not applicable for owners
    completedItems = listings.filter((l: SpotListing) => l.status === "used")
    cancelledItems = listings.filter((l: SpotListing) => l.status === "cancelled")
    unusedItems = listings.filter((l: SpotListing) => l.status === "unused")
  } else {
    // For renters - categorize their bookings
    const today = new Date().toISOString().split('T')[0]
    activeItems = mockBookings.filter((b: Booking) => b.status === "confirmed" && b.bookingDate >= today)
    pendingItems = mockBookings.filter((b: Booking) => b.status === "pending") 
    paymentPendingItems = mockBookings.filter((b: Booking) => b.status === "confirmed" && !b.paymentReceived && b.bookingDate >= today)
    completedItems = mockBookings.filter((b: Booking) => b.status === "completed" || (b.status === "confirmed" && b.paymentReceived && b.bookingDate < today))
    cancelledItems = mockBookings.filter((b: Booking) => b.status === "cancelled")
    unusedItems = [] // Renters don't have unused items
  }

  // Mutation for cancelling booking
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
    },
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been successfully cancelled",
        variant: "warning",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel booking. Please try again.",
        variant: "destructive",
      })
    }
  })

  const handleCancelBooking = async (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId) as any
    
    const confirmed = await confirm(confirmations.cancelBooking(
      booking ? `Spot ${booking.spotNumber || booking.spotId?.slice(-8) || 'Unknown'}` : undefined,
      booking?.bookingDate
    ))
    
    if (confirmed) {
      cancelBookingMutation.mutate(bookingId)
    }
  }

  const handleViewDetails = (item: Booking | SpotListing) => {
    if (isOwnerView) {
      setSelectedListing(item)
    } else {
      setSelectedBooking(item)
    }
    setShowViewDetails(true)
  }

  // Mutation for marking payment as received
  const markPaidMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/payment`, { 
        method: 'PATCH',
        body: { paymentReceived: true }
      })
    },
    onSuccess: () => {
      toast({
        title: "Payment Confirmed",
        description: "Booking has been marked as paid",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Payment Update Failed",
        description: error.message || "Failed to mark payment. Please try again.",
        variant: "destructive",
      })
    }
  })

  const handleMarkPaid = async (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId) as any
    const confirmed = await confirm({
      title: "Confirm Payment",
      description: `Mark payment as received for booking on ${booking?.bookingDate || 'selected date'}?`,
      confirmText: "Mark as Paid",
      cancelText: "Cancel"
    })
    
    if (confirmed) {
      markPaidMutation.mutate(bookingId)
    }
  }

  const handleDownloadReceipt = (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId) as any
    
    if (!booking) {
      toast({
        title: "Receipt Error",
        description: "Booking not found",
        variant: "destructive",
      })
      return
    }

    // Create receipt data
    const receiptData = [{
      spotNumber: booking.spotNumber || 'N/A',
      spotLocation: booking.location || 'N/A',
      renterName: user?.firstName + ' ' + user?.lastName || 'N/A',
      renterEmail: user?.email || 'N/A',
      ownerName: booking.ownerName || booking.owner || 'N/A',
      status: booking.status || 'N/A',
      dailyRate: booking.dailyRate || 0,
      bookingDate: booking.bookingDate || booking.date || 'N/A',
      paymentReceived: booking.paymentReceived || false
    }]

    quickExportBookingsPDF(receiptData, `receipt-${booking.spotNumber || bookingId}`)
    
    toast({
      title: "Receipt Downloaded",
      description: "Receipt has been downloaded successfully",
    })
  }

  const handleEditBooking = (bookingId: string) => {
    console.log('Edit booking:', bookingId)
    // Navigate to edit booking form
  }

  const handleDownloadHistory = () => {
    // Check if there's data to export
    if (sortedItems.length === 0) {
      toast({
        title: "No Data to Export",
        description: isOwnerView ? "You don't have any listings to export." : "You don't have any bookings to export.",
        variant: "destructive",
      })
      return
    }
    
    // Show export format selection dialog
    setShowExportDialog(true)
  }
  
  const handleExportPDF = () => {
    const title = isOwnerView ? 'My Spot Listings History' : 'My Booking History'
    
    // Transform data for export (both bookings and listings can be treated similarly)
    const exportData = sortedItems.map((item: any) => {
      if (isOwnerView) {
        // Owner listing data - use enriched nested fields
        return {
          id: item.id,
          spotNumber: item.spot?.spotNumber ?? 'N/A',
          spotLocation: item.spot?.location ?? 'N/A',
          spotType: item.spot?.spotType ?? 'N/A',
          renterName: item.renterName || 'Not booked',
          renterEmail: item.renterEmail || 'N/A',
          ownerName: user?.firstName + ' ' + user?.lastName || 'N/A',
          status: item.status ?? 'N/A',
          dailyRate: item.dailyRate ? `$${item.dailyRate}` : 'N/A',
          startTime: item.startTime || 'N/A',
          endTime: item.endTime || 'N/A',
          bookingDate: item.singleDate ?? item.periodStartDate ?? 'N/A',
          paymentReceived: item.paymentReceived || false
        }
      } else {
        // Renter booking data
        return {
          id: item.id,
          spotNumber: item.spotNumber || 'N/A',
          spotLocation: item.location || 'N/A',
          renterName: user?.firstName + ' ' + user?.lastName || 'N/A',
          renterEmail: user?.email || 'N/A',
          ownerName: item.ownerName || item.owner || 'N/A',
          status: item.status || 'N/A',
          dailyRate: item.dailyRate || item.price || 0,
          startTime: item.startTime || 'N/A',
          endTime: item.endTime || 'N/A',
          bookingDate: item.bookingDate || item.date || 'N/A',
          paymentReceived: item.paymentReceived || false
        }
      }
    })
    
    const success = quickExportBookingsPDF(exportData, title, (errorMessage) => {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: errorMessage
      })
    })
    
    if (success) {
      toast({
        title: "Export Successful",
        description: "PDF has been downloaded successfully"
      })
      setShowExportDialog(false)
    }
  }
  
  const handleExportExcel = () => {
    const title = isOwnerView ? 'My Spot Listings History' : 'My Booking History'
    
    // Transform data for export (both bookings and listings can be treated similarly)
    const exportData = sortedItems.map((item: any) => {
      if (isOwnerView) {
        // Owner listing data - use enriched nested fields
        return {
          id: item.id,
          spotNumber: item.spot?.spotNumber ?? 'N/A',
          spotLocation: item.spot?.location ?? 'N/A',
          spotType: item.spot?.spotType ?? 'N/A',
          renterName: item.renterName || 'Not booked',
          renterEmail: item.renterEmail || 'N/A',
          ownerName: user?.firstName + ' ' + user?.lastName || 'N/A',
          status: item.status ?? 'N/A',
          dailyRate: item.dailyRate ? `$${item.dailyRate}` : 'N/A',
          startTime: item.startTime || 'N/A',
          endTime: item.endTime || 'N/A',
          bookingDate: item.singleDate ?? item.periodStartDate ?? 'N/A',
          paymentReceived: item.paymentReceived || false
        }
      } else {
        // Renter booking data
        return {
          id: item.id,
          spotNumber: item.spotNumber || 'N/A',
          spotLocation: item.location || 'N/A',
          renterName: user?.firstName + ' ' + user?.lastName || 'N/A',
          renterEmail: user?.email || 'N/A',
          ownerName: item.ownerName || item.owner || 'N/A',
          status: item.status || 'N/A',
          dailyRate: item.dailyRate || item.price || 0,
          startTime: item.startTime || 'N/A',
          endTime: item.endTime || 'N/A',
          bookingDate: item.bookingDate || item.date || 'N/A',
          paymentReceived: item.paymentReceived || false
        }
      }
    })
    
    const success = quickExportBookingsExcel(exportData, title, (errorMessage) => {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: errorMessage
      })
    })
    
    if (success) {
      toast({
        title: "Export Successful",
        description: "Excel file has been downloaded successfully"
      })
      setShowExportDialog(false)
    }
  }

  const handleEditListing = (listing: any) => {
    setSelectedListing(listing)
    setShowEditListing(true)
  }

  const handleDeleteListing = async (listing: any) => {
    const confirmed = await confirm(confirmations.deleteListing(listing.spotNumber))
    if (confirmed) {
      deleteListingMutation.mutate(listing.id)
    }
  }


  // Mutations for listing management
  const updateListingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return apiRequest(`/api/listings/${id}`, { method: 'PATCH', body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      setShowEditListing(false)
    }
  })

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/listings/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
    }
  })

  const markPaymentMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string, paid: boolean }) => {
      return apiRequest(`/api/bookings/${id}/payment`, { method: 'PATCH', body: { paymentReceived: paid } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
    }
  })


  const handleMarkPayment = (listingId: string, currentlyPaid: boolean) => {
    markPaymentMutation.mutate({ id: listingId, paid: !currentlyPaid })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
      case "booked":
      case "used":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "pending":
      case "available":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "unused":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      default:
        return null
    }
  }

  // Owner listing with edit/delete actions (for Active tab)
  const renderOwnerListingWithActions = (listing: any) => (
    <div key={listing.id} className="border rounded-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(listing.status)}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold break-words">Spot {listing.spotNumber}</h3>
            <p className="text-sm text-muted-foreground break-words">{listing.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={listing.status === "used" || listing.status === "booked" ? "default" : 
                    listing.status === "available" ? "secondary" : 
                    listing.status === "unused" ? "destructive" : "outline"}
          >
            {listing.status}
          </Badge>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(listing)}
              data-testid={`button-view-${listing.id}`}
              title="View Bookings"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {(listing.status === "available" || listing.status === "booked") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditListing(listing)}
                  data-testid={`button-edit-listing-${listing.id}`}
                  title="Edit Listing"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteListing(listing)}
                  data-testid={`button-cancel-listing-${listing.id}`}
                  title="Cancel Listing"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 mb-3">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium truncate">{listing.date}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-xs truncate">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium truncate">
            {listing.renterName || "Not booked"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spot Type</p>
          <p className="text-sm font-medium truncate capitalize">
            {listing.spot?.spotType || "Regular"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${listing.totalAmount || listing.price}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-xs truncate">
            {listing.status === "unused" && "Listed but unused"}
            {listing.status === "used" && "Successfully rented"}
            {listing.status === "booked" && "Currently booked"}
            {listing.status === "available" && "Available for booking"}
          </p>
        </div>
      </div>
    </div>
  )

  // Owner listing with payment management (for All tab)
  const renderOwnerListingWithPayment = (listing: any) => (
    <div key={listing.id} className="border rounded-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(listing.status)}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold break-words">Spot {listing.spot?.spotNumber || 'Unknown'}</h3>
            <p className="text-sm text-muted-foreground break-words">{listing.spot?.location || 'Unknown'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={listing.status === "used" || listing.status === "booked" ? "default" : 
                    listing.status === "available" ? "secondary" : 
                    listing.status === "unused" ? "destructive" : "outline"}
          >
            {listing.status}
          </Badge>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(listing)}
              data-testid={`button-view-${listing.id}`}
              title="View Bookings"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {listing.status === "used" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMarkPayment(listing.id, listing.paymentReceived)}
                disabled={markPaymentMutation.isPending}
                data-testid={`button-payment-${listing.id}`}
                title={listing.paymentReceived ? "Mark payment as not received" : "Mark payment as received"}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 mb-3">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium truncate">{listing.date}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-xs truncate">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium truncate">
            {listing.renterName || "Not booked"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehicle</p>
          <p className="text-sm font-medium truncate">
            {listing.renterVehicle || "N/A"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${listing.totalAmount || listing.price}</p>
          {listing.status === "unused" && (
            <Badge variant="outline" className="text-xs text-orange-600">
              No revenue
            </Badge>
          )}
          {listing.paymentReceived && listing.status === "used" && (
            <Badge variant="outline" className="text-xs text-green-600">
              Paid
            </Badge>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-xs truncate">
            {listing.status === "unused" && "Listed but unused"}
            {listing.status === "used" && "Successfully rented"}
            {listing.status === "booked" && "Currently booked"}
            {listing.status === "available" && "Available for booking"}
          </p>
        </div>
      </div>
      
      {listing.status === "unused" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 break-words">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            This spot was listed for {listing.date} but was not booked by anyone.
          </div>
        </div>
      )}
    </div>
  )

  const renderRenterBooking = (booking: any) => {
    const today = new Date().toISOString().split('T')[0]
    const isActive = booking.status === "confirmed" && booking.bookingDate >= today
    const isPaymentPending = booking.status === "confirmed" && !booking.paymentReceived && booking.bookingDate >= today
    const isCompleted = booking.status === "completed" || (booking.status === "confirmed" && booking.paymentReceived && booking.bookingDate < today)
    
    return (
      <div key={booking.id} className="border rounded-lg p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(booking.status)}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold break-words">Spot {booking.spotNumber}</h3>
              <p className="text-sm text-muted-foreground break-words">{booking.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={booking.status === "confirmed" ? "default" : 
                      booking.status === "pending" ? "secondary" : "destructive"}
            >
              {booking.status}
            </Badge>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleViewDetails(booking)}
                data-testid={`button-view-details-${booking.id}`}
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelBooking(booking.id)}
                  data-testid={`button-cancel-${booking.id}`}
                  title="Cancel Booking"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
              {isPaymentPending && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkPaid(booking.id)}
                  data-testid={`button-mark-paid-${booking.id}`}
                  title="Mark as Paid"
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
              )}
              {isCompleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadReceipt(booking.id)}
                  data-testid={`button-download-receipt-${booking.id}`}
                  title="Download Receipt"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-sm font-medium truncate">{booking.bookingDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-xs truncate">Full Day</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="text-sm font-medium truncate">{booking.ownerName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Spot Type</p>
            <p className="text-sm font-medium truncate capitalize">{booking.spotType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-sm font-medium">${booking.totalAmount || booking.dailyRate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <Badge variant="outline" className="text-xs">
              {booking.paymentStatus}
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while fetching data
  if (isLoadingBookings || isLoadingListings) {
    return (
      <div className="w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-my-bookings">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm md:text-base text-muted-foreground">Loading {isOwnerView ? 'listings' : 'bookings'}...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-my-bookings">
      <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 md:h-8 md:w-8" />
            {isOwnerView ? "My Spot Listings" : "My Bookings"}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isOwnerView ? 
              "Track your parking spot listings, bookings, and usage history." :
              "Manage your current and past parking reservations."
            }
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {isOwnerView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowListingForm(true)} data-testid="button-list-spot" className="w-full md:w-auto min-h-11">
                  <Plus className="h-4 w-4 mr-2" />
                  List My Spot
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new parking spot listing to earn money from your available spaces</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleDownloadHistory} variant="outline" data-testid="button-download-history" className="w-full md:w-auto min-h-11">
                <Download className="h-4 w-4 mr-2" />
                Download History
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export your {isOwnerView ? 'listing' : 'booking'} history as a PDF or Excel file for record keeping</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {isOwnerView ? (
          <>
            {/* Owner Stats */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("active")}
                  data-testid="card-stat-active"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
                    <div className="rounded-full border-2 border-purple-400 p-2">
                      <Building className="h-4 w-4 text-purple-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeItems.length}</div>
                    <p className="text-xs text-purple-600">Currently available for booking</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view active listings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("completed")}
                  data-testid="card-stat-completed"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Spots Used</CardTitle>
                    <div className="rounded-full border-2 border-green-400 p-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{completedItems.length}</div>
                    <p className="text-xs text-green-600">Successfully rented out</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view completed listings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("all")}
                  data-testid="card-stat-negative"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Spots Unused</CardTitle>
                    <div className="rounded-full border-2 border-orange-400 p-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{unusedItems.length}</div>
                    <p className="text-xs text-orange-600">Listed but not booked</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view all listings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("all")}
                  data-testid="card-stat-money"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                    <div className="rounded-full border-2 border-blue-400 p-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${listings.filter((l: SpotListing) => l.status === "used").reduce((sum, l) => sum + Number(l.dailyRate), 0)}
                    </div>
                    <p className="text-xs text-blue-600">From completed rentals</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view all listings</p>
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {/* Renter Stats */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("active")}
                  data-testid="card-stat-active"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
                    <div className="rounded-full border-2 border-green-400 p-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeItems.length}</div>
                    <p className="text-xs text-green-600">Confirmed upcoming reservations</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view active bookings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("payment-pending")}
                  data-testid="card-stat-payment"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
                    <div className="rounded-full border-2 border-orange-400 p-2">
                      <DollarSign className="h-4 w-4 text-orange-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paymentPendingItems.length}</div>
                    <p className="text-xs text-orange-600">Awaiting payment confirmation</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view payment pending bookings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("completed")}
                  data-testid="card-stat-completed"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <div className="rounded-full border-2 border-slate-400 p-2">
                      <CheckCircle2 className="h-4 w-4 text-slate-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{completedItems.length}</div>
                    <p className="text-xs text-slate-600">Past bookings with payment</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view completed bookings</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card 
                  className="hover-elevate cursor-pointer active-elevate-2" 
                  onClick={() => setActiveTab("all")}
                  data-testid="card-stat-money"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                    <div className="rounded-full border-2 border-blue-400 p-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${mockBookings
                        .filter((b: Booking) => 
                          b.status === "completed" || 
                          (b.status === "confirmed" && b.paymentReceived)
                        )
                        .reduce((sum, b) => sum + Number(b.dailyRate || 0), 0)
                        .toFixed(2)}
                    </div>
                    <p className="text-xs text-blue-600">All-time parking expenses</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view all bookings</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Filters and Search */}
      <EnhancedFilters
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filterConfigs={isOwnerView ? ownerFilterConfigs : renterFilterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        searchPlaceholder={`Search by spot, location, or ${isOwnerView ? 'renter' : 'owner'}...`}
        className="hover-elevate"
      />

      {/* Enhanced Status-Based Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex md:grid overflow-x-auto md:overflow-x-visible flex-nowrap md:grid-cols-4 w-full h-auto gap-1">
          <TabsTrigger value="active" className="gap-2 flex-shrink-0 md:flex-shrink min-h-11" data-testid="tab-active">
            <CheckCircle2 className="h-4 w-4 !text-green-600" />
            Active ({activeItems.length})
          </TabsTrigger>
          <TabsTrigger value="payment-pending" className="gap-2 flex-shrink-0 md:flex-shrink min-h-11" data-testid="tab-payment">
            <DollarSign className="h-4 w-4 !text-orange-600" />
            Payment Pending ({paymentPendingItems.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 flex-shrink-0 md:flex-shrink min-h-11" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4 !text-slate-600" />
            Completed ({completedItems.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2 flex-shrink-0 md:flex-shrink min-h-11" data-testid="tab-all">
            <Activity className="h-4 w-4 !text-purple-600" />
            All ({sortedItems.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="w-full space-y-3 md:space-y-4">
          {activeItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <Clock className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  {isOwnerView ? "No active listings" : "No active bookings"}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {isOwnerView ? "Create a new listing to start earning from your parking spots." : "Book a parking spot to see it here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {activeItems.map((item) => (
                isOwnerView ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payment-pending" className="w-full space-y-3 md:space-y-4">
          {paymentPendingItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <CreditCard className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  No payment pending
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {isOwnerView ? "All your bookings have been paid for." : "All your booking payments are up to date."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {paymentPendingItems.map((item) => (
                isOwnerView ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="w-full space-y-3 md:space-y-4">
          {completedItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <CheckCircle className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  No completed bookings
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {isOwnerView ? "No completed bookings for your spots yet." : "You haven't completed any bookings yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {completedItems.map((item) => (
                isOwnerView ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>
        
        
        <TabsContent value="all" className="w-full space-y-3 md:space-y-4">
          {sortedItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  {isOwnerView ? "No listings found" : "No bookings found"}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Try adjusting your search or filters to find your {isOwnerView ? "listings" : "bookings"}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sortedItems.map((item) => (
                isOwnerView ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Spot Listing Dialog */}
      <Dialog open={showListingForm} onOpenChange={setShowListingForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>List Your Parking Spot</DialogTitle>
          </DialogHeader>
          <SpotListingForm onSubmit={() => setShowListingForm(false)} onCancel={() => setShowListingForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Listing Dialog */}
      <Dialog open={showEditListing} onOpenChange={setShowEditListing}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Your Listing</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <SpotListingForm 
              initialData={selectedListing}
              onSubmit={() => setShowEditListing(false)} 
              onCancel={() => setShowEditListing(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showViewDetails} onOpenChange={setShowViewDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isOwnerView ? "Listing Details" : "Booking Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isOwnerView && selectedListing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Spot Number</p>
                    <p className="font-medium">{selectedListing.spotNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedListing.status === "available" ? "secondary" : "default"}>
                      {selectedListing.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedListing.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">${selectedListing.totalAmount || selectedListing.price}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{selectedListing.location}</p>
                  </div>
                  {selectedListing.renterName && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Renter</p>
                        <p className="font-medium">{selectedListing.renterName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Vehicle</p>
                        <p className="font-medium">{selectedListing.renterVehicle || "Not specified"}</p>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : selectedBooking ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Spot Number</p>
                    <p className="font-medium">{selectedBooking.spotNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedBooking.status === "confirmed" ? "default" : "secondary"}>
                      {selectedBooking.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedBooking.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="font-medium">${selectedBooking.totalAmount || selectedBooking.price}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{selectedBooking.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Owner</p>
                    <p className="font-medium">{selectedBooking.owner}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{selectedBooking.vehicleUsed}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <Badge variant="outline">{selectedBooking.paymentStatus}</Badge>
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowViewDetails(false)} data-testid="button-close-details">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Format Selection Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export {isOwnerView ? "Listings" : "Bookings"} History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Choose the format for your export. You have {sortedItems.length} {isOwnerView ? "listing" : "booking"}{sortedItems.length !== 1 ? "s" : ""} to export.
            </p>
            <div className="grid gap-3">
              <Button 
                onClick={handleExportPDF}
                variant="outline"
                className="w-full justify-start gap-3"
                data-testid="button-export-pdf"
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Export as PDF</div>
                  <div className="text-xs text-muted-foreground">Professional formatted document</div>
                </div>
              </Button>
              <Button 
                onClick={handleExportExcel}
                variant="outline"
                className="w-full justify-start gap-3"
                data-testid="button-export-excel"
              >
                <FileText className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Export as Excel</div>
                  <div className="text-xs text-muted-foreground">Spreadsheet for data analysis</div>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowExportDialog(false)}
              data-testid="button-cancel-export"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}