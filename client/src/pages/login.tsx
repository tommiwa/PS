import { Button } from "@/components/ui/button";
import { BCIHeroLogo } from "@/components/bci-logo";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-12">
        {/* Logo and Header */}
        <div className="text-center space-y-6">
          <BCIHeroLogo className="mx-auto" />
          
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              BCI Parking
            </h1>
            <p className="text-muted-foreground">
              Sign in to access your parking dashboard
            </p>
          </div>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          <Button 
            onClick={handleLogin}
            className="w-full"
            size="lg"
            data-testid="button-login"
          >
            Sign In with Replit
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <p className="text-center text-xs text-muted-foreground">
            Secure authentication for BCI employees
          </p>
        </div>
      </div>
    </div>
  );
}
