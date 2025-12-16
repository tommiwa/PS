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
  Clock
} from "lucide-react"
import { Link, useLocation, useRoute } from "wouter"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserRole } from "@shared/schema"
import { useAuth } from "@/contexts/auth-context"
import { queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

// Main navigation items with tooltips
const mainMenuItems = [
  {
    title: "Find Parking",
    url: "/search",
    icon: Search,
    roles: ["owner", "renter"],
    tooltip: "Find Parking"
  },
  {
    title: "My Bookings",
    url: "/my-bookings",
    icon: Calendar,
    roles: ["owner", "renter"],
    tooltip: {
      owner: "My Spot Listings",
      renter: "My Bookings"
    }
  },
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["admin", "owner", "renter"],
    tooltip: {
      admin: "Dashboard",
      owner: "Statistics",
      renter: "Statistics"
    }
  },
  {
    title: "My Spots",
    url: "/my-spots",
    icon: Car,
    roles: ["owner"],
    tooltip: "My Spots"
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
    title: "Audit Logs",
    url: "/admin/audits",
    icon: FileText,
    roles: ["admin"],
    tooltip: "Audit Logs"
  },
]

// Admin Analytics & Audit items (empty - Reports moved to Dashboard, Audit Logs moved to Operations)
const adminAnalyticsItems: typeof adminOperationsItems = []

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
  
  // Get effective role: use view role if set (for admin viewing as other role), 
  // otherwise use user's actual roles
  const effectiveRole = getCurrentViewRole();
  const effectiveRoles = effectiveRole ? [effectiveRole] : (user?.roles || []);
  
  // Filter menu items based on effective roles (respects "view as" functionality)
  const filteredMainItems = mainMenuItems.filter(item => 
    effectiveRoles.some(role => item.roles.includes(role))
  );

  // Custom ordering for spot owners: My Bookings, My Spots, Find Parking, Statistics
  const getOrderedMainItems = () => {
    // If effective roles include owner, use custom ordering
    if (effectiveRoles.includes("owner")) {
      const orderedItems = [];
      
      // 1. My Bookings (first)
      const myBookings = filteredMainItems.find(item => item.title === "My Bookings");
      if (myBookings) orderedItems.push(myBookings);
      
      // 2. My Spots (second) 
      const mySpots = filteredMainItems.find(item => item.title === "My Spots");
      if (mySpots) orderedItems.push(mySpots);
      
      // 3. Find Parking (third)
      const findParking = filteredMainItems.find(item => item.title === "Find Parking");
      if (findParking) orderedItems.push(findParking);
      
      // 4. Statistics/Dashboard (last)
      const dashboard = filteredMainItems.find(item => item.title === "Dashboard");
      if (dashboard) orderedItems.push(dashboard);
      
      return orderedItems;
    }
    
    // For other roles, use original order
    return filteredMainItems;
  };

  const orderedMainItems = getOrderedMainItems();
  
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
        } else if (item.url === "/my-bookings" && effectiveRole === "owner") {
          isActive = true; // Owner lands on my-bookings (if has spots), so my-bookings should be active
        }
      }
      
      // Special handling for admin on /admin page - Dashboard should be active
      if (location === "/admin" && item.title === "Dashboard" && effectiveRole === "admin") {
        isActive = true;
      }
      
      // For Dashboard item, show "Statistics" for renter/owner roles, "Dashboard" for admin
      // For My Bookings item, show "My Spot Listings" for owners
      let displayTitle = item.title;
      if (item.title === "Dashboard" && (effectiveRole === "renter" || effectiveRole === "owner")) {
        displayTitle = "Statistics";
      } else if (item.title === "My Bookings" && effectiveRole === "owner") {
        displayTitle = "My Spot Listings";
      }
      
      const tooltipText = getTooltipText(item);
      const hasNewBadge = 'isNew' in item && item.isNew;
      
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
                    <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                      New
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
                    <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                      New
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
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(orderedMainItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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

        {/* Admin Analytics & Audit - Only shown when viewing as admin */}
        {filteredAdminAnalyticsItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Analytics & Audit</SidebarGroupLabel>
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
    </Sidebar>
  )
}