import { BookingCard } from '../booking-card'

export default function BookingCardExample() {
  const mockBooking = {
    id: "B-001",
    spotNumber: "A-15",
    location: "Main Building - Level 2",
    date: "2024-01-15",
    startTime: "8:00 AM",
    endTime: "6:00 PM",
    price: 25,
    status: "confirmed" as const,
    paymentStatus: "sent" as const,
    owner: "Sarah Chen",
    canCancel: true,
    canEdit: true
  }

  return (
    <div className="max-w-sm">
      <BookingCard 
        booking={mockBooking} 
        onCancel={(id) => console.log('Cancel booking:', id)}
        onEdit={(id) => console.log('Edit booking:', id)}
        onUpdatePayment={(id, status) => console.log('Update payment:', id, status)}
      />
    </div>
  )
}