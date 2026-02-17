import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserRole } from "@shared/schema";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  department?: string;
  departmentId?: number;
  memberSince?: string;
  roles: UserRole[];
  profileImageUrl?: string;
  acceptedTermsVersion?: number | null;
  acceptedTermsAt?: string | null;
  vehicleInfo?: { 
    make?: string; 
    model?: string; 
    color?: string; 
  };
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
  switchViewRole: (role: UserRole) => Promise<void>;
  resetViewRole: () => Promise<void>;
  getCurrentViewRole: () => UserRole | null;
  isViewingAs: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
  effectiveRole: UserRole | null;
  // Terms and Conditions
  hasAcceptedTerms: () => boolean;
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
  switchViewRole: async () => { throw new Error("AuthProvider not initialized") },
  resetViewRole: async () => { throw new Error("AuthProvider not initialized") },
  getCurrentViewRole: () => null,
  isViewingAs: () => false,
  refreshUser: async () => { throw new Error("AuthProvider not initialized") },
  effectiveRole: null,
  hasAcceptedTerms: () => false,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewRole, setViewRole] = useState<UserRole | null>(null);

  // Fetch authenticated user from backend with graceful session recovery
  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Mark that we've had a successful session
        try { sessionStorage.setItem('bci_had_session', '1'); } catch {}
      } else if (response.status === 401) {
        setUser(null);
        
        // Attempt silent re-auth if user previously had a session
        // Use sessionStorage flag + cooldown to prevent redirect loops
        const hadSession = sessionStorage.getItem('bci_had_session') === '1';
        const lastReauthAttempt = parseInt(sessionStorage.getItem('bci_reauth_ts') || '0', 10);
        const cooldownMs = 60000; // 1 minute cooldown between re-auth attempts
        const now = Date.now();
        
        if (hadSession && (now - lastReauthAttempt) > cooldownMs) {
          console.log("[Auth] Session expired, attempting silent re-auth...");
          sessionStorage.setItem('bci_reauth_ts', String(now));
          sessionStorage.removeItem('bci_had_session');
          window.location.href = '/api/login';
          return;
        }
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

  // Initialize view role from backend session
  useEffect(() => {
    const initializeViewRole = async () => {
      try {
        const response = await fetch('/api/auth/view-as', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.viewAsRole) {
            setViewRole(data.viewAsRole);
          }
        }
      } catch (error) {
        console.error("Error initializing view role:", error);
      }
    };
    
    if (user?.roles?.includes("admin")) {
      initializeViewRole();
    }
  }, [user]);

  const logout = () => {
    try { sessionStorage.setItem('bci_logging_out', '1'); } catch (_) {}
    window.location.href = '/api/logout';
  };

  const hasRole = (role: UserRole): boolean => {
    return user ? user.roles.includes(role) : false;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.some(role => user.roles.includes(role)) : false;
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

  const getEffectiveRole = (): UserRole | null => {
    if (!user || !user.roles || user.roles.length === 0) return null;
    
    // Priority: admin > owner > renter
    if (user.roles.includes('admin')) return 'admin';
    if (user.roles.includes('owner')) return 'owner';
    return 'renter';
  };

  // Role switching functions for admins
  const switchViewRole = async (role: UserRole) => {
    if (user?.roles?.includes("admin")) {
      setViewRole(role);
      
      // Persist to backend
      try {
        await fetch('/api/auth/view-as', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
          credentials: 'include',
        });
      } catch (error) {
        console.error("Error persisting view role:", error);
      }
    }
  };

  const resetViewRole = async () => {
    setViewRole(null);
    
    // Clear from backend
    try {
      await fetch('/api/auth/view-as', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error("Error clearing view role:", error);
    }
  };

  const getCurrentViewRole = (): UserRole | null => {
    if (user?.roles?.includes("admin") && viewRole) {
      return viewRole;
    }
    return getEffectiveRole();
  };

  const isViewingAs = (role: UserRole): boolean => {
    return getCurrentViewRole() === role;
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const hasAcceptedTerms = (): boolean => {
    return !!user?.acceptedTermsVersion;
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
    effectiveRole: getEffectiveRole(),
    hasAcceptedTerms,
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
    return allowedRoles.some(role => user.roles.includes(role));
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
