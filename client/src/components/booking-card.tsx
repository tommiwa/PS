import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MapPin, Calendar, Clock, DollarSign, User, X, Edit } from "lucide-react"
import { useConfirm, confirmations } from "@/hooks/use-confirm"

export interface Booking {
  id: string
  spotNumber: string
  location: string
  date: string
  price: number
  status: "confirmed" | "pending" | "cancelled"
  paymentStatus: "pending" | "sent" | "received" | "completed"
  renter?: string
  owner?: string
  canCancel: boolean
  canEdit: boolean
}

interface BookingCardProps {
  booking: Booking
  onCancel?: (bookingId: string) => void
  onEdit?: (bookingId: string) => void
  onUpdatePayment?: (bookingId: string, status: string) => void
  showRenterInfo?: boolean
}

export function BookingCard({ 
  booking, 
  onCancel, 
  onEdit,
  onUpdatePayment,
  showRenterInfo = false
}: BookingCardProps) {
  const { confirm } = useConfirm()
  const getStatusBadge = () => {
    const statusConfig = {
      confirmed: { variant: "default" as const, label: "Confirmed", tooltip: "Booking confirmed - spot is reserved for your selected date and time" },
      pending: { variant: "secondary" as const, label: "Pending", tooltip: "Booking pending approval - waiting for spot owner confirmation" },
      cancelled: { variant: "destructive" as const, label: "Cancelled", tooltip: "Booking cancelled - spot is no longer reserved" }
    }
    
    const config = statusConfig[booking.status]
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            tabIndex={0}
            role="button"
            className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            data-testid={`badge-status-${booking.status}-${booking.id}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
          >
            <Badge variant={config.variant}>{config.label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const getPaymentBadge = () => {
    const paymentConfig = {
      pending: { variant: "secondary" as const, label: "Awaiting Payment", tooltip: "Payment not yet sent - you need to process payment for this booking" },
      sent: { variant: "default" as const, label: "Payment Sent", tooltip: "Payment sent to spot owner - waiting for confirmation of receipt" },
      received: { variant: "default" as const, label: "Payment Received", tooltip: "Payment received by spot owner - transaction completed" },
      completed: { variant: "default" as const, label: "Completed", tooltip: "Booking and payment fully completed - no further action needed" }
    }
    
    const config = paymentConfig[booking.paymentStatus]
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            tabIndex={0}
            role="button"
            className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            data-testid={`badge-payment-${booking.paymentStatus}-${booking.id}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
          >
            <Badge variant={config.variant}>{config.label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const handleCancel = async () => {
    const confirmed = await confirm(confirmations.cancelBooking(
      `Spot ${booking.spotNumber}`, 
      booking.date
    ))
    
    if (confirmed) {
      console.log(`Cancelling booking ${booking.id}`)
      onCancel?.(booking.id)
    }
  }

  const handleEdit = () => {
    console.log(`Editing booking ${booking.id}`)
    onEdit?.(booking.id)
  }

  const handlePaymentUpdate = () => {
    console.log(`Updating payment for booking ${booking.id}`)
    const nextStatus = booking.paymentStatus === "pending" ? "sent" : "received"
    onUpdatePayment?.(booking.id, nextStatus)
  }

  return (
    <Card 
      className={`hover-elevate ${booking.status === 'cancelled' ? 'opacity-60' : ''}`}
      data-testid={`card-booking-${booking.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">
            Spot {booking.spotNumber}
          </CardTitle>
          <div className="flex gap-1">
            {getStatusBadge()}
            {getPaymentBadge()}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 justify-start text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              data-testid={`text-location-${booking.id}`}
            >
              <MapPin className="h-4 w-4 mr-1" />
              {booking.location}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Parking location: {booking.location}</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      
      <CardContent className="pt-0 pb-4">
        <div className="space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 justify-start text-sm hover:bg-transparent hover:text-foreground"
                data-testid={`text-date-${booking.id}`}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {booking.date}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Booking date: {booking.date}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 justify-start text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                data-testid={`text-duration-${booking.id}`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Full Day
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Full day booking - spot is reserved for the entire day</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 justify-start text-sm font-medium hover:bg-transparent hover:text-foreground"
                data-testid={`text-price-${booking.id}`}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                ${booking.price}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total cost for this parking booking: ${booking.price}</p>
            </TooltipContent>
          </Tooltip>
          {showRenterInfo && booking.renter && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 justify-start text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                  data-testid={`text-renter-info-${booking.id}`}
                >
                  <User className="h-4 w-4 mr-2" />
                  Renter: {booking.renter}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Person who booked this parking spot: {booking.renter}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {!showRenterInfo && booking.owner && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 justify-start text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                  data-testid={`text-owner-info-${booking.id}`}
                >
                  <User className="h-4 w-4 mr-2" />
                  Owner: {booking.owner}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Spot owner you're renting from: {booking.owner}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 gap-2">
        {booking.paymentStatus !== "completed" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePaymentUpdate}
                data-testid={`button-payment-${booking.id}`}
              >
                {booking.paymentStatus === "pending" ? "Mark Sent" : "Mark Received"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{booking.paymentStatus === "pending" 
                ? "Mark payment as sent to the spot owner" 
                : "Confirm that payment has been received by the owner"}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {booking.canEdit && booking.status !== "cancelled" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEdit}
                data-testid={`button-edit-${booking.id}`}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit booking details - modify date, time, or special requirements</p>
            </TooltipContent>
          </Tooltip>
        )}
        {booking.canCancel && booking.status !== "cancelled" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleCancel}
                data-testid={`button-cancel-${booking.id}`}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Cancel this booking - spot will become available again (cancellation policy may apply)</p>
            </TooltipContent>
          </Tooltip>
        )}
      </CardFooter>
    </Card>
  )
}