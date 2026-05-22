import { 
  Calendar, 
  Car, 
 
  Home, 
  MapPin, 
  Settings, 
  Users, 
  BarChart3, 
  Shield,
  Search,
  ParkingCircle,
  Bell,
  CalendarCheck,
  FileText,
  Database,
  Lock,
  Clock,
  DollarSign,
  AlertCircle,
  MessageSquare,
  HelpCircle,
  Download,
  Tag,
  Trophy
} from "lucide-react"
import { Link, useLocation, useRoute } from "wouter"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { ReportIssueDialog } from "@/components/report-issue-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserRole } from "@shared/schema"
import { useAuth } from "@/contexts/auth-context"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { isNewFeature } from "@/lib/utils"
import { useNewBadgeDays } from "@/hooks/use-new-badge-days"

// Owner-specific navigation items - grouped by category
// Group 1: Managing their own spots
const ownerManagementItems = [
  {
    title: "My Spots",
    url: "/my-spots",
    icon: Car,
    roles: ["owner"],
    tooltip: "Manage your parking spots"
  },
  {
    title: "My Spot Listings",
    url: "/my-listings",
    icon: Calendar,
    roles: ["owner"],
    tooltip: "Spots you're renting out"
  },
  {
    title: "My Calendar",
    url: "/my-calendar",
    icon: CalendarCheck,
    roles: ["owner"],
    tooltip: "Monthly view of your listings",
    introducedOn: new Date("2026-03-20")
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["owner"],
    tooltip: {
      admin: "Dashboard",
      owner: "Statistics",
      renter: "Statistics"
    }
  },
]

// Group 2: Renting from others
const ownerRentingItems = [
  {
    title: "Find Parking",
    url: "/search",
    icon: Search,
    roles: ["owner"],
    tooltip: "Find Parking"
  },
  {
    title: "My Rentals",
    url: "/my-rentals",
    icon: CalendarCheck,
    roles: ["owner"],
    tooltip: "Spots you've booked from others"
  },
]

// Main navigation items for non-owners (renters)
const mainMenuItems = [
  {
    title: "Find Parking",
    url: "/search",
    icon: Search,
    roles: ["renter"],
    tooltip: "Find Parking"
  },
  {
    title: "My Bookings",
    url: "/my-bookings",
    icon: Calendar,
    roles: ["renter"],
    tooltip: "My Bookings"
  },
  {
    title: "My Calendar",
    url: "/my-calendar",
    icon: CalendarCheck,
    roles: ["renter"],
    tooltip: "Monthly view of your bookings",
    introducedOn: new Date("2026-03-20")
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["admin", "renter"],
    tooltip: {
      admin: "Dashboard",
      owner: "Statistics",
      renter: "Statistics"
    }
  },
]

// Admin Core Management items
const adminCoreItems = [
  {
    title: "User Management",
    url: "/admin/users",
    icon: Users,
    roles: ["admin"],
    tooltip: "User Management"
  },
  {
    title: "Parking Management",
    url: "/admin/parking",
    icon: Shield,
    roles: ["admin"],
    tooltip: "Parking Management"
  },
  {
    title: "Waiting List Management",
    url: "/admin/waiting-list",
    icon: Clock,
    roles: ["admin"],
    tooltip: "Waiting List Management"
  },
]

// Admin Operations items
const adminOperationsItems = [
  {
    title: "Spot Booking Management",
    url: "/admin/bookings",
    icon: CalendarCheck,
    roles: ["admin"],
    tooltip: "Booking Management"
  },
  {
    title: "Sales & Promotions",
    url: "/admin/sales",
    icon: Tag,
    roles: ["admin"],
    tooltip: "Manage discount sale events for WPS listings"
  },
  {
    title: "User Feedback",
    url: "/admin/issues",
    icon: AlertCircle,
    roles: ["admin"],
    tooltip: "View and manage user feedback"
  },
  {
    title: "Audit Logs",
    url: "/admin/audits",
    icon: FileText,
    roles: ["admin"],
    tooltip: "Audit Logs"
  },
]

// Admin Reporting items
const adminAnalyticsItems = [
  {
    title: "Payroll Reports",
    url: "/admin/reports",
    icon: DollarSign,
    roles: ["admin"],
    tooltip: "Payroll Reports"
  },
  {
    title: "Active Users",
    url: "/admin/active-users",
    icon: Users,
    roles: ["admin"],
    tooltip: "Active Users Report"
  },
  {
    title: "Parking Leaderboard",
    url: "/admin/leaderboard",
    icon: Trophy,
    roles: ["admin"],
    tooltip: "Renter and Owner Rankings"
  },
]

// Admin Configuration items
const adminConfigurationItems = [
  {
    title: "System Settings",
    url: "/admin/data-management",
    icon: Settings,
    roles: ["admin"],
    tooltip: "System Settings & Configuration"
  },
]

