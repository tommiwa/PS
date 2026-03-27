import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  DollarSign,
  Tag,
  User,
} from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  isValid,
  getDay,
} from "date-fns"
import { useAuth } from "@/contexts/auth-context"

type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed"
type ListingStatus = "available" | "booked" | "used" | "unused" | "cancelled"

interface RenterBookingView {
  id: string
  bookingDate: string
  spotNumber: string
  location: string
  dailyRate: string | number
  status: BookingStatus
  ownerName?: string | null
}

interface OwnerListingView {
  id: string
  listingType: "single" | "period" | "recurring"
  singleDate: string | null
  periodStartDate: string | null
  periodEndDate: string | null
  recurringStartDate: string | null
  recurringEndDate: string | null
  daysOfWeek: string[] | null
  spot: { spotNumber?: string; location?: string } | null
  dailyRate: string | number
  status: ListingStatus
  renterName?: string | null
}

type CalendarEntry = {
  id: string
  date: string
  spotNumber: string
  location: string
  dailyRate: number
  status: string
  type: "booking" | "listing"
  personName?: string | null
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function safeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  return isValid(d) ? d : null
}

function expandListingToDates(listing: OwnerListingView): string[] {
  const type = listing.listingType
  if (type === "single") {
    const d = listing.singleDate
    return d ? [d] : []
  }
  if (type === "period") {
    const start = safeDate(listing.periodStartDate)
    const end = safeDate(listing.periodEndDate)
    if (!start || !end) return listing.periodStartDate ? [listing.periodStartDate] : []
    return eachDayOfInterval({ start, end }).map((d) => format(d, "yyyy-MM-dd"))
  }
  if (type === "recurring") {
    const start = safeDate(listing.recurringStartDate)
    if (!start) return []
    const end = safeDate(listing.recurringEndDate)
    const allowedDays = (listing.daysOfWeek ?? []).map(
      (d) => DAY_NAME_TO_INDEX[d.toLowerCase()] ?? -1
    )
    const rangeEnd = end ?? addMonths(start, 12)
    return eachDayOfInterval({ start, end: rangeEnd })
      .filter((d) => allowedDays.includes(getDay(d)))
      .map((d) => format(d, "yyyy-MM-dd"))
  }
  return []
}

function listingToCalendarEntries(listing: OwnerListingView): CalendarEntry[] {
  const spotNumber = listing.spot?.spotNumber ?? "?"
  const location = listing.spot?.location ?? "Unknown"
  const dailyRate = Number(listing.dailyRate ?? 0)
  const status = listing.status ?? "available"
  const dates = expandListingToDates(listing)
  return dates.map((date) => ({
    id: listing.id,
    date,
    spotNumber,
    location,
    dailyRate,
    status,
    type: "listing" as const,
    personName: listing.renterName ?? null,
  }))
}

function bookingToCalendarEntry(booking: RenterBookingView): CalendarEntry {
  return {
    id: booking.id,
    date: booking.bookingDate ?? "",
    spotNumber: booking.spotNumber ?? "?",
    location: booking.location ?? "Unknown",
    dailyRate: Number(booking.dailyRate ?? 0),
    status: booking.status ?? "confirmed",
    type: "booking",
    personName: booking.ownerName ?? null,
  }
}

function getEntryColor(entry: CalendarEntry): string {
  if (entry.type === "booking") {
    if (entry.status === "cancelled") {
      return "bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500"
    }
    if (entry.status === "confirmed" || entry.status === "completed") {
      const today = format(new Date(), "yyyy-MM-dd")
      if (entry.date > today) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      if (entry.date === today) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    }
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
  } else {
    if (entry.status === "cancelled" || entry.status === "unused") {
      return "bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500"
    }
    if (entry.status === "booked" || entry.status === "used") {
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    }
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
  }
}

function getStatusLabel(status: string, entryType?: "booking" | "listing", entryDate?: string): string {
  if (entryType === "booking" && (status === "confirmed" || status === "completed") && entryDate) {
    const today = format(new Date(), "yyyy-MM-dd")
    if (entryDate > today) return "Upcoming"
    if (entryDate === today) return "Active"
    return "Completed"
  }
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    pending: "Pending",
    available: "Available",
    booked: "Booked",
    unused: "Unused",
    used: "Used",
  }
  return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
}

