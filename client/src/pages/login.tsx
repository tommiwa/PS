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
import { Car, Users, Shield, Clock, ChevronRight, Loader2, AlertCircle } from "lucide-react";

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
  waitlist: Clock,
};

// Color mapping for user type cards
const userTypeColors: Record<UserRole, string> = {
  renter: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
  owner: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
  admin: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800",
  waitlist: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
};

export default function Login() {
  const [, setLocation] = useLocation();
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
      await AuthService.demoLogin(selectedUserType, data.email);
      
      // Redirect based on user role
      switch (selectedUserType) {
        case "admin":
          setLocation("/admin/dashboard");
          break;
        case "renter":
          setLocation("/renter/dashboard");
          break;
        case "owner":
          setLocation("/dashboard");
          break;
        case "waitlist":
          setLocation("/waitlist/dashboard");
          break;
        default:
          setLocation("/dashboard");
      }
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
      await AuthService.demoLogin(userType);
      
      // Redirect based on user role
      switch (userType) {
        case "admin":
          setLocation("/admin/dashboard");
          break;
        case "renter":
          setLocation("/renter/dashboard");
          break;
        case "owner":
          setLocation("/dashboard");
          break;
        case "waitlist":
          setLocation("/waitlist/dashboard");
          break;
        default:
          setLocation("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">BCI Parking</h1>
              <p className="text-muted-foreground">Spot Sharing Application</p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground">
            Select your user type to access the parking system
          </p>
        </div>

        {/* User Type Selection */}
        {!showCredentials && (
          <div>
            <h2 className="text-xl font-semibold text-center mb-6">Choose Your Role</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.entries(userTypeDescriptions) as [UserRole, typeof userTypeDescriptions[UserRole]][]).map(([role, info]) => {
                const Icon = userTypeIcons[role];
                const isSelected = selectedUserType === role;
                const credentials = demoCredentials[role];
                
                return (
                  <Card
                    key={role}
                    className={`cursor-pointer transition-all duration-200 hover-elevate ${
                      isSelected 
                        ? `ring-2 ring-primary ${userTypeColors[role]}` 
                        : "hover:shadow-md"
                    }`}
                    onClick={() => handleUserTypeSelect(role)}
                    data-testid={`card-user-type-${role}`}
                  >
                    <CardHeader className="text-center pb-4">
                      <div className="flex justify-center mb-3">
                        <div className={`h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center`}>
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <CardTitle className="text-lg">{info.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {info.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Sample User:</h4>
                        <div className="text-sm">
                          <p className="font-medium">{credentials.email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                          <p className="text-muted-foreground">{credentials.email}</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Features:</h4>
                        <ul className="text-xs space-y-1">
                          {info.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <div className="h-1 w-1 bg-primary rounded-full flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full group"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickLogin(role);
                          }}
                          disabled={isLoading}
                          data-testid={`button-quick-login-${role}`}
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Quick Login
                              <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
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
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {selectedUserType && (() => {
                  const Icon = userTypeIcons[selectedUserType];
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                <CardTitle>
                  {selectedUserType && userTypeDescriptions[selectedUserType].title}
                </CardTitle>
              </div>
              <CardDescription>
                Enter your credentials to continue
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.name@bci.com"
                    {...form.register("email")}
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    {...form.register("password")}
                    data-testid="input-password"
                  />
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive" data-testid="alert-login-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Logging in...
                      </>
                    ) : (
                      "Log In"
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCredentials(false);
                      setSelectedUserType(null);
                      form.reset();
                      setError(null);
                    }}
                    className="w-full"
                    data-testid="button-back"
                  >
                    Back to Role Selection
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Demo Credentials Info */}
        <Card className="max-w-2xl mx-auto bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Demo Application
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This is a demonstration of the BCI Parking Spot Sharing Application. 
              You can quickly login with any role using the "Quick Login" buttons above.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-medium mb-2">Available Demo Accounts:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Renter: michael.rodriguez@bci.com</li>
                  <li>• Owner: sarah.chen@bci.com</li>
                  <li>• Admin: david.thompson@bci.com</li>
                  <li>• Waitlist: jennifer.kim@bci.com</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Features:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Role-based access control</li>
                  <li>• Persistent authentication</li>
                  <li>• Responsive design</li>
                  <li>• Real-time availability</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}