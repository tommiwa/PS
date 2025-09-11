import { BookingForm } from '../booking-form'

export default function BookingFormExample() {
  const mockSpot = {
    id: "P-001",
    spotNumber: "A-15",
    location: "Main Building - Level 2",
    type: "electric" as const,
    isInside: true,
    price: 25,
    availability: {
      date: "2024-01-15",
      startTime: "08:00",
      endTime: "18:00"
    },
    owner: "Sarah Chen",
    isAvailable: true
  }

  return (
    <BookingForm 
      spot={mockSpot}
      onSubmit={(data) => console.log('Booking submitted:', data)}
      onCancel={() => console.log('Booking cancelled')}
    />
  )
}