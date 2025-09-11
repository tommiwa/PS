import { useState } from "react"
import { BookingCard } from "@/components/booking-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Calendar, Search, Filter, Download, Clock, CheckCircle, XCircle } from "lucide-react"

export default function MyBookings() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [filterStatus, setFilterStatus] = useState("all")

  //todo: remove mock functionality
  const mockBookings = [
    {
      id: "B-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      date: "2024-01-20",
      startTime: "8:00 AM",
      endTime: "6:00 PM",
      price: 25,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      owner: "Sarah Chen",
      canCancel: true,
      canEdit: true,
      bookedDate: "2024-01-15",
      vehicleUsed: "Tesla Model 3 (ABC-123)"
    },
    {
      id: "B-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      date: "2024-01-18",
      startTime: "9:00 AM",
      endTime: "5:00 PM",
      price: 20,
      status: "pending" as const,
      paymentStatus: "pending" as const,
      owner: "Mike Johnson",
      canCancel: true,
      canEdit: true,
      bookedDate: "2024-01-14",
      vehicleUsed: "Honda Civic (XYZ-789)"
    },
    {
      id: "B-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      date: "2024-01-10",
      startTime: "8:00 AM",
      endTime: "5:00 PM",
      price: 15,
      status: "confirmed" as const,
      paymentStatus: "completed" as const,
      owner: "Lisa Anderson",
      canCancel: false,
      canEdit: false,
      bookedDate: "2024-01-08",
      vehicleUsed: "Ford Focus (DEF-456)"
    },
    {
      id: "B-004",
      spotNumber: "A-22",
      location: "Main Building - Level 1",
      date: "2024-01-05",
      startTime: "9:00 AM",
      endTime: "6:00 PM",
      price: 30,
      status: "cancelled" as const,
      paymentStatus: "completed" as const,
      owner: "David Park",
      canCancel: false,
      canEdit: false,
      bookedDate: "2024-01-03",
      vehicleUsed: "BMW X3 (GHI-123)"
    }
  ]

  const filteredBookings = mockBookings.filter(booking => {
    const matchesSearch = booking.spotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.owner.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || booking.status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const sortedBookings = [...filteredBookings].sort((a, b) => {
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

  const activeBookings = mockBookings.filter(b => b.status === "confirmed" || b.status === "pending")
  const completedBookings = mockBookings.filter(b => b.status === "confirmed" && new Date(b.date) < new Date())
  const cancelledBookings = mockBookings.filter(b => b.status === "cancelled")

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
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-my-bookings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Bookings</h1>
          <p className="text-muted-foreground">
            Manage your current and past parking reservations.
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledBookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$180</div>
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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

      {/* Bookings Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({sortedBookings.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeBookings.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedBookings.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledBookings.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {sortedBookings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters to find your bookings.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedBookings.map((booking) => (
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
                      <p className="text-xs text-muted-foreground">Date & Time</p>
                      <p className="text-sm font-medium">{booking.date}</p>
                      <p className="text-xs text-muted-foreground">{booking.startTime} - {booking.endTime}</p>
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
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          <div className="space-y-4">
            {activeBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking}
                showRenterInfo={true}
                showBookButton={false}
                onCancel={handleCancelBooking}
                onEdit={handleEditBooking}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          <div className="space-y-4">
            {completedBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking}
                showRenterInfo={true}
                showBookButton={false}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="cancelled" className="space-y-4">
          <div className="space-y-4">
            {cancelledBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking}
                showRenterInfo={true}
                showBookButton={false}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}