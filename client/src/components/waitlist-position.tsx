import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, MapPin, Users, TrendingUp } from "lucide-react"

export interface WaitlistEntry {
  location: string
  position: number
  totalInQueue: number
  estimatedWaitMonths: number
  joinedDate: string
  lastMovement: string
}

interface WaitlistPositionProps {
  entries: WaitlistEntry[]
}

export function WaitlistPosition({ entries }: WaitlistPositionProps) {
  const getProgressPercentage = (position: number, total: number) => {
    return Math.max(0, ((total - position) / total) * 100)
  }

  const getPositionColor = (position: number, total: number) => {
    const percentage = getProgressPercentage(position, total)
    if (percentage > 80) return "text-green-600"
    if (percentage > 50) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-4" data-testid="waitlist-positions">
      {entries.map((entry, index) => (
        <Card key={index} className="hover-elevate" data-testid={`waitlist-card-${index}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {entry.location}
              </CardTitle>
              <Badge 
                variant="outline" 
                className={getPositionColor(entry.position, entry.totalInQueue)}
                data-testid={`position-badge-${index}`}
              >
                #{entry.position} of {entry.totalInQueue}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Queue Progress</span>
                <span className="font-medium">
                  {Math.round(getProgressPercentage(entry.position, entry.totalInQueue))}% to front
                </span>
              </div>
              <Progress 
                value={getProgressPercentage(entry.position, entry.totalInQueue)} 
                className="h-2"
                data-testid={`progress-${index}`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Est. Wait Time</div>
                  <div className="text-muted-foreground">
                    {entry.estimatedWaitMonths} months
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Joined Queue</div>
                  <div className="text-muted-foreground">
                    {entry.joinedDate}
                  </div>
                </div>
              </div>
            </div>
            
            {entry.lastMovement && (
              <div className="flex items-center gap-2 text-sm p-3 bg-muted rounded-md">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">
                  Last movement: {entry.lastMovement}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}