import { ParkingSpotCard } from '../parking-spot-card'

export default function ParkingSpotCardExample() {
  const mockSpot = {
    id: "P-001",
    spotNumber: "A-15",
    location: "750 Pandora Ave, Victoria BC - Level 2",
    type: "electric" as const,
    isInside: true,
    price: 25,
    availability: {
      date: "2024-01-15",
      startTime: "8:00 AM",
      endTime: "6:00 PM"
    },
    owner: "Sarah Chen",
    isAvailable: true
  }

  return (
    <div className="max-w-sm">
      <ParkingSpotCard 
        spot={mockSpot} 
        onBook={(id) => console.log('Book spot:', id)}
        onViewDetails={(id) => console.log('View details:', id)}
      />
    </div>
  )
}