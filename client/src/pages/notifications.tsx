import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { 
  Bell, 
  Car, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Trash2,
  MapPin,
  CalendarClock,
  Info,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { useLocation } from "wouter"

interface InAppNotification {
  id: string;
  userId: string;
  type: 'assignment' | 'reminder' | 'expiration' | 'welcome' | 'general' | 'booking_confirmation' | 'booking_cancelled' | 'payment_reminder' | 'spot_availability' | 'weekly_report' | 'system_maintenance';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

const notificationIcons: Record<string, any> = {
  assignment: Car,
  reminder: Clock,
  expiration: AlertTriangle,
  welcome: CheckCircle,
  general: Info,
  booking_confirmation: CheckCircle,
  booking_cancelled: AlertTriangle,
  payment_reminder: Clock,
  spot_availability: MapPin,
  weekly_report: CalendarClock,
  system_maintenance: AlertTriangle,
};

const notificationColors: Record<string, string> = {
  assignment: "bg-green-500",
  reminder: "bg-blue-500", 
  expiration: "bg-red-500",
  welcome: "bg-purple-500",
  general: "bg-gray-500",
  booking_confirmation: "bg-green-500",
  booking_cancelled: "bg-orange-500",
  payment_reminder: "bg-yellow-500",
  spot_availability: "bg-blue-500",
  weekly_report: "bg-indigo-500",
  system_maintenance: "bg-red-500",
};

export default function NotificationsPage() {
  const { user } = useAuth()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [, navigate] = useLocation()
  const [selectedNotification, setSelectedNotification] = useState<InAppNotification | null>(null)

  const { data: notifications = [], isLoading } = useQuery<InAppNotification[]>({
    queryKey: ["/api/notifications", user?.id],
    enabled: !!user?.id
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/notifications/mark-all-read', { method: 'PATCH' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
      toast({ title: "All notifications marked as read" });
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
      setSelectedNotification(null);
      toast({ title: "Notification deleted" });
    }
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/notifications/delete-all', { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
      setSelectedNotification(null);
      toast({ title: "All notifications deleted" });
    }
  });

  const handleNotificationClick = (notification: InAppNotification) => {
    setSelectedNotification(notification);
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = await confirm({
      title: "Delete All Notifications",
      description: `Are you sure you want to delete all ${notifications.length} notifications? This cannot be undone.`,
      confirmText: "Delete All",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (confirmed) {
      deleteAllNotificationsMutation.mutate();
    }
  };

  const handleDeleteOne = async (notification: InAppNotification) => {
    const confirmed = await confirm({
      title: "Delete Notification",
      description: "Are you sure you want to delete this notification?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (confirmed) {
      deleteNotificationMutation.mutate(notification.id);
    }
  };

  const formatNotificationTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const formatFullDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursRemaining <= 0) {
      return { status: 'expired', color: 'text-red-600 bg-red-50', text: 'Expired' };
    } else if (hoursRemaining <= 4) {
      return { status: 'urgent', color: 'text-red-500 bg-red-50', text: `${Math.ceil(hoursRemaining)}h remaining` };
    } else if (hoursRemaining <= 24) {
      return { status: 'warning', color: 'text-orange-500 bg-orange-50', text: `${Math.ceil(hoursRemaining)}h remaining` };
    }
    
    return { status: 'normal', color: 'text-muted-foreground bg-muted', text: `${Math.ceil(hoursRemaining/24)}d remaining` };
  };

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please log in to view notifications.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
          </h1>
          <p className="text-muted-foreground">
            {notifications.length === 0 
              ? "No notifications" 
              : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="gap-2"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAll}
              disabled={deleteAllNotificationsMutation.isPending}
              className="gap-2"
            >
              {deleteAllNotificationsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete All
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Notifications</h3>
            <p className="text-muted-foreground">
              You don't have any notifications yet. Important updates will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">All Notifications</CardTitle>
              <CardDescription>Click a notification to view full details</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || Info;
                  const iconColor = notificationColors[notification.type] || "bg-gray-500";
                  const isSelected = selectedNotification?.id === notification.id;
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      } ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${iconColor} text-white flex-shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} line-clamp-1`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                            {notification.message}
                          </p>
                          
                          <span className="text-xs text-muted-foreground">
                            {formatNotificationTime(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-6 self-start">
            <CardHeader>
              <CardTitle className="text-lg">Notification Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNotification ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-full ${notificationColors[selectedNotification.type] || "bg-gray-500"} text-white flex-shrink-0`}>
                      {(() => {
                        const Icon = notificationIcons[selectedNotification.type] || Info;
                        return <Icon className="h-5 w-5" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{selectedNotification.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatFullDate(selectedNotification.createdAt)}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="prose prose-sm max-w-none">
                    <p className="text-foreground whitespace-pre-wrap">{selectedNotification.message}</p>
                  </div>

                  {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Additional Details</h4>
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          {selectedNotification.data.spotNumber && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Spot:</span>
                              <span>{selectedNotification.data.spotNumber}</span>
                            </div>
                          )}
                          {selectedNotification.data.location && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Location:</span>
                              <span>{selectedNotification.data.location}</span>
                            </div>
                          )}
                          {selectedNotification.data.building && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">Building:</span>
                              <span>{selectedNotification.data.building}</span>
                            </div>
                          )}
                          {selectedNotification.data.cancelledBookingsCount !== undefined && (
                            <div className="flex items-center gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                              <span className="font-medium">Cancelled Bookings:</span>
                              <span>{selectedNotification.data.cancelledBookingsCount}</span>
                            </div>
                          )}
                          {selectedNotification.data.cancelledBookings && Array.isArray(selectedNotification.data.cancelledBookings) && (
                            <div className="mt-2">
                              <span className="font-medium text-sm">Affected Bookings:</span>
                              <ul className="mt-1 space-y-1">
                                {selectedNotification.data.cancelledBookings.map((booking: any, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground">
                                    {booking.bookingDate} - Spot {booking.spotNumber} at {booking.location}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {(() => {
                    const expiry = getExpiryStatus(selectedNotification.expiresAt);
                    return expiry ? (
                      <>
                        <Separator />
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={expiry.color}>
                            <CalendarClock className="h-3 w-3 mr-1" />
                            {expiry.text}
                          </Badge>
                        </div>
                      </>
                    ) : null;
                  })()}

                  <Separator />

                  <div className="flex items-center gap-2">
                    {!selectedNotification.read && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => markAsReadMutation.mutate(selectedNotification.id)}
                        disabled={markAsReadMutation.isPending}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Mark as Read
                      </Button>
                    )}
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteOne(selectedNotification)}
                      disabled={deleteNotificationMutation.isPending}
                      className="gap-2"
                    >
                      {deleteNotificationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a notification to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