function EntryChip({ entry }: { entry: CalendarEntry }) {
  const colorClass = getEntryColor(entry)
  return (
    <div className={`text-xs rounded px-1 py-0.5 truncate leading-tight ${colorClass}`}>
      {entry.spotNumber}
    </div>
  )
}

function EntryCard({ entry, isOwnerView }: { entry: CalendarEntry; isOwnerView: boolean }) {
  const colorClass = getEntryColor(entry)
  const shortLocation = entry.location.split(" - ")[0] ?? entry.location
  const personName = entry.personName
  const personLabel = isOwnerView ? "Renter" : "Owner"
  return (
    <div className={`flex-1 min-h-0 rounded p-1 flex flex-col gap-0.5 overflow-hidden ${colorClass}`}>
      <div className="font-semibold text-xs leading-tight truncate">Spot {entry.spotNumber}</div>
      <div className="text-[10px] leading-tight truncate opacity-80">{shortLocation}</div>
      {personName && (
        <div className="text-[10px] leading-tight truncate opacity-80">
          <span className="opacity-70">{personLabel}: </span>{personName}
        </div>
      )}
      <div className="text-[10px] leading-tight opacity-80 font-medium">
        {getStatusLabel(entry.status, entry.type, entry.date)}
      </div>
      <div className="text-[10px] leading-tight opacity-70 hidden sm:block">
        ${Number(entry.dailyRate).toFixed(2)}/day
      </div>
    </div>
  )
}

