import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Phone, Car, Settings, MapPin } from "lucide-react"

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string
  department: string
  role: "admin" | "owner" | "renter" | "waitlist"
  avatar?: string
  vehicleInfo?: {
    make: string
    model: string
    licensePlate: string
  }
  spotCount?: number
  memberSince: string
}

interface UserProfileCardProps {
  user: UserProfile
  onEditProfile?: () => void
  showEditButton?: boolean
}

export function UserProfileCard({ user, onEditProfile, showEditButton = true }: UserProfileCardProps) {
  const getRoleBadge = () => {
    const roleConfig = {
      admin: { variant: "default" as const, label: "Administrator" },
      owner: { variant: "secondary" as const, label: "Spot Owner" },
      renter: { variant: "outline" as const, label: "Renter" },
      waitlist: { variant: "secondary" as const, label: "Waiting List" }
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
      
      <CardContent className="space-y-4">
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
        
        {user.vehicleInfo && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
            <Car className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Vehicle Information</div>
              <div className="text-sm text-muted-foreground">
                {user.vehicleInfo.make} {user.vehicleInfo.model} • {user.vehicleInfo.licensePlate}
              </div>
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