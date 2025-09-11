import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookingForm } from "@/components/booking-form"
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock,
  MapPin,
  DollarSign,
  Zap,
  Car
} from "lucide-react"
import { format, startOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns"

type CalendarView = "day" | "week" | "month"

interface ParkingSpot {
  id: string
  spotNumber: string
  location: string
  type: "regular" | "electric" | "accessible"
  isInside: boolean
  price: number
  isAvailable: boolean
  availability: {
    date: string
    startTime: string
    endTime: string
  }
  owner: string
}

interface ParkingCalendarProps {
  spots: ParkingSpot[]
  onBookSpot: (spotId: string) => void
  selectedDate?: Date
  onDateChange?: (date: Date) => void
}

export function ParkingCalendar({ spots, onBookSpot, selectedDate = new Date(), onDateChange }: ParkingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate)
  const [view, setView] = useState<CalendarView>("week")
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)

  const navigateDate = (direction: "prev" | "next") => {
    let newDate: Date
    switch (view) {
      case "day":
        newDate = direction === "next" ? addDays(currentDate, 1) : addDays(currentDate, -1)
        break
      case "week":
        newDate = direction === "next" ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)
        break
      case "month":
        newDate = direction === "next" ? addMonths(currentDate, 1) : subMonths(currentDate, 1)
        break
    }
    setCurrentDate(newDate)
    onDateChange?.(newDate)
  }

  const getDateTitle = () => {
    switch (view) {
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy")
      case "week":
        const weekStart = startOfWeek(currentDate)
        const weekEnd = addDays(weekStart, 6)
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
      case "month":
        return format(currentDate, "MMMM yyyy")
    }
  }

  const getVisibleDates = () => {
    switch (view) {
      case "day":
        return [currentDate]
      case "week":
        const weekStart = startOfWeek(currentDate)
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      case "month":
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const calendarStart = startOfWeek(monthStart)
        const calendarEnd = addDays(startOfWeek(monthEnd), 6)
        return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    }
  }

  const getSpotsForDate = (date: Date) => {
    return spots.filter(spot => {
      const spotDate = new Date(spot.availability.date)
      return isSameDay(spotDate, date) && spot.isAvailable
    })
  }

  const getSpotTypeIcon = (type: string) => {
    switch (type) {
      case "electric":
        return <Zap className="h-3 w-3 text-green-600" />
      case "accessible":
        return <Car className="h-3 w-3 text-blue-600" />
      default:
        return <Car className="h-3 w-3 text-gray-600" />
    }
  }

  const getSpotTypeColor = (type: string) => {
    switch (type) {
      case "electric":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
      case "accessible":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const handleSpotClick = (spot: ParkingSpot) => {
    setSelectedSpot(spot)
    setShowBookingForm(true)
  }

  const handleBookingSubmit = (bookingData: any) => {
    if (selectedSpot) {
      onBookSpot(selectedSpot.id)
    }
    setShowBookingForm(false)
    setSelectedSpot(null)
  }

  const renderDayView = () => {
    const daySpots = getSpotsForDate(currentDate)
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-1 gap-2 p-4">
          <div className="text-lg font-semibold mb-4">
            {format(currentDate, "EEEE, MMMM d, yyyy")} - {daySpots.length} spots available
          </div>
          {daySpots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No parking spots available for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {daySpots.map((spot) => (
                <Card 
                  key={spot.id} 
                  className={`cursor-pointer hover-elevate transition-all border-l-4 ${getSpotTypeColor(spot.type)}`}
                  onClick={() => handleSpotClick(spot)}
                  data-testid={`calendar-spot-${spot.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getSpotTypeIcon(spot.type)}
                        <div>
                          <div className="font-medium">Spot {spot.spotNumber}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {spot.location}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ${spot.price}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {spot.availability.startTime} - {spot.availability.endTime}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {spot.type}
                      </Badge>
                      {spot.isInside && (
                        <Badge variant="outline" className="text-xs">
                          Indoor
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {spot.owner}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = getVisibleDates()
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-7 gap-1 border-b">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="p-2 text-center border-r last:border-r-0">
              <div className="font-medium text-sm">{format(day, "EEE")}</div>
              <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-primary font-bold' : ''}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDays.map((day) => {
            const daySpots = getSpotsForDate(day)
            return (
              <div key={day.toISOString()} className="border-r last:border-r-0 p-2 min-h-[200px]">
                <div className="space-y-1">
                  {daySpots.slice(0, 3).map((spot) => (
                    <div
                      key={spot.id}
                      className={`p-2 rounded text-xs cursor-pointer hover-elevate transition-all ${getSpotTypeColor(spot.type)}`}
                      onClick={() => handleSpotClick(spot)}
                      data-testid={`calendar-spot-${spot.id}`}
                    >
                      <div className="font-medium">{spot.spotNumber}</div>
                      <div className="flex items-center gap-1">
                        {getSpotTypeIcon(spot.type)}
                        <span>${spot.price}</span>
                      </div>
                      <div className="text-xs opacity-75">
                        {spot.availability.startTime}
                      </div>
                    </div>
                  ))}
                  {daySpots.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{daySpots.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDays = getVisibleDates()
    
    return (
      <div className="h-full">
        <div className="grid grid-cols-7 gap-1 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center font-medium text-sm border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {monthDays.map((day) => {
            const daySpots = getSpotsForDate(day)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = isSameDay(day, new Date())
            
            return (
              <div 
                key={day.toISOString()} 
                className={`border-r border-b last:border-r-0 p-1 min-h-[80px] ${!isCurrentMonth ? 'opacity-50 bg-muted/20' : ''}`}
              >
                <div className={`text-sm mb-1 ${isToday ? 'text-primary font-bold' : ''}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {daySpots.slice(0, 2).map((spot) => (
                    <div
                      key={spot.id}
                      className={`p-1 rounded text-xs cursor-pointer hover-elevate transition-all ${getSpotTypeColor(spot.type)}`}
                      onClick={() => handleSpotClick(spot)}
                      data-testid={`calendar-spot-${spot.id}`}
                    >
                      <div className="flex items-center gap-1">
                        {getSpotTypeIcon(spot.type)}
                        <span className="font-medium">{spot.spotNumber}</span>
                      </div>
                      <div>${spot.price}</div>
                    </div>
                  ))}
                  {daySpots.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{daySpots.length - 2}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCalendarContent = () => {
    switch (view) {
      case "day":
        return renderDayView()
      case "week":
        return renderWeekView()
      case "month":
        return renderMonthView()
    }
  }

  return (
    <div className="h-full flex flex-col" data-testid="parking-calendar">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-lg font-semibold">{getDateTitle()}</div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={view === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("day")}
            data-testid="calendar-view-day"
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            data-testid="calendar-view-week"
          >
            Week
          </Button>
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
            data-testid="calendar-view-month"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto">
        {renderCalendarContent()}
      </div>

      {/* Booking Dialog */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Parking Spot</DialogTitle>
          </DialogHeader>
          {selectedSpot && (
            <BookingForm
              spot={selectedSpot}
              onSubmit={handleBookingSubmit}
              onCancel={() => setShowBookingForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}