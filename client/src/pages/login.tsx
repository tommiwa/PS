import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BCIHeroLogo } from "@/components/bci-logo";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [location] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Parse error parameter from URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error === 'account_suspended') {
      setErrorMessage('Your account has been suspended. Please contact your administrator for assistance.');
    } else if (error === 'account_deleted') {
      setErrorMessage('Your account has been deleted. Please contact your administrator for assistance.');
    } else {
      // Reset error message when no error parameter is present
      setErrorMessage(null);
    }
  }, [location]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-8">
          {/* Logo */}
          <div className="text-center">
            <BCIHeroLogo className="mx-auto" />
          </div>

          {/* Content */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                Sign in to access your dashboard
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="destructive" data-testid="alert-login-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="text-login-error">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Terms and Conditions Link */}
            <div className="text-center">
              <a 
                href="/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground underline"
                data-testid="link-login-terms"
              >
                View Terms and Conditions
              </a>
            </div>

            {/* Login Button */}
            <Button 
              onClick={handleLogin}
              className="w-full"
              size="lg"
              data-testid="button-login"
            >
              Sign In with Replit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
