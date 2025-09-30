import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserRole } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  profileImageUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
  isRenter: () => boolean;
  // Role switching for admins
  viewRole: UserRole | null;
  switchViewRole: (role: UserRole) => void;
  resetViewRole: () => void;
  getCurrentViewRole: () => UserRole | null;
  isViewingAs: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

// Create a default context value to prevent HMR issues
const defaultAuthContextValue: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  logout: () => { throw new Error("AuthProvider not initialized") },
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdmin: () => false,
  isOwner: () => false,
  isRenter: () => false,
  viewRole: null,
  switchViewRole: () => { throw new Error("AuthProvider not initialized") },
  resetViewRole: () => { throw new Error("AuthProvider not initialized") },
  getCurrentViewRole: () => null,
  isViewingAs: () => false,
  refreshUser: async () => { throw new Error("AuthProvider not initialized") },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewRole, setViewRole] = useState<UserRole | null>(null);

  // Fetch authenticated user from backend
  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    fetchUser();
  }, []);

  const logout = () => {
    window.location.href = '/api/logout';
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

  // Role switching functions for admins
  const switchViewRole = (role: UserRole) => {
    if (user?.role === "admin") {
      setViewRole(role);
    }
  };

  const resetViewRole = () => {
    setViewRole(null);
  };

  const getCurrentViewRole = (): UserRole | null => {
    if (user?.role === "admin" && viewRole) {
      return viewRole;
    }
    return user?.role || null;
  };

  const isViewingAs = (role: UserRole): boolean => {
    return getCurrentViewRole() === role;
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
    hasRole,
    hasAnyRole,
    isAdmin,
    isOwner,
    isRenter,
    viewRole,
    switchViewRole,
    resetViewRole,
    getCurrentViewRole,
    isViewingAs,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  // In development, provide more helpful debugging information
  if (context === defaultAuthContextValue && import.meta.env.DEV) {
    console.warn("useAuth is using default context value. Make sure AuthProvider is properly wrapped around your component tree.");
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
