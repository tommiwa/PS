import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AuthService, userTypeDescriptions, demoCredentials } from "@/lib/auth";
import { UserRole } from "@shared/schema";
import { useAuth } from "@/contexts/auth-context";
import { Car, Users, Shield, Clock, ChevronRight, Loader2, AlertCircle, ArrowLeft, Building2 } from "lucide-react";
import BCILogo, { BCIHeroLogo } from "@/components/bci-logo";

// Form validation schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

// Icon mapping for user types
const userTypeIcons: Record<UserRole, React.ComponentType<any>> = {
  renter: Car,
  owner: Users,
  admin: Shield,
};

// Professional color mapping for user type cards
const userTypeColors: Record<UserRole, string> = {
  renter: "border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30",
  owner: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30",
  admin: "border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20 hover:bg-violet-100/50 dark:hover:bg-violet-950/30",
};

// Professional icon backgrounds for user types
const userTypeIconBgs: Record<UserRole, string> = {
  renter: "bg-primary/10 text-primary",
  owner: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  admin: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [selectedUserType, setSelectedUserType] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Handle user type selection
  const handleUserTypeSelect = (userType: UserRole) => {
    setSelectedUserType(userType);
    setError(null);
    
    // Auto-fill credentials for demo
    const credentials = demoCredentials[userType];
    form.setValue("email", credentials.email);
    form.setValue("password", credentials.password);
    setShowCredentials(true);
  };

  // Handle form submission
  const onSubmit = async (data: LoginForm) => {
    if (!selectedUserType) {
      setError("Please select a user type to continue");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(selectedUserType, data.email);
      
      // Redirect to root path, let LandingPageRedirect handle role-based routing
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick demo login
  const handleQuickLogin = async (userType: UserRole) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(userType);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-primary/5">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 bg-[size:20px_20px] opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-primary/10 dark:from-slate-950/50 dark:via-transparent dark:to-primary/5" />
      
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-5xl space-y-8">
          {/* Hero Logo Section */}
          <div className="text-center py-8">
            <BCIHeroLogo className="mx-auto" />
            
            {!showCredentials && (
              <div className="mt-8 space-y-3">
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome to BCI Parking
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Select your role to access our enterprise parking management system. 
                  Streamline your parking experience with our professional solution.
                </p>
              </div>
            )}
            
            {showCredentials && (
              <div className="mt-6 space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  Sign In to Your Account
                </h2>
                <p className="text-muted-foreground">
                  Welcome back! Please enter your credentials to continue.
                </p>
              </div>
            )}
          </div>

          {/* User Type Selection */}
          {!showCredentials && (
            <div className="space-y-8">
              {/* Section Header */}
              <div className="text-center space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Select Your Account Type</h3>
                <p className="text-muted-foreground">Choose the option that best describes your role in the organization</p>
              </div>

              {/* User Type Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {(Object.entries(userTypeDescriptions) as [UserRole, typeof userTypeDescriptions[UserRole]][]).map(([role, info]) => {
                  const Icon = userTypeIcons[role];
                  const isSelected = selectedUserType === role;
                  const credentials = demoCredentials[role];
                  
                  return (
                    <Card
                      key={role}
                      className={`cursor-pointer transition-all duration-300 hover-elevate group relative overflow-hidden ${
                        isSelected 
                          ? `ring-2 ring-primary/50 shadow-lg ${userTypeColors[role]}` 
                          : `${userTypeColors[role]} hover:shadow-md border`
                      }`}
                      onClick={() => handleUserTypeSelect(role)}
                      data-testid={`card-user-type-${role}`}
                    >
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 h-0 w-0 border-l-[40px] border-t-[40px] border-l-transparent border-t-primary/20" />
                      )}
                      
                      <CardHeader className="pb-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 ${userTypeIconBgs[role]}`}>
                            <Icon className="h-7 w-7" />
                          </div>
                          
                          {/* Title and Description */}
                          <div className="flex-1 space-y-2">
                            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                              {info.title}
                            </CardTitle>
                            <CardDescription className="text-sm leading-relaxed">
                              {info.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Demo User Info */}
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Demo Account</Badge>
                          </div>
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {credentials.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-muted-foreground text-xs">{credentials.email}</p>
                          </div>
                        </div>
                        
                        {/* Key Features */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Key Features:</h4>
                          <ul className="space-y-1">
                            {info.features.slice(0, 2).map((feature, index) => (
                              <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                                <span className="leading-relaxed">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 group/btn text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickLogin(role);
                            }}
                            disabled={isLoading}
                            data-testid={`button-quick-login-${role}`}
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                Quick Login
                                <ChevronRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-0.5 transition-transform" />
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="px-3 text-xs"
                            onClick={() => handleUserTypeSelect(role)}
                            data-testid={`button-select-${role}`}
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Login Form */}
          {showCredentials && (
            <div className="max-w-lg mx-auto">
              <Card className="shadow-xl border-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm">
                <CardHeader className="text-center pb-6">
                  {/* Back Button */}
                  <div className="flex items-center mb-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCredentials(false);
                        setSelectedUserType(null);
                        form.reset();
                        setError(null);
                      }}
                      className="gap-2"
                      data-testid="button-back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Role Selection
                    </Button>
                  </div>
                  
                  {/* Selected User Type Info */}
                  {selectedUserType && (
                    <div className="bg-muted/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {(() => {
                          const Icon = userTypeIcons[selectedUserType];
                          return (
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${userTypeIconBgs[selectedUserType]}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                          );
                        })()}
                        <div className="text-left">
                          <CardTitle className="text-lg">
                            {userTypeDescriptions[selectedUserType].title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {demoCredentials[selectedUserType].email}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <CardDescription className="text-base">
                    Enter your credentials to access the BCI Parking system
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Email Field */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.name@bci.ca"
                        className="h-11 text-base"
                        {...form.register("email")}
                        data-testid="input-email"
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password Field */}
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        className="h-11 text-base"
                        {...form.register("password")}
                        data-testid="input-password"
                      />
                      {form.formState.errors.password && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {form.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Error Alert */}
                    {error && (
                      <Alert variant="destructive" data-testid="alert-login-error">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    {/* Demo Credentials Helper */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Demo Account
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Use the pre-filled credentials or click "Log In" to access the demo system.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Login Button */}
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base font-medium"
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In to BCI Parking"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Demo Credentials Info */}
          {!showCredentials && (
            <div className="max-w-4xl mx-auto">
              <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center pb-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      Demo Environment
                    </CardTitle>
                  </div>
                  <CardDescription className="text-base">
                    Experience the full BCI Parking Management System with our interactive demo
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      This demonstration showcases our enterprise parking solution with role-based access control, 
                      real-time availability tracking, and comprehensive management features.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Demo Accounts */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Demo Accounts Available
                      </h4>
                      <div className="space-y-2">
                        {(Object.entries(demoCredentials) as [UserRole, typeof demoCredentials[UserRole]][]).map(([role, credentials]) => (
                          <div key={role} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
                            {(() => {
                              const Icon = userTypeIcons[role];
                              return (
                                <div className={`h-6 w-6 rounded flex items-center justify-center ${userTypeIconBgs[role]}`}>
                                  <Icon className="h-3 w-3" />
                                </div>
                              );
                            })()}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground capitalize">
                                {userTypeDescriptions[role].title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {credentials.email}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* System Features */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Enterprise Features
                      </h4>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                          <span>Role-based access control with admin oversight</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                          <span>Real-time parking availability and booking management</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                          <span>Real-time notifications and system alerts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                          <span>Comprehensive analytics and reporting dashboard</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                          <span>Responsive design optimized for all devices</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Quick Start Instructions */}
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Car className="h-3 w-3 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-primary">
                          Quick Start Guide
                        </p>
                        <p className="text-xs text-primary/80">
                          Select any account type above to explore the system, or use the "Quick Login" buttons for instant access. 
                          All demo accounts are pre-configured with sample data to showcase the full functionality.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}