import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { BCIHeroLogo } from "@/components/bci-logo";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

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
      return await apiRequest("/api/legal/terms/accept", {
        method: "POST",
      });
    },
    onSuccess: async () => {
      toast({
        title: "Terms Accepted",
        description: "You have successfully accepted the Terms and Conditions.",
      });
      
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
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

        <Card className="p-6">
          <ScrollArea className="h-[60vh] mb-6">
            <div 
              className="prose prose-sm dark:prose-invert max-w-none pr-4 whitespace-pre-wrap" 
              data-testid="terms-consent-content"
              dangerouslySetInnerHTML={{ __html: terms.content.replace(/\n/g, '<br/>') }}
            />
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
