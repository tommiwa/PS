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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Shield, User, Car } from "lucide-react";
import { UserRole } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

export function RoleSwitcher() {
  const { user, getCurrentViewRole, switchViewRole, resetViewRole, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const roleConfig = {
    admin: {
      label: t("role.admin"),
      icon: Shield,
      color: "bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400"
    },
    owner: {
      label: t("role.owner"), 
      icon: Car,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
    },
    renter: {
      label: t("role.renter"),
      icon: User,
      color: "bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400"
    }
  };

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
      setLocation("/admin", { replace: true }); // Admin goes to /admin, not /dashboard
    } else {
      switchViewRole(role); // Switch to other role view
      
      // Redirect to appropriate landing page for the role
      if (role === "owner") {
        // Spot owners: My Bookings if they have spots, My Spots if they don't
        const targetPage = hasRegisteredSpots(user?.id || "") ? "/my-bookings" : "/my-spots";
        setLocation(targetPage, { replace: true });
      } else if (role === "renter") {
        // Renters: Smart Parking Search page
        setLocation("/search", { replace: true });
      }
    }
  };

  const getTooltipText = () => {
    return `Switch views between different user roles (Admin only). Currently viewing as: ${currentConfig.label}. Click to switch to a different role perspective.`;
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
      
      <DropdownMenuContent align="end" className="w-44" data-testid="dropdown-role-switcher">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("roleSwitcher.viewAs")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("admin")}
          className="flex items-center gap-2"
          data-testid="menu-item-admin-view"
        >
          <Shield className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("role.admin")}</p>
            <p className="text-xs text-muted-foreground">{t("roleSwitcher.adminDesc")}</p>
          </div>
          {currentViewRole === "admin" && (
            <Badge variant="outline" className="text-xs">{t("roleSwitcher.current")}</Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("owner")}
          className="flex items-center gap-2"
          data-testid="menu-item-owner-view"
        >
          <Car className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("role.owner")}</p>
            <p className="text-xs text-muted-foreground">{t("roleSwitcher.ownerDesc")}</p>
          </div>
          {currentViewRole === "owner" && (
            <Badge variant="outline" className="text-xs">{t("roleSwitcher.current")}</Badge>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => handleRoleSwitch("renter")}
          className="flex items-center gap-2"
          data-testid="menu-item-renter-view"
        >
          <User className="h-4 w-4" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t("role.renter")}</p>
            <p className="text-xs text-muted-foreground">{t("roleSwitcher.renterDesc")}</p>
          </div>
          {currentViewRole === "renter" && (
            <Badge variant="outline" className="text-xs">{t("roleSwitcher.current")}</Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}