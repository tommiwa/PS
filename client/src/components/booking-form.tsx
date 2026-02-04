import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Calendar, Clock, DollarSign, MapPin, Car, AlertTriangle, User, Zap, Accessibility, Building, CreditCard, Timer, Info, Phone, Banknote, Heart, Tag, Sparkles } from "lucide-react"
import { isWeekend, parseISO } from "date-fns"
import { format, addMonths } from "date-fns"
import type { ParkingSpot as DBParkingSpot } from "@shared/schema"
import { isPastDate, getTodayString } from "@/utils/date-utils"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useQuery } from "@tanstack/react-query"
import { type PaymentPreferences } from "@shared/schema"
import { useLock } from "@/contexts/LockContext"

interface BookingData {
  date: string
  paymentMethod: string
  specialInstructions: string
  contactPhone: string
  vehicleInfo: string
  spotId: string
}

// Display spot interface with enriched properties for the booking form
export interface ParkingSpot extends DBParkingSpot {
  location: string
  type: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved"
  isInside: boolean
  price: number
  owner: string
  availability?: {
    date: string
  }
  donateToCharity?: boolean
  dateToCharity?: Record<string, boolean>
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
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const { userActiveLock } = useLock();
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  
  // Track if we've hydrated auth data to avoid overwriting user edits
  const authDataHydratedRef = useRef(false);

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
    paymentMethod: "Interac Transfer", // Default to Interac
    specialInstructions: "",
    contactPhone: "", // Will be populated when auth loads
    vehicleInfo: "" // Will be populated when auth loads (model + color)
  })

  // Auto-populate user fields from auth context when it loads (once only)
  useEffect(() => {
    if (authUser && !authDataHydratedRef.current) {
      authDataHydratedRef.current = true;
      const vehicleDetails = authUser.vehicleInfo 
        ? `${authUser.vehicleInfo.model || ''}${authUser.vehicleInfo.color ? ` (${authUser.vehicleInfo.color})` : ''}`.trim()
        : "";
      setFormData(prev => ({
        ...prev,
        contactPhone: authUser.phone || "",
        vehicleInfo: vehicleDetails
      }));
    }
  }, [authUser]);

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

  // Calculate payroll deduction month for BCI-managed spots
  const getPayrollDeductionMonth = (bookingDate: string): string => {
    const date = new Date(bookingDate + "T12:00:00");
    const dayOfMonth = date.getDate();
    // If before 20th, deduct same month; otherwise next month
    const deductionDate = dayOfMonth < 20 ? date : addMonths(date, 1);
    return format(deductionDate, "MMMM yyyy");
  }

  // Determine if spot is truly BCI-managed (payroll eligible) vs peer-to-peer
  // A spot uses payroll deduction ONLY if:
  // 1. isBciManaged flag is true, AND
  // 2. There is no individual owner (assignedUserName is null/undefined)
  // If there's a real person as owner, it's peer-to-peer even if isBciManaged flag is incorrectly set
  const isTrulyBciManaged = (): boolean => {
    const hasIndividualOwner = !!(spot as any).assignedUserName;
    return spot.isBciManaged && !hasIndividualOwner;
  }
  
  const isPayrollSpot = isTrulyBciManaged();

  // Countdown timer effect
  useEffect(() => {
    if (userActiveLock) {
      // Initialize remaining seconds from lock
      const remaining = Math.max(0, Math.floor((new Date(userActiveLock.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      // Update timer every second
      const interval = setInterval(() => {
        setRemainingSeconds(prev => {
          const newRemaining = prev - 1;
          
          // When timer hits 0, close dialog and show toast
          if (newRemaining <= 0) {
            clearInterval(interval);
            toast({
              title: "Lock Expired",
              description: "Your reservation expired. Please try again.",
              variant: "destructive"
            });
            onCancel(); // Close the dialog
            return 0;
          }
          
          return newRemaining;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [userActiveLock, onCancel, toast]);

  // Format remaining time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

    // Payment method validation (only for peer-to-peer spots)
    if (!isPayrollSpot && !formData.paymentMethod) {
      errors.paymentMethod = "Payment method is required"
    }

    // Contact phone validation (basic)
    if (!formData.contactPhone.trim()) {
      errors.contactPhone = "Contact phone is required"
    } else if (!/^[\d\s\-\(\)\+]+$/.test(formData.contactPhone)) {
      errors.contactPhone = "Please enter a valid phone number"
    }

    // Vehicle info validation
    if (!formData.vehicleInfo.trim()) {
      errors.vehicleInfo = "Vehicle information is required"
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
      // For BCI-managed spots, set payment method to Payroll
      const submitData = {
        ...formData,
        spotId: spot.id,
        paymentMethod: isPayrollSpot ? "Payroll" : formData.paymentMethod
      };
      // Simply pass the data to parent - parent handles the mutation and toasts
      onSubmit(submitData)
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

  const getSpotTypeBadge = () => {
    switch (spot.type) {
      case "electric":
        return "EV Charger"
      case "tesla_ev":
        return "Tesla Charger"
      case "accessible":
        return "Accessible"
      case "reserved":
        return "Reserved"
      default:
        return "Regular"
    }
  }

  return (
    <div className="w-full" data-testid="card-booking-form">
      {/* Spot Information Section - Highlighted Container */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-blue-200 dark:border-blue-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2 text-xl font-semibold">
                {getSpotTypeIcon()}
                Spot {spot.spotNumber}
              </div>
              <Badge variant="secondary">
                {getSpotTypeBadge()}
              </Badge>
              {/* Promotional Labels */}
              {(() => {
                const bookingDate = formData.date;
                const isCharityListing = spot.dateToCharity?.[bookingDate] ?? spot.donateToCharity ?? false;
                const isWeekendBooking = bookingDate && isWeekend(parseISO(bookingDate));
                const isTopDeal = spot.price <= 10;
                
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isCharityListing && (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex">
                            <Badge className="bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700 flex items-center gap-1 cursor-help">
                              <Heart className="h-3 w-3 fill-pink-500 text-pink-500" />
                              Charity
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs z-[100]">
                          <p className="font-medium">Support a Good Cause</p>
                          <p className="text-xs text-muted-foreground">All proceeds from this booking will be donated to charity by the spot owner.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isTopDeal && (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 flex items-center gap-1 cursor-help">
                              <Tag className="h-3 w-3" />
                              Top Deal
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs z-[100]">
                          <p className="font-medium">Great Value</p>
                          <p className="text-xs text-muted-foreground">This spot is priced at $10/day or less - one of the best deals available!</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isWeekendBooking && (
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 flex items-center gap-1 cursor-help">
                              <Sparkles className="h-3 w-3" />
                              Weekend
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs z-[100]">
                          <p className="font-medium">Weekend Booking</p>
                          <p className="text-xs text-muted-foreground">This booking is for a weekend day - perfect for personal errands or weekend activities!</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {spot.location}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                  <DollarSign className="h-5 w-5" />
                  {spot.price}/day
                </div>
                <div className="text-sm text-muted-foreground">
                  Owner: <span className="font-medium text-foreground">{(spot as any).assignedUserName || "BCI Workplace Services"}</span>
                </div>
              </div>
              {/* Booking Date Info */}
              <div className="flex items-center gap-2 mt-1 text-sm">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">{formData.date}</span>
                <span className="text-muted-foreground">(Full day: 12:00 AM - 11:59 PM)</span>
              </div>
            </div>
          </div>
          {userActiveLock && remainingSeconds > 0 && (
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1.5 whitespace-nowrap h-fit ${
                remainingSeconds <= 30 
                  ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' 
                  : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              }`}
              data-testid="badge-countdown-timer"
            >
              <Timer className="h-4 w-4" />
              {formatTime(remainingSeconds)}
            </Badge>
          )}
        </div>
      </div>

      {/* Owner's Payment Instructions - If available */}
      {ownerPaymentPreferences?.paymentInstructions && (
        <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800 px-6 py-3">
          <div className="flex items-start gap-2">
            <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Owner's Payment Instructions
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {ownerPaymentPreferences.paymentInstructions}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Section - Input Container */}
      <div className="px-6 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Your Booking Details - Highlighted Input Container */}
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Your Booking Details
            </h3>

            {/* Payment Method - Different for BCI-managed vs peer-to-peer */}
            {isPayrollSpot ? (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Payment Method</Label>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Banknote className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-amber-800">You are booking a Workplace Services spot</p>
                      <p className="text-sm text-amber-700">
                        Payment will be deducted directly from your payroll.
                      </p>
                      <p className="text-sm font-medium text-amber-600">
                        Deduction month: {getPayrollDeductionMonth(formData.date)}
                      </p>
                      <p className="text-xs text-amber-600/80 mt-1">
                        Bookings before the 20th are deducted in the same month, otherwise the next month.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="text-sm font-semibold">Payment Method</Label>
                <Select value={formData.paymentMethod} onValueChange={(value) => updateFormData("paymentMethod", value)}>
                  <SelectTrigger data-testid="select-payment-method" className="bg-background">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interac Transfer">Interac e-Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.paymentMethod && (
                  <p className="text-sm text-destructive">{validationErrors.paymentMethod}</p>
                )}
                {ownerPaymentPreferences && !ownerPaymentPreferences.paymentInstructions && (
                  <p className="text-xs text-muted-foreground">
                    Owner prefers: {ownerPaymentPreferences.paymentType === "interac_transfer" ? "Interac Transfer" : "Cash"}
                  </p>
                )}
              </div>
            )}

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contactPhone" className="text-sm font-semibold">Phone Number</Label>
                  {authUser?.phone && (
                    <Badge variant="outline" className="text-xs h-5">
                      <User className="h-3 w-3 mr-1" />
                      Profile
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.contactPhone}
                    onChange={(e) => updateFormData("contactPhone", e.target.value)}
                    required
                    data-testid="input-contact-phone"
                    className="pl-9 bg-background"
                  />
                </div>
                {validationErrors.contactPhone && (
                  <p className="text-sm text-destructive">{validationErrors.contactPhone}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vehicleInfo" className="text-sm font-semibold">Vehicle (Model & Color)</Label>
                  {authUser?.vehicleInfo?.model && (
                    <Badge variant="outline" className="text-xs h-5">
                      <User className="h-3 w-3 mr-1" />
                      Profile
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g., Camry (Blue)"
                    value={formData.vehicleInfo}
                    onChange={(e) => updateFormData("vehicleInfo", e.target.value)}
                    required
                    data-testid="input-vehicle-info"
                    className="pl-9 bg-background"
                  />
                </div>
                {validationErrors.vehicleInfo && (
                  <p className="text-sm text-destructive">{validationErrors.vehicleInfo}</p>
                )}
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-2">
              <Label htmlFor="specialInstructions" className="text-sm font-semibold">Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Textarea
                placeholder="Any special instructions or notes for the spot owner..."
                value={formData.specialInstructions}
                onChange={(e) => updateFormData("specialInstructions", e.target.value)}
                className="min-h-20 resize-none bg-background"
                data-testid="textarea-instructions"
              />
            </div>
          </div>

          {/* Legal Notice - Only show for peer-to-peer bookings */}
          {!isPayrollSpot && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-1.5">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    Important Notice
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                    BCI is not responsible for payment arrangements between users. Please ensure payment details are confirmed directly with the spot owner.
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    By booking, you agree to our{" "}
                    <a 
                      href="/terms" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-amber-950 dark:hover:text-amber-50"
                      data-testid="link-terms-conditions"
                    >
                      Terms and Conditions
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Error Display */}
          {submitError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {submitError}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
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
                <>
                  Book for ${spot.price}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
