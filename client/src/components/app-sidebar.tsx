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
  Bell
} from "lucide-react"
import { Link, useLocation } from "wouter"
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
import { UserRole } from "@shared/schema"

// Main navigation items
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["admin", "owner", "renter"]
  },
  {
    title: "Find Parking",
    url: "/search",
    icon: Search,
    roles: ["owner", "renter"]
  },
  {
    title: "My Bookings",
    url: "/my-bookings",
    icon: Calendar,
    roles: ["owner", "renter"]
  },
  {
    title: "My Spots",
    url: "/my-spots",
    icon: Car,
    roles: ["owner"]
  },
]

// Admin-specific menu items
const adminMenuItems = [
  {
    title: "Administration",
    url: "/admin",
    icon: Shield,
    roles: ["admin"]
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: Users,
    roles: ["admin"]
  },
  {
    title: "Parking Space Admin",
    url: "/admin/parking-spaces",
    icon: ParkingCircle,
    roles: ["admin"]
  },
  {
    title: "Analytics & Reports",
    url: "/admin/analytics",
    icon: BarChart3,
    roles: ["admin"]
  },
]

// Settings menu items
const settingsMenuItems = [
  {
    title: "Profile",
    url: "/profile",
    icon: Users,
    roles: ["admin", "owner", "renter"]
  },
  {
    title: "Notification Settings",
    url: "/notifications",
    icon: Bell,
    roles: ["renter", "owner"]
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["admin", "owner", "renter"]
  },
]

interface AppSidebarProps {
  userRole?: UserRole;
}

export function AppSidebar({ userRole = "owner" }: AppSidebarProps) {
  const [location] = useLocation();
  
  // Filter menu items based on user role
  const filteredMainItems = mainMenuItems.filter(item => 
    item.roles.includes(userRole)
  );
  
  const filteredAdminItems = adminMenuItems.filter(item => 
    item.roles.includes(userRole)
  );
  
  const filteredSettingsItems = settingsMenuItems.filter(item => 
    item.roles.includes(userRole)
  );

  const renderMenuItems = (items: typeof mainMenuItems) => {
    return items.map((item) => {
      // Handle active state based on role and current location
      let isActive = location === item.url;
      
      // Special handling for root path active states
      if (location === "/") {
        if (item.url === "/dashboard" && userRole === "admin") {
          isActive = true; // Admin lands on dashboard, so dashboard should be active
        } else if (item.url === "/search" && (userRole === "renter" || userRole === "owner")) {
          isActive = true; // Renter/Owner lands on search, so search should be active
        }
      }
      
      // For Dashboard item, show "Reports" for renter/owner roles, "Dashboard" for admin
      const displayTitle = item.title === "Dashboard" && (userRole === "renter" || userRole === "owner") 
        ? "Reports" 
        : item.title;
      
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild data-active={isActive}>
            <Link href={item.url} data-testid={`link-${displayTitle.toLowerCase().replace(/\s+/g, '-')}`}>
              <item.icon />
              <span>{displayTitle}</span>
            </Link>
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
              {renderMenuItems(filteredMainItems)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - Only shown to admins */}
        {userRole === "admin" && filteredAdminItems.length > 0 && (
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