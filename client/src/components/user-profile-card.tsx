import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useLanguage } from "@/hooks/use-language"
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
  showEditButton?: boolean
}

export function UserProfileCard({ 
  user, 
  onEditProfile, 
  showEditButton = true 
}: UserProfileCardProps) {
  const { t } = useLanguage()
  const getRoleBadge = () => {
    const roleConfig = {
      admin: { variant: "default" as const, label: t("role.admin") },
      owner: { variant: "secondary" as const, label: t("role.owner") },
      renter: { variant: "outline" as const, label: t("role.renter") },
    }
    
    const config = roleConfig[user.role]
    return <Badge variant={config.variant} data-testid={`badge-role-${user.role}`}>{config.label}</Badge>
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
                {t("profile.spotsOwned", { count: user.spotCount?.toString() || '0' })}
              </div>
            )}
          </div>
          {showEditButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEdit}
                  data-testid="button-edit-profile"
                >
                  <Settings className="h-4 w-4" />
                  {t("common.edit")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("tooltip.profile.editSave")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{t("profile.emailAddress")}</div>
              <div className="text-sm text-muted-foreground" data-testid="text-user-email">
                {user.email}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{t("profile.phoneNumber")}</div>
              <div className="text-sm text-muted-foreground">
                {user.phone}
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Parking Spots */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t("profile.assignedSpots")}
            {user.assignedSpots && user.assignedSpots.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {user.assignedSpots.length} Spot{user.assignedSpots.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </h4>
          
          {user.assignedSpots && user.assignedSpots.length > 0 ? (
            <div className="space-y-2">
              {user.assignedSpots.map((spot, index) => (
                <div 
                  key={spot.id} 
                  className="flex items-center justify-between p-4 bg-muted rounded-lg border border-muted-foreground/20"
                  data-testid={`assigned-spot-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      spot.spotType === 'electric' || spot.spotType === 'tesla_ev' ? 'bg-green-500' :
                      spot.spotType === 'accessible' ? 'bg-blue-500' : 
                      spot.spotType === 'reserved' ? 'bg-purple-500' : 'bg-gray-500'
                    }`} />
                    <div>
                      <div className="text-sm font-medium">
                        {t("profile.spotNumber", { number: spot.spotNumber })}
                        <Badge variant="outline" className="ml-2 capitalize">
                          {spot.spotType === 'tesla_ev' ? t("spotType.teslaEv") : t(`spotType.${spot.spotType}`)}
                        </Badge>
                        {spot.isActive && (
                          <Badge variant="default" className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            {t("common.active")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {spot.location}
                        {spot.isIndoor && ` • ${t('common.indoor')}`}
                        {spot.isBookable && ` • ${t('common.availableForSharing')}`}
                      </div>
                      {spot.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {spot.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`text-sm font-medium ${spot.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                      {spot.isActive ? t("common.active") : t("common.inactive")}
                    </div>
                    {spot.isBookable && spot.isActive && (
                      <div className="text-xs text-muted-foreground">
                        {t("common.canBeShared")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{t("profile.noSpotsAssigned")}</p>
              <p className="text-xs">{t("profile.contactAdmin")}</p>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {t("profile.memberSince", { date: user.memberSince })}
        </div>
      </CardContent>
    </Card>
  )
}