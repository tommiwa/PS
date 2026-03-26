import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BCIHeroLogo } from "@/components/bci-logo";
import { ArrowRight, AlertCircle, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// Component to render formatted terms content
function FormattedTermsContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'bullet' | 'check' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className={listType === 'check' ? 'space-y-2 mb-6' : 'space-y-1.5 mb-6 ml-6'}>
          {currentList}
        </ul>
      );
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Main heading (H1)
    if (trimmed.startsWith('# ')) {
      flushList();
      const text = trimmed.substring(2).trim();
      elements.push(
        <h1 key={`h1-${index}`} className="text-2xl font-bold text-foreground mb-4 mt-8 first:mt-0">
          {text}
        </h1>
      );
    }
    // Section heading (H2)
    else if (trimmed.startsWith('## ')) {
      flushList();
      const text = trimmed.substring(3).trim();
      elements.push(
        <h2 key={`h2-${index}`} className="text-lg font-semibold text-primary mb-4 mt-8 first:mt-0">
          {text}
        </h2>
      );
    }
    // Subsection heading (H3)
    else if (trimmed.startsWith('### ')) {
      flushList();
      const text = trimmed.substring(4).trim();
      elements.push(
        <h3 key={`h3-${index}`} className="text-base font-semibold text-foreground mb-3 mt-6">
          {text}
        </h3>
      );
    }
    // Horizontal rule
    else if (trimmed === '---') {
      flushList();
      elements.push(
        <Separator key={`sep-${index}`} className="my-4" />
      );
    }
    // Check list item
    else if (trimmed.startsWith('✓ ')) {
      if (listType !== 'check') {
        flushList();
        listType = 'check';
      }
      const text = trimmed.substring(2).trim();
      currentList.push(
        <li key={`check-${index}`} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-muted-foreground">{text}</span>
        </li>
      );
    }
    // Bullet point
    else if (trimmed.startsWith('- ')) {
      if (listType !== 'bullet') {
        flushList();
        listType = 'bullet';
      }
      const text = trimmed.substring(2).trim();
      currentList.push(
        <li key={`bullet-${index}`} className="text-sm text-muted-foreground list-disc">
          {text.startsWith('**') && text.endsWith('**') ? (
            <strong className="text-foreground font-semibold">{text.slice(2, -2)}</strong>
          ) : (
            text
          )}
        </li>
      );
    }
    // Bold text paragraph
    else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      flushList();
      const text = trimmed.slice(2, -2);
      elements.push(
        <p key={`bold-${index}`} className="text-sm font-semibold text-foreground mb-2 mt-2">
          {text}
        </p>
      );
    }
    // Regular paragraph
    else if (trimmed && !trimmed.startsWith('*') && !trimmed.startsWith('#')) {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="text-sm text-muted-foreground mb-2 leading-relaxed">
          {trimmed}
        </p>
      );
    }
    // Empty line
    else if (!trimmed) {
      flushList();
    }
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
}

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
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  const { data: terms, isLoading: termsLoading } = useQuery<TermsVersion>({
    queryKey: ["/api/legal/terms"],
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error === 'account_suspended') {
      setErrorMessage('Your account has been suspended. Please contact your administrator for assistance.');
    } else if (error === 'account_deleted') {
      setErrorMessage('Your account has been deleted. Please contact your administrator for assistance.');
    } else {
      setErrorMessage(null);
    }
  }, [location]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5 dark:from-primary/5 dark:via-background dark:to-primary/10" />
      
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-md relative shadow-2xl border-primary/20">
        <div className="p-8 md:p-10 space-y-8">
          <div className="text-center space-y-4">
            <BCIHeroLogo className="mx-auto" />
            <p className="text-sm text-muted-foreground">
              Sign in to continue
            </p>
          </div>

          <div className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive" data-testid="alert-login-error" className="border-destructive/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="text-login-error">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Button 
                onClick={handleLogin}
                className="w-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                size="lg"
                data-testid="button-login"
              >
                Sign In with Replit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                By signing in, you agree to our{" "}
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
                      {termsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : terms ? (
                        <div className="max-w-none" data-testid="terms-dialog-content">
                          <FormattedTermsContent content={terms.content} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12 text-center">
                          <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">Terms temporarily unavailable. Please try again later.</p>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
