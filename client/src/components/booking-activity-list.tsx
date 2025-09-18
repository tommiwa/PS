import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { 
  CalendarCheck, 
  XCircle, 
  CheckCircle, 
  DollarSign, 
  Car,
  MapPin,
  Plus,
  Edit,
  UserCheck,
  Clock,
  AlertTriangle,
  Activity
} from "lucide-react";
import type { BookingActivityResponse, BookingActivityItem } from "@shared/schema";

interface BookingActivityListProps {
  queryParams?: {
    from?: string;
    to?: string;
    actorId?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  };
  title?: string;
  showTitle?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

const getActivityIcon = (type: BookingActivityItem['type'], success: boolean) => {
  const baseProps = { className: "w-4 h-4 flex-shrink-0" };
  const color = success ? "text-blue-600" : "text-red-600";
  
  switch (type) {
    case 'booking_created':
      return <CalendarCheck {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'booking_cancelled':
      return <XCircle {...baseProps} className={`${baseProps.className} text-red-600`} />;
    case 'booking_completed':
      return <CheckCircle {...baseProps} className={`${baseProps.className} text-green-600`} />;
    case 'payment_received':
      return <DollarSign {...baseProps} className={`${baseProps.className} text-green-600`} />;
    case 'payment_updated':
      return <DollarSign {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'spot_assigned':
      return <Car {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'listing_created':
      return <Plus {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'listing_updated':
      return <Edit {...baseProps} className={`${baseProps.className} ${color}`} />;
    default:
      return <Activity {...baseProps} className={`${baseProps.className} ${color}`} />;
  }
};

const getActivityTypeName = (type: BookingActivityItem['type']) => {
  switch (type) {
    case 'booking_created': return 'Booking Created';
    case 'booking_cancelled': return 'Booking Cancelled';
    case 'booking_completed': return 'Booking Completed';
    case 'payment_received': return 'Payment Received';
    case 'payment_updated': return 'Payment Updated';
    case 'spot_assigned': return 'Spot Assigned';
    case 'listing_created': return 'Listing Created';
    case 'listing_updated': return 'Listing Updated';
    default: return 'Booking Activity';
  }
};

const getActivityColor = (type: BookingActivityItem['type'], success: boolean) => {
  if (!success) return "destructive";
  
  switch (type) {
    case 'booking_created':
    case 'listing_created':
      return "default";
    case 'booking_cancelled':
      return "destructive";
    case 'booking_completed':
    case 'payment_received':
      return "secondary";
    case 'payment_updated':
    case 'listing_updated':
    case 'spot_assigned':
      return "outline";
    default:
      return "secondary";
  }
};

export function BookingActivityList({ 
  queryParams = {}, 
  title = "Recent Booking Activity",
  showTitle = true,
  maxHeight = "400px",
  compact = false
}: BookingActivityListProps) {
  // Use the robust query client with query params as objects
  const hasParams = queryParams && Object.values(queryParams).some(value => value !== undefined && value !== null && value !== '');
  const queryKey = hasParams
    ? ["/api/admin/booking-activity", queryParams]
    : ["/api/admin/booking-activity"];

  const { data, isLoading, error } = useQuery<BookingActivityResponse>({
    queryKey,
  });

  if (isLoading) {
    return (
      <Card data-testid="booking-activity-loading">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-4 h-4 rounded mt-1" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="w-16 h-5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="booking-activity-error">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load booking activity. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.items || [];
  
  if (activities.length === 0) {
    return (
      <Card data-testid="booking-activity-empty">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No Recent Activity</p>
            <p className="text-sm">Booking activity will appear here when available.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="booking-activity-list">
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {title}
            </CardTitle>
            <Badge variant="secondary" data-testid="activity-count">
              {data?.total || 0} total
            </Badge>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-4" : undefined}>
        <ScrollArea style={{ maxHeight }}>
          <div className={`space-y-${compact ? '2' : '3'}`}>
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className={`flex items-start gap-3 p-${compact ? '2' : '3'} rounded-lg hover-elevate cursor-pointer transition-colors`}
                data-testid={`activity-item-${activity.id}`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type, activity.success)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-medium text-sm ${activity.success ? 'text-foreground' : 'text-red-600'}`}>
                      {getActivityTypeName(activity.type)}
                    </p>
                    <Badge 
                      variant={getActivityColor(activity.type, activity.success)}
                      className="text-xs"
                      data-testid="status-badge"
                    >
                      {activity.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    {activity.user || activity.userEmail || 'System User'}
                  </p>
                  
                  <p className={`text-xs ${compact ? 'line-clamp-1' : 'line-clamp-2'} text-muted-foreground`}>
                    {activity.details}
                  </p>
                  
                  {activity.relatedEntity && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        {activity.relatedEntity.type === 'booking' && <CalendarCheck className="w-3 h-3 text-muted-foreground" />}
                        {activity.relatedEntity.type === 'parking_spot' && <Car className="w-3 h-3 text-muted-foreground" />}
                        {activity.relatedEntity.type === 'spot_listing' && <MapPin className="w-3 h-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">
                          {activity.relatedEntity.description}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}