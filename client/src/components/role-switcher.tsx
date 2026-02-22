import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Shield, User, Car, Eye, X, Search as SearchIcon } from "lucide-react";
import { UserRole } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

export function RoleSwitcher() {
  const { user, getCurrentViewRole, switchViewRole, resetViewRole, isAdmin, startViewingAsUser, stopViewingAsUser, viewAsUser, isImpersonating } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const [showUserPicker, setShowUserPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  useEffect(() => {
    if (!showUserPicker) return;
    
    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const users = await response.json();
          setSearchResults(users);
        }
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, showUserPicker]);

  // Only show for admin users
  if (!isAdmin()) {
    return null;
  }

  const handleSelectUser = async (selectedUser: any) => {
    await startViewingAsUser(selectedUser.id);
    setShowUserPicker(false);
    setSearchQuery("");
    setLocation("/search", { replace: true });
  };

  const currentViewRole = getCurrentViewRole();
  const currentConfig = roleConfig[currentViewRole as UserRole] || roleConfig.admin;
  const CurrentIcon = currentConfig.icon;

  const hasRegisteredSpots = (userId: string) => {
    const usersWithSpots = ['user-admin-001', 'owner-002', 'owner-004']; 
    return usersWithSpots.includes(userId);
  };

  const handleRoleSwitch = async (role: UserRole) => {
    if (role === "admin") {
      await resetViewRole();
      setLocation("/admin", { replace: true });
    } else {
      await switchViewRole(role);
      
      if (role === "owner") {
        const targetPage = hasRegisteredSpots(user?.id || "") ? "/my-bookings" : "/my-spots";
        setLocation(targetPage, { replace: true });
      } else if (role === "renter") {
        setLocation("/search", { replace: true });
      }
    }
  };

  const getTooltipText = () => {
    return `Switch views between different user roles (Admin only). Currently viewing as: ${currentConfig.label}. Click to switch to a different role perspective.`;
  };

  return (
    <>
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

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Troubleshooting
          </DropdownMenuLabel>

          {isImpersonating ? (
            <DropdownMenuItem 
              onClick={async () => {
                await stopViewingAsUser();
                setLocation("/admin", { replace: true });
              }}
              className="flex items-center gap-2 text-orange-600 dark:text-orange-400"
              data-testid="menu-item-stop-impersonation"
            >
              <X className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-sm font-medium">Exit User View</p>
                <p className="text-xs text-muted-foreground">
                  Viewing as {viewAsUser?.firstName} {viewAsUser?.lastName}
                </p>
              </div>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={() => setShowUserPicker(true)}
              className="flex items-center gap-2"
              data-testid="menu-item-view-as-user"
            >
              <Eye className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-sm font-medium">Switch to User</p>
                <p className="text-xs text-muted-foreground">See what a specific user sees</p>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showUserPicker} onOpenChange={setShowUserPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>View as User</DialogTitle>
            <DialogDescription>
              Select a user to view the application from their perspective. You will be in read-only mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {isSearching ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchQuery ? "No users found" : "Type to search users"}
                  </p>
                ) : (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="w-full text-left px-3 py-2 rounded-md hover-elevate flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {u.roles?.includes('admin') && (
                          <Badge variant="secondary" className="text-xs">Admin</Badge>
                        )}
                        {u.roles?.includes('owner') && (
                          <Badge variant="secondary" className="text-xs">Owner</Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
