import { AuthUser, UserRole, sampleUsers } from "@shared/schema";

// Authentication storage keys
const AUTH_USER_KEY = "bci_parking_user";
const AUTH_TOKEN_KEY = "bci_parking_token";

// Authentication service
export class AuthService {
  // Store authenticated user in localStorage
  static setAuthUser(user: AuthUser): void {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, `token_${user.id}_${Date.now()}`);
  }

  // Get authenticated user from localStorage
  static getAuthUser(): AuthUser | null {
    try {
      const userStr = localStorage.getItem(AUTH_USER_KEY);
      if (!userStr) return null;
      
      const user = JSON.parse(userStr);
      
      // Convert lastLogin back to Date if it exists
      if (user.lastLogin) {
        user.lastLogin = new Date(user.lastLogin);
      }
      
      return user as AuthUser;
    } catch (error) {
      console.error("Error parsing auth user:", error);
      return null;
    }
  }

  // Clear authentication data
  static clearAuth(): void {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    const user = this.getAuthUser();
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return !!(user && token);
  }

  // Get auth token
  static getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  // Demo login function - authenticates based on role selection
  static async demoLogin(userType: UserRole, email?: string): Promise<AuthUser> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get sample user for the selected role
    const user = sampleUsers[userType];
    
    // If email is provided, verify it matches the sample user
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("Invalid email for selected user type");
    }
    
    // Update last login time
    const authenticatedUser: AuthUser = {
      ...user,
      lastLogin: new Date()
    };
    
    // Store in localStorage
    this.setAuthUser(authenticatedUser);
    
    return authenticatedUser;
  }

  // Check if user has specific role
  static hasRole(requiredRole: UserRole): boolean {
    const user = this.getAuthUser();
    return user?.role === requiredRole;
  }

  // Check if user has any of the specified roles
  static hasAnyRole(roles: UserRole[]): boolean {
    const user = this.getAuthUser();
    return user ? roles.includes(user.role) : false;
  }

  // Check if user is admin
  static isAdmin(): boolean {
    return this.hasRole("admin");
  }

  // Check if user is owner
  static isOwner(): boolean {
    return this.hasRole("owner");
  }

  // Check if user is renter
  static isRenter(): boolean {
    return this.hasRole("renter");
  }

}

// Available user types for login (excluding disabled roles)
type AvailableUserRoles = Exclude<UserRole, "owner">;

// User type descriptions for the login page
export const userTypeDescriptions: Record<AvailableUserRoles, { title: string; description: string; features: string[] }> = {
  renter: {
    title: "Spot Renter",
    description: "Search and book available parking spaces from other employees",
    features: [
      "Search and book available parking spots",
      "View real-time spot availability",
      "Manage your bookings and history",
      "Get notified about booking confirmations"
    ]
  },
  // DISABLED FOR V1: Spot owner login functionality disabled
  // Admins will manage unallocated spots instead
  // owner: {
  //   title: "Spot Owner", 
  //   description: "Share your parking spots AND book spaces from others",
  //   features: [
  //     "List your parking spots for rental",
  //     "Book parking spaces when you need them",
  //     "Manage both your spots and bookings",
  //     "Earn money from your unused spaces"
  //   ]
  // },
  admin: {
    title: "System Administrator",
    description: "Manage parking system and users", 
    features: [
      "Manage all users and roles",
      "Oversee parking spot assignments",
      "Monitor system usage",
      "Generate reports and analytics"
    ]
  }
};

// Default demo credentials for easy login
export const demoCredentials: Record<AvailableUserRoles, { email: string; password: string }> = {
  renter: {
    email: "michael.rodriguez@bci.ca",
    password: "demo123"
  },
  // DISABLED FOR V1: Spot owner login functionality disabled
  // owner: {
  //   email: "sarah.chen@bci.ca", 
  //   password: "demo123"
  // },
  admin: {
    email: "david.thompson@bci.ca",
    password: "admin123"
  }
};