import { WaitlistPosition } from '../waitlist-position'

export default function WaitlistPositionExample() {
  const mockEntries = [
    {
      location: "Main Building - Level 2",
      position: 47,
      totalInQueue: 120,
      estimatedWaitMonths: 6,
      joinedDate: "Jan 2024",
      lastMovement: "Moved up 3 positions last week"
    },
    {
      location: "North Parking Lot",
      position: 12,
      totalInQueue: 45,
      estimatedWaitMonths: 2,
      joinedDate: "Mar 2024",
      lastMovement: "Moved up 1 position yesterday"
    }
  ]

  return <WaitlistPosition entries={mockEntries} />
}