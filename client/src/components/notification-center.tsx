import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { 
  Bell, 
  Car, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  X,
  Trash2,
  Settings,
  MoreHorizontal,
  MapPin,
  CalendarClock,
  Info
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export interface InAppNotification {
  id: string;
  userId: string;
  type: 'assignment' | 'reminder' | 'expiration' | 'welcome' | 'general';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

const notificationIcons = {
  assignment: Car,
  reminder: Clock,
  expiration: AlertTriangle,
  welcome: CheckCircle,
  general: Info,
};

const notificationColors = {
  assignment: "bg-green-500",
  reminder: "bg-blue-500", 
  expiration: "bg-red-500",
  welcome: "bg-purple-500",
  general: "bg-gray-500",
};

export function NotificationCenter() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  // Query user notifications
  const { data: notifications = [], isLoading, refetch } = useQuery<InAppNotification[]>({
    queryKey: ["/api/notifications", user?.id],
    enabled: !!user?.id
  });

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/notifications/mark-all-read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    }
  });

  const handleNotificationClick = (notification: InAppNotification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Handle notification-specific actions
    if (notification.type === 'assignment' && notification.data?.spotNumber) {
      // Could navigate to a spot acceptance page or show a modal
      console.log('Navigate to assignment acceptance page');
    }
  };

  const formatNotificationTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursRemaining <= 0) {
      return { status: 'expired', color: 'text-red-600', text: 'Expired' };
    } else if (hoursRemaining <= 4) {
      return { status: 'urgent', color: 'text-red-500', text: `${Math.ceil(hoursRemaining)}h remaining` };
    } else if (hoursRemaining <= 24) {
      return { status: 'warning', color: 'text-orange-500', text: `${Math.ceil(hoursRemaining)}h remaining` };
    }
    
    return { status: 'normal', color: 'text-muted-foreground', text: `${Math.ceil(hoursRemaining/24)}d remaining` };
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end" data-testid="popover-notification-center">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-96" data-testid="scroll-notifications">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-sm">You'll see important updates here</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type];
                const expiry = getExpiryStatus(notification.expiresAt);
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer hover-elevate transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${notificationColors[notification.type]} text-white flex-shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" data-testid="indicator-unread" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotificationMutation.mutate(notification.id);
                              }}
                              data-testid={`button-delete-notification-${notification.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatNotificationTime(notification.createdAt)}</span>
                          {expiry && (
                            <Badge variant="outline" className={expiry.color}>
                              <CalendarClock className="h-3 w-3 mr-1" />
                              {expiry.text}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Assignment-specific additional info */}
                        {notification.type === 'assignment' && notification.data && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
                            <div className="flex items-center gap-4">
                              {notification.data.spotNumber && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {notification.data.spotNumber}
                                </span>
                              )}
                              {notification.data.building && (
                                <span>{notification.data.building}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-4">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setIsOpen(false);
                  // Could navigate to a full notifications page
                }}
                data-testid="button-view-all-notifications"
              >
                View All Notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Simple notification toast component for immediate feedback
export function NotificationToast({ 
  notification, 
  onDismiss 
}: { 
  notification: InAppNotification; 
  onDismiss: () => void; 
}) {
  const Icon = notificationIcons[notification.type];
  
  return (
    <Card className="fixed top-4 right-4 w-80 z-50 shadow-lg" data-testid="toast-notification">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-full ${notificationColors[notification.type]} text-white`}>
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm">{notification.title}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onDismiss}
            data-testid="button-dismiss-toast"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">{notification.message}</p>
        {notification.type === 'assignment' && notification.data?.spotNumber && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Badge variant="secondary">
              <Car className="h-3 w-3 mr-1" />
              {notification.data.spotNumber}
            </Badge>
            {notification.data.building && (
              <Badge variant="outline">{notification.data.building}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}