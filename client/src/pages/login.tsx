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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5 dark:from-primary/5 dark:via-background dark:to-primary/10" />
      
      {/* Decorative Circles */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      
      {/* Login Card */}
      <Card className="w-full max-w-md relative shadow-2xl border-primary/20">
        <div className="p-8 md:p-10 space-y-8">
          {/* Logo with animation effect */}
          <div className="text-center space-y-4">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
              <BCIHeroLogo className="mx-auto" />
            </div>
            <div className="space-y-1">
              <p className="text-lg text-muted-foreground font-light">
                Welcome to BCI ParkShare
              </p>
              <p className="text-sm text-muted-foreground/80">
                Sign in to access your dashboard
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="destructive" data-testid="alert-login-error" className="border-destructive/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="text-login-error">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Terms and Conditions Acceptance */}
            <div className="flex items-start space-x-3 p-4 bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border border-border/50">
              <Checkbox
                id="terms-acceptance"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                data-testid="checkbox-accept-terms-login"
                className="mt-0.5"
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
                        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium"
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
            <div className="space-y-3">
              <Button 
                onClick={handleLogin}
                disabled={!termsAccepted}
                className="w-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
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
        </div>
      </Card>
    </div>
  );
}
