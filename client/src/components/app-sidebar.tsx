import { 
  Calendar, 
  Car, 
  Clock, 
  Home, 
  MapPin, 
  Settings, 
  Users, 
  BarChart3, 
  Shield,
  Search
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

// Main navigation items
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    roles: ["admin", "owner", "renter", "waitlist"]
  },
  {
    title: "Find Parking",
    url: "/search",
    icon: Search,
    roles: ["owner", "renter", "waitlist"]
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
  {
    title: "Waiting List",
    url: "/waitlist",
    icon: Clock,
    roles: ["waitlist", "admin"]
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
    roles: ["admin", "owner", "renter", "waitlist"]
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["admin", "owner", "renter", "waitlist"]
  },
]

interface AppSidebarProps {
  userRole?: string;
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
      const isActive = location === item.url || (item.url === "/dashboard" && location === "/");
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild data-active={isActive}>
            <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <item.icon />
              <span>{item.title}</span>
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