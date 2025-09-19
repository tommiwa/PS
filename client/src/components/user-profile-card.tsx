import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Phone, Car, Settings, MapPin, Plus, Edit3, Trash2 } from "lucide-react"

export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  licensePlate: string
  color?: string
  isDefault?: boolean
}

export interface AssignedSpot {
  id: string
  spotNumber: string
  location: string
  spotType: 'regular' | 'electric' | 'accessible' | 'tesla_ev' | 'reserved'
  isIndoor: boolean
  ownerId: string | null
  description: string | null
  isActive: boolean
  isBookable: boolean
}

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  department: string
  role: "admin" | "owner" | "renter"
  avatar?: string
  vehicles?: Vehicle[]
  assignedSpots?: AssignedSpot[]
  spotCount?: number
  memberSince: string
}

interface UserProfileCardProps {
  user: UserProfile
  onEditProfile?: () => void
  onAddVehicle?: () => void
  onEditVehicle?: (vehicle: Vehicle) => void
  onDeleteVehicle?: (vehicle: Vehicle) => void
  showEditButton?: boolean
}

export function UserProfileCard({ 
  user, 
  onEditProfile, 
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  showEditButton = true 
}: UserProfileCardProps) {
  const getRoleBadge = () => {
    const roleConfig = {
      admin: { variant: "default" as const, label: "Administrator" },
      owner: { variant: "secondary" as const, label: "Spot Owner" },
      renter: { variant: "outline" as const, label: "Renter" },
    }
    
    const config = roleConfig[user.role]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const handleEdit = () => {
    console.log('Edit profile clicked')
    onEditProfile?.()
  }

  return (
    <Card className="hover-elevate" data-testid="card-user-profile">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold" data-testid="text-user-name">
                {user.name}
              </h3>
              {getRoleBadge()}
            </div>
            <p className="text-muted-foreground">{user.department}</p>
            {user.spotCount && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                {user.spotCount} parking spot{user.spotCount !== 1 ? 's' : ''} owned
              </div>
            )}
          </div>
          {showEditButton && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleEdit}
              data-testid="button-edit-profile"
            >
              <Settings className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Email</div>
              <div className="text-sm text-muted-foreground" data-testid="text-user-email">
                {user.email}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Phone</div>
              <div className="text-sm text-muted-foreground">
                {user.phone}
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Car className="h-4 w-4" />
              Vehicle Information
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddVehicle}
              data-testid="button-add-vehicle"
            >
              <Plus className="h-4 w-4" />
              Add Vehicle
            </Button>
          </div>
          
          {user.vehicles && user.vehicles.length > 0 ? (
            <div className="space-y-2">
              {user.vehicles.map((vehicle, index) => (
                <div 
                  key={vehicle.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-md hover-elevate"
                  data-testid={`vehicle-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" style={{ backgroundColor: vehicle.color || '#6366f1' }} />
                    <div>
                      <div className="text-sm font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                        {vehicle.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.licensePlate}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditVehicle?.(vehicle)}
                      data-testid={`button-edit-vehicle-${index}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteVehicle?.(vehicle)}
                      data-testid={`button-delete-vehicle-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No vehicles registered</p>
              <p className="text-xs">Add your vehicle information to complete your profile</p>
            </div>
          )}
        </div>

        {/* Assigned Spots */}
        {user.assignedSpots && user.assignedSpots.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Assigned Spots ({user.assignedSpots.length})
            </h4>
            <div className="space-y-2">
              {user.assignedSpots.map((spot, index) => (
                <div 
                  key={spot.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-md"
                  data-testid={`assigned-spot-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      spot.spotType === 'electric' || spot.spotType === 'tesla_ev' ? 'bg-green-500' :
                      spot.spotType === 'accessible' ? 'bg-blue-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <div className="text-sm font-medium">
                        Spot {spot.spotNumber}
                        <Badge variant="outline" className="ml-2 capitalize">
                          {spot.spotType === 'tesla_ev' ? 'Tesla EV' : spot.spotType}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {spot.location} {spot.isIndoor && '• Indoor'}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {spot.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          Member since {user.memberSince}
        </div>
      </CardContent>
    </Card>
  )
}