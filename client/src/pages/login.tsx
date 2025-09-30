import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BCILogo, { BCIHeroLogo } from "@/components/bci-logo";
import { Building2, Shield, Users, ArrowRight } from "lucide-react";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-primary/5">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 bg-[size:20px_20px] opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-primary/10 dark:from-slate-950/50 dark:via-transparent dark:to-primary/5" />
      
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Hero Logo Section */}
          <div className="text-center py-8">
            <BCIHeroLogo className="mx-auto" />
            
            <div className="mt-8 space-y-3">
              <h2 className="text-3xl font-semibold text-foreground">
                Welcome to BCI Parking
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Enterprise parking management system for BCI employees. 
                Sign in with your company account to continue.
              </p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-semibold">
                Sign In
              </CardTitle>
              <CardDescription className="text-base">
                Access the BCI Parking Management System
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Login Button */}
              <Button 
                onClick={handleLogin}
                className="w-full h-12 text-base font-medium"
                size="lg"
                data-testid="button-login"
              >
                Sign In with Replit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              {/* Features Grid */}
              <div className="pt-4 space-y-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-4">
                    System Features
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Real-Time Availability</p>
                      <p className="text-xs text-muted-foreground">Search and book parking spots instantly</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Multi-Location Support</p>
                      <p className="text-xs text-muted-foreground">Access parking across all BCI locations</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Secure & Compliant</p>
                      <p className="text-xs text-muted-foreground">Enterprise-grade security and data protection</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer Info */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Secure authentication powered by Replit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
