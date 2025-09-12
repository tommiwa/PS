import { useState } from "react"
import { BookingCard } from "@/components/booking-card"
import { ParkingCalendar } from "@/components/parking-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SpotListingForm } from "@/components/spot-listing-form"
import { Calendar, Search, Filter, Download, Clock, CheckCircle, XCircle, Car, MapPin, DollarSign, AlertTriangle, Plus, Edit, Trash2, CreditCard } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { isPastDate } from "@/utils/date-utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"

export default function MyBookings() {
  const { user, isOwner } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showListingForm, setShowListingForm] = useState(false)
  const [showEditListing, setShowEditListing] = useState(false)
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [listingToDelete, setListingToDelete] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("active")

  // Fetch real data based on user role
  const { data: renterBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ['/api/my-bookings'],
    enabled: !isOwner(), // Only fetch if user is a renter
  })

  const { data: ownerListings = [], isLoading: isLoadingListings } = useQuery({
    queryKey: ['/api/my-listings'],
    enabled: isOwner(), // Only fetch if user is an owner
  })

  // Use appropriate data based on user role
  const mockBookings = isOwner() ? [] : renterBookings
  const listings = isOwner() ? ownerListings : []

  // Filter and sort logic for both renters and owners
  const allItems = isOwner() ? listings : mockBookings

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (isOwner() ? 
                           ('renterName' in item && item.renterName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) :
                           ('owner' in item && item.owner?.toLowerCase().includes(searchTerm.toLowerCase()) || false))
    
    const matchesStatus = filterStatus === "all" || item.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      case "price":
        return b.price - a.price
      case "location":
        return a.location.localeCompare(b.location)
      default:
        return 0
    }
  })

  // Categories for different user types
  let activeItems: any[], completedItems: any[], cancelledItems: any[], unusedItems: any[]

  if (isOwner()) {
    // For owners - categorize their listings
    activeItems = listings.filter(l => l.status === "available" || l.status === "booked")
    completedItems = listings.filter(l => l.status === "used") // Past spots that were booked
    cancelledItems = [] // Owners don't have cancelled bookings in this context
    unusedItems = listings.filter(l => l.status === "unused") // Past spots that were not booked
  } else {
    // For renters - categorize their bookings
    activeItems = mockBookings.filter(b => b.status === "confirmed" || b.status === "pending")
    completedItems = mockBookings.filter(b => b.status === "confirmed" && isPastDate(b.date))
    cancelledItems = [] // No cancelled status in current mock data
    unusedItems = [] // Renters don't have unused items
  }

  const handleCancelBooking = (bookingId: string) => {
    console.log('Cancel booking:', bookingId)
    // Show confirmation dialog and handle cancellation
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

  const handleDeleteListing = (listing: any) => {
    setListingToDelete(listing)
    setShowDeleteConfirm(true)
  }

  const handleBookSpot = (spotId: string) => {
    console.log('Book spot:', spotId)
    // Handle spot booking from calendar
  }

  // Transform real listing data for calendar
  const transformListingsToCalendarSpots = (listings: any[]) => {
    return listings.map((listing: any) => ({
      id: listing.id,
      spotNumber: listing.spotNumber || `Spot-${listing.id.slice(-4)}`,
      location: listing.location || "Location not specified",
      type: listing.spotType || "regular" as const,
      isInside: listing.isIndoor || false,
      price: Number(listing.dailyRate) || 0,
      isAvailable: listing.status === "active" || listing.status === "available",
      owner: isOwner() ? "You" : "Other Owner",
      availability: { 
        date: listing.singleDate || listing.periodStartDate || new Date().toISOString().split('T')[0]
      },
      isOwned: true // All listings in MyBookings are owned by the current user
    }))
  }

  const calendarSpots = isOwner() ? transformListingsToCalendarSpots(listings) : []

  // Mutations for listing management
  const updateListingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return apiRequest('PATCH', `/api/listings/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      setShowEditListing(false)
    }
  })

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/listings/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
      setShowDeleteConfirm(false)
      setListingToDelete(null)
    }
  })

  const markPaymentMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string, paid: boolean }) => {
      return apiRequest('PATCH', `/api/bookings/${id}/payment`, { paymentReceived: paid })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
    }
  })

  const confirmDeleteListing = () => {
    if (listingToDelete) {
      deleteListingMutation.mutate(listingToDelete.id)
    }
  }

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
    <div key={listing.id} className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(listing.status)}
          <div>
            <h3 className="font-semibold">Spot {listing.spotNumber}</h3>
            <p className="text-sm text-muted-foreground">{listing.location}</p>
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
          {(listing.status === "available" || listing.status === "booked") && (
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleEditListing(listing)}
                data-testid={`button-edit-listing-${listing.id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDeleteListing(listing)}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
                data-testid={`button-delete-listing-${listing.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium">{listing.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium">
            {listing.renterName || "Not booked"}
          </p>
          {listing.renterVehicle && (
            <p className="text-xs text-muted-foreground">{listing.renterVehicle}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-sm font-medium">${listing.price}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium">
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
    <div key={listing.id} className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(listing.status)}
          <div>
            <h3 className="font-semibold">Spot {listing.spotNumber}</h3>
            <p className="text-sm text-muted-foreground">{listing.location}</p>
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
          {listing.status === "used" && (
            <Button
              variant={listing.paymentReceived ? "outline" : "default"}
              size="sm"
              onClick={() => handleMarkPayment(listing.id, listing.paymentReceived)}
              disabled={markPaymentMutation.isPending}
              data-testid={`button-payment-${listing.id}`}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              {listing.paymentReceived ? "Unmark" : "Mark Paid"}
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium">{listing.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {listing.status === "unused" ? "No Renter" : "Renter"}
          </p>
          <p className="text-sm font-medium">
            {listing.renterName || "Not booked"}
          </p>
          {listing.renterVehicle && (
            <p className="text-xs text-muted-foreground">{listing.renterVehicle}</p>
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
          <p className="text-sm font-medium">
            {listing.status === "unused" && "Listed but unused"}
            {listing.status === "used" && "Successfully rented"}
            {listing.status === "booked" && "Currently booked"}
            {listing.status === "available" && "Available for booking"}
          </p>
        </div>
      </div>
      
      {listing.status === "unused" && (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-4 w-4" />
            This spot was listed for {listing.date} but was not booked by anyone.
          </div>
        </div>
      )}
    </div>
  )

  const renderRenterBooking = (booking: any) => (
    <div key={booking.id} className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(booking.status)}
          <div>
            <h3 className="font-semibold">Spot {booking.spotNumber}</h3>
            <p className="text-sm text-muted-foreground">{booking.location}</p>
          </div>
        </div>
        <Badge 
          variant={booking.status === "confirmed" ? "default" : 
                  booking.status === "pending" ? "secondary" : "destructive"}
        >
          {booking.status}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-medium">{booking.date}</p>
          <p className="text-xs text-muted-foreground">Full Day</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Owner</p>
          <p className="text-sm font-medium">{booking.owner}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehicle</p>
          <p className="text-sm font-medium">{booking.vehicleUsed}</p>
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
        <div className="flex gap-2 pt-2 border-t">
          {booking.canEdit && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleEditBooking(booking.id)}
              data-testid={`button-edit-${booking.id}`}
            >
              Edit
            </Button>
          )}
          {booking.canCancel && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => handleCancelBooking(booking.id)}
              data-testid={`button-cancel-${booking.id}`}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  )

  // Show loading state while fetching data
  if (isLoadingBookings || isLoadingListings) {
    return (
      <div className="p-6 space-y-6" data-testid="page-my-bookings">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading {isOwner() ? 'listings' : 'bookings'}...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-my-bookings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{isOwner() ? "My Spot Listings" : "My Bookings"}</h1>
          <p className="text-muted-foreground">
            {isOwner() ? 
              "Track your parking spot listings, bookings, and usage history." :
              "Manage your current and past parking reservations."
            }
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner() && (
            <Button onClick={() => setShowListingForm(true)} data-testid="button-list-spot">
              <Plus className="h-4 w-4 mr-2" />
              List My Spot
            </Button>
          )}
          <Button onClick={handleDownloadHistory} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download History
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Active Listings" : "Active Bookings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Spots Used" : "Completed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Spots Unused" : "Cancelled"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isOwner() ? unusedItems.length : cancelledItems.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isOwner() ? "Total Earned" : "Total Spent"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${isOwner() ? 
                listings.filter(l => l.status === "used").reduce((sum, l) => sum + l.price, 0) :
                180
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by spot, location, or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-bookings"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]" data-testid="select-sort-bookings">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Restructured Tabs: Active → Calendar → All */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active ({activeItems.length})
          </TabsTrigger>
          <TabsTrigger value="calendar">
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({sortedItems.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {activeItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {isOwner() ? "No active listings" : "No active bookings"}
                </h3>
                <p className="text-muted-foreground">
                  {isOwner() ? "Create a new listing to start earning from your parking spots." : "Book a parking spot to see it here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeItems.map((item) => (
                isOwner() ? renderOwnerListingWithActions(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isOwner() ? "View and manage your spot availability" : "Browse available parking spots"}
              </p>
            </CardHeader>
            <CardContent>
              <ParkingCalendar 
                spots={calendarSpots}
                onBookSpot={handleBookSpot}
                isOwnerView={isOwner()}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          {sortedItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {isOwner() ? "No listings found" : "No bookings found"}
                </h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters to find your {isOwner() ? "listings" : "bookings"}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
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

      {/* Delete Listing Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <p className="font-semibold text-red-900 dark:text-red-200">Warning: This action cannot be undone</p>
              </div>
              <p className="text-sm text-red-800 dark:text-red-300">
                Deleting this listing will permanently remove it and any existing bookings will be cancelled.
              </p>
            </div>

            {listingToDelete && (
              <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                <p className="font-medium">Spot {listingToDelete.spotNumber}</p>
                <p className="text-sm text-muted-foreground">{listingToDelete.location}</p>
                <p className="text-sm text-muted-foreground">Date: {listingToDelete.date}</p>
                <p className="text-sm text-muted-foreground">Price: ${listingToDelete.price}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(false)}
              data-testid="button-cancel-delete-listing"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteListing}
              disabled={deleteListingMutation.isPending}
              data-testid="button-confirm-delete-listing"
            >
              {deleteListingMutation.isPending ? "Deleting..." : "Delete Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}