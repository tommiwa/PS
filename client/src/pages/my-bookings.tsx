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
import { Calendar, Search, Filter, Download, Clock, CheckCircle, CheckCircle2, XCircle, Car, MapPin, DollarSign, AlertTriangle, Plus, Edit, Trash2, CreditCard, Info, Building, Ban, Eye, FileText, CalendarCheck, Receipt, LayoutGrid, List } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { isPastDate } from "@/utils/date-utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { Booking, SpotListing } from "@shared/schema"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { quickExportBookingsPDF, quickExportBookingsExcel, generateParkingReceiptPDF } from "@/utils/export-utils"
import { getErrorMessage } from "@/lib/error-utils"

interface MyBookingsProps {
  viewMode?: 'listings' | 'rentals';
}

export default function MyBookings({ viewMode }: MyBookingsProps) {
  const { user, isOwner, getCurrentViewRole } = useAuth()
  // Use view role for admins, otherwise use actual role
  // If viewMode is explicitly set, use that to determine the view
  // 'listings' = owner's listings (isOwnerView = true)
  // 'rentals' = owner's bookings as a renter (isOwnerView = false)
  const defaultOwnerView = getCurrentViewRole() === 'owner' || (getCurrentViewRole() === null && isOwner())
  const isOwnerView = viewMode === 'listings' ? true : viewMode === 'rentals' ? false : defaultOwnerView
  const [searchTerm, setSearchTerm] = useState("")
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const [showListingForm, setShowListingForm] = useState(false)
  const [showEditListing, setShowEditListing] = useState(false)
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [showViewDetails, setShowViewDetails] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [isCompactView, setIsCompactView] = useState(false)
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
        { value: "payment-pending", label: "Awaiting Payment" }
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
          const paymentStatus = booking.paymentStatus || 'pending'
          matchesStatus = booking.status === 'confirmed' && paymentStatus === 'pending'
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
    // For owners - categorize their listings using status and payment workflow
    const today = new Date().toISOString().split('T')[0]
    
    // Active: listings that are available OR booked for today/future (regardless of payment status)
    activeItems = listings.filter((l: any) => 
      l.status === "available" || 
      (l.status === "booked" && l.date >= today)
    )
    pendingItems = [] // Owners don't have pending bookings in this context
    
    // Payment Pending: booked listings where payment is not yet confirmed
    // - paymentStatus = 'pending' (awaiting renter payment)
    // - paymentStatus = 'paid' (awaiting owner confirmation)
    paymentPendingItems = listings.filter((l: any) => 
      l.status === "booked" && (l.paymentStatus === 'pending' || l.paymentStatus === 'paid')
    )
    
    // Completed: used listings OR listings where payment was confirmed
    completedItems = listings.filter((l: any) => 
      l.status === "used" || l.paymentStatus === 'received'
    )
    cancelledItems = listings.filter((l: SpotListing) => l.status === "cancelled")
    unusedItems = listings.filter((l: SpotListing) => l.status === "unused")
  } else {
    // For renters - categorize their bookings
    const today = new Date().toISOString().split('T')[0]
    
    // Active: confirmed bookings for today or future dates (regardless of payment status)
    activeItems = mockBookings.filter((b: Booking) => 
      b.status === "confirmed" && b.bookingDate >= today
    )
    pendingItems = mockBookings.filter((b: Booking) => b.status === "pending") 
    
    // Payment Pending: all bookings where payment is not yet confirmed by owner
    // - paymentStatus = 'pending' (awaiting renter payment)
    // - paymentStatus = 'paid' (awaiting owner confirmation)
    // Includes both active and past bookings
    paymentPendingItems = mockBookings.filter((b: Booking) => {
      const paymentStatus = b.paymentStatus || 'pending'
      return b.status === "confirmed" && (paymentStatus === 'pending' || paymentStatus === 'paid')
    })
    
    // Completed: bookings where owner has confirmed payment (paymentStatus = 'received')
    completedItems = mockBookings.filter((b: Booking) => {
      const paymentStatus = b.paymentStatus || 'pending'
      return b.status === "completed" || paymentStatus === 'received'
    })
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
        description: getErrorMessage(error, "Failed to cancel booking. Please try again."),
        variant: "destructive",
      })
    }
  })

  const handleCancelBooking = async (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId) as any
    
    // Check 24-hour cancellation policy
    const bookingDate = new Date(booking?.bookingDate + 'T00:00:00')
    const now = new Date()
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    const canCancel = hoursUntilBooking >= 24
    
    const confirmed = await confirm(confirmations.cancelBooking(
      booking ? `Spot ${booking.spotNumber || booking.spotId?.slice(-8) || 'Unknown'}` : undefined,
      booking?.bookingDate,
      canCancel
    ))
    
    if (confirmed && canCancel) {
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

  // Mutation for renter marking payment as paid (pending → paid)
  const markPaidMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/mark-paid`, { 
        method: 'POST'
      })
    },
    onSuccess: () => {
      toast({
        title: "Payment Marked as Sent",
        description: "You've marked your payment as sent. Waiting for owner to confirm receipt.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Payment Update Failed",
        description: getErrorMessage(error, "Failed to mark payment. Please try again."),
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
    // For renters: look in bookings; for owners: look in listings (which have embedded booking info)
    let booking = mockBookings.find(b => b.id === bookingId) as any
    let isOwnerReceipt = false
    
    // If not found in bookings, check listings (for owner view)
    if (!booking && isOwnerView) {
      const listing = listings.find((l: any) => l.bookingId === bookingId || l.id === bookingId) as any
      if (listing && listing.isBooked) {
        booking = {
          id: listing.bookingId || listing.id,
          spotNumber: listing.spot?.spotNumber || 'N/A',
          location: listing.spot?.location || 'N/A',
          renterName: listing.renterName || 'N/A',
          renterEmail: listing.renterEmail || 'N/A',
          status: listing.bookingStatus || listing.status || 'N/A',
          dailyRate: listing.dailyRate || listing.price || 0,
          bookingDate: listing.date || 'N/A',
          paymentStatus: listing.paymentStatus || 'pending'
        }
        isOwnerReceipt = true
      }
    }
    
    if (!booking) {
      toast({
        title: "Receipt Error",
        description: "Booking not found",
        variant: "destructive",
      })
      return
    }

    // Create receipt data - adjust based on whether it's owner or renter viewing
    const receiptData = {
      spotNumber: booking.spotNumber || 'N/A',
      spotLocation: booking.location || 'N/A',
      renterName: isOwnerReceipt ? booking.renterName : (user?.firstName + ' ' + user?.lastName || 'N/A'),
      renterEmail: isOwnerReceipt ? booking.renterEmail : (user?.email || 'N/A'),
      ownerName: isOwnerReceipt ? (user?.firstName + ' ' + user?.lastName || 'N/A') : (booking.ownerName || booking.owner || 'N/A'),
      status: booking.status || 'N/A',
      dailyRate: booking.dailyRate || 0,
      bookingDate: booking.bookingDate || booking.date || 'N/A',
      paymentStatus: booking.paymentStatus || 'pending',
      bookingId: booking.id || bookingId
    }

    generateParkingReceiptPDF(receiptData, `parking-receipt-${booking.spotNumber || bookingId}`)
    
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
          paymentStatus: item.paymentStatus || 'pending'
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
          paymentStatus: item.paymentStatus || 'pending'
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
  
  const handleExportExcel = async () => {
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
          paymentStatus: item.paymentStatus || 'pending'
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
          paymentStatus: item.paymentStatus || 'pending'
        }
      }
    })
    
    const success = await quickExportBookingsExcel(exportData, title, (errorMessage) => {
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

  // Mutation for owner confirming payment received (paid → received, status → completed)
  const markPaymentMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/confirm-payment`, { 
        method: 'POST'
      })
    },
    onSuccess: () => {
      toast({
        title: "Payment Confirmed",
        description: "Payment has been marked as received and booking is now completed.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Payment Update Failed",
        description: getErrorMessage(error, "Failed to confirm payment. Please try again."),
        variant: "destructive",
      })
    }
  })


  const handleMarkPayment = async (bookingId: string) => {
    const confirmed = await confirm({
      title: "Confirm Payment Received",
      description: "Confirm that you have received payment for this booking? This will mark the booking as completed.",
      confirmText: "Confirm Receipt",
      cancelText: "Cancel"
    })
    
    if (confirmed) {
      markPaymentMutation.mutate(bookingId)
    }
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

  // Unified Owner listing render function with proper action buttons based on status and payment
  const renderOwnerListing = (listing: any) => {
    const paymentStatus = listing.paymentStatus || null
    const today = new Date().toISOString().split('T')[0]
    const listingDate = listing.availableDate || listing.date
    const isPastDate = listingDate < today
    
    // Use isBooked from API to determine actual booking status (not just listing.status from database)
    const effectivelyBooked = listing.isBooked || listing.status === "booked"
    const isCompleted = listing.status === "used" || paymentStatus === 'received'
    const isCancelled = listing.status === "cancelled"
    
    // Action visibility rules:
    // - canEdit: Only for available listings that are NOT past, NOT booked, NOT completed, NOT cancelled
    // - canCancel: Only for available/future listings that are NOT booked, NOT completed, NOT cancelled, NOT past
    // - canConfirmPayment: Only for booked listings where renter has paid but owner hasn't confirmed
    // - showReceipt: Only for completed listings
    const canEdit = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canCancel = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canConfirmPayment = effectivelyBooked && paymentStatus === 'paid' && !isCompleted && !isCancelled
    
    // Get status badge with color - use effectivelyBooked for accurate display
    const getStatusBadge = () => {
      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        available: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Available" },
        booked: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Booked" },
        used: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        unused: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Unused" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
      }
      // If effectively booked but status says available, show as booked
      const displayStatus = effectivelyBooked && listing.status === 'available' ? 'booked' : listing.status
      const config = statusConfig[displayStatus] || statusConfig.available
      return (
        <Badge variant="outline" className={`${config.bg} ${config.text} border-0 font-medium`}>
          {config.label}
        </Badge>
      )
    }
    
    return (
      <Card key={listing.id} className="overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base">Spot {listing.spot?.spotNumber || listing.spotNumber || 'Unknown'}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{listing.spot?.location || listing.location || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {getStatusBadge()}
              </div>
            </div>
            
            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium truncate">{listing.date}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">Full Day</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Building className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Spot Type</p>
                  <p className="text-sm font-medium capitalize truncate">{listing.spot?.spotType || "Regular"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-sm font-semibold text-primary">${listing.totalAmount || listing.price || listing.dailyRate}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  {listing.renterName ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Renter</p>
                  <p className={`text-sm font-medium truncate ${listing.renterName ? '' : 'text-muted-foreground italic'}`}>
                    {listing.renterName || "Not booked yet"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Payment Status Banner (if applicable) */}
            {listing.status === "booked" && paymentStatus && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                paymentStatus === 'pending' ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                paymentStatus === 'paid' ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' :
                'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
              }`}>
                {paymentStatus === 'pending' && (
                  <>
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">Awaiting renter payment</span>
                  </>
                )}
                {paymentStatus === 'paid' && (
                  <>
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">Renter has paid - please confirm receipt</span>
                  </>
                )}
                {paymentStatus === 'received' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-300">Payment confirmed</span>
                  </>
                )}
              </div>
            )}
            
            {/* Unused Warning */}
            {listing.status === "unused" && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="text-sm text-amber-700 dark:text-amber-300">This spot was not booked for {listing.date}</span>
              </div>
            )}
          </div>
          
          {/* Actions Column */}
          <div className="lg:w-32 border-t lg:border-t-0 lg:border-l bg-muted/20 p-3 lg:p-4 flex lg:flex-col items-center lg:items-stretch justify-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewDetails(listing)}
                  data-testid={`button-view-${listing.id}`}
                  className="flex-1 lg:flex-none"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
            
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditListing(listing)}
                    data-testid={`button-edit-listing-${listing.id}`}
                    className="flex-1 lg:flex-none"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Listing</TooltipContent>
              </Tooltip>
            )}
            
            {canCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteListing(listing)}
                    data-testid={`button-cancel-listing-${listing.id}`}
                    className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel Listing</TooltipContent>
              </Tooltip>
            )}
            
            {canConfirmPayment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleMarkPayment(listing.bookingId || listing.id)}
                    disabled={markPaymentMutation.isPending}
                    data-testid={`button-confirm-payment-${listing.id}`}
                    className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Confirm</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Confirm Payment Received</TooltipContent>
              </Tooltip>
            )}
            
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReceipt(listing.bookingId || listing.id)}
                    data-testid={`button-download-receipt-${listing.id}`}
                    className="flex-1 lg:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Receipt</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download Receipt</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // Backward compatibility aliases - all use unified render function
  const renderOwnerListingWithActions = renderOwnerListing
  const renderOwnerListingWithPayment = renderOwnerListing

  const renderRenterBooking = (booking: any) => {
    const today = new Date().toISOString().split('T')[0]
    const paymentStatus = booking.paymentStatus || 'pending'
    const isPastDate = booking.bookingDate < today
    
    // Status checks
    const isCompleted = booking.status === "completed" || (booking.status === "confirmed" && paymentStatus === 'received')
    const isCancelled = booking.status === "cancelled"
    const isActive = booking.status === "confirmed" && !isPastDate && !isCompleted
    
    // 24-hour cancellation policy check
    const bookingDate = new Date(booking.bookingDate + 'T00:00:00')
    const now = new Date()
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    const canCancelWithin24Hours = hoursUntilBooking >= 24
    
    // Action visibility rules:
    // - canMarkPaid: Only for confirmed, future bookings with pending payment (not completed, not cancelled, not past)
    // - canCancel: Only for confirmed bookings that are 24+ hours away (not completed, not cancelled, not past)
    // - showReceipt: Only for completed bookings
    const canMarkPaid = booking.status === "confirmed" && paymentStatus === 'pending' && !isPastDate && !isCompleted && !isCancelled
    const canCancel = booking.status === "confirmed" && canCancelWithin24Hours && !isPastDate && !isCompleted && !isCancelled
    
    // Get status badge with color
    const getBookingStatusBadge = () => {
      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        confirmed: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Confirmed" },
        pending: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Pending" },
        completed: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
      }
      const config = statusConfig[booking.status] || statusConfig.pending
      return (
        <Badge variant="outline" className={`${config.bg} ${config.text} border-0 font-medium`}>
          {config.label}
        </Badge>
      )
    }
    
    return (
      <Card key={booking.id} className="overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base">Spot {booking.spotNumber}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{booking.location}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {getBookingStatusBadge()}
              </div>
            </div>
            
            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium truncate">{booking.bookingDate}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">Full Day</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <Building className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Spot Type</p>
                  <p className="text-sm font-medium capitalize truncate">{booking.spotType || "Regular"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-sm font-semibold text-primary">${booking.totalAmount || booking.dailyRate}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="text-sm font-medium truncate">{booking.ownerName || "N/A"}</p>
                </div>
              </div>
            </div>
            
            {/* Payment Status Banner */}
            {booking.status === "confirmed" && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                paymentStatus === 'pending' ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                paymentStatus === 'paid' ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' :
                'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
              }`}>
                {paymentStatus === 'pending' && (
                  <>
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">Payment pending - please mark as paid after transfer</span>
                  </>
                )}
                {paymentStatus === 'paid' && (
                  <>
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">Awaiting owner confirmation</span>
                  </>
                )}
                {paymentStatus === 'received' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-300">Payment confirmed by owner</span>
                  </>
                )}
              </div>
            )}
            
            {/* Cancelled Warning */}
            {isCancelled && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-300">This booking was cancelled</span>
              </div>
            )}
          </div>
          
          {/* Actions Column */}
          <div className="lg:w-32 border-t lg:border-t-0 lg:border-l bg-muted/20 p-3 lg:p-4 flex lg:flex-col items-center lg:items-stretch justify-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewDetails(booking)}
                  data-testid={`button-view-details-${booking.id}`}
                  className="flex-1 lg:flex-none"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
            
            {canMarkPaid && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleMarkPaid(booking.id)}
                    data-testid={`button-mark-paid-${booking.id}`}
                    disabled={markPaidMutation.isPending}
                    className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Pay</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as Paid</TooltipContent>
              </Tooltip>
            )}
            
            {canCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelBooking(booking.id)}
                    data-testid={`button-cancel-${booking.id}`}
                    className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel Booking</TooltipContent>
              </Tooltip>
            )}
            
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReceipt(booking.id)}
                    data-testid={`button-download-receipt-${booking.id}`}
                    className="flex-1 lg:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Receipt</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download Receipt</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // Compact row render for owner listings
  const renderOwnerListingCompact = (listing: any) => {
    const paymentStatus = listing.paymentStatus || null
    const today = new Date().toISOString().split('T')[0]
    const listingDate = listing.availableDate || listing.date
    const isPastDate = listingDate < today
    
    const effectivelyBooked = listing.isBooked || listing.status === "booked"
    const isCompleted = listing.status === "used" || paymentStatus === 'received'
    const isCancelled = listing.status === "cancelled"
    
    // Same logic as card view
    const canEdit = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canCancel = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canConfirmPayment = effectivelyBooked && paymentStatus === 'paid' && !isCompleted && !isCancelled
    
    const getStatusBadge = () => {
      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        available: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Available" },
        booked: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Booked" },
        used: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
        unused: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Unused" },
      }
      const displayStatus = effectivelyBooked && listing.status === 'available' ? 'booked' : listing.status
      const config = statusConfig[displayStatus] || statusConfig.available
      return <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-xs`}>{config.label}</Badge>
    }
    
    return (
      <div key={listing.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Car className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Spot {listing.spot?.spotNumber || listing.spotNumber || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground truncate">{listing.spot?.location || listing.locationName || 'Unknown'}</p>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">{listingDate}</div>
          <div className="hidden md:block text-sm font-medium text-primary">${listing.totalAmount || listing.price || listing.dailyRate}</div>
          <div className="flex justify-end md:justify-start">{getStatusBadge()}</div>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleViewDetails(listing)} data-testid={`compact-view-${listing.id}`}>
              <Eye className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)} data-testid={`compact-edit-${listing.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" size="icon" onClick={() => handleDeleteListing(listing)} data-testid={`compact-cancel-${listing.id}`} className="text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {canConfirmPayment && (
              <Button size="icon" onClick={() => handleMarkPayment(listing.bookingId || listing.id)} data-testid={`compact-confirm-${listing.id}`} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {isCompleted && (
              <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(listing.bookingId || listing.id)} data-testid={`compact-receipt-${listing.id}`}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Compact row render for renter bookings
  const renderRenterBookingCompact = (booking: any) => {
    const today = new Date().toISOString().split('T')[0]
    const paymentStatus = booking.paymentStatus || 'pending'
    const isPastDate = booking.bookingDate < today
    
    // Status checks - same as card view
    const isCompleted = booking.status === "completed" || (booking.status === "confirmed" && paymentStatus === 'received')
    const isCancelled = booking.status === "cancelled"
    
    // 24-hour cancellation policy check
    const bookingDate = new Date(booking.bookingDate + 'T00:00:00')
    const now = new Date()
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    const canCancelWithin24Hours = hoursUntilBooking >= 24
    
    // Same action logic as card view
    const canMarkPaid = booking.status === "confirmed" && paymentStatus === 'pending' && !isPastDate && !isCompleted && !isCancelled
    const canCancel = booking.status === "confirmed" && canCancelWithin24Hours && !isPastDate && !isCompleted && !isCancelled
    
    const getStatusBadge = () => {
      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        confirmed: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Confirmed" },
        pending: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Pending" },
        completed: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
      }
      const config = statusConfig[booking.status] || statusConfig.pending
      return <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-xs`}>{config.label}</Badge>
    }
    
    return (
      <div key={booking.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate">
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Car className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Spot {booking.spotNumber}</p>
            <p className="text-xs text-muted-foreground truncate">{booking.location}</p>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">{booking.bookingDate}</div>
          <div className="hidden md:block text-sm font-medium text-primary">${booking.totalAmount || booking.dailyRate}</div>
          <div className="flex justify-end md:justify-start">{getStatusBadge()}</div>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => handleViewDetails(booking)} data-testid={`compact-view-${booking.id}`}>
              <Eye className="h-4 w-4" />
            </Button>
            {canMarkPaid && (
              <Button size="icon" onClick={() => handleMarkPaid(booking.id)} data-testid={`compact-pay-${booking.id}`} className="bg-blue-600 hover:bg-blue-700 text-white">
                <DollarSign className="h-4 w-4" />
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" size="icon" onClick={() => handleCancelBooking(booking.id)} data-testid={`compact-cancel-${booking.id}`} className="text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {isCompleted && (
              <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(booking.id)} data-testid={`compact-receipt-${booking.id}`}>
                <Download className="h-4 w-4" />
              </Button>
            )}
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
            {isOwnerView ? "My Spot Listings" : viewMode === 'rentals' ? "My Rentals" : "My Bookings"}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isOwnerView ? 
              "Track your parking spot listings, bookings, and usage history." :
              viewMode === 'rentals' ? 
                "Spots you've booked from other owners." :
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
              <Button onClick={handleDownloadHistory} variant="outline" data-testid="button-download-history" className="hidden md:inline-flex md:w-auto min-h-11">
                <Download className="h-4 w-4 mr-2" />
                Download History
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export your {isOwnerView ? 'listing' : 'booking'} history as a PDF or Excel file for record keeping</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => setIsCompactView(!isCompactView)} 
                variant="outline" 
                size="icon"
                data-testid="button-toggle-view"
                className="hidden md:inline-flex min-h-11 min-w-11"
              >
                {isCompactView ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCompactView ? 'Switch to card view' : 'Switch to compact view'}</p>
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
                    <CardTitle className="text-sm font-medium">Awaiting Payment</CardTitle>
                    <div className="rounded-full border-2 border-orange-400 p-2">
                      <DollarSign className="h-4 w-4 text-orange-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paymentPendingItems.length}</div>
                    <p className="text-xs text-orange-600">Bookings requiring payment</p>
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
                          (b.status === "confirmed" && b.paymentStatus === "received")
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
        {/* Mobile: Scrollable tabs with fade indicators */}
        <div className="relative md:hidden">
          {/* Left fade indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          {/* Right fade indicator */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <TabsList className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full h-auto gap-1 px-4">
            <TabsTrigger value="active" className="gap-1.5 flex-shrink-0 min-h-10 px-3 snap-start" data-testid="tab-active">
              <CheckCircle2 className="h-4 w-4 !text-green-600" />
              <span>Active</span>
              <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs">{activeItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="payment-pending" className="gap-1.5 flex-shrink-0 min-h-10 px-3 snap-start" data-testid="tab-payment">
              <DollarSign className="h-4 w-4 !text-orange-600" />
              <span>{isOwnerView ? 'Confirm' : 'Pay'}</span>
              <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs">{paymentPendingItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 flex-shrink-0 min-h-10 px-3 snap-start" data-testid="tab-completed">
              <CheckCircle2 className="h-4 w-4 !text-slate-600" />
              <span>Done</span>
              <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs">{completedItems.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>
        {/* Desktop: Grid layout */}
        <TabsList className="hidden md:grid md:grid-cols-3 w-full h-auto gap-1">
          <TabsTrigger value="active" className="gap-2 min-h-11" data-testid="tab-active-desktop">
            <CheckCircle2 className="h-4 w-4 !text-green-600" />
            Active ({activeItems.length})
          </TabsTrigger>
          <TabsTrigger value="payment-pending" className="gap-2 min-h-11" data-testid="tab-payment-desktop">
            <DollarSign className="h-4 w-4 !text-orange-600" />
            {isOwnerView ? `Confirm Payment (${paymentPendingItems.length})` : `Awaiting Payment (${paymentPendingItems.length})`}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2 min-h-11" data-testid="tab-completed-desktop">
            <CheckCircle2 className="h-4 w-4 !text-slate-600" />
            Completed ({completedItems.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="w-full space-y-3 md:space-y-4">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 dark:bg-muted/20 px-3 py-2">
            <CalendarCheck className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {isOwnerView 
                ? "Your listed spots that are available for booking or have confirmed reservations." 
                : "Your confirmed bookings that are ready to use on the scheduled date."}
            </p>
          </div>
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
          ) : isCompactView ? (
            <div className="space-y-2">
              {activeItems.map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {activeItems.map((item) => (
                isOwnerView ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payment-pending" className="w-full space-y-3 md:space-y-4">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 dark:bg-muted/20 px-3 py-2">
            {isOwnerView 
              ? <Receipt className="h-4 w-4 mt-0.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              : <CreditCard className="h-4 w-4 mt-0.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            }
            <p className="text-sm text-muted-foreground">
              {isOwnerView 
                ? "Confirm when you've received payment from renters for these bookings." 
                : "Complete payment for these bookings to finalize your reservation."}
            </p>
          </div>
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
          ) : isCompactView ? (
            <div className="space-y-2">
              {paymentPendingItems.map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {paymentPendingItems.map((item) => (
                isOwnerView ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="w-full space-y-3 md:space-y-4">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 dark:bg-muted/20 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {isOwnerView 
                ? "Past bookings where your spots were used and payments received." 
                : "Your past bookings with completed payments."}
            </p>
          </div>
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
          ) : isCompactView ? (
            <div className="space-y-2">
              {completedItems.map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {completedItems.map((item) => (
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