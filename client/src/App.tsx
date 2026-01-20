import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { RoleSwitcher } from "@/components/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { LockProvider } from "@/contexts/LockContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { NotificationCenter } from "@/components/notification-center";
import { LogOut, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import parkShareLogo from "@assets/logo.png";

// Pages
import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile-working";
import MyBookings from "@/pages/my-bookings";
import MySpots from "@/pages/my-spots";
import AdminUserManagement from "@/pages/admin-user-management";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminSpotBookingManagement from "@/pages/admin-spot-booking-management";
import AdminAudits from "@/pages/admin-audits";
import AdminParkingManagement from "@/pages/admin-parking-management";
import AdminDataManagement from "@/pages/admin-data-management";
import AdminReportsPage from "@/pages/admin-reports";
import AdminLockerManagement from "@/pages/admin-locker-management";
import AdminWaitingList from "@/pages/admin-waiting-list";
import AdminIssuesPage from "@/pages/admin/issues";
import MapDemo from "@/pages/map-demo";
import Login from "@/pages/login";
import Terms from "@/pages/terms";
// Note: TermsConsent page removed - terms are now accepted on the login page
import NotFound from "@/pages/not-found";

// Terms version interface
interface TermsVersion {
  id: number;
  version: number;
  content: string;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Component to render formatted terms content
function FormattedTermsContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'bullet' | 'check' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className={listType === 'check' ? 'space-y-2 mb-6' : 'space-y-1.5 mb-6 ml-6'}>
          {currentList}
        </ul>
      );
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Main heading (H1)
    if (trimmed.startsWith('# ')) {
      flushList();
      const text = trimmed.substring(2).trim();
      elements.push(
        <h1 key={`h1-${index}`} className="text-2xl font-bold text-foreground mb-4 mt-8 first:mt-0">
          {text}
        </h1>
      );
    }
    // Section heading (H2)
    else if (trimmed.startsWith('## ')) {
      flushList();
      const text = trimmed.substring(3).trim();
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl font-semibold text-primary mb-3 mt-8 first:mt-0">
          {text}
        </h2>
      );
    }
    // Subsection heading (H3)
    else if (trimmed.startsWith('### ')) {
      flushList();
      const text = trimmed.substring(4).trim();
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-semibold text-foreground mb-3 mt-6">
          {text}
        </h3>
      );
    }
    // Horizontal rule
    else if (trimmed === '---') {
      flushList();
      elements.push(
        <Separator key={`sep-${index}`} className="my-6" />
      );
    }
    // Check list item
    else if (trimmed.startsWith('✓ ')) {
      if (listType !== 'check') {
        flushList();
        listType = 'check';
      }
      const text = trimmed.substring(2).trim();
      currentList.push(
        <li key={`check-${index}`} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{text}</span>
        </li>
      );
    }
    // Bullet point
    else if (trimmed.startsWith('- ')) {
      if (listType !== 'bullet') {
        flushList();
        listType = 'bullet';
      }
      const text = trimmed.substring(2).trim();
      currentList.push(
        <li key={`bullet-${index}`} className="text-sm text-muted-foreground list-disc">
          {text.startsWith('**') && text.endsWith('**') ? (
            <strong className="text-foreground font-semibold">{text.slice(2, -2)}</strong>
          ) : (
            text
          )}
        </li>
      );
    }
    // Bold text paragraph
    else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      flushList();
      const text = trimmed.slice(2, -2);
      elements.push(
        <p key={`bold-${index}`} className="text-base font-semibold text-foreground mb-3 mt-2">
          {text}
        </p>
      );
    }
    // Regular paragraph
    else if (trimmed && !trimmed.startsWith('*') && !trimmed.startsWith('#')) {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {trimmed}
        </p>
      );
    }
    // Empty line
    else if (!trimmed) {
      flushList();
    }
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
}

