import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BCIHeroLogo } from "@/components/bci-logo";
import { ArrowRight, AlertCircle, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface TermsVersion {
  id: number;
  version: number;
  content: string;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function Login() {
  const [location] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Fetch terms for the popup
  const { data: terms } = useQuery<TermsVersion>({
    queryKey: ["/api/legal/terms"],
  });

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
    // Include acceptTerms parameter if checkbox is checked
    const loginUrl = termsAccepted ? "/api/login?acceptTerms=true" : "/api/login";
    window.location.href = loginUrl;
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

            {/* Terms and Conditions Acceptance */}
            <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
              <Checkbox
                id="terms-acceptance"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                data-testid="checkbox-accept-terms-login"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms-acceptance"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I accept the{" "}
                  <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-primary underline hover:text-primary/80"
                        data-testid="button-open-terms-dialog"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsDialogOpen(true);
                        }}
                      >
                        Terms and Conditions
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Terms and Conditions
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[60vh] pr-4">
                        {terms ? (
                          <div 
                            className="prose prose-sm dark:prose-invert max-w-none"
                            data-testid="terms-dialog-content"
                            dangerouslySetInnerHTML={{ __html: terms.content.replace(/\n/g, '<br/>') }}
                          />
                        ) : (
                          <p className="text-muted-foreground">Loading terms...</p>
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </label>
              </div>
            </div>

            {/* Login Button */}
            <Button 
              onClick={handleLogin}
              disabled={!termsAccepted}
              className="w-full"
              size="lg"
              data-testid="button-login"
            >
              Sign In with Replit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            {!termsAccepted && (
              <p className="text-xs text-center text-muted-foreground">
                Please accept the Terms and Conditions to continue
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
