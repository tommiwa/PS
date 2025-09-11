import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Calendar, Clock, DollarSign, User, X, Edit } from "lucide-react"

export interface Booking {
  id: string
  spotNumber: string
  location: string
  date: string
  startTime: string
  endTime: string
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
  const getStatusBadge = () => {
    const statusConfig = {
      confirmed: { variant: "default" as const, label: "Confirmed" },
      pending: { variant: "secondary" as const, label: "Pending" },
      cancelled: { variant: "destructive" as const, label: "Cancelled" }
    }
    
    const config = statusConfig[booking.status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getPaymentBadge = () => {
    const paymentConfig = {
      pending: { variant: "secondary" as const, label: "Payment Pending" },
      sent: { variant: "default" as const, label: "Payment Sent" },
      received: { variant: "default" as const, label: "Payment Received" },
      completed: { variant: "default" as const, label: "Completed" }
    }
    
    const config = paymentConfig[booking.paymentStatus]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const handleCancel = () => {
    console.log(`Cancelling booking ${booking.id}`)
    onCancel?.(booking.id)
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
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {booking.location}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            {booking.date}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {booking.startTime} - {booking.endTime}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            ${booking.price}
          </div>
          {showRenterInfo && booking.renter && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-4 w-4" />
              Renter: {booking.renter}
            </div>
          )}
          {!showRenterInfo && booking.owner && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-4 w-4" />
              Owner: {booking.owner}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 gap-2">
        {booking.paymentStatus !== "completed" && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePaymentUpdate}
            data-testid={`button-payment-${booking.id}`}
          >
            {booking.paymentStatus === "pending" ? "Mark Sent" : "Mark Received"}
          </Button>
        )}
        {booking.canEdit && booking.status !== "cancelled" && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEdit}
            data-testid={`button-edit-${booking.id}`}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
        {booking.canCancel && booking.status !== "cancelled" && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleCancel}
            data-testid={`button-cancel-${booking.id}`}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}