import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BCIHeroLogo } from "@/components/bci-logo";
import { Loader2, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface TermsVersion {
  id: number;
  version: number;
  content: string;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function Terms() {
  const [, setLocation] = useLocation();

  const { data: terms, isLoading, error } = useQuery<TermsVersion>({
    queryKey: ["/api/legal/terms"],
  });

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
            Unable to load the Terms and Conditions. Please try again later.
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <BCIHeroLogo className="h-8" />
          </div>

          {/* Terms Content */}
          <Card className="p-8">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none pr-4 whitespace-pre-wrap" 
                data-testid="terms-content"
                dangerouslySetInnerHTML={{ __html: terms.content.replace(/\n/g, '<br/>') }}
              />
            </ScrollArea>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
              <p>Version {terms.version}</p>
              <p>Last updated: {new Date(terms.publishedAt || terms.createdAt).toLocaleDateString()}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
