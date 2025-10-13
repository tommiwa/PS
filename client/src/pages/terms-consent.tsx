import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BCIHeroLogo } from "@/components/bci-logo";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

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
        <h1 key={`h1-${index}`} className="text-3xl font-bold text-foreground mb-4 mt-10 first:mt-0">
          {text}
        </h1>
      );
    }
    // Section heading (H2)
    else if (trimmed.startsWith('## ')) {
      flushList();
      const text = trimmed.substring(3).trim();
      elements.push(
        <h2 key={`h2-${index}`} className="text-xl font-semibold text-primary mb-4 mt-10 first:mt-0 flex items-center gap-2">
          {text}
        </h2>
      );
    }
    // Subsection heading (H3)
    else if (trimmed.startsWith('### ')) {
      flushList();
      const text = trimmed.substring(4).trim();
      elements.push(
        <h3 key={`h3-${index}`} className="text-lg font-semibold text-foreground mb-3 mt-8">
          {text}
        </h3>
      );
    }
    // Horizontal rule
    else if (trimmed === '---') {
      flushList();
      elements.push(
        <Separator key={`sep-${index}`} className="my-6" />
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
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
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
        <p key={`bold-${index}`} className="text-base font-semibold text-foreground mb-3 mt-2">
          {text}
        </p>
      );
    }
    // Regular paragraph
    else if (trimmed && !trimmed.startsWith('*') && !trimmed.startsWith('#')) {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="text-sm text-muted-foreground mb-3 leading-relaxed">
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

export default function TermsConsent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const { data: terms, isLoading, error } = useQuery<TermsVersion>({
    queryKey: ["/api/legal/terms"],
  });

  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/legal/terms/accept", {
        method: "POST",
      });
      return await response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Terms Accepted",
        description: "You have successfully accepted the Terms and Conditions.",
      });
      
      // Refresh user data to update terms acceptance status
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Navigate to home and let role-based routing handle the destination
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept terms. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (accepted) {
      acceptTermsMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading Terms and Conditions...</p>
        </div>
      </div>
    );
  }

  if (error || !terms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Terms Not Available</h2>
          <p className="text-muted-foreground mb-4">
            Unable to load the Terms and Conditions. Please contact support.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-6 text-center">
          <BCIHeroLogo className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground">
            Please review and accept the terms to continue using the platform
          </p>
        </div>

        <Card className="p-6 md:p-8">
          <ScrollArea className="h-[60vh] mb-6">
            <div className="max-w-none pr-4" data-testid="terms-consent-content">
              <FormattedTermsContent content={terms.content} />
            </div>
          </ScrollArea>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
              <Checkbox
                id="terms-acceptance"
                checked={accepted}
                onCheckedChange={(checked) => setAccepted(checked === true)}
                data-testid="checkbox-accept-terms"
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="terms-acceptance"
                  className="text-sm font-medium leading-relaxed cursor-pointer"
                >
                  I have read and agree to the Terms and Conditions
                </label>
                <p className="text-sm text-muted-foreground">
                  By checking this box, you acknowledge that you understand and accept all terms outlined above.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Version {terms.version} • Last updated: {new Date(terms.publishedAt || terms.createdAt).toLocaleDateString()}
              </p>
              <Button
                onClick={handleAccept}
                disabled={!accepted || acceptTermsMutation.isPending}
                size="lg"
                data-testid="button-accept-terms"
              >
                {acceptTermsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept and Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