// Account menu items with tooltips
const accountMenuItems = [
  {
    title: "Profile",
    url: "/profile",
    icon: Users,
    roles: ["admin", "owner", "renter"],
    tooltip: "Profile"
  },
  {
    title: "FAQ",
    url: "/faq",
    icon: HelpCircle,
    roles: ["admin", "owner", "renter"],
    tooltip: "Frequently Asked Questions"
  },
]

interface AppSidebarProps {
  userRole?: UserRole;
}

export function AppSidebar({ userRole = "owner" }: AppSidebarProps) {
  const [location, setLocation] = useLocation();
  const { getCurrentViewRole, user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const { setOpenMobile } = useSidebar();
  const { canInstall, install } = usePwaInstall();
  const newBadgeDays = useNewBadgeDays();
  
  // Get effective role: use view role if set (for admin viewing as other role), 
  // otherwise use user's actual roles
  const effectiveRole = getCurrentViewRole();
  const effectiveRoles = effectiveRole ? [effectiveRole] : (user?.roles || []);
  
  // Check if user is an owner (for grouped navigation)
  const isOwnerView = effectiveRoles.includes("owner");
  
  // Filter menu items based on effective roles (respects "view as" functionality)
  const filteredMainItems = mainMenuItems.filter(item => 
    effectiveRoles.some(role => item.roles.includes(role))
  );
  
  // Owner-specific grouped items
  const filteredOwnerManagementItems = isOwnerView ? ownerManagementItems : [];
  const filteredOwnerRentingItems = isOwnerView ? ownerRentingItems : [];
  
  // Admin items only shown if effective role is admin (respects "view as")
  const filteredAdminCoreItems = effectiveRoles.includes("admin") 
    ? adminCoreItems.filter(item => effectiveRoles.some(role => item.roles.includes(role)))
    : [];
  
  const filteredAdminOperationsItems = effectiveRoles.includes("admin") 
    ? adminOperationsItems.filter(item => effectiveRoles.some(role => item.roles.includes(role)))
    : [];
  
  const filteredAdminAnalyticsItems = effectiveRoles.includes("admin") 
    ? adminAnalyticsItems.filter(item => effectiveRoles.some(role => item.roles.includes(role)))
    : [];
  
  const filteredAdminConfigurationItems = effectiveRoles.includes("admin") 
    ? adminConfigurationItems.filter(item => effectiveRoles.some(role => item.roles.includes(role)))
    : [];
  
  // Account items shown based on effective roles
  const filteredAccountItems = accountMenuItems.filter(item => 
    effectiveRoles.some(role => item.roles.includes(role))
  );

  // Refresh functions for each page
  const refreshFunctions: Record<string, () => Promise<void>> = {
    "/admin": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics-revenue"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics-top-performers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics-issues"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics-usage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] }),
      ]);
    },
    "/profile": async () => {
      if (!user?.id) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "notification-preferences"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "assigned-spots"] }),
      ]);
    },
    "/admin/users": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/user-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] }),
      ]);
    },
    "/admin/parking": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] }),
      ]);
    },
    "/admin/bookings": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] }),
      ]);
    },
    "/admin/reports": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/utilization"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/revenue"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/user-compliance"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/waitlist-performance"] }),
      ]);
    },
    "/admin/data-management": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] }),
      ]);
    },
    "/admin/waiting-list": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/spot-types"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
      ]);
    },
    "/my-listings": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-listings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/my-spots"] }),
      ]);
    },
    "/my-rentals": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/my-spots"] }),
      ]);
    },
    "/my-calendar": async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/my-listings"] }),
      ]);
    },
  };


  // Function to refresh profile data (kept for compatibility)
  const refreshProfileData = async () => {
    const refreshFn = refreshFunctions["/profile"];
    if (refreshFn) {
      await refreshFn();
    }
  };

  const handleProfileClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Close sidebar on mobile
    setOpenMobile(false);
    
    // If already on profile page, refresh data
    if (location === "/profile") {
      await refreshProfileData();
    } else {
      // Navigate to profile and then refresh data
      setLocation("/profile");
      // Small delay to ensure navigation happens first
      setTimeout(async () => {
        await refreshProfileData();
      }, 100);
    }
  };

  // Get effective role: use view role if set (for admin viewing as other role), 
  // otherwise use highest priority role (admin > owner > renter)
  const getEffectiveRole = (): UserRole => {
    const viewRole = getCurrentViewRole();
    if (viewRole) return viewRole;
    
    if (user?.roles?.includes("admin") ?? false) return "admin";
    if (user?.roles?.includes("owner") ?? false) return "owner";
    return "renter";
  };

  const getTooltipText = (item: any) => {
    if (typeof item.tooltip === 'string') {
      return item.tooltip;
    } else if (typeof item.tooltip === 'object') {
      const effectiveRole = getEffectiveRole();
      return item.tooltip[effectiveRole] || "";
    }
    return "";
  };

  const handleNavItemClick = async (url: string, e: React.MouseEvent) => {
    // Close sidebar on mobile
    setOpenMobile(false);
    
    const refreshFn = refreshFunctions[url];
    
    // If already on this page, refresh the data and prevent navigation
    if (location === url) {
      e.preventDefault();
      if (refreshFn) {
        setRefreshing(url);
        try {
          await refreshFn();
          toast({
            title: "Refreshed",
            description: "Data has been updated successfully",
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to refresh data",
            variant: "destructive",
          });
        } finally {
          setRefreshing(null);
        }
      }
    } else {
      // Navigating to a new page - also refresh data in background
      if (refreshFn) {
        // Small delay to ensure navigation happens first, then refresh data
        setTimeout(async () => {
          await refreshFn();
        }, 100);
      }
    }
  };

  const renderMenuItems = (items: typeof mainMenuItems) => {
    return items.map((item) => {
      const effectiveRole = getEffectiveRole();
      
      // For Dashboard item, admin users should go to /admin, others to /dashboard
      const itemUrl = item.title === "Dashboard" && effectiveRole === "admin" 
        ? "/admin" 
        : item.url;
      
      // Handle active state based on role and current location
      let isActive = location === itemUrl;
      
      // Special handling for root path active states based on user's effective role
      if (location === "/") {
        if (item.title === "Dashboard" && effectiveRole === "admin") {
          isActive = true; // Admin lands on /admin, so dashboard should be active
        } else if (item.url === "/search" && effectiveRole === "renter") {
          isActive = true; // Renter lands on search, so search should be active
        } else if (item.url === "/my-listings" && effectiveRole === "owner") {
          isActive = true; // Owner lands on my-listings, so my-listings should be active
        }
      }
      
      // Special handling for admin on /admin page - Dashboard should be active
      if (location === "/admin" && item.title === "Dashboard" && effectiveRole === "admin") {
        isActive = true;
      }
      
      // For Dashboard item, show "Statistics" for renter/owner roles, "Dashboard" for admin
      let displayTitle = item.title;
      if (item.title === "Dashboard" && (effectiveRole === "renter" || effectiveRole === "owner")) {
        displayTitle = "Statistics";
      }
      
      const tooltipText = getTooltipText(item);
      const hasNewBadge = 'introducedOn' in item && item.introducedOn instanceof Date && isNewFeature(item.introducedOn, newBadgeDays);
      
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton 
            asChild 
            isActive={isActive}
            tooltip={tooltipText}
          >
            {item.title === "Profile" ? (
              <button 
                onClick={handleProfileClick}
                data-testid={`link-${displayTitle.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-2 w-full text-left"
              >
                <item.icon />
                <span className="flex items-center gap-2 flex-1">
                  {displayTitle}
                  {hasNewBadge ? (
                    <Badge variant="default" className="ml-auto text-xs px-1.5 py-0">
                      New!
                    </Badge>
                  ) : null}
                </span>
              </button>
            ) : (
              <Link 
                href={itemUrl} 
                onClick={(e) => handleNavItemClick(itemUrl, e)}
                data-testid={`link-${displayTitle.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon />
                <span className="flex items-center gap-2 flex-1">
                  {displayTitle}
                  {hasNewBadge ? (
                    <Badge variant="default" className="ml-auto text-xs px-1.5 py-0">
                      New!
                    </Badge>
                  ) : null}
                </span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        {/* Owner-specific grouped navigation */}
        {isOwnerView ? (
          <>
            {/* Spot Sharing Group for Owners */}
            <SidebarGroup>
              <SidebarGroupLabel>Spot Sharing</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredOwnerManagementItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Spot Renting Group for Owners */}
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Spot Renting</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredOwnerRentingItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          /* Standard Navigation for Renters */
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItems(filteredMainItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Core Management - Only shown when viewing as admin */}
        {filteredAdminCoreItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Core Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAdminCoreItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Admin Operations - Only shown when viewing as admin */}
        {filteredAdminOperationsItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAdminOperationsItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Admin Reporting - Only shown when viewing as admin */}
        {filteredAdminAnalyticsItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Reporting</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAdminAnalyticsItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Configuration Section - Admin Only */}
        {filteredAdminConfigurationItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Configuration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAdminConfigurationItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Account Section */}
        {filteredAccountItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAccountItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      
      {/* Footer with Feedback and FAQ buttons - visible to all users */}
      <SidebarFooter className="border-t p-3">
        <div className="flex flex-col gap-2">
          {canInstall && (
            <Button 
              variant="default" 
              size="sm" 
              className="w-full justify-start gap-2"
              onClick={() => install()}
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          )}
          <div className="flex items-center gap-2">
            <ReportIssueDialog>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Feedback
              </Button>
            </ReportIssueDialog>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}