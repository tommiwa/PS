import { AdminUsersTable } from '../admin-users-table'

export default function AdminUsersTableExample() {
  //todo: remove mock functionality
  const mockUsers = [
    {
      id: "user-001",
      name: "Sarah Chen",
      email: "sarah.chen@bci.ca",
      department: "Engineering",
      role: "owner" as const,
      spotsOwned: 2,
      bookingsCount: 15,
      status: "active" as const,
      lastLogin: "2024-01-15",
      memberSince: "Jan 2023"
    },
    {
      id: "user-002", 
      name: "Michael Rodriguez",
      email: "m.rodriguez@bci.ca",
      department: "Marketing",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 8,
      status: "active" as const,
      lastLogin: "2024-01-14",
      memberSince: "Mar 2023"
    },
    {
      id: "user-003",
      name: "Jennifer Kim",
      email: "j.kim@bci.ca", 
      department: "Finance",
      role: "renter" as const,
      spotsOwned: 0,
      bookingsCount: 3,
      status: "active" as const,
      lastLogin: "2024-01-12",
      memberSince: "Dec 2023"
    },
    {
      id: "user-004",
      name: "David Thompson",
      email: "d.thompson@bci.ca",
      department: "IT",
      role: "admin" as const,
      spotsOwned: 0,
      bookingsCount: 0,
      status: "active" as const,
      lastLogin: "2024-01-15",
      memberSince: "Jan 2022"
    }
  ]

  return (
    <AdminUsersTable 
      users={mockUsers}
      onEditUser={(id) => console.log('Edit user:', id)}
      onDeleteUser={(id) => console.log('Delete user:', id)}
      onAssignSpot={(id) => console.log('Assign spot:', id)}
    />
  )
}