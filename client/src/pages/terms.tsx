import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BCIHeroLogo } from "@/components/bci-logo";
import { Loader2, FileText, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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
        <h2 key={`h2-${index}`} className="text-xl font-semibold text-primary mb-4 mt-10 first:mt-0">
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
          <div className="mb-8 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <BCIHeroLogo className="h-8 flex-shrink-0" />
          </div>

          {/* Terms Content */}
          <Card className="p-8">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="max-w-none pr-4" data-testid="terms-content">
                <FormattedTermsContent content={terms.content} />
              </div>
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