// Protected Router that handles authentication
function ProtectedRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to login if not authenticated, or away from login if authenticated
  // Note: Terms acceptance is handled on the login page before sign-in,
  // so we no longer need a separate terms-consent page redirect
  useEffect(() => {
    // Allow public access to /terms page
    if (location === "/terms") {
      return;
    }
    
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    } else if (isAuthenticated && location === "/login") {
      setLocation("/"); // Move away from /login to let LandingPageRedirect handle role-based routing
    } else if (isAuthenticated && location === "/terms-consent") {
      // Redirect away from terms-consent since terms are now accepted on login page
      setLocation("/");
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

  // Show terms page publicly if on /terms route
  if (location === "/terms") {
    return <Terms />;
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
    
    // Get effective role: getCurrentViewRole for admins viewing as other roles, 
    // otherwise use highest priority role from user.roles
    const effectiveRole = getCurrentViewRole() || 
      (user.roles.includes("admin") ? "admin" : 
       user.roles.includes("owner") ? "owner" : "renter");
    
    // Use replace: true to keep browser history clean
    if (effectiveRole === "admin") {
      setLocation("/admin", { replace: true });
    } else if (effectiveRole === "owner") {
      // Spot owners: My Spot Listings if they have spots, My Spots if they don't
      const targetPage = hasRegisteredSpots(user.id) ? "/my-listings" : "/my-spots";
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

// Custom hook for automatic data refresh on navigation
function useNavigationDataRefresh() {
  const [location] = useLocation();

  useEffect(() => {
    // Map routes to query keys that should be refreshed when navigating to that route
    const routeQueryMap: Record<string, string[]> = {
      '/admin/users': ['/api/admin/users'],
      '/admin/parking': ['/api/admin/all-spots', '/api/admin/unallocated-spots'],
      '/admin/locker-management': ['/api/admin/lockers', '/api/admin/locker-waitlist', '/api/admin/locker-assignment-history'],
      '/admin/bookings': ['/api/admin/spot-bookings'],
      '/admin/analytics': [
        '/api/admin/analytics-overview',
        '/api/admin/analytics-revenue', 
        '/api/admin/analytics-top-performers',
        '/api/admin/analytics-issues',
        '/api/admin/analytics-usage'
      ],
      '/admin/audits': ['/api/admin/audit-logs'],
      '/admin/reports': [
        '/api/admin/reports/overview',
        '/api/admin/reports/utilization',
        '/api/admin/reports/revenue',
        '/api/admin/reports/user-compliance',
        '/api/admin/reports/waitlist-performance'
      ],
      '/dashboard': ['/api/admin/users', '/api/admin/all-spots', '/api/admin/analytics-overview'],
      '/my-bookings': ['/api/bookings', '/api/my-spots'],
      '/my-listings': ['/api/my-listings', '/api/my-spots'],
      '/my-rentals': ['/api/bookings', '/api/my-spots'],
      '/my-spots': ['/api/my-spots'],
      '/search': ['/api/admin/all-spots', '/api/bookings']
    };

    const queriesToRefresh = routeQueryMap[location];
    if (queriesToRefresh) {
      // Invalidate queries for the current route to get fresh data
      queriesToRefresh.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    }
  }, [location]);
}

// Main authenticated app layout
function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  
  // Fetch terms for the footer dialog
  const { data: terms } = useQuery<TermsVersion>({
    queryKey: ["/api/legal/terms"],
  });
  
  // Enable automatic data refresh on navigation
  useNavigationDataRefresh();
  
  // Custom sidebar width for the parking application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleLogout = () => {
    logout(); // Redirects to /api/logout which clears session and redirects to /
  };

  if (!user) {
    return <Login />;
  }

  // Get highest priority role for sidebar
  const userRole = user.roles.includes("admin") ? "admin" : 
                   user.roles.includes("owner") ? "owner" : "renter";
  
  // Construct user name from firstName and lastName
  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.firstName || user.lastName || user.email;

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-primary/10 border-primary/20 shadow-sm min-w-0">
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle sidebar navigation - hide or show the main menu</p>
                </TooltipContent>
              </Tooltip>
              <div className="hidden md:flex items-center gap-3">
                <img src={parkShareLogo} alt="ParkShare Logo" className="h-10 w-10" />
                <div>
                  <h2 className="text-lg font-semibold text-primary">BCI ParkShare</h2>
                  <p className="text-sm text-muted-foreground">Spot Sharing Application</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium" data-testid="text-current-user">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 cursor-pointer">
                      {user.profileImageUrl && (
                        <AvatarImage src={user.profileImageUrl} alt={userName} />
                      )}
                      <AvatarFallback className="text-sm">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>User profile: {userName} ({userRole})</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <RoleSwitcher />
              <NotificationCenter />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    data-testid="button-logout"
                    aria-label="Logout"
                    className=""
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">Logout</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Log out of your account and return to the login page</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-muted/30">
            <Switch>
              {/* Default landing page - redirects based on user role */}
              <Route path="/">
                <LandingPageRedirect />
              </Route>
              
              {/* Main dashboard - handles all role-based rendering */}
              <Route path="/dashboard">
                <Dashboard userRole={userRole} />
              </Route>
              
              {/* General pages available to all authenticated users */}
              <Route path="/search" component={Search} />
              <Route path="/profile" component={Profile} />
              
              {/* Renter-specific pages */}
              <Route path="/my-bookings">
                <MyBookings />
              </Route>
              
              {/* Owner-specific pages */}
              <Route path="/my-listings">
                <MyBookings viewMode="listings" />
              </Route>
              <Route path="/my-rentals">
                <MyBookings viewMode="rentals" />
              </Route>
              <Route path="/my-spots" component={MySpots} />
              
              {/* Admin-only pages */}
              <Route path="/admin" component={Admin} />
              <Route path="/admin/parking" component={AdminParkingManagement} />
              <Route path="/admin/locker-management" component={AdminLockerManagement} />
              <Route path="/admin/users" component={AdminUserManagement} />
              <Route path="/admin/bookings" component={AdminSpotBookingManagement} />
              <Route path="/admin/analytics" component={AdminAnalytics} />
              <Route path="/admin/audits" component={AdminAudits} />
              <Route path="/admin/data-management" component={AdminDataManagement} />
              <Route path="/admin/reports" component={AdminReportsPage} />
              <Route path="/admin/waiting-list" component={AdminWaitingList} />
              <Route path="/admin/issues" component={AdminIssuesPage} />
              
              {/* Demo pages */}
              <Route path="/map-demo" component={MapDemo} />
              
              {/* Fallback to 404 */}
              <Route path="(.*)" component={NotFound} />
            </Switch>
          </main>
          <footer className="border-t bg-background py-3 px-4">
            <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-3 text-xs text-muted-foreground/60">
              {/* Mobile: Simple single line */}
              <div className="flex md:hidden items-center gap-2">
                <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="hover:text-foreground/80 underline cursor-pointer"
                      data-testid="link-footer-terms"
                      onClick={() => setTermsDialogOpen(true)}
                    >
                      Terms
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Terms and Conditions
                      </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[65vh] pr-4">
                      {terms ? (
                        <div className="max-w-none" data-testid="terms-dialog-content">
                          <FormattedTermsContent content={terms.content} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <span>•</span>
                <span>© 2025-2026 BCI</span>
              </div>
              
              {/* Desktop: Full footer */}
              <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="hidden md:inline hover:text-foreground/80 underline cursor-pointer"
                    data-testid="link-footer-terms-desktop"
                    onClick={() => setTermsDialogOpen(true)}
                  >
                    Terms and Conditions
                  </button>
                </DialogTrigger>
              </Dialog>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">BCI ParkShare Application v1.0</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">© 2025-2026 BCI Workplace Services</span>
            </div>
          </footer>
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
        <TooltipProvider delayDuration={200}>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <LockProvider>
                  <ConfirmProvider>
                    <ProtectedRouter />
                  </ConfirmProvider>
                  <Toaster />
                </LockProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
