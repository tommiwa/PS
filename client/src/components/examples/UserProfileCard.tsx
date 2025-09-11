import { UserProfileCard } from '../user-profile-card'

export default function UserProfileCardExample() {
  const mockUser = {
    id: "user-001",
    name: "Sarah Chen",
    email: "sarah.chen@bci.com",
    phone: "(555) 123-4567",
    department: "Engineering",
    role: "owner" as const,
    vehicleInfo: {
      make: "Tesla",
      model: "Model 3",
      licensePlate: "ABC-123"
    },
    spotCount: 2,
    memberSince: "January 2023"
  }

  return (
    <div className="max-w-2xl">
      <UserProfileCard 
        user={mockUser} 
        onEditProfile={() => console.log('Edit profile')}
      />
    </div>
  )
}