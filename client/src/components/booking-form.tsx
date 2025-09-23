import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Calendar, Clock, DollarSign, MapPin, Car, AlertTriangle, User, Zap, Accessibility, Building, CreditCard } from "lucide-react"
import { ParkingSpot } from "./parking-spot-card"
import { isPastDate, getTodayString } from "@/utils/date-utils"
import { AuthService } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { useQuery } from "@tanstack/react-query"
import { type PaymentPreferences } from "@shared/schema"

interface BookingData {
  date: string
  paymentMethod: string
  specialInstructions: string
  contactPhone: string
  vehicleLicense: string
  spotId: string
}

interface BookingFormProps {
  spot: ParkingSpot
  onSubmit: (bookingData: BookingData) => void
  onCancel: () => void
  selectedDate?: string // Pre-selected date from calendar
  isDateLocked?: boolean // Whether date can be changed
}

export function BookingForm({ spot, onSubmit, onCancel, selectedDate, isDateLocked = false }: BookingFormProps) {
  // Get authenticated user for auto-population
  const authUser = AuthService.getAuthUser();
  const { toast } = useToast();

  // Query spot owner's payment preferences
  const { data: ownerPaymentPreferences, isLoading: isLoadingPaymentPreferences } = useQuery<PaymentPreferences | null>({
    queryKey: ["/api/users", spot.ownerId, "payment-preferences"],
    enabled: !!spot.ownerId
  });
  
  // Ensure we don't default to a past date
  const getValidDate = () => {
    if (selectedDate) return selectedDate;
    const proposedDate = spot.availability?.date || getTodayString();
    return isPastDate(proposedDate) ? getTodayString() : proposedDate;
  };

  const [formData, setFormData] = useState({
    date: getValidDate(),
    paymentMethod: "",
    specialInstructions: "",
    contactPhone: authUser?.phone || "", // Auto-populate from user profile
    vehicleLicense: authUser?.vehicleInfo?.licensePlate || "" // Auto-populate from user profile
  })

  // Auto-populate payment method from owner's preferences
  useEffect(() => {
    if (ownerPaymentPreferences && !formData.paymentMethod) {
      const paymentMethodMap = {
        "interac_transfer": "Interac Transfer",
        "cash": "Cash"
      };
      setFormData(prev => ({
        ...prev,
        paymentMethod: paymentMethodMap[ownerPaymentPreferences.paymentType] || ""
      }));
    }
  }, [ownerPaymentPreferences, formData.paymentMethod]);

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const updateFormData = (key: string, value: string) => {
    // Don't allow date changes if locked
    if (key === "date" && isDateLocked) {
      return; // Ignore date changes when locked
    }
    
    // Validate date to prevent past date selection
    if (key === "date") {
      if (isPastDate(value)) {
        setDateError("Cannot book parking spots for past dates");
        return; // Don't update the form data
      } else {
        setDateError(""); // Clear any existing error
      }
    }
    
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Date validation
    if (!formData.date) {
      errors.date = "Date is required"
    } else if (isPastDate(formData.date)) {
      errors.date = "Cannot book parking spots for past dates"
    }

    // Payment method validation
    if (!formData.paymentMethod) {
      errors.paymentMethod = "Payment method is required"
    }

    // Contact phone validation (basic)
    if (!formData.contactPhone.trim()) {
      errors.contactPhone = "Contact phone is required"
    } else if (!/^[\d\s\-\(\)\+]+$/.test(formData.contactPhone)) {
      errors.contactPhone = "Please enter a valid phone number"
    }

    // Vehicle license validation
    if (!formData.vehicleLicense.trim()) {
      errors.vehicleLicense = "Vehicle license plate is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    setDateError("")
    setValidationErrors({})

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the form errors before submitting.",
        variant: "error",
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Simulate API call with potential failure
      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          // Simulate 90% success rate for testing
          if (Math.random() > 0.1) {
            console.log('Submitting booking:', { ...formData, spotId: spot.id })
            resolve()
          } else {
            reject(new Error("Failed to create booking. Please try again."))
          }
        }, 1000)
      })
      
      onSubmit({ ...formData, spotId: spot.id })
      toast({
        title: "Booking Created",
        description: `Successfully booked Spot ${spot.spotNumber} for ${formData.date}`,
        variant: "success",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      setSubmitError(errorMessage)
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getSpotTypeIcon = () => {
    switch (spot.type) {
      case "electric":
        return <Zap className="h-4 w-4 text-green-600" />
      case "tesla_ev":
        return <Zap className="h-4 w-4 text-red-600" />
      case "accessible":
        return <Accessibility className="h-4 w-4 text-blue-600" />
      case "reserved":
        return <Building className="h-4 w-4 text-orange-600" />
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
              {spot.type === "electric" ? "EV Charger" : 
               spot.type === "tesla_ev" ? "Tesla Charger" : 
               spot.type === "accessible" ? "Accessible" : 
               spot.type === "reserved" ? "Reserved" : "Regular"}
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
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date">Select Date</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  type="date"
                  value={formData.date}
                  min={getTodayString()}
                  onChange={(e) => updateFormData("date", e.target.value)}
                  required
                  disabled={isDateLocked}
                  data-testid="input-booking-date"
                  className={`w-full md:w-auto ${isDateLocked ? 'bg-muted cursor-not-allowed' : ''}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Select reservation date</p>
              </TooltipContent>
            </Tooltip>
            {isDateLocked && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Date selected from calendar and cannot be changed
              </div>
            )}
            {(dateError || validationErrors.date) && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {dateError || validationErrors.date}
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <Calendar className="h-4 w-4" />
                This reservation is for the full day (12:00 AM - 11:59 PM)
              </div>
            </div>
          </div>

          {/* Owner's Payment Preferences */}
          {ownerPaymentPreferences && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
                <CreditCard className="h-4 w-4" />
                Owner's Payment Preferences
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-green-700 dark:text-green-300">Preferred Payment Method: </span>
                  <span className="text-green-600 dark:text-green-400">
                    {ownerPaymentPreferences.paymentType === "interac_transfer" ? "Interac Transfer" : "Cash"}
                  </span>
                </div>
                {ownerPaymentPreferences.paymentInstructions && (
                  <div>
                    <span className="font-medium text-green-700 dark:text-green-300">Payment Instructions: </span>
                    <span className="text-green-600 dark:text-green-400">
                      {ownerPaymentPreferences.paymentInstructions}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {isLoadingPaymentPreferences && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Loading payment preferences...</div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select value={formData.paymentMethod} onValueChange={(value) => updateFormData("paymentMethod", value)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose payment method for this booking</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="Interac Transfer">Interac e-Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.paymentMethod && (
              <p className="text-sm text-red-600">{validationErrors.paymentMethod}</p>
            )}
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="flex items-center gap-2">
                Contact Phone
                {authUser?.phone && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    From Profile
                  </Badge>
                )}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.contactPhone}
                    onChange={(e) => updateFormData("contactPhone", e.target.value)}
                    required
                    data-testid="input-contact-phone"
                    className={authUser?.phone ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/50" : ""}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Phone number for booking coordination</p>
                </TooltipContent>
              </Tooltip>
              {authUser?.phone && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Auto-filled from your profile
                </p>
              )}
              {validationErrors.contactPhone && (
                <p className="text-sm text-red-600">{validationErrors.contactPhone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleLicense" className="flex items-center gap-2">
                Vehicle License Plate
                {authUser?.vehicleInfo?.licensePlate && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    From Profile
                  </Badge>
                )}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    placeholder="ABC-123"
                    value={formData.vehicleLicense}
                    onChange={(e) => updateFormData("vehicleLicense", e.target.value)}
                    required
                    data-testid="input-vehicle-license"
                    className={authUser?.vehicleInfo?.licensePlate ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/50" : ""}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>License plate for parking identification</p>
                </TooltipContent>
              </Tooltip>
              {authUser?.vehicleInfo?.licensePlate ? (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Auto-filled from your profile • Can be changed if using different car
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  💡 Tip: Add your vehicle info to your profile to auto-fill this field next time
                </p>
              )}
              {validationErrors.vehicleLicense && (
                <p className="text-sm text-red-600">{validationErrors.vehicleLicense}</p>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions (Optional)</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Textarea
                  placeholder="Any special instructions or notes for the spot owner..."
                  value={formData.specialInstructions}
                  onChange={(e) => updateFormData("specialInstructions", e.target.value)}
                  className="min-h-20"
                  data-testid="textarea-instructions"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Add special requirements or arrival notes</p>
              </TooltipContent>
            </Tooltip>
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

          {/* Submit Error Display */}
          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {submitError}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  className="flex-1"
                  data-testid="button-cancel-booking"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cancel booking and return</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>Submit booking request</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}