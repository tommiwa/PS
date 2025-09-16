import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoleSwitcher } from "@/components/role-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { NotificationCenter } from "@/components/notification-center";
import { LogOut, Loader2 } from "lucide-react";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import MyBookings from "@/pages/my-bookings";
import MySpots from "@/pages/my-spots";
import AdminUserManagement from "@/pages/admin-user-management";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminSpotBookingManagement from "@/pages/admin-spot-booking-management";
import AdminAudits from "@/pages/admin-audits";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

// Protected Router that handles authentication
function ProtectedRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to login if not authenticated, or away from login if authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    } else if (isAuthenticated && location === "/login") {
      setLocation("/"); // Move away from /login to let LandingPageRedirect handle role-based routing
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

  // Render authenticated app with layout
  return <AuthenticatedApp />;
}

// Component to handle landing page redirects
function LandingPageRedirect() {
  const { user, getCurrentViewRole } = useAuth();
  const [, setLocation] = useLocation();
  
  // Mock function to check if spot owner has registered spots
  // In real app, this would query the database
  const hasRegisteredSpots = (userId: string) => {
    // Mock data - some users have spots, some don't
    // Demo spot owner "user-owner-001" has registered spots
    const usersWithSpots = ['user-owner-001', 'owner-002', 'owner-004']; 
    return usersWithSpots.includes(userId);
  };
  
  useEffect(() => {
    if (!user) return;
    
    // Use current view role for admins, otherwise use actual role
    const effectiveRole = getCurrentViewRole() || user.role;
    
    // Use replace: true to keep browser history clean
    if (effectiveRole === "admin") {
      setLocation("/dashboard", { replace: true });
    } else if (effectiveRole === "owner") {
      // Spot owners: My Bookings if they have spots, My Spots if they don't
      const targetPage = hasRegisteredSpots(user.id) ? "/my-bookings" : "/my-spots";
      setLocation(targetPage, { replace: true });
    } else {
      // Renters and others: Search
      setLocation("/search", { replace: true });
    }
  }, [user, getCurrentViewRole, setLocation]);
  
  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
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
              <RoleSwitcher />
              <NotificationCenter />
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
            <Switch>
              {/* Default landing page - redirects based on user role */}
              <Route path="/">
                <LandingPageRedirect />
              </Route>
              
              {/* Main dashboard - handles all role-based rendering */}
              <Route path="/dashboard">
                <Dashboard userRole={user?.role} />
              </Route>
              
              {/* General pages available to all authenticated users */}
              <Route path="/search" component={Search} />
              <Route path="/profile" component={Profile} />
              
              {/* Renter-specific pages */}
              <Route path="/my-bookings" component={MyBookings} />
              
              {/* Owner-specific pages */}
              <Route path="/my-spots" component={MySpots} />
              
              {/* Admin-only pages */}
              <Route path="/admin" component={Admin} />
              <Route path="/admin/users" component={AdminUserManagement} />
              <Route path="/admin/bookings" component={AdminSpotBookingManagement} />
              <Route path="/admin/analytics" component={AdminAnalytics} />
              <Route path="/admin/audits" component={AdminAudits} />
              
              {/* Fallback to 404 */}
              <Route path="(.*)" component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// Root App component
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <AuthProvider>
              <ConfirmProvider>
                <ProtectedRouter />
              </ConfirmProvider>
              <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
