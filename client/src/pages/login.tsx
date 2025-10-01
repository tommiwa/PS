import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BCIHeroLogo } from "@/components/bci-logo";
import { ArrowRight } from "lucide-react";

export default function Login() {
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
