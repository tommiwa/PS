import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, DollarSign, MapPin, Car, AlertTriangle } from "lucide-react"
import { ParkingSpot } from "./parking-spot-card"

interface BookingFormProps {
  spot: ParkingSpot
  onSubmit: (bookingData: any) => void
  onCancel: () => void
}

export function BookingForm({ spot, onSubmit, onCancel }: BookingFormProps) {
  const [formData, setFormData] = useState({
    date: spot.availability?.date || new Date().toISOString().split('T')[0],
    startTime: spot.availability?.startTime || "8:00 AM",
    endTime: spot.availability?.endTime || "6:00 PM",
    paymentMethod: "",
    specialInstructions: "",
    contactPhone: "",
    vehicleLicense: ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    console.log('Submitting booking:', { ...formData, spotId: spot.id })
    
    // Simulate API call
    setTimeout(() => {
      onSubmit({ ...formData, spotId: spot.id })
      setIsSubmitting(false)
    }, 1000)
  }

  const getSpotTypeIcon = () => {
    switch (spot.type) {
      case "electric":
        return <Car className="h-4 w-4 text-blue-600" />
      case "accessible":
        return <Car className="h-4 w-4 text-green-600" />
      default:
        return <Car className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card className="max-w-2xl mx-auto" data-testid="card-booking-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Book Parking Spot
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Spot Summary */}
        <div className="p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              {getSpotTypeIcon()}
              Spot {spot.spotNumber}
            </h3>
            <Badge variant="secondary">
              {spot.type === "electric" ? "EV Charging" : 
               spot.type === "accessible" ? "Accessible" : "Regular"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {spot.location} {spot.isInside && "(Inside)"}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            ${spot.price}/day
          </div>
          <div className="text-sm text-muted-foreground">
            Owner: {spot.owner}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => updateFormData("date", e.target.value)}
                required
                data-testid="input-booking-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => updateFormData("startTime", e.target.value)}
                required
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => updateFormData("endTime", e.target.value)}
                required
                data-testid="input-end-time"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={formData.paymentMethod} onValueChange={(value) => updateFormData("paymentMethod", value)}>
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interac">Interac e-Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.contactPhone}
                onChange={(e) => updateFormData("contactPhone", e.target.value)}
                required
                data-testid="input-contact-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleLicense">Vehicle License Plate</Label>
              <Input
                placeholder="ABC-123"
                value={formData.vehicleLicense}
                onChange={(e) => updateFormData("vehicleLicense", e.target.value)}
                required
                data-testid="input-vehicle-license"
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions (Optional)</Label>
            <Textarea
              placeholder="Any special instructions or notes for the spot owner..."
              value={formData.specialInstructions}
              onChange={(e) => updateFormData("specialInstructions", e.target.value)}
              className="min-h-20"
              data-testid="textarea-instructions"
            />
          </div>

          {/* Legal Notice */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Important Notice
                </p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  BCI is not responsible for payment arrangements between users. 
                  Please ensure payment details are confirmed directly with the spot owner.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="flex-1"
              data-testid="button-cancel-booking"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.paymentMethod}
              className="flex-1"
              data-testid="button-submit-booking"
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Book for $${spot.price}`
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}