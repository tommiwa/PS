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
import { Calendar, Search, Download, Clock, CheckCircle, CheckCircle2, XCircle, Car, MapPin, DollarSign, AlertTriangle, Plus, Edit, Trash2, CreditCard, Info, Building, Ban, Eye, FileText, CalendarCheck, Receipt, LayoutGrid, List, User, Bell, X } from "lucide-react"
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

  // Simple text search function - searches all displayed fields
  const filterBySearch = (items: (Booking | SpotListing)[]) => {
    if (!searchTerm || searchTerm.trim() === '') return items
    
    const search = searchTerm.toLowerCase()
    return items.filter((item: Booking | SpotListing) => {
      if (isOwnerView) {
        // For owners (SpotListing) - search all displayed fields:
        // Spot number, location, spot type, renter name, date, price, status
        const listing = item as any
        const spotNumber = ((listing.spot?.spotNumber ?? listing.spotNumber ?? "") as string).toLowerCase()
        const location = ((listing.spot?.location ?? listing.locationName ?? "") as string).toLowerCase()
        const spotType = ((listing.spot?.spotType ?? listing.spotType ?? "") as string).toLowerCase()
        const renterName = ((listing.renterName ?? "") as string).toLowerCase()
        const renterEmail = ((listing.renterEmail ?? "") as string).toLowerCase()
        const date = (listing.singleDate ?? listing.date ?? "").toLowerCase()
        const price = String(listing.totalAmount ?? listing.dailyRate ?? listing.price ?? "")
        const status = (listing.status ?? "").toLowerCase()
        const paymentStatus = (listing.paymentStatus ?? "").toLowerCase()
        
        return (
          spotNumber.includes(search) ||
          location.includes(search) ||
          spotType.includes(search) ||
          renterName.includes(search) ||
          renterEmail.includes(search) ||
          date.includes(search) ||
          price.includes(search) ||
          status.includes(search) ||
          paymentStatus.includes(search)
        )
      } else {
        // For renters (Booking) - search all displayed fields:
        // Spot number, location, owner name, date, spot type, price, status
        const booking = item as any
        const spotNumber = ((booking.spotNumber ?? "") as string).toLowerCase()
        const location = ((booking.location ?? "") as string).toLowerCase()
        const ownerName = ((booking.ownerName ?? "") as string).toLowerCase()
        const bookingDate = (booking.bookingDate ?? "").toLowerCase()
        const spotType = ((booking.spotType ?? "") as string).toLowerCase()
        const price = String(booking.totalAmount ?? booking.dailyRate ?? "")
        const status = (booking.status ?? "").toLowerCase()
        const paymentStatus = (booking.paymentStatus ?? "").toLowerCase()
        const notes = ((booking.notes ?? "") as string).toLowerCase()
        
        return (
          spotNumber.includes(search) ||
          location.includes(search) ||
          ownerName.includes(search) ||
          bookingDate.includes(search) ||
          spotType.includes(search) ||
          price.includes(search) ||
          status.includes(search) ||
          paymentStatus.includes(search) ||
          notes.includes(search)
        )
      }
    })
  }

  const sortItems = (items: (Booking | SpotListing)[]) => {
    return [...items].sort((a: Booking | SpotListing, b: Booking | SpotListing) => {
      // Default sort by date (newest first)
      const aDate = 'bookingDate' in a ? a.bookingDate : ('singleDate' in a ? a.singleDate : null)
      const bDate = 'bookingDate' in b ? b.bookingDate : ('singleDate' in b ? b.singleDate : null)
      return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime()
    })
  }

  // Categories for different user types
  let activeItems: (Booking | SpotListing)[], pendingItems: (Booking | SpotListing)[], paymentPendingItems: (Booking | SpotListing)[], completedItems: (Booking | SpotListing)[], cancelledItems: (Booking | SpotListing)[], unusedItems: (Booking | SpotListing)[]

  if (isOwnerView) {
    // For owners - categorize their listings using status and payment workflow
    const today = new Date().toISOString().split('T')[0]
    
    // Helper to get listing date
    const getListingDate = (l: any) => l.date || l.singleDate || ''
    
    // Active: ONLY current/future dates that are AVAILABLE (open for booking, not yet booked)
    // Once booked, it moves to the second tab
    activeItems = listings.filter((l: any) => {
      const listingDate = getListingDate(l)
      const isFutureOrToday = listingDate >= today
      const isAvailable = l.status === "available" && !l.isBooked
      return isAvailable && isFutureOrToday
    })
    pendingItems = [] // Owners don't have pending bookings in this context
    
    // Waiting Payment / Past: Shows:
    // 1. All booked listings (any date) - waiting for payment or awaiting confirmation
    // 2. Expired/past date listings that weren't booked
    // EXCLUDES: completed items (status === 'used' OR paymentStatus === 'received')
    paymentPendingItems = listings.filter((l: any) => {
      const listingDate = getListingDate(l)
      const isPastDate = listingDate < today
      const isBooked = l.status === "booked" || l.isBooked
      const isExpiredAvailable = l.status === "available" && isPastDate && !l.isBooked
      
      // Exclude completed items from this tab
      const isCompleted = l.status === "used" || l.paymentStatus === 'received'
      if (isCompleted) return false
      
      // Include if booked (any date) OR if expired available (past date, not booked)
      return isBooked || isExpiredAvailable
    })
    
    // Completed: used listings OR listings where payment was confirmed
    completedItems = listings.filter((l: any) => 
      l.status === "used" || l.paymentStatus === 'received'
    )
    cancelledItems = listings.filter((l: SpotListing) => l.status === "cancelled")
    unusedItems = listings.filter((l: SpotListing) => l.status === "unused")
  } else {
    // For renters - categorize their bookings by payment workflow
    const today = new Date().toISOString().split('T')[0]
    
    // Active: confirmed bookings where payment is PENDING (not yet marked as paid by renter)
    // These require the renter to mark as paid after transfer
    activeItems = mockBookings.filter((b: Booking) => {
      const paymentStatus = b.paymentStatus || 'pending'
      return b.status === "confirmed" && paymentStatus === 'pending'
    })
    pendingItems = mockBookings.filter((b: Booking) => b.status === "pending") 
    
    // Awaiting Payment: bookings where renter has marked as PAID but waiting for owner confirmation
    // Renter can send reminder to owner to confirm payment
    paymentPendingItems = mockBookings.filter((b: Booking) => {
      const paymentStatus = b.paymentStatus || 'pending'
      return b.status === "confirmed" && paymentStatus === 'paid'
    })
    
    // Completed: bookings where owner has confirmed payment (paymentStatus = 'received')
    completedItems = mockBookings.filter((b: Booking) => {
      const paymentStatus = b.paymentStatus || 'pending'
      return b.status === "completed" || paymentStatus === 'received'
    })
    cancelledItems = mockBookings.filter((b: Booking) => b.status === "cancelled")
    unusedItems = [] // Renters don't have unused items
  }

  // Combined sorted items for export functionality
  const sortedItems = sortItems(allItems)

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
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
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
      title: "Confirm Payment Sent",
      description: `Mark payment as sent to spot owner for booking on ${booking?.bookingDate || 'selected date'}?`,
      confirmText: "Mark as Sent",
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

  const handleCancelListing = async (listing: any) => {
    const confirmed = await confirm({
      title: "Cancel Listing",
      description: `Are you sure you want to cancel this listing for Spot ${listing.spotNumber || listing.spot?.spotNumber} on ${listing.date}? This will mark it as cancelled.`,
      confirmText: "Yes, Cancel",
      cancelText: "Keep Listing"
    })
    if (confirmed) {
      cancelListingMutation.mutate(listing.id)
    }
  }

  // Mutations for listing management
  const updateListingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return apiRequest(`/api/listings/${id}`, { method: 'PATCH', body: data })
    },
    onSuccess: () => {
      toast({
        title: "Listing Updated",
        description: "Your listing has been updated successfully.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
      setShowEditListing(false)
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: getErrorMessage(error, "Failed to update listing. Please try again."),
        variant: "destructive",
      })
    }
  })

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/listings/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      toast({
        title: "Listing Deleted",
        description: "The unused listing has been removed.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: getErrorMessage(error, "Only unused listings can be deleted."),
        variant: "destructive",
      })
    }
  })

  // Mutation for cancelling a listing (sets status to "cancelled")
  const cancelListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/listings/${id}`, { 
        method: 'PATCH', 
        body: { status: 'cancelled' } 
      })
    },
    onSuccess: () => {
      toast({
        title: "Listing Cancelled",
        description: "The listing has been cancelled.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: getErrorMessage(error, "Failed to cancel the listing."),
        variant: "destructive",
      })
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


  const handleMarkPayment = async (bookingId: string, bookingDate?: string) => {
    const confirmed = await confirm({
      title: "Confirm Payment Received",
      description: `Mark payment as received for booking on ${bookingDate || 'selected date'}? This will mark the booking as completed.`,
      confirmText: "Confirm Receipt",
      cancelText: "Cancel"
    })
    
    if (confirmed) {
      markPaymentMutation.mutate(bookingId)
    }
  }

  // Mutation for sending payment reminder notification
  const sendPaymentReminderMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/payment-reminder`, { 
        method: 'POST'
      })
    },
    onSuccess: () => {
      toast({
        title: "Reminder Sent",
        description: "Payment reminder has been sent to the renter.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: getErrorMessage(error, "Could not send payment reminder. Please try again."),
        variant: "destructive",
      })
    }
  })

  const handleSendPaymentReminder = async (bookingId: string, renterName: string) => {
    const confirmed = await confirm({
      title: "Send Payment Reminder",
      description: `Send a payment reminder notification to ${renterName}?`,
      confirmText: "Send Reminder",
      cancelText: "Cancel"
    })
    
    if (confirmed) {
      sendPaymentReminderMutation.mutate(bookingId)
    }
  }

  // Mutation for renter to notify owner to confirm payment (paid → waiting for confirmation)
  const notifyOwnerMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return apiRequest(`/api/bookings/${bookingId}/notify-owner`, { 
        method: 'POST'
      })
    },
    onSuccess: () => {
      toast({
        title: "Reminder Sent",
        description: "A reminder has been sent to the spot owner to confirm your payment.",
      })
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: getErrorMessage(error, "Could not send reminder to owner. Please try again."),
        variant: "destructive",
      })
    }
  })

  const handleNotifyOwner = async (bookingId: string, ownerName: string) => {
    const confirmed = await confirm({
      title: "Send Confirmation Reminder",
      description: `Send a reminder to ${ownerName} to confirm they received your payment?`,
      confirmText: "Send Reminder",
      cancelText: "Cancel"
    })
    
    if (confirmed) {
      notifyOwnerMutation.mutate(bookingId)
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
    // IMPORTANT: "unused" status means the listing expired without being booked - never show as booked
    const isUnused = listing.status === "unused"
    const effectivelyBooked = !isUnused && (listing.isBooked || listing.status === "booked")
    const isCompleted = listing.status === "used" || paymentStatus === 'received'
    const isCancelled = listing.status === "cancelled"
    
    // Action visibility rules:
    // - canEdit: Only for available listings that are NOT past, NOT booked, NOT completed, NOT cancelled
    // - canCancel: Only for available/future listings that are NOT booked, NOT completed, NOT cancelled, NOT past
    // - canNotify: Booked but payment pending - can send reminder to renter
    // - canConfirmPayment: Only for booked listings where renter has paid but owner hasn't confirmed
    // - showReceipt: Only for completed listings
    const canEdit = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canCancel = listing.status === "available" && !isPastDate && !effectivelyBooked && !isCompleted && !isCancelled
    const canNotify = effectivelyBooked && (paymentStatus === 'pending' || !paymentStatus) && !isCompleted && !isCancelled
    const canConfirmPayment = effectivelyBooked && paymentStatus === 'paid' && !isCompleted && !isCancelled
    
    // Get status badge with color - prioritize isCompleted for consistent display
    const getStatusBadge = () => {
      const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
        available: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", label: "Available" },
        booked: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Booked" },
        completed: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        used: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        unused: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Unused" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
      }
      // Prioritize: completed > cancelled > booked > available
      let displayStatus = listing.status
      if (isCompleted) {
        displayStatus = 'completed'
      } else if (effectivelyBooked && listing.status === 'available') {
        displayStatus = 'booked'
      }
      const config = statusConfig[displayStatus] || statusConfig.available
      return (
        <Badge variant="outline" className={`${config.bg} ${config.text} border-0 font-medium`}>
          {config.label}
        </Badge>
      )
    }
    
    // Determine card accent color based on status
    const getCardAccentColor = () => {
      if (isCancelled) return 'border-l-4 border-l-red-400'
      if (isCompleted) return 'border-l-4 border-l-slate-400'
      if (listing.status === 'unused') return 'border-l-4 border-l-amber-400'
      if (effectivelyBooked) {
        if (paymentStatus === 'paid') return 'border-l-4 border-l-blue-500' // Awaiting confirmation
        if (paymentStatus === 'pending') return 'border-l-4 border-l-amber-500' // Awaiting payment
        return 'border-l-4 border-l-blue-400' // Booked
      }
      return 'border-l-4 border-l-emerald-400' // Available
    }

    return (
      <Card key={listing.id} className={`overflow-hidden ${getCardAccentColor()}`}>
        <div className="flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 p-4">
            {/* Header Row - Spot info and status */}
            <div className="flex items-start justify-between gap-3 mb-3">
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
            
            {/* Primary Focus: Booking Status & Renter */}
            <div className="p-3 rounded-lg mb-3 bg-muted/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {isUnused ? (
                    <>
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                        <p className="text-lg font-bold text-amber-700">Expired - Not Booked</p>
                      </div>
                    </>
                  ) : effectivelyBooked || isCompleted ? (
                    <>
                      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-foreground/70" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          {isCompleted ? "Rented To" : "Booked By"}
                        </p>
                        <p className="text-lg font-bold">{listing.renterName || "Unknown Renter"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-foreground/60" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                        <p className="text-lg font-bold">Open for Booking</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{isCompleted ? "You Earned" : isUnused ? "Listed At" : "You'll Earn"}</p>
                  <p className="text-xl font-bold text-primary">${listing.totalAmount || listing.price || listing.dailyRate}</p>
                </div>
              </div>
            </div>
            
            {/* Secondary Info - Date and details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{listing.date}</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span>Full Day</span>
              <span className="hidden sm:inline">•</span>
              <span className="capitalize">{listing.spot?.spotType || "Regular"}</span>
            </div>
            
            {/* Payment Status Banner (if applicable) - only for actually booked items, not unused */}
            {!isUnused && (effectivelyBooked || isCompleted) && paymentStatus && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                paymentStatus === 'pending' ? 'bg-amber-50 border border-amber-200' :
                paymentStatus === 'paid' ? 'bg-blue-50 border border-blue-200' :
                'bg-green-50 border border-green-200'
              }`}>
                {paymentStatus === 'pending' && (
                  <>
                    <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm text-amber-700">Awaiting renter payment</span>
                  </>
                )}
                {paymentStatus === 'paid' && (
                  <>
                    <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-blue-700">Renter has paid - please confirm receipt</span>
                  </>
                )}
                {paymentStatus === 'received' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700">Payment confirmed</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Actions Column */}
          <div className="lg:w-32 border-t lg:border-t-0 lg:border-l bg-muted/20 p-3 lg:p-4 flex lg:flex-col items-center lg:items-stretch justify-center gap-2">
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
                    onClick={() => handleCancelListing(listing)}
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
            
            {canNotify && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendPaymentReminder(listing.bookingId || listing.id, listing.renterName || "Renter")}
                    disabled={sendPaymentReminderMutation.isPending}
                    data-testid={`button-notify-${listing.id}`}
                    className="flex-1 lg:flex-none text-amber-600 hover:text-amber-700"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Notify</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send Payment Reminder</TooltipContent>
              </Tooltip>
            )}
            
            {canConfirmPayment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkPayment(listing.bookingId || listing.id, listing.date)}
                    disabled={markPaymentMutation.isPending}
                    data-testid={`button-confirm-payment-${listing.id}`}
                    className="flex-1 lg:flex-none text-green-600 hover:text-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Confirm</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Confirm Payment Received</TooltipContent>
              </Tooltip>
            )}
            
            {listing.status === "unused" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteListing(listing)}
                    data-testid={`button-delete-unused-${listing.id}`}
                    className="flex-1 lg:flex-none text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Unused Listing</TooltipContent>
              </Tooltip>
            )}
            
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
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
    // - canMarkPaid: Only for confirmed bookings with pending payment (not completed, not cancelled)
    // - canNotifyOwner: Only for confirmed bookings where payment is 'paid' (awaiting owner confirmation)
    // - canCancel: Only for confirmed bookings that are 24+ hours away (not completed, not cancelled, not past)
    // - showReceipt: Only for completed bookings
    const canMarkPaid = booking.status === "confirmed" && paymentStatus === 'pending' && !isCompleted && !isCancelled
    const canNotifyOwner = booking.status === "confirmed" && paymentStatus === 'paid' && !isCompleted && !isCancelled
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
    
    // Determine card accent color based on status
    const getCardAccentColor = () => {
      if (isCancelled) return 'border-l-4 border-l-red-400'
      if (isCompleted) return 'border-l-4 border-l-slate-400'
      if (paymentStatus === 'paid') return 'border-l-4 border-l-blue-500' // Paid, awaiting confirmation
      if (paymentStatus === 'pending') return 'border-l-4 border-l-amber-500' // Pending payment
      if (isActive) return 'border-l-4 border-l-emerald-400' // Active/confirmed
      return 'border-l-4 border-l-blue-400'
    }

    return (
      <Card key={booking.id} className={`overflow-hidden ${getCardAccentColor()}`}>
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
            
            {/* Payment/Booking Status Banner */}
            {booking.status === "confirmed" && (
              <div className={`mt-4 p-3 rounded-lg flex items-center justify-between gap-3 ${
                paymentStatus === 'pending' ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                paymentStatus === 'paid' ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' :
                'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
              }`}>
                <div className="flex items-center gap-3">
                  {paymentStatus === 'pending' && (
                    <>
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-sm text-amber-700 dark:text-amber-300">Payment pending - please mark as paid after transfer</span>
                    </>
                  )}
                  {paymentStatus === 'paid' && (
                    <>
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">Payment sent - awaiting owner confirmation</span>
                    </>
                  )}
                  {paymentStatus === 'received' && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-sm text-green-700 dark:text-green-300">Booking confirmed - Ready to use on scheduled date</span>
                    </>
                  )}
                </div>
                {paymentStatus === 'pending' && canMarkPaid && (
                  <Button
                    size="sm"
                    onClick={() => handleMarkPaid(booking.id)}
                    disabled={markPaidMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </Button>
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
            {/* Mark as Paid - First action for active bookings */}
            {canMarkPaid && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkPaid(booking.id)}
                    data-testid={`button-mark-paid-${booking.id}`}
                    disabled={markPaidMutation.isPending}
                    className="flex-1 lg:flex-none text-amber-600 hover:text-amber-700"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Mark as Paid</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark payment as sent to owner after completing transfer</TooltipContent>
              </Tooltip>
            )}
            
            {/* View Details - Always available */}
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
              <TooltipContent>View booking details and payment information</TooltipContent>
            </Tooltip>
            
            {/* Cancel - For active bookings 24+ hours away */}
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
                <TooltipContent>Cancel this booking (available 24+ hours before)</TooltipContent>
              </Tooltip>
            )}
            
            {/* Notify Owner - For awaiting payment confirmation */}
            {canNotifyOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNotifyOwner(booking.id, booking.ownerName || 'Owner')}
                    data-testid={`button-notify-owner-${booking.id}`}
                    disabled={notifyOwnerMutation.isPending}
                    className="flex-1 lg:flex-none text-blue-600 hover:text-blue-700"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Notify</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send reminder to owner to confirm payment receipt</TooltipContent>
              </Tooltip>
            )}
            
            {/* Receipt - For completed bookings */}
            {isCompleted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadReceipt(booking.id)}
                    data-testid={`button-download-receipt-${booking.id}`}
                    className="flex-1 lg:flex-none"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Receipt</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download payment receipt for this booking</TooltipContent>
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
    
    // IMPORTANT: "unused" status means the listing expired without being booked - never show as booked
    const isUnused = listing.status === "unused"
    const effectivelyBooked = !isUnused && (listing.isBooked || listing.status === "booked")
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
        completed: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        used: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Completed" },
        cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
        unused: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Unused" },
      }
      // Prioritize: completed > cancelled > booked > available
      let displayStatus = listing.status
      if (isCompleted) {
        displayStatus = 'completed'
      } else if (effectivelyBooked && listing.status === 'available') {
        displayStatus = 'booked'
      }
      const config = statusConfig[displayStatus] || statusConfig.available
      return <Badge variant="outline" className={`${config.bg} ${config.text} border-0 text-xs`}>{config.label}</Badge>
    }
    
    // Determine row accent color based on status
    const getRowAccentColor = () => {
      if (isCancelled) return 'border-l-4 border-l-red-400'
      if (isCompleted) return 'border-l-4 border-l-slate-400'
      if (listing.status === 'unused') return 'border-l-4 border-l-amber-400'
      if (effectivelyBooked) {
        if (paymentStatus === 'paid') return 'border-l-4 border-l-blue-500'
        if (paymentStatus === 'pending') return 'border-l-4 border-l-amber-500'
        return 'border-l-4 border-l-blue-400'
      }
      return 'border-l-4 border-l-emerald-400'
    }

    return (
      <div key={listing.id} className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate ${getRowAccentColor()}`}>
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Car className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
          {/* Spot Info */}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">Spot {listing.spot?.spotNumber || listing.spotNumber || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground truncate">{listing.spot?.location || listing.locationName || 'Unknown'}</p>
          </div>
          {/* Date */}
          <div className="hidden md:block text-sm text-muted-foreground">{listingDate}</div>
          {/* Renter - EMPHASIZED */}
          <div className="hidden md:block min-w-0">
            {isUnused ? (
              <p className="text-sm font-medium text-amber-600">Expired</p>
            ) : effectivelyBooked || isCompleted ? (
              <p className="text-sm font-semibold text-foreground truncate">{listing.renterName || "Renter"}</p>
            ) : (
              <p className="text-sm text-blue-500 font-medium">Open</p>
            )}
          </div>
          {/* Price */}
          <div className="hidden md:block text-sm font-medium text-primary">${listing.totalAmount || listing.price || listing.dailyRate}</div>
          {/* Actions */}
          <div className="flex justify-end gap-1 col-span-1 md:col-span-1">
            {getStatusBadge()}
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)} data-testid={`compact-edit-${listing.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" size="icon" onClick={() => handleCancelListing(listing)} data-testid={`compact-cancel-${listing.id}`} className="text-destructive hover:text-destructive">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            {canConfirmPayment && (
              <Button variant="ghost" size="icon" onClick={() => handleMarkPayment(listing.bookingId || listing.id, listing.date)} data-testid={`compact-confirm-${listing.id}`} className="text-green-600 hover:text-green-700">
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
    
    // Determine row accent color based on status
    const isActive = booking.status === "confirmed" && !isPastDate && !isCompleted
    const getRowAccentColor = () => {
      if (isCancelled) return 'border-l-4 border-l-red-400'
      if (isCompleted) return 'border-l-4 border-l-slate-400'
      if (paymentStatus === 'paid') return 'border-l-4 border-l-blue-500'
      if (paymentStatus === 'pending') return 'border-l-4 border-l-amber-500'
      if (isActive) return 'border-l-4 border-l-emerald-400'
      return 'border-l-4 border-l-blue-400'
    }

    return (
      <div key={booking.id} className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate ${getRowAccentColor()}`}>
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
              <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(booking.id)} data-testid={`compact-pay-${booking.id}`} className="text-blue-600 hover:text-blue-700">
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
                  onClick={() => setActiveTab("payment-pending")}
                  data-testid="card-stat-pending"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Awaiting Confirmation</CardTitle>
                    <div className="rounded-full border-2 border-amber-400 p-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{paymentPendingItems.length}</div>
                    <p className="text-xs text-amber-600">Pending payment confirmation</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to view pending confirmations</p>
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
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder={`Search by spot, location${isOwnerView ? ', renter' : ''}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 w-full"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-7 w-7 z-10"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-amber-50 border-amber-200 px-3 py-2">
            <Info className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              {isOwnerView 
                ? "Your listed spots that are available for booking. Create new listings to earn from your parking spots." 
                : "Bookings awaiting your payment. After transferring payment to the owner, click 'Mark as Paid' to notify them."}
            </p>
          </div>
          {filterBySearch(activeItems).length === 0 ? (
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
              {sortItems(filterBySearch(activeItems)).map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sortItems(filterBySearch(activeItems)).map((item) => (
                isOwnerView ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payment-pending" className="w-full space-y-3 md:space-y-4">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder={`Search by spot, location${isOwnerView ? ', renter' : ''}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 w-full"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-7 w-7 z-10"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-blue-50 border-blue-200 px-3 py-2">
            <Info className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              {isOwnerView 
                ? "Confirm when you've received payment from renters for these bookings." 
                : "Payment sent - waiting for owner to confirm receipt. You can send a reminder if needed."}
            </p>
          </div>
          {filterBySearch(paymentPendingItems).length === 0 ? (
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
              {sortItems(filterBySearch(paymentPendingItems)).map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sortItems(filterBySearch(paymentPendingItems)).map((item) => (
                isOwnerView ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="w-full space-y-3 md:space-y-4">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder={`Search by spot, location${isOwnerView ? ', renter' : ''}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 w-full"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 h-7 w-7 z-10"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-green-50 border-green-200 px-3 py-2">
            <Info className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">
              {isOwnerView 
                ? "Past bookings where your spots were used and payments received." 
                : "Completed bookings with confirmed payments. Download receipts for your records."}
            </p>
          </div>
          {filterBySearch(completedItems).length === 0 ? (
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
              {sortItems(filterBySearch(completedItems)).map((item) => (
                isOwnerView ? renderOwnerListingCompact(item) : renderRenterBookingCompact(item)
              ))}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sortItems(filterBySearch(completedItems)).map((item) => (
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