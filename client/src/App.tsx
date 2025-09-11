import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { LogOut, Loader2 } from "lucide-react";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import MyBookings from "@/pages/my-bookings";
import MySpots from "@/pages/my-spots";
import AdminUserManagement from "@/pages/admin-user-management";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminWaitlist from "@/pages/admin-waitlist";
import AdminParkingSpaces from "@/pages/admin-parking-spaces";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

// Protected Router that handles authentication
function ProtectedRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Router for authenticated users
  return (
    <Switch>
      {/* Default dashboard based on user role */}
      <Route path="/" component={() => <Dashboard userRole={user?.role} />} />
      
      {/* General pages available to all authenticated users */}
      <Route path="/dashboard" component={() => <Dashboard userRole={user?.role} />} />
      <Route path="/search" component={Search} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      
      {/* Role-specific dashboards */}
      <Route path="/admin/dashboard" component={() => <Dashboard userRole="admin" />} />
      <Route path="/renter/dashboard" component={() => <Dashboard userRole="renter" />} />
      <Route path="/owner/dashboard" component={() => <Dashboard userRole="owner" />} />
      <Route path="/waitlist/dashboard" component={() => <Dashboard userRole="waitlist" />} />
      
      {/* Renter-specific pages */}
      <Route path="/my-bookings" component={MyBookings} />
      
      {/* Owner-specific pages */}
      <Route path="/my-spots" component={MySpots} />
      
      {/* Admin-only pages */}
      <Route path="/admin" component={Admin} />
      <Route path="/admin/users" component={AdminUserManagement} />
      <Route path="/admin/waitlist" component={AdminWaitlist} />
      <Route path="/admin/parking-spaces" component={AdminParkingSpaces} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      
      {/* Login page for authenticated users (will redirect) */}
      <Route path="/login" component={() => { setLocation("/dashboard"); return null; }} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// Main authenticated app layout
function AuthenticatedApp() {
  const { user, logout } = useAuth();
  
  // Custom sidebar width for the parking application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleLogout = () => {
    logout();
    window.location.reload(); // Force reload to reset app state
  };

  if (!user) {
    return <Login />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={user.role} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="hidden md:block">
                <h2 className="text-lg font-semibold">BCI Parking</h2>
                <p className="text-sm text-muted-foreground">Spot Sharing Application</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium" data-testid="text-current-user">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.department}
                  </p>
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="button-logout"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <ProtectedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Root App component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
