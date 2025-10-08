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
import { Calendar, Search, Filter, Download, Clock, CheckCircle, XCircle, Car, MapPin, DollarSign, AlertTriangle, Plus, Edit, Trash2, CreditCard, Info } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { isPastDate } from "@/utils/date-utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import type { Booking, SpotListing } from "@shared/schema"
import { useConfirm, confirmations } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"

export default function MyBookings() {
  const { user, isOwner } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showListingForm, setShowListingForm] = useState(false)
  const [showEditListing, setShowEditListing] = useState(false)
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("active")
  const { confirm } = useConfirm()
  const { toast } = useToast()

  // Fetch real data based on user role
  const { data: renterBookings = [], isLoading: isLoadingBookings } = useQuery<Booking[]>({
    queryKey: ['/api/my-bookings'],
    enabled: !isOwner(), // Only fetch if user is a renter
  })

  const { data: ownerListings = [], isLoading: isLoadingListings } = useQuery<SpotListing[]>({
    queryKey: ['/api/my-listings'],
    enabled: isOwner(), // Only fetch if user is an owner
  })

  // Use appropriate data based on user role
  const mockBookings: Booking[] = isOwner() ? [] : renterBookings
  const listings: SpotListing[] = isOwner() ? ownerListings : []

  // Filter and sort logic for both renters and owners
  const allItems: (Booking | SpotListing)[] = isOwner() ? listings : mockBookings

  const filteredItems = allItems.filter((item: Booking | SpotListing) => {
    // Handle different property names between Booking and SpotListing
    const spotInfo = 'spotId' in item ? 'Spot Info' : 'Spot Info' // Placeholder for now
    const location = 'location' in item ? (item as any).location : 'Location' // Placeholder for now
    
    const matchesSearch = searchTerm === '' || 
                         spotInfo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         location.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || item.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const sortedItems = [...filteredItems].sort((a: Booking | SpotListing, b: Booking | SpotListing) => {
    switch (sortBy) {
      case "date":
        const aDate = 'bookingDate' in a ? a.bookingDate : ('singleDate' in a ? a.singleDate : null)
        const bDate = 'bookingDate' in b ? b.bookingDate : ('singleDate' in b ? b.singleDate : null)
        return new Date(bDate || 0).getTime() - new Date(aDate || 0).getTime()
      case "price":
        const aPrice = Number(a.dailyRate) || 0
        const bPrice = Number(b.dailyRate) || 0
        return bPrice - aPrice
      case "location":
        // Both types have spot reference, simplified for now
        return 0
      default:
        return 0
    }
  })

  // Categories for different user types
  let activeItems: (Booking | SpotListing)[], pendingItems: (Booking | SpotListing)[], paymentPendingItems: (Booking | SpotListing)[], completedItems: (Booking | SpotListing)[], cancelledItems: (Booking | SpotListing)[], unusedItems: (Booking | SpotListing)[]

  if (isOwner()) {
    // For owners - categorize their listings
    activeItems = listings.filter((l: SpotListing) => l.status === "active")
    pendingItems = [] // Owners don't have pending bookings in this context
    paymentPendingItems = listings.filter((l: SpotListing) => l.status === "expired" && !('paymentReceived' in l && (l as any).paymentReceived))
    completedItems = listings.filter((l: SpotListing) => l.status === "expired" && ('paymentReceived' in l && (l as any).paymentReceived)) // Fully completed with payment
    cancelledItems = listings.filter((l: SpotListing) => l.status === "cancelled")
    unusedItems = listings.filter((l: SpotListing) => l.status === "paused") // Paused spots that were not used
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

  const handleCancelBooking = async (bookingId: string) => {
    const booking = mockBookings.find(b => b.id === bookingId)
    
    const confirmed = await confirm(confirmations.cancelBooking(
      booking ? `Spot ${booking.spotId?.slice(-8) || 'Unknown'}` : undefined,
      booking?.bookingDate
    ))
    
    if (confirmed) {
      console.log('Cancel booking:', bookingId)
      // TODO: Implement actual booking cancellation logic
      toast({
        title: "Booking Cancelled",
        description: `Successfully cancelled booking for ${booking?.bookingDate || 'selected date'}`,
        variant: "warning",
      })
    }
  }

  const handleEditBooking = (bookingId: string) => {
    console.log('Edit booking:', bookingId)
    // Navigate to edit booking form
  }

  const handleDownloadHistory = () => {
    console.log('Download booking history')
    // Generate and download booking history report
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Badge 
            variant={listing.status === "used" || listing.status === "booked" ? "default" : 
                    listing.status === "available" ? "secondary" : 
                    listing.status === "unused" ? "destructive" : "outline"}
            className="w-full sm:w-auto justify-center"
          >
            {listing.status}
          </Badge>
          {(listing.status === "available" || listing.status === "booked") && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEditListing(listing)}
                    data-testid={`button-edit-listing-${listing.id}`}
                    className="min-h-11 flex-1 sm:flex-initial"
                  >
                    <Edit className="h-4 w-4 sm:mr-0 mr-2" />
                    <span className="sm:hidden">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit listing details including price, availability, and spot information</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteListing(listing)}
                    className="text-red-600 hover:text-red-700 hover:border-red-300 min-h-11 flex-1 sm:flex-initial"
                    data-testid={`button-delete-listing-${listing.id}`}
                  >
                    <Trash2 className="h-4 w-4 sm:mr-0 mr-2" />
                    <span className="sm:hidden">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Permanently remove this listing - action cannot be undone</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium break-words">{listing.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium break-words">
            {listing.renterName || "Not booked"}
          </p>
          {listing.renterVehicle && (
            <p className="text-xs text-muted-foreground break-words">{listing.renterVehicle}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${listing.price}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium break-words">
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
            <h3 className="font-semibold break-words">Spot {listing.spotNumber}</h3>
            <p className="text-sm text-muted-foreground break-words">{listing.location}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Badge 
            variant={listing.status === "used" || listing.status === "booked" ? "default" : 
                    listing.status === "available" ? "secondary" : 
                    listing.status === "unused" ? "destructive" : "outline"}
            className="w-full sm:w-auto justify-center"
          >
            {listing.status}
          </Badge>
          {listing.status === "used" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={listing.paymentReceived ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleMarkPayment(listing.id, listing.paymentReceived)}
                  disabled={markPaymentMutation.isPending}
                  data-testid={`button-payment-${listing.id}`}
                  className="w-full sm:w-auto min-h-11"
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  {listing.paymentReceived ? "Unmark" : "Mark Paid"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{listing.paymentReceived ? "Mark payment as not received" : "Confirm you have received payment from the renter"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium break-words">{listing.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium break-words">
            {listing.renterName || "Not booked"}
          </p>
          {listing.renterVehicle && (
            <p className="text-xs text-muted-foreground break-words">{listing.renterVehicle}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${listing.price}</p>
          {listing.status === "unused" && (
            <Badge variant="outline" className="text-xs text-orange-600">
              No revenue
            </Badge>
          )}
          {listing.paymentReceived && listing.status === "used" && (
            <Badge variant="outline" className="text-xs text-green-600">
              Payment received
            </Badge>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium break-words">
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

  const renderRenterBooking = (booking: any) => (
    <div key={booking.id} className="border rounded-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(booking.status)}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold break-words">Spot {booking.spotNumber}</h3>
            <p className="text-sm text-muted-foreground break-words">{booking.location}</p>
          </div>
        </div>
        <Badge 
          variant={booking.status === "confirmed" ? "default" : 
                  booking.status === "pending" ? "secondary" : "destructive"}
          className="w-full sm:w-auto justify-center"
        >
          {booking.status}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium break-words">{booking.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Owner</p>
          <p className="text-sm font-medium break-words">{booking.owner}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehicle</p>
          <p className="text-sm font-medium break-words">{booking.vehicleUsed}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${booking.price}</p>
          <Badge variant="outline" className="text-xs">
            {booking.paymentStatus}
          </Badge>
        </div>
      </div>
      
      {(booking.canCancel || booking.canEdit) && (
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          {booking.canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleEditBooking(booking.id)}
                  data-testid={`button-edit-${booking.id}`}
                  className="w-full sm:w-auto sm:flex-1 min-h-11"
                >
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Modify booking details such as date, time, or vehicle information</p>
              </TooltipContent>
            </Tooltip>
          )}
          {booking.canCancel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleCancelBooking(booking.id)}
                  data-testid={`button-cancel-${booking.id}`}
                  className="w-full sm:w-auto sm:flex-1 min-h-11"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cancel this reservation - may be subject to cancellation fees</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )

  // Show loading state while fetching data
  if (isLoadingBookings || isLoadingListings) {
    return (
      <div className="w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-4 md:space-y-6" data-testid="page-my-bookings">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm md:text-base text-muted-foreground">Loading {isOwner() ? 'listings' : 'bookings'}...</p>
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
            {isOwner() ? "My Spot Listings" : "My Bookings"}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isOwner() ? 
              "Track your parking spot listings, bookings, and usage history." :
              "Manage your current and past parking reservations."
            }
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          {isOwner() && (
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
              <p>Export your {isOwner() ? 'listing' : 'booking'} history as a PDF or Excel file for record keeping</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate" data-testid="card-stat-active">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Active Listings" : "Active Bookings"}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-muted-foreground"
                  data-testid="info-button-stat-active"
                >
                  <Info className="h-3 w-3" />
                  <span className="sr-only">Info about {isOwner() ? "active listings" : "active bookings"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isOwner() ? 
                  "Number of parking spots currently available for booking by renters" : 
                  "Your confirmed reservations for upcoming dates"}
                </p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeItems.length}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="card-stat-completed">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Spots Used" : "Completed"}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-muted-foreground"
                  data-testid="info-button-stat-completed"
                >
                  <Info className="h-3 w-3" />
                  <span className="sr-only">Info about {isOwner() ? "spots used" : "completed bookings"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isOwner() ? 
                  "Number of parking spots that were successfully rented out to users" : 
                  "Bookings you've finished using with confirmed payment"}
                </p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedItems.length}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="card-stat-negative">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Spots Unused" : "Cancelled"}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-muted-foreground"
                  data-testid="info-button-stat-negative"
                >
                  <Info className="h-3 w-3" />
                  <span className="sr-only">Info about {isOwner() ? "unused spots" : "cancelled bookings"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isOwner() ? 
                  "Parking spots that were listed but never booked by anyone" : 
                  "Reservations that were cancelled before the booking date"}
                </p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isOwner() ? unusedItems.length : cancelledItems.length}</div>
          </CardContent>
        </Card>
        <Card className="hover-elevate" data-testid="card-stat-money">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Total Earned" : "Total Spent"}
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-muted-foreground"
                  data-testid="info-button-stat-money"
                >
                  <Info className="h-3 w-3" />
                  <span className="sr-only">Info about {isOwner() ? "total earned" : "total spent"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isOwner() ? 
                  "Total revenue generated from all completed parking spot rentals" : 
                  "Total amount paid for all completed parking reservations"}
                </p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${isOwner() ? 
                listings.filter((l: SpotListing) => l.status === "expired").reduce((sum, l) => sum + Number(l.dailyRate), 0) :
                180
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="w-full flex flex-col md:flex-row gap-4 md:items-center">
            <div className="w-full md:flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Input
                      placeholder="Search by spot, location, or owner..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 min-h-11"
                      data-testid="input-search-bookings"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search through your {isOwner() ? 'listings' : 'bookings'} by spot number, location, or {isOwner() ? 'renter' : 'owner'} name</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full md:w-[180px] min-h-11" data-testid="select-filter-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {isOwner() ? (
                      <>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                        <SelectItem value="unused">Unused</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter {isOwner() ? 'listings' : 'bookings'} by their current status to find specific items quickly</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[150px] min-h-11" data-testid="select-sort-bookings">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                  </SelectContent>
                </Select>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort your {isOwner() ? 'listings' : 'bookings'} by date (newest first), price (highest first), or location alphabetically</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Status-Based Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex md:grid overflow-x-auto md:overflow-x-visible flex-nowrap md:grid-cols-5 w-full h-auto gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="active" className="flex-shrink-0 md:flex-shrink min-h-11 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 dark:data-[state=active]:bg-emerald-950/30 dark:data-[state=active]:text-emerald-400" data-testid="tab-active">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">Active</span>
                  <span className="sm:hidden">Active</span> ({activeItems.length})
                </div>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOwner() ? "Parking spots currently available for booking" : "Your confirmed upcoming reservations"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="pending" className="flex-shrink-0 md:flex-shrink min-h-11 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-600 dark:data-[state=active]:bg-amber-950/30 dark:data-[state=active]:text-amber-400" data-testid="tab-pending">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">Pending</span>
                  <span className="sm:hidden">Pend</span> ({pendingItems.length})
                </div>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOwner() ? "Booking requests awaiting your approval" : "Reservation requests waiting for owner confirmation"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="payment-pending" className="flex-shrink-0 md:flex-shrink min-h-11 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 dark:data-[state=active]:bg-orange-950/30 dark:data-[state=active]:text-orange-400" data-testid="tab-payment">
                <div className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  <span className="hidden sm:inline">Payment</span>
                  <span className="sm:hidden">Pay</span> ({paymentPendingItems.length})
                </div>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOwner() ? "Completed bookings with pending payment receipt" : "Confirmed bookings requiring payment processing"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="completed" className="flex-shrink-0 md:flex-shrink min-h-11 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-600 dark:data-[state=active]:bg-violet-950/30 dark:data-[state=active]:text-violet-400" data-testid="tab-completed">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">Completed</span>
                  <span className="sm:hidden">Done</span> ({completedItems.length})
                </div>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOwner() ? "Successfully rented spots with confirmed payments" : "Finished reservations with completed payments"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="all" className="flex-shrink-0 md:flex-shrink min-h-11 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-600 dark:data-[state=active]:bg-slate-950/30 dark:data-[state=active]:text-slate-400" data-testid="tab-all">
                All ({sortedItems.length})
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>View all your {isOwner() ? 'listings' : 'bookings'} regardless of status for complete history overview</p>
            </TooltipContent>
          </Tooltip>
        </TabsList>
        
        <TabsContent value="active" className="w-full space-y-3 md:space-y-4">
          {activeItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <Clock className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  {isOwner() ? "No active listings" : "No active bookings"}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {isOwner() ? "Create a new listing to start earning from your parking spots." : "Book a parking spot to see it here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {activeItems.map((item) => (
                isOwner() ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="w-full space-y-3 md:space-y-4">
          {pendingItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 md:p-8 text-center">
                <Clock className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  No pending bookings
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  {isOwner() ? "No pending bookings for your spots." : "You have no pending booking requests at this time."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {pendingItems.map((item) => (
                isOwner() ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
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
                  {isOwner() ? "All your bookings have been paid for." : "All your booking payments are up to date."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {paymentPendingItems.map((item) => (
                isOwner() ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
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
                  {isOwner() ? "No completed bookings for your spots yet." : "You haven't completed any bookings yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {completedItems.map((item) => (
                isOwner() ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
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
                  {isOwner() ? "No listings found" : "No bookings found"}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Try adjusting your search or filters to find your {isOwner() ? "listings" : "bookings"}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {sortedItems.map((item) => (
                isOwner() ? renderOwnerListingWithPayment(item) : renderRenterBooking(item)
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

    </div>
  )
}