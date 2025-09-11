import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Car, MapPin, DollarSign, Clock, Edit, Plus, Eye, Calendar, Users, TrendingUp } from "lucide-react"

type ParkingSpot = {
  id: string
  spotNumber: string
  location: string
  type: "regular" | "electric" | "accessible"
  isInside: boolean
  basePrice: number
  isActive: boolean
  currentBooking?: {
    id: string
    renterName: string
    date: string
    startTime: string
    endTime: string
    status: "confirmed" | "pending"
  }
  monthlyEarnings: number
  totalBookings: number
  rating: number
  description?: string
  amenities: string[]
}

export default function MySpots() {
  const [showAddSpot, setShowAddSpot] = useState(false)
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null)
  const [showEditSpot, setShowEditSpot] = useState(false)

  //todo: remove mock functionality
  const mockSpots: ParkingSpot[] = [
    {
      id: "spot-001",
      spotNumber: "A-15",
      location: "Main Building - Level 2",
      type: "electric",
      isInside: true,
      basePrice: 25,
      isActive: true,
      currentBooking: {
        id: "B-001",
        renterName: "Mike Johnson",
        date: "2024-01-20",
        startTime: "8:00 AM",
        endTime: "6:00 PM",
        status: "confirmed"
      },
      monthlyEarnings: 450,
      totalBookings: 18,
      rating: 4.9,
      description: "Close to elevator, EV charging station available",
      amenities: ["EV Charging", "Covered", "Security Camera"]
    },
    {
      id: "spot-002",
      spotNumber: "B-08",
      location: "North Parking Lot",
      type: "regular",
      isInside: false,
      basePrice: 20,
      isActive: true,
      monthlyEarnings: 380,
      totalBookings: 19,
      rating: 4.7,
      description: "Easy access, close to main entrance",
      amenities: ["Security Camera", "Well-lit"]
    },
    {
      id: "spot-003",
      spotNumber: "C-12",
      location: "South Parking Lot",
      type: "accessible",
      isInside: false,
      basePrice: 15,
      isActive: false,
      monthlyEarnings: 0,
      totalBookings: 0,
      rating: 0,
      description: "Accessible parking space with wide access",
      amenities: ["Accessible", "Wide Space"]
    }
  ]

  const totalEarnings = mockSpots.reduce((sum, spot) => sum + spot.monthlyEarnings, 0)
  const totalBookings = mockSpots.reduce((sum, spot) => sum + spot.totalBookings, 0)
  const activeSpots = mockSpots.filter(spot => spot.isActive).length
  const averageRating = mockSpots.filter(spot => spot.rating > 0).reduce((sum, spot) => sum + spot.rating, 0) / mockSpots.filter(spot => spot.rating > 0).length

  const handleAddSpot = () => {
    setShowAddSpot(true)
  }

  const handleEditSpot = (spot: ParkingSpot) => {
    setSelectedSpot(spot)
    setShowEditSpot(true)
  }

  const handleToggleSpotStatus = (spotId: string) => {
    console.log('Toggle spot status:', spotId)
    // Handle spot activation/deactivation
  }

  const handleViewBookingHistory = (spotId: string) => {
    console.log('View booking history for spot:', spotId)
    // Navigate to spot booking history
  }

  const getSpotTypeIcon = (type: string) => {
    switch (type) {
      case "electric":
        return "⚡"
      case "accessible":
        return "♿"
      default:
        return "🚗"
    }
  }

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "electric":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "accessible":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-my-spots">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Parking Spots</h1>
          <p className="text-muted-foreground">
            Manage your parking spaces and track your earnings.
          </p>
        </div>
        <Button onClick={handleAddSpot}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Spot
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Active Spots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSpots}</div>
            <p className="text-xs text-muted-foreground">Out of {mockSpots.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings}</div>
            <p className="text-xs text-green-600">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0</p>
          </CardContent>
        </Card>
      </div>

      {/* Spots List */}
      <div className="space-y-4">
        {mockSpots.map((spot) => (
          <Card key={spot.id} className={`${!spot.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getSpotTypeIcon(spot.type)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">Spot {spot.spotNumber}</h3>
                      <Badge className={getSpotTypeColor(spot.type)}>
                        {spot.type}
                      </Badge>
                      {spot.isInside && (
                        <Badge variant="outline">Indoor</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {spot.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-4">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={spot.isActive ? "default" : "secondary"}>
                      {spot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEditSpot(spot)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {spot.description && (
                <p className="text-sm text-muted-foreground mb-4">{spot.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Base Price</p>
                  <p className="text-lg font-semibold">${spot.basePrice}/day</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Earnings</p>
                  <p className="text-lg font-semibold">${spot.monthlyEarnings}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Bookings</p>
                  <p className="text-lg font-semibold">{spot.totalBookings}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="text-lg font-semibold">{spot.rating > 0 ? `${spot.rating}/5` : 'No ratings'}</p>
                </div>
              </div>

              {spot.amenities.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1">
                    {spot.amenities.map((amenity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {spot.currentBooking && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Current Booking</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Renter: </span>
                      <span className="font-medium">{spot.currentBooking.renterName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-medium">{spot.currentBooking.date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time: </span>
                      <span className="font-medium">{spot.currentBooking.startTime} - {spot.currentBooking.endTime}</span>
                    </div>
                    <div>
                      <Badge variant={spot.currentBooking.status === "confirmed" ? "default" : "secondary"}>
                        {spot.currentBooking.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`spot-toggle-${spot.id}`} className="text-sm">
                    {spot.isActive ? 'Active' : 'Inactive'}
                  </Label>
                  <Switch
                    id={`spot-toggle-${spot.id}`}
                    checked={spot.isActive}
                    onCheckedChange={() => handleToggleSpotStatus(spot.id)}
                    data-testid={`switch-spot-${spot.id}`}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewBookingHistory(spot.id)}
                    data-testid={`button-history-${spot.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View History
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSpot(spot)}
                    data-testid={`button-edit-${spot.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Manage Availability
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Spot Dialog */}
      <Dialog open={showAddSpot} onOpenChange={setShowAddSpot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Parking Spot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="spot-number">Spot Number</Label>
                <Input id="spot-number" placeholder="e.g., A-15" />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g., Main Building - Level 2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="spot-type">Spot Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="electric">Electric Vehicle</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="base-price">Base Price (per day)</Label>
                <Input id="base-price" type="number" placeholder="25" />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Describe your parking spot..." />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="is-indoor" />
              <Label htmlFor="is-indoor">Indoor parking</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddSpot(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowAddSpot(false)}>
                Add Spot
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Spot Dialog */}
      <Dialog open={showEditSpot} onOpenChange={setShowEditSpot}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-number">Spot Number</Label>
                  <Input id="edit-spot-number" defaultValue={selectedSpot.spotNumber} />
                </div>
                <div>
                  <Label htmlFor="edit-location">Location</Label>
                  <Input id="edit-location" defaultValue={selectedSpot.location} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-spot-type">Spot Type</Label>
                  <Select defaultValue={selectedSpot.type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="electric">Electric Vehicle</SelectItem>
                      <SelectItem value="accessible">Accessible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-base-price">Base Price (per day)</Label>
                  <Input id="edit-base-price" type="number" defaultValue={selectedSpot.basePrice} />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" defaultValue={selectedSpot.description} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="edit-is-indoor" defaultChecked={selectedSpot.isInside} />
                <Label htmlFor="edit-is-indoor">Indoor parking</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditSpot(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowEditSpot(false)}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}