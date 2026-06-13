import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, Clock, DollarSign, MapPin, Car, AlertTriangle, CalendarDays, Repeat, Heart } from "lucide-react"
import { getTodayString } from "@/utils/date-utils"
import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { getBCStatHolidaysForRange } from "@/lib/bc-stat-holidays"
import { queryClient } from "@/lib/queryClient"
import type { ParkingSpotWithUser } from "@shared/schema"

interface SpotListingData {
  spotId: string
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
  initialData?: any
}

export function SpotListingForm({ onSubmit, onCancel, initialData }: SpotListingFormProps) {
  // When editing, always treat as single day since each listing day is independent
  const isEditMode = !!initialData
  const currentYear = new Date().getFullYear()
  const holidays = getBCStatHolidaysForRange(currentYear, currentYear + 1)
  const [listingType, setListingType] = useState<"single" | "period" | "recurring">("single")
  const [formData, setFormData] = useState({
    spotId: "",
    price: "",
    // Single day
    date: getTodayString(),
    // Period
    startDate: "",
    endDate: "",
    // Recurring
    recurringDays: [] as string[],
    recurringStartDate: getTodayString(),
    recurringEndDate: "", // Optional end date for recurring
    // Common
    description: "",
    specialInstructions: "",
    donateToCharity: false
  })
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotWithUser | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [singleDateOpen, setSingleDateOpen] = useState(false)
  const [periodStartOpen, setPeriodStartOpen] = useState(false)
  const [periodEndOpen, setPeriodEndOpen] = useState(false)
  const [recurringStartOpen, setRecurringStartOpen] = useState(false)
  const [recurringEndOpen, setRecurringEndOpen] = useState(false)

  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined
    const d = new Date(dateStr + 'T12:00:00')
    return isNaN(d.getTime()) ? undefined : d
  }
  const formatDateStr = (date: Date | undefined): string => {
    if (!date) return ""
    return format(date, "yyyy-MM-dd")
  }
  const todayDate = new Date()
  const maxFutureDate = new Date()
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 6)

  // Fetch user's parking spots
  const { data: userSpots = [], isLoading: spotsLoading } = useQuery<ParkingSpotWithUser[]>({
    queryKey: ['/api/my-spots'],
    enabled: true // Always fetch spots when form opens
  })

  // Fetch default daily rate from system settings
  const { data: defaultDailyRateConfig } = useQuery<{ value: string }>({
    queryKey: ['/api/app-configs', 'default_daily_rate'],
  })
  const systemDefaultRate = defaultDailyRateConfig?.value || "10"

  // Populate form with initial data when editing an existing listing
  useEffect(() => {
    if (initialData && userSpots.length > 0) {
      // In edit mode, always use single day type since each listing is treated independently
      setListingType("single")
      
      // Find and set the spot
      const spotId = initialData.spotId || initialData.spot?.id || ""
      const spot = userSpots.find((s) => s.id === spotId)
      if (spot) {
        setSelectedSpot(spot)
      }
      
      // Populate form data based on the listing
      setFormData({
        spotId: spotId,
        price: initialData.dailyRate || initialData.price || systemDefaultRate,
        // Single day - use date or singleDate
        date: initialData.date || initialData.singleDate || getTodayString(),
        // Period
        startDate: initialData.periodStartDate || initialData.startDate || "",
        endDate: initialData.periodEndDate || initialData.endDate || "",
        // Recurring
        recurringDays: initialData.daysOfWeek || initialData.recurringDays || [],
        recurringStartDate: initialData.recurringStartDate || getTodayString(),
        recurringEndDate: initialData.recurringEndDate || "",
        // Common
        description: initialData.notes || initialData.description || "",
        specialInstructions: initialData.specialInstructions || "",
        donateToCharity: initialData.donateToCharity || false
      })
    }
  }, [initialData, userSpots, systemDefaultRate])

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSpotSelection = (spotId: string) => {
    const spot = userSpots.find((s) => s.id === spotId)
    setSelectedSpot(spot || null)
    updateFormData("spotId", spotId)
    
    // Auto-populate price: use spot's default price if set, otherwise system default
    if (spot) {
      const spotDefaultPrice = (spot as any).defaultPrice
      if (spotDefaultPrice && parseFloat(spotDefaultPrice) > 0) {
        updateFormData("price", String(spotDefaultPrice))
      } else if (!formData.price) {
        // Only set system default if price is empty
        updateFormData("price", systemDefaultRate)
      }
    }
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
    if (!formData.spotId) {
      errors.spotId = "Please select a parking spot"
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      errors.price = "Valid price is required"
    }

    // Date validations - in edit mode, always validate single day only
    if (isEditMode || listingType === "single") {
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
      if (!formData.recurringEndDate) {
        errors.recurringEndDate = "End date is required"
      }
      if (formData.recurringStartDate && formData.recurringEndDate && formData.recurringStartDate > formData.recurringEndDate) {
        errors.recurringEndDate = "End date must be after start date"
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
      if (isEditMode) {
        // Update existing listing - only single day fields since each listing is independent
        const updateData = {
          dailyRate: formData.price,
          singleDate: formData.date,
          notes: formData.description || null,
          donateToCharity: formData.donateToCharity
        }

        const listingId = initialData.id
        const response = await fetch(`/api/spot-listings/${listingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to update listing. Please try again.")
        }

        // Invalidate queries to refresh the listings
        queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
        queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] })
        
        console.log('Updated spot listing:', { listingId, ...updateData })
      } else {
        // Create new listing via API
        const listingData = {
          spotId: formData.spotId,
          listingType,
          price: parseFloat(formData.price),
          singleDate: listingType === "single" ? formData.date : null,
          periodStartDate: listingType === "period" ? formData.startDate : null,
          periodEndDate: listingType === "period" ? formData.endDate : null,
          recurringStartDate: listingType === "recurring" ? formData.recurringStartDate : null,
          recurringEndDate: listingType === "recurring" ? formData.recurringEndDate || null : null,
          daysOfWeek: listingType === "recurring" ? formData.recurringDays : null,
          notes: formData.description || null,
          donateToCharity: formData.donateToCharity
        }

        const response = await fetch('/api/spot-listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listingData)
        })

        if (!response.ok) {
          throw new Error("Failed to create listing. Please try again.")
        }

        // Invalidate queries to refresh the listings
        queryClient.invalidateQueries({ queryKey: ['/api/my-listings'] })
        queryClient.invalidateQueries({ queryKey: ['/api/available-spots'] })
        
        console.log('Submitting spot listing:', { ...formData, listingType })
      }
      
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

  const getSpotTypeIcon = (spotType?: string) => {
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
      {/* Listing Type Selection - Only show when creating new listing, not when editing */}
      {!isEditMode && (
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
      )}

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
              {isEditMode ? (
                /* In edit mode, show spot info as read-only */
                <div className="space-y-2">
                  <Label>Parking Spot</Label>
                  {selectedSpot ? (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {getSpotTypeIcon(selectedSpot.spotTypeName)}
                        <span className="font-semibold">{selectedSpot.spotNumber}</span>
                        <Badge variant="outline">{selectedSpot.spotTypeName}</Badge>
                        {selectedSpot.isIndoor && <Badge variant="secondary">Indoor</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedSpot.locationName}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                      Spot: {initialData?.spotNumber || initialData?.spot?.spotNumber || 'Unknown'}
                    </div>
                  )}
                </div>
              ) : (
                /* In create mode, allow spot selection */
                <div className="space-y-2">
                  <Label htmlFor="spotId">Select Your Parking Spot *</Label>
                  {spotsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading your spots...</div>
                  ) : userSpots.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No spots found. Please add a spot in "My Spots" first.
                    </div>
                  ) : (
                    <Select value={formData.spotId} onValueChange={handleSpotSelection}>
                      <SelectTrigger data-testid="select-parking-spot">
                        <SelectValue placeholder="Select your parking spot" />
                      </SelectTrigger>
                      <SelectContent>
                        {userSpots.map((spot) => (
                          <SelectItem key={spot.id} value={spot.id}>
                            {spot.spotNumber} - {spot.locationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {validationErrors.spotId && (
                    <p className="text-sm text-red-600">{validationErrors.spotId}</p>
                  )}
                </div>
              )}
              {!isEditMode && selectedSpot && (
                <div className="space-y-2">
                  <Label>Selected Spot Details</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {getSpotTypeIcon(selectedSpot.spotTypeName)}
                      <span className="font-semibold">{selectedSpot.spotNumber}</span>
                      <Badge variant="outline">{selectedSpot.spotTypeName}</Badge>
                      {selectedSpot.isIndoor && <Badge variant="secondary">Indoor</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedSpot.locationName}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Daily Price ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`e.g. ${systemDefaultRate}`}
                  value={formData.price}
                  onChange={(e) => updateFormData("price", e.target.value)}
                  required
                  data-testid="input-price"
                  className="placeholder:text-muted-foreground/50"
                />
                {validationErrors.price && (
                  <p className="text-sm text-red-600">{validationErrors.price}</p>
                )}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Date Selection Based on Type - In edit mode, always show single day */}
        {(isEditMode || listingType === "single") && (
          <Card>
            <CardHeader>
              <CardTitle>{isEditMode ? "Listing Date" : "Single Day Listing"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Popover open={singleDateOpen} onOpenChange={setSingleDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-date"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {formData.date ? format(parseDate(formData.date)!, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {singleDateOpen && (
                      <CalendarComponent
                        mode="single"
                        selected={parseDate(formData.date)}
                        defaultMonth={parseDate(formData.date) || new Date()}
                        onSelect={(date) => {
                          updateFormData("date", formatDateStr(date))
                          setSingleDateOpen(false)
                        }}
                        disabled={(date) => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          return date < today || date > maxFutureDate
                        }}
                        holidays={holidays}
                        initialFocus
                      />
                    )}
                  </PopoverContent>
                </Popover>
                {validationErrors.date && (
                  <p className="text-sm text-red-600">{validationErrors.date}</p>
                )}
                {formData.date && holidays[formData.date] && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                    BC Stat Holiday: {holidays[formData.date]}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isEditMode && listingType === "period" && (
          <Card>
            <CardHeader>
              <CardTitle>Date Range Listing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Popover open={periodStartOpen} onOpenChange={setPeriodStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-start-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {formData.startDate && parseDate(formData.startDate) ? format(parseDate(formData.startDate)!, "PPP") : "Pick start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      {periodStartOpen && (
                        <CalendarComponent
                          mode="single"
                          selected={parseDate(formData.startDate)}
                          defaultMonth={parseDate(formData.startDate) || parseDate(formData.endDate) || new Date()}
                          onSelect={(date) => {
                            const dateStr = formatDateStr(date)
                            updateFormData("startDate", dateStr)
                            if (dateStr && (!formData.endDate || formData.endDate < dateStr)) {
                              updateFormData("endDate", dateStr)
                            }
                            setPeriodStartOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            return date < today || date > maxFutureDate
                          }}
                          holidays={holidays}
                          initialFocus
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                  {validationErrors.startDate && (
                    <p className="text-sm text-red-600">{validationErrors.startDate}</p>
                  )}
                  {formData.startDate && holidays[formData.startDate] && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                      BC Stat Holiday: {holidays[formData.startDate]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className={!formData.startDate ? "text-muted-foreground" : ""}>End Date *</Label>
                  <Popover open={periodEndOpen} onOpenChange={(open) => { if (formData.startDate) setPeriodEndOpen(open) }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-end-date"
                        disabled={!formData.startDate}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {formData.endDate && parseDate(formData.endDate) ? format(parseDate(formData.endDate)!, "PPP") : "Pick end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      {periodEndOpen && (
                        <CalendarComponent
                          key={formData.startDate || 'end-cal'}
                          mode="single"
                          selected={parseDate(formData.endDate)}
                          defaultMonth={parseDate(formData.startDate) || parseDate(formData.endDate) || new Date()}
                          onSelect={(date) => {
                            const dateStr = formatDateStr(date)
                            updateFormData("endDate", dateStr)
                            setPeriodEndOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const startDate = parseDate(formData.startDate)
                            if (date < today || date > maxFutureDate) return true
                            if (startDate && date < startDate) return true
                            return false
                          }}
                          holidays={holidays}
                          initialFocus
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                  {!formData.startDate && (
                    <p className="text-xs text-muted-foreground">Select a start date first</p>
                  )}
                  {validationErrors.endDate && (
                    <p className="text-sm text-red-600">{validationErrors.endDate}</p>
                  )}
                  {formData.endDate && holidays[formData.endDate] && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                      BC Stat Holiday: {holidays[formData.endDate]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isEditMode && listingType === "recurring" && (
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
                  <Popover open={recurringStartOpen} onOpenChange={setRecurringStartOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-recurring-start"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {formData.recurringStartDate ? format(parseDate(formData.recurringStartDate)!, "PPP") : "Pick start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      {recurringStartOpen && (
                        <CalendarComponent
                          mode="single"
                          selected={parseDate(formData.recurringStartDate)}
                          defaultMonth={parseDate(formData.recurringStartDate) || new Date()}
                          onSelect={(date) => {
                            const dateStr = formatDateStr(date)
                            updateFormData("recurringStartDate", dateStr)
                            if (dateStr && formData.recurringEndDate && formData.recurringEndDate < dateStr) {
                              updateFormData("recurringEndDate", dateStr)
                            }
                            setRecurringStartOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            return date < today || date > maxFutureDate
                          }}
                          holidays={holidays}
                          initialFocus
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                  {validationErrors.recurringStartDate && (
                    <p className="text-sm text-red-600">{validationErrors.recurringStartDate}</p>
                  )}
                  {formData.recurringStartDate && holidays[formData.recurringStartDate] && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                      BC Stat Holiday: {holidays[formData.recurringStartDate]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurringEndDate">End Date *</Label>
                  <Popover open={recurringEndOpen} onOpenChange={setRecurringEndOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-recurring-end"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {formData.recurringEndDate ? format(parseDate(formData.recurringEndDate)!, "PPP") : "Pick end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      {recurringEndOpen && (
                        <CalendarComponent
                          mode="single"
                          selected={parseDate(formData.recurringEndDate)}
                          defaultMonth={parseDate(formData.recurringEndDate) || parseDate(formData.recurringStartDate) || new Date()}
                          onSelect={(date) => {
                            updateFormData("recurringEndDate", formatDateStr(date))
                            setRecurringEndOpen(false)
                          }}
                          disabled={(date) => {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            if (date < today || date > maxFutureDate) return true
                            const startDate = parseDate(formData.recurringStartDate)
                            if (startDate && date < startDate) return true
                            return false
                          }}
                          holidays={holidays}
                          initialFocus
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                  {validationErrors.recurringEndDate && (
                    <p className="text-sm text-red-600">{validationErrors.recurringEndDate}</p>
                  )}
                  {formData.recurringEndDate && holidays[formData.recurringEndDate] && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                      BC Stat Holiday: {holidays[formData.recurringEndDate]}
                    </p>
                  )}
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

            {/* Donate to Charity Option */}
            <div className="flex items-start space-x-3 p-4 bg-pink-50 border-2 border-pink-300 rounded-lg">
              <Checkbox
                id="donateToCharity"
                checked={formData.donateToCharity}
                onCheckedChange={(checked) => updateFormData("donateToCharity", checked === true)}
                className="mt-0.5 h-5 w-5 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                data-testid="checkbox-donate-to-charity"
              />
              <div className="space-y-1">
                <Label htmlFor="donateToCharity" className="cursor-pointer font-medium text-pink-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
                  Donate Earnings to Charity
                </Label>
                <p className="text-sm text-pink-700">
                  By selecting this, you commit to donating all earnings from this listing to charity. A special badge will appear on the listing.
                </p>
              </div>
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
              (!isEditMode && !formData.spotId) || 
              !formData.price ||
              (!isEditMode && listingType === "recurring" && formData.recurringDays.length === 0)
            }
            className="flex-1"
            data-testid="button-submit-listing"
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                {isEditMode ? "Saving Changes..." : "Creating Listing..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              `Create ${listingType === "single" ? "Single Day" : listingType === "period" ? "Period" : "Recurring"} Listing`
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}