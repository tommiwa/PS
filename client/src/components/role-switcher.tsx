import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Shield, User, Car } from "lucide-react";
import { UserRole } from "@shared/schema";

const roleConfig = {
  admin: {
    label: "Admin",
    icon: Shield,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  },
  owner: {
    label: "Spot Owner", 
    icon: Car,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  renter: {
    label: "Renter",
    icon: User,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  }
};

export function RoleSwitcher() {
  const { user, getCurrentViewRole, switchViewRole, resetViewRole, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  // Only show for admin users
  if (!isAdmin()) {
    return null;
  }

  const currentViewRole = getCurrentViewRole();
  const currentConfig = roleConfig[currentViewRole as UserRole] || roleConfig.admin;
  const CurrentIcon = currentConfig.icon;

  // Mock function to check if spot owner has registered spots  
  // In real app, this would query the database
  const hasRegisteredSpots = (userId: string) => {
    // Mock data - some users have spots, some don't
    // Demo spot owner "user-owner-001" has registered spots
    const usersWithSpots = ['user-admin-001', 'owner-002', 'owner-004']; 
    return usersWithSpots.includes(userId);
  };

  const handleRoleSwitch = (role: UserRole) => {
    if (role === "admin") {
      resetViewRole(); // Reset to admin view
      setLocation("/dashboard", { replace: true });
    } else {
      switchViewRole(role); // Switch to other role view
      
      // Redirect to appropriate landing page for the role
      if (role === "owner") {
        // Spot owners: My Bookings if they have spots, My Spots if they don't
        const targetPage = hasRegisteredSpots(user?.id || "") ? "/my-bookings" : "/my-spots";
        setLocation(targetPage, { replace: true });
      } else if (role === "renter") {
        // Renters: Search page
        setLocation("/search", { replace: true });
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="flex items-center gap-2 h-8"
          data-testid="button-role-switcher"
        >
          <Badge variant="secondary" className={`flex items-center gap-1 text-xs ${currentConfig.color}`}>
            <CurrentIcon className="h-3 w-3" />
            {currentConfig.label}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-44" data-testid="dropdown-role-switcher">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          View As
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("admin")}
          className="flex items-center gap-2"
          data-testid="menu-item-admin-view"
        >
          <Shield className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">Dashboard & Management</p>
          </div>
          {currentViewRole === "admin" && (
            <Badge variant="outline" className="text-xs">Current</Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("owner")}
          className="flex items-center gap-2"
          data-testid="menu-item-owner-view"
        >
          <Car className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">Spot Owner</p>
            <p className="text-xs text-muted-foreground">My Spots & Bookings</p>
          </div>
          {currentViewRole === "owner" && (
            <Badge variant="outline" className="text-xs">Current</Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("renter")}
          className="flex items-center gap-2"
          data-testid="menu-item-renter-view"
        >
          <User className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">Renter</p>
            <p className="text-xs text-muted-foreground">Find & Book Parking</p>
          </div>
          {currentViewRole === "renter" && (
            <Badge variant="outline" className="text-xs">Current</Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}