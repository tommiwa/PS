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
  FileText
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
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserRole } from "@shared/schema"
import { useAuth } from "@/contexts/auth-context"
import { queryClient } from "@/lib/queryClient"

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
    tooltip: "My Bookings"
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

// Admin-specific menu items with tooltips
const adminMenuItems = [
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

// Settings menu items with tooltips
const settingsMenuItems = [
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
  
  // Use current view role for admins, otherwise use the actual user role
  const effectiveRole = getCurrentViewRole() || userRole;
  
  // Filter menu items based on effective role (current view role for admins)
  const filteredMainItems = mainMenuItems.filter(item => 
    item.roles.includes(effectiveRole)
  );

  // Custom ordering for spot owners: My Bookings, My Spots, Find Parking, Statistics
  const getOrderedMainItems = () => {
    if (effectiveRole === "owner") {
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
  
  const filteredAdminItems = adminMenuItems.filter(item => 
    item.roles.includes(effectiveRole)
  );
  
  const filteredSettingsItems = settingsMenuItems.filter(item => 
    item.roles.includes(effectiveRole)
  );

  // Function to refresh profile data
  const refreshProfileData = async () => {
    if (!user?.id) return;
    
    // Invalidate all profile-related queries to force a refresh
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "vehicles"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "notification-preferences"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "assigned-spots"] }),
    ]);
  };

  const handleProfileClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
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

  const getTooltipText = (item: any) => {
    if (typeof item.tooltip === 'string') {
      return item.tooltip;
    } else if (typeof item.tooltip === 'object' && item.tooltip[effectiveRole]) {
      return item.tooltip[effectiveRole];
    }
    return "";
  };

  const renderMenuItems = (items: typeof mainMenuItems) => {
    return items.map((item) => {
      // Handle active state based on role and current location
      let isActive = location === item.url;
      
      // Special handling for root path active states based on effective role
      if (location === "/") {
        if (item.url === "/dashboard" && effectiveRole === "admin") {
          isActive = true; // Admin lands on dashboard, so dashboard should be active
        } else if (item.url === "/search" && effectiveRole === "renter") {
          isActive = true; // Renter lands on search, so search should be active
        } else if (item.url === "/my-bookings" && effectiveRole === "owner") {
          isActive = true; // Owner lands on my-bookings (if has spots), so my-bookings should be active
        }
      }
      
      // For Dashboard item, show "Statistics" for renter/owner roles, "Dashboard" for admin
      const displayTitle = item.title === "Dashboard" && (effectiveRole === "renter" || effectiveRole === "owner") 
        ? "Statistics" 
        : item.title;
      
      const tooltipText = getTooltipText(item);
      
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
                <span>{displayTitle}</span>
              </button>
            ) : (
              <Link href={item.url} data-testid={`link-${displayTitle.toLowerCase().replace(/\s+/g, '-')}`}>
                <item.icon />
                <span>{displayTitle}</span>
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

        {/* Admin Section - Only shown when viewing as admin */}
        {effectiveRole === "admin" && filteredAdminItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredAdminItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Settings Section */}
        {filteredSettingsItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderMenuItems(filteredSettingsItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  )
}