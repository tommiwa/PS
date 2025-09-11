import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileCard } from "@/components/user-profile-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Dashboard userRole="owner" />} />
      <Route path="/dashboard" component={() => <Dashboard userRole="owner" />} />
      <Route path="/search" component={Search} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/my-spots" component={MySpots} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      {/* Admin routes */}
      <Route path="/admin" component={Admin} />
      <Route path="/admin/users" component={AdminUserManagement} />
      <Route path="/admin/waitlist" component={AdminWaitlist} />
      <Route path="/admin/parking-spaces" component={AdminParkingSpaces} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      {/* Different role dashboards */}
      <Route path="/admin/dashboard" component={() => <Dashboard userRole="admin" />} />
      <Route path="/renter/dashboard" component={() => <Dashboard userRole="renter" />} />
      <Route path="/waitlist/dashboard" component={() => <Dashboard userRole="waitlist" />} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Custom sidebar width for the parking application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  //todo: remove mock functionality - get from auth context
  const currentUser = {
    id: "user-004",
    name: "David Thompson",
    email: "d.thompson@bci.com",
    phone: "(555) 456-7890",
    department: "IT",
    role: "admin" as const,
    memberSince: "January 2022"
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar userRole={currentUser.role} />
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
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.department}
                      </p>
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">
                        {getInitials(currentUser.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto bg-muted/30">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
