import { useState } from "react"
import { BookingCard } from "@/components/booking-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar, Search, Filter, Download, Clock, CheckCircle, XCircle, Car, MapPin, DollarSign, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { isPastDate } from "@/utils/date-utils"

export default function MyBookings() {
  const { user, isOwner } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [filterStatus, setFilterStatus] = useState("all")

  //todo: remove mock functionality
  // For renters - their bookings
  const mockRenterBookings = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2025-01-20",
      price: 25,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      owner: "Sarah Chen",
      canCancel: true,
      canEdit: true,
      bookedDate: "2025-01-15",
      vehicleUsed: "Tesla Model 3 (ABC-123)"
    },
    {
      id: "B-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      date: "2025-01-18",
      price: 20,
      status: "pending" as const,
      paymentStatus: "pending" as const,
      owner: "Mike Johnson",
      canCancel: true,
      canEdit: true,
      bookedDate: "2025-01-14",
      vehicleUsed: "Honda Civic (XYZ-789)"
    },
    {
      id: "B-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      date: "2024-12-10",
      price: 15,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      owner: "Lisa Anderson",
      canCancel: false,
      canEdit: false,
      bookedDate: "2024-12-08",
      vehicleUsed: "Ford Focus (DEF-456)"
    }
  ]

  // For owners - their spot listings and booking history
  const mockOwnerListings = [
    {
      id: "L-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2025-01-20",
      price: 25,
      status: "booked" as const,
      renterName: "Michael Rodriguez",
      renterVehicle: "Toyota Camry (ABC-123)",
      bookedDate: "2025-01-15",
      paymentReceived: true
    },
    {
      id: "L-002",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2025-01-18",
      price: 25,
      status: "available" as const,
      renterName: null,
      renterVehicle: null,
      bookedDate: null,
      paymentReceived: false
    },
    {
      id: "L-003",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-12-15",
      price: 25,
      status: "used" as const, // Past date, was booked and used
      renterName: "Sarah Johnson",
      renterVehicle: "Honda Civic (XYZ-789)",
      bookedDate: "2024-12-10",
      paymentReceived: true
    },
    {
      id: "L-004",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-12-12",
      price: 25,
      status: "unused" as const, // Past date, was not booked
      renterName: null,
      renterVehicle: null,
      bookedDate: null,
      paymentReceived: false
    },
    {
      id: "L-005",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-12-08",
      price: 25,
      status: "used" as const, // Past date, was booked and used
      renterName: "David Park",
      renterVehicle: "BMW X3 (DEF-456)",
      bookedDate: "2024-12-05",
      paymentReceived: true
    }
  ]

  // Use appropriate data based on user role
  const mockBookings = isOwner() ? [] : mockRenterBookings
  const ownerListings = isOwner() ? mockOwnerListings : []

  // Filter and sort logic for both renters and owners
  const allItems = isOwner() ? ownerListings : mockBookings

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (isOwner() ? 
                           (item.renterName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) :
                           (item.owner?.toLowerCase().includes(searchTerm.toLowerCase()) || false))
    
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
  let activeItems, completedItems, cancelledItems, unusedItems

  if (isOwner()) {
    // For owners - categorize their listings
    activeItems = ownerListings.filter(l => l.status === "available" || l.status === "booked")
    completedItems = ownerListings.filter(l => l.status === "used") // Past spots that were booked
    cancelledItems = [] // Owners don't have cancelled bookings in this context
    unusedItems = ownerListings.filter(l => l.status === "unused") // Past spots that were not booked
  } else {
    // For renters - categorize their bookings
    activeItems = mockBookings.filter(b => b.status === "confirmed" || b.status === "pending")
    completedItems = mockBookings.filter(b => b.status === "confirmed" && isPastDate(b.date))
    cancelledItems = mockBookings.filter(b => b.status === "cancelled")
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

  const renderOwnerListing = (listing: any) => (
    <div key={listing.id} className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon(listing.status)}
          <div>
            <h3 className="font-semibold">Spot {listing.spotNumber}</h3>
            <p className="text-sm text-muted-foreground">{listing.location}</p>
          </div>
        </div>
        <Badge 
          variant={listing.status === "used" || listing.status === "booked" ? "default" : 
                  listing.status === "available" ? "secondary" : 
                  listing.status === "unused" ? "destructive" : "outline"}
        >
          {listing.status}
        </Badge>
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
        <Button onClick={handleDownloadHistory} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download History
        </Button>
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
                ownerListings.filter(l => l.status === "used").reduce((sum, l) => sum + l.price, 0) :
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

      {/* Bookings/Listings Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className={`grid w-full ${isOwner() ? 'grid-cols-4' : 'grid-cols-4'}`}>
          <TabsTrigger value="all">All ({sortedItems.length})</TabsTrigger>
          <TabsTrigger value="active">
            {isOwner() ? "Active" : "Active"} ({activeItems.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {isOwner() ? "Used" : "Completed"} ({completedItems.length})
          </TabsTrigger>
          <TabsTrigger value={isOwner() ? "unused" : "cancelled"}>
            {isOwner() ? "Unused" : "Cancelled"} ({isOwner() ? unusedItems.length : cancelledItems.length})
          </TabsTrigger>
        </TabsList>
        
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
                isOwner() ? renderOwnerListing(item) : renderRenterBooking(item)
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          <div className="space-y-4">
            {activeItems.map((item) => (
              isOwner() ? renderOwnerListing(item) : renderRenterBooking(item)
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          <div className="space-y-4">
            {completedItems.map((item) => (
              isOwner() ? renderOwnerListing(item) : renderRenterBooking(item)
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value={isOwner() ? "unused" : "cancelled"} className="space-y-4">
          <div className="space-y-4">
            {isOwner() ? (
              unusedItems.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">Great job!</h3>
                    <p className="text-muted-foreground">
                      All your listed parking spots have been successfully booked.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                unusedItems.map((item) => renderOwnerListing(item))
              )
            ) : (
              cancelledItems.map((item) => renderRenterBooking(item))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}