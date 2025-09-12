import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthUser, UserRole } from "@shared/schema";
import { AuthService } from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userType: UserRole, email?: string) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
  isRenter: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = AuthService.getAuthUser();
        if (storedUser && AuthService.isAuthenticated()) {
          setUser(storedUser);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        AuthService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (userType: UserRole, email?: string): Promise<AuthUser> => {
    try {
      const authenticatedUser = await AuthService.demoLogin(userType, email);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    AuthService.clearAuth();
    setUser(null);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const isAdmin = (): boolean => {
    return hasRole("admin");
  };

  const isOwner = (): boolean => {
    return hasRole("owner");
  };

  const isRenter = (): boolean => {
    return hasRole("renter");
  };


  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
    hasAnyRole,
    isAdmin,
    isOwner,
    isRenter,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Custom hook for protected routes
export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, isAuthenticated, isLoading } = useAuth();

  const hasAccess = () => {
    if (!isAuthenticated || !user) return false;
    if (!allowedRoles) return true;
    return allowedRoles.includes(user.role);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    hasAccess: hasAccess(),
  };
}

// HOC for protected components
interface ProtectedComponentProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  fallback?: ReactNode;
}

export function ProtectedComponent({ 
  children, 
  allowedRoles, 
  fallback = null 
}: ProtectedComponentProps) {
  const { hasAccess } = useRequireAuth(allowedRoles);
  
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}