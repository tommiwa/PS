import { Calendar, Car, Clock, Home, MapPin, Settings, Users, ListChecks } from "lucide-react"
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
} from "@/components/ui/sidebar"

// Menu items for different user roles
const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    roles: ["admin", "owner", "renter", "waitlist"]
  },
  {
    title: "My Bookings",
    url: "/bookings",
    icon: Calendar,
    roles: ["owner", "renter"]
  },
  {
    title: "My Spots",
    url: "/spots",
    icon: Car,
    roles: ["owner"]
  },
  {
    title: "Find Parking",
    url: "/search",
    icon: MapPin,
    roles: ["renter", "waitlist"]
  },
  {
    title: "Waiting List",
    url: "/waitlist",
    icon: Clock,
    roles: ["waitlist", "admin"]
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: Users,
    roles: ["admin"]
  },
  {
    title: "Reports",
    url: "/admin/reports",
    icon: ListChecks,
    roles: ["admin"]
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
  const filteredItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  );

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>BCI Parking</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const isActive = location === item.url;
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}