import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { 
  UserPlus, 
  UserCheck, 
  UserX, 
  Shield, 
  LogIn, 
  LogOut,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import type { UserActivityResponse, UserActivityItem } from "@shared/schema";

interface UserActivityListProps {
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

const getActivityIcon = (type: UserActivityItem['type'], success: boolean) => {
  const baseProps = { className: "w-4 h-4 flex-shrink-0" };
  const color = success ? "text-green-600" : "text-red-600";
  
  switch (type) {
    case 'user_created':
      return <UserPlus {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'user_updated':
      return <Settings {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'role_changed':
      return <Shield {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'login':
      return <LogIn {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'logout':
      return <LogOut {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'account_activated':
      return <UserCheck {...baseProps} className={`${baseProps.className} ${color}`} />;
    case 'account_deactivated':
      return <UserX {...baseProps} className={`${baseProps.className} ${color}`} />;
    default:
      return <Clock {...baseProps} className={`${baseProps.className} ${color}`} />;
  }
};

const getActivityTypeName = (type: UserActivityItem['type']) => {
  switch (type) {
    case 'user_created': return 'User Created';
    case 'user_updated': return 'Profile Updated';
    case 'role_changed': return 'Role Changed';
    case 'login': return 'Login';
    case 'logout': return 'Logout';
    case 'account_activated': return 'Account Activated';
    case 'account_deactivated': return 'Account Deactivated';
    default: return 'User Activity';
  }
};

export function UserActivityList({ 
  queryParams = {}, 
  title = "Recent User Activity",
  showTitle = true,
  maxHeight = "400px",
  compact = false
}: UserActivityListProps) {
  // Use the robust query client with query params as objects
  const hasParams = queryParams && Object.values(queryParams).some(value => value !== undefined && value !== null && value !== '');
  const queryKey = hasParams
    ? ["/api/admin/user-activity", queryParams]
    : ["/api/admin/user-activity"];

  const { data, isLoading, error } = useQuery<UserActivityResponse>({
    queryKey,
  });

  if (isLoading) {
    return (
      <Card data-testid="user-activity-loading">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Clock className="w-5 h-5" />
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
      <Card data-testid="user-activity-error">
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
              Failed to load user activity. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.items || [];
  
  if (activities.length === 0) {
    return (
      <Card data-testid="user-activity-empty">
        {showTitle && (
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No Recent Activity</p>
            <p className="text-sm">User activity will appear here when available.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="user-activity-list">
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Clock className="w-5 h-5" />
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
                    <div className="flex items-center gap-2">
                      {activity.success ? (
                        <CheckCircle className="w-3 h-3 text-green-600" data-testid="success-icon" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-600" data-testid="error-icon" />
                      )}
                      <Badge 
                        variant={activity.success ? "secondary" : "destructive"} 
                        className="text-xs"
                        data-testid="status-badge"
                      >
                        {activity.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    {activity.user || activity.userEmail || 'Unknown User'}
                  </p>
                  
                  <p className={`text-xs ${compact ? 'line-clamp-1' : 'line-clamp-2'} text-muted-foreground`}>
                    {activity.details}
                  </p>
                  
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