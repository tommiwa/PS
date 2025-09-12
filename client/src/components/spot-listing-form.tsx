import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, Clock, DollarSign, MapPin, Car, AlertTriangle, CalendarDays, Repeat } from "lucide-react"
import { getTodayString } from "@/utils/date-utils"

interface SpotListingData {
  spotNumber: string
  location: string
  spotType: "regular" | "electric" | "accessible"
  isInside: boolean
  price: string
  // Single day
  date: string
  // Period
  startDate: string
  endDate: string
  // Recurring
  recurringDays: string[]
  recurringStartDate: string
  recurringEndDate: string
  // Common
  description: string
  specialInstructions: string
  listingType: "single" | "period" | "recurring"
}

interface SpotListingFormProps {
  onSubmit: (listingData: SpotListingData) => void
  onCancel: () => void
}

export function SpotListingForm({ onSubmit, onCancel }: SpotListingFormProps) {
  const [listingType, setListingType] = useState<"single" | "period" | "recurring">("single")
  const [formData, setFormData] = useState({
    spotNumber: "",
    location: "",
    spotType: "regular" as const,
    isInside: false,
    price: "",
    // Single day
    date: getTodayString(),
    // Period
    startDate: getTodayString(),
    endDate: getTodayString(),
    // Recurring
    recurringDays: [] as string[],
    recurringStartDate: getTodayString(),
    recurringEndDate: "", // Optional end date for recurring
    // Common
    description: "",
    specialInstructions: ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleRecurringDayChange = (day: string, checked: boolean) => {
    const newDays = checked 
      ? [...formData.recurringDays, day]
      : formData.recurringDays.filter(d => d !== day)
    updateFormData("recurringDays", newDays)
  }

  const [submitError, setSubmitError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Basic required fields
    if (!formData.spotNumber.trim()) {
      errors.spotNumber = "Spot number is required"
    }
    if (!formData.location) {
      errors.location = "Location is required"
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = "Valid price is required"
    }

    // Date validations based on listing type
    if (listingType === "single") {
      if (!formData.date) {
        errors.date = "Date is required"
      }
    } else if (listingType === "period") {
      if (!formData.startDate) {
        errors.startDate = "Start date is required"
      }
      if (!formData.endDate) {
        errors.endDate = "End date is required"
      }
      if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        errors.endDate = "End date must be after start date"
      }
    } else if (listingType === "recurring") {
      if (formData.recurringDays.length === 0) {
        errors.recurringDays = "Please select at least one day of the week"
      }
      if (!formData.recurringStartDate) {
        errors.recurringStartDate = "Start date is required"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    setValidationErrors({})

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    
    try {
      // Simulate API call with potential failure
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 90% success rate for testing
          if (Math.random() > 0.1) {
            console.log('Submitting spot listing:', { ...formData, listingType })
            resolve(true)
          } else {
            reject(new Error("Failed to create listing. Please try again."))
          }
        }, 1000)
      })
      
      onSubmit({ ...formData, listingType })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const weekDays = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" }
  ]

  const getSpotTypeIcon = () => {
    const spotType = formData.spotType as "regular" | "electric" | "accessible"
    switch (spotType) {
      case "electric":
        return <Car className="h-4 w-4 text-blue-600" />
      case "accessible":
        return <Car className="h-4 w-4 text-green-600" />
      default:
        return <Car className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Listing Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Choose Listing Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={listingType} onValueChange={(value: string) => setListingType(value as "single" | "period" | "recurring")} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single" className="cursor-pointer flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Single Day
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="period" id="period" />
              <Label htmlFor="period" className="cursor-pointer flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Date Range
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recurring" id="recurring" />
              <Label htmlFor="recurring" className="cursor-pointer flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Recurring Days
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Spot Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getSpotTypeIcon()}
              Spot Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spotNumber">Spot Number *</Label>
                <Input
                  placeholder="e.g., A-15"
                  value={formData.spotNumber}
                  onChange={(e) => updateFormData("spotNumber", e.target.value)}
                  required
                  data-testid="input-spot-number"
                />
                {validationErrors.spotNumber && (
                  <p className="text-sm text-red-600">{validationErrors.spotNumber}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select value={formData.location} onValueChange={(value) => updateFormData("location", value)}>
                  <SelectTrigger data-testid="select-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Building - Level 1">Main Building - Level 1</SelectItem>
                    <SelectItem value="Main Building - Level 2">Main Building - Level 2</SelectItem>
                    <SelectItem value="Main Building - Level 3">Main Building - Level 3</SelectItem>
                    <SelectItem value="North Parking Lot">North Parking Lot</SelectItem>
                    <SelectItem value="South Parking Lot">South Parking Lot</SelectItem>
                    <SelectItem value="West Parking Lot">West Parking Lot</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.location && (
                  <p className="text-sm text-red-600">{validationErrors.location}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spotType">Spot Type</Label>
                <Select value={formData.spotType} onValueChange={(value) => updateFormData("spotType", value)}>
                  <SelectTrigger data-testid="select-spot-type">
                    <SelectValue placeholder="Select spot type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="electric">Electric Vehicle Charging</SelectItem>
                    <SelectItem value="accessible">Accessible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Daily Price ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="25"
                  value={formData.price}
                  onChange={(e) => updateFormData("price", e.target.value)}
                  required
                  data-testid="input-price"
                />
                {validationErrors.price && (
                  <p className="text-sm text-red-600">{validationErrors.price}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isInside" 
                checked={formData.isInside}
                onCheckedChange={(checked) => updateFormData("isInside", checked)}
                data-testid="checkbox-inside"
              />
              <Label htmlFor="isInside">Indoor parking spot</Label>
            </div>
          </CardContent>
        </Card>

        {/* Date Selection Based on Type */}
        {listingType === "single" && (
          <Card>
            <CardHeader>
              <CardTitle>Single Day Listing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  min={getTodayString()}
                  onChange={(e) => updateFormData("date", e.target.value)}
                  required
                  data-testid="input-date"
                />
                {validationErrors.date && (
                  <p className="text-sm text-red-600">{validationErrors.date}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {listingType === "period" && (
          <Card>
            <CardHeader>
              <CardTitle>Date Range Listing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    min={getTodayString()}
                    onChange={(e) => updateFormData("startDate", e.target.value)}
                    required
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || getTodayString()}
                    onChange={(e) => updateFormData("endDate", e.target.value)}
                    required
                    data-testid="input-end-date"
                  />
                  {validationErrors.endDate && (
                    <p className="text-sm text-red-600">{validationErrors.endDate}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {listingType === "recurring" && (
          <Card>
            <CardHeader>
              <CardTitle>Recurring Days Listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Select Days of the Week *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {weekDays.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.value}
                        checked={formData.recurringDays.includes(day.value)}
                        onCheckedChange={(checked) => handleRecurringDayChange(day.value, !!checked)}
                        data-testid={`checkbox-${day.value}`}
                      />
                      <Label htmlFor={day.value} className="text-sm cursor-pointer">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {formData.recurringDays.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-sm text-muted-foreground">Selected:</Label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {formData.recurringDays.map((day) => (
                        <Badge key={day} variant="secondary" className="text-xs">
                          {weekDays.find(d => d.value === day)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {validationErrors.recurringDays && (
                  <p className="text-sm text-red-600">{validationErrors.recurringDays}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurringStartDate">Start From *</Label>
                  <Input
                    type="date"
                    value={formData.recurringStartDate}
                    min={getTodayString()}
                    onChange={(e) => updateFormData("recurringStartDate", e.target.value)}
                    required
                    data-testid="input-recurring-start"
                  />
                  {validationErrors.recurringStartDate && (
                    <p className="text-sm text-red-600">{validationErrors.recurringStartDate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurringEndDate">End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.recurringEndDate}
                    min={formData.recurringStartDate || getTodayString()}
                    onChange={(e) => updateFormData("recurringEndDate", e.target.value)}
                    data-testid="input-recurring-end"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for ongoing recurring availability</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                placeholder="Describe your parking spot, any special features, or important details..."
                value={formData.description}
                onChange={(e) => updateFormData("description", e.target.value)}
                className="min-h-20"
                data-testid="textarea-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions (Optional)</Label>
              <Textarea
                placeholder="Any special instructions for renters (access codes, parking rules, etc.)"
                value={formData.specialInstructions}
                onChange={(e) => updateFormData("specialInstructions", e.target.value)}
                className="min-h-20"
                data-testid="textarea-instructions"
              />
            </div>
          </CardContent>
        </Card>

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
                Please ensure parking spot details and payment terms are clearly communicated with renters.
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
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
            data-testid="button-cancel-listing"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={
              isSubmitting || 
              !formData.spotNumber || 
              !formData.location || 
              !formData.price ||
              (listingType === "recurring" && formData.recurringDays.length === 0)
            }
            className="flex-1"
            data-testid="button-submit-listing"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Creating Listing...
              </>
            ) : (
              `Create ${listingType === "single" ? "Single Day" : listingType === "period" ? "Period" : "Recurring"} Listing`
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}