function DayCell({
  date,
  entries,
  isCurrentMonth,
  isOwnerView,
}: {
  date: Date
  entries: CalendarEntry[]
  isCurrentMonth: boolean
  isOwnerView: boolean
}) {
  const [open, setOpen] = useState(false)
  const maxVisible = 2
  const visible = entries.slice(0, maxVisible)
  const overflow = entries.length - maxVisible
  const isCurrentDay = isToday(date)
  const single = entries.length === 1

  const dateNumber = (
    <span
      className={`text-xs font-medium self-end mb-0.5 h-5 w-5 flex items-center justify-center rounded-full flex-shrink-0 ${
        isCurrentDay
          ? "bg-primary text-primary-foreground"
          : isCurrentMonth
          ? "text-foreground"
          : "text-muted-foreground"
      }`}
    >
      {format(date, "d")}
    </span>
  )

  if (entries.length === 0) {
    return (
      <div
        className={`min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] p-1 border-r border-b border-border flex flex-col ${
          !isCurrentMonth ? "bg-muted/20" : ""
        }`}
      >
        {dateNumber}
      </div>
    )
  }

  const trigger = (
    <div
      className={`min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] p-1 border-r border-b border-border flex flex-col cursor-pointer hover-elevate ${
        !isCurrentMonth ? "bg-muted/20" : ""
      }`}
    >
      {dateNumber}
      <div className="flex flex-col gap-0.5 flex-1 min-h-0">
        {single ? (
          <EntryCard entry={entries[0]} isOwnerView={isOwnerView} />
        ) : (
          <>
            {visible.map((e, i) => (
              <EntryChip key={`${e.id}-${e.date}-${i}`} entry={e} />
            ))}
            {overflow > 0 && (
              <div className="text-xs text-muted-foreground pl-0.5">+{overflow}</div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center">
        <p className="text-sm font-semibold mb-2">{format(date, "EEEE, MMMM d, yyyy")}</p>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {entries.map((entry, i) => {
            const entryDateLabel = entry.date
              ? format(parseISO(entry.date), "MMMM d, yyyy")
              : format(date, "MMMM d, yyyy")
            const personLabel = isOwnerView
              ? entry.personName
                ? `Renter: ${entry.personName}`
                : null
              : entry.personName
              ? `Owner: ${entry.personName}`
              : null
            return (
              <div
                key={`${entry.id}-${entry.date}-${i}`}
                className="flex flex-col gap-1 p-2 rounded-md border border-border bg-card"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">Spot {entry.spotNumber}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      entry.status === "cancelled" || entry.status === "unused"
                        ? "opacity-60"
                        : entry.type === "listing" && entry.status === "available"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : ""
                    }`}
                  >
                    {getStatusLabel(entry.status, entry.type, entry.date)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3 flex-shrink-0" />
                  <span>{entryDateLabel}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{entry.location}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3 flex-shrink-0" />
                  <span>${entry.dailyRate.toFixed(2)} / day</span>
                  <Tag className="h-3 w-3 ml-2 flex-shrink-0" />
                  <span className="capitalize">{entry.type === "booking" ? "Rental" : "Your Listing"}</span>
                </div>
                {personLabel && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{personLabel}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function MyCalendar() {
  const { getCurrentViewRole, isOwner } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const effectiveRole = getCurrentViewRole()
  const isOwnerView = effectiveRole === "owner" || (effectiveRole === null && isOwner())

  const { data: renterBookings = [], isLoading: isLoadingBookings } = useQuery<RenterBookingView[]>({
    queryKey: ["/api/my-bookings"],
    enabled: !isOwnerView,
  })

  const { data: ownerListings = [], isLoading: isLoadingListings } = useQuery<OwnerListingView[]>({
    queryKey: ["/api/my-listings"],
    enabled: isOwnerView,
  })

  const isLoading = isOwnerView ? isLoadingListings : isLoadingBookings

  const allEntries: CalendarEntry[] = isOwnerView
    ? ownerListings.flatMap((l) => listingToCalendarEntries(l))
    : renterBookings.map((b) => bookingToCalendarEntry(b))

  const entries: CalendarEntry[] = allEntries.filter((e) => e.status !== "cancelled")

  const entriesByDate = entries.reduce<Record<string, CalendarEntry[]>>((acc, entry) => {
    if (!entry.date) return acc
    if (!acc[entry.date]) acc[entry.date] = []
    acc[entry.date].push(entry)
    return acc
  }, {})

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const prevMonth = () => setCurrentMonth((d) => subMonths(d, 1))
  const nextMonth = () => setCurrentMonth((d) => addMonths(d, 1))

  const dayHeadersFull = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dayHeadersShort = ["S", "M", "T", "W", "T", "F", "S"]

  const totalEntries = entries.length

  return (
    <div className="h-full flex flex-col overflow-hidden p-3 md:p-4">
      <div className="mb-3 flex items-center gap-3 flex-shrink-0">
        <CalendarDays className="h-5 w-5 text-primary flex-shrink-0" />
        <div>
          <h1 className="text-lg font-semibold leading-tight">My Calendar</h1>
          <p className="text-xs text-muted-foreground">
            {isOwnerView
              ? "Monthly view of your spot listings"
              : "Monthly view of your bookings"}
          </p>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!isLoading && totalEntries === 0 && (
            <p className="text-sm text-muted-foreground pt-1">
              {isOwnerView
                ? "You have no listings yet. Create a listing from My Spot Listings."
                : "You have no bookings yet. Find parking to book a spot."}
            </p>
          )}
        </CardHeader>

        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="p-3 grid grid-cols-7 gap-1 flex-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-[80px] rounded" />
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="min-w-[320px] h-full flex flex-col">
                <div className="grid grid-cols-7 border-l border-t border-border flex-shrink-0">
                  {dayHeadersFull.map((d, i) => (
                    <div
                      key={d}
                      className="text-xs font-medium text-muted-foreground text-center py-1.5 border-r border-b border-border bg-muted/30"
                    >
                      <span className="hidden sm:inline">{d}</span>
                      <span className="sm:hidden">{dayHeadersShort[i]}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-l border-border flex-1">
                  {calendarDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd")
                    const dayEntries = entriesByDate[dateStr] ?? []
                    return (
                      <DayCell
                        key={dateStr}
                        date={date}
                        entries={dayEntries}
                        isCurrentMonth={isSameMonth(date, currentMonth)}
                        isOwnerView={isOwnerView}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && totalEntries > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground items-center flex-shrink-0">
          <span className="font-medium text-foreground">Legend:</span>
          {isOwnerView ? (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-100 border border-emerald-300 flex-shrink-0" />
                Available
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-violet-100 border border-violet-300 flex-shrink-0" />
                Booked / Used
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-gray-100 border border-gray-300 flex-shrink-0" />
                Unused
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-blue-100 border border-blue-300 flex-shrink-0" />
                Upcoming
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-green-100 border border-green-300 flex-shrink-0" />
                Active
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-violet-100 border border-violet-300 flex-shrink-0" />
                Completed
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
