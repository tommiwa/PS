import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Mail, Plus, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ReportActionsProps {
  reportType: 'overview' | 'utilization' | 'revenue' | 'user-compliance' | 'waitlist-performance' | 'spot-assignments';
  onExport: () => void;
  filters: {
    dateFrom: string;
    dateTo: string;
    scope: 'all' | 'bci';
  };
}

export function ReportActions({ reportType, onExport, filters }: ReportActionsProps) {
  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleAddEmail = () => {
    const email = currentEmail.trim();
    if (!email) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }
    
    if (recipients.includes(email)) {
      toast({
        title: 'Duplicate email',
        description: 'This email is already in the list',
        variant: 'destructive'
      });
      return;
    }
    
    setRecipients([...recipients, email]);
    setCurrentEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(recipients.filter(e => e !== email));
  };

  const handleSendEmail = async () => {
    if (recipients.length === 0) {
      toast({
        title: 'No recipients',
        description: 'Please add at least one recipient',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    try {
      const response: any = await apiRequest(`/api/admin/reports/${reportType}/email`, {
        method: 'POST',
        body: JSON.stringify({
          recipients,
          from: filters.dateFrom,
          to: filters.dateTo,
          scope: filters.scope
        })
      });

      if (response.success) {
        toast({
          title: 'Email sent successfully',
          description: response.message || `Report sent to ${recipients.join(', ')}`
        });
        setEmailDialogOpen(false);
        setRecipients([]);
      } else {
        throw new Error(response.message || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Error sending report email:', error);
      
      // Handle SendGrid not configured error
      if (error.message?.includes('not configured') || error.message?.includes('unavailable')) {
        toast({
          title: 'Email service unavailable',
          description: 'SendGrid is not configured. Please contact your administrator to set up email delivery.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Failed to send email',
          description: error.message || 'An error occurred while sending the report',
          variant: 'destructive'
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={onExport}
        variant="outline"
        data-testid={`button-export-excel-${reportType}`}
      >
        <Download className="w-4 h-4 mr-2" />
        Export Excel
      </Button>
      
      <Button
        onClick={() => setEmailDialogOpen(true)}
        variant="outline"
        data-testid={`button-email-report-${reportType}`}
      >
        <Mail className="w-4 h-4 mr-2" />
        Email Report
      </Button>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent data-testid="dialog-email-report">
          <DialogHeader>
            <DialogTitle>Email Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-input">Add Recipients</Label>
              <div className="flex gap-2">
                <Input
                  id="email-input"
                  type="email"
                  placeholder="email@example.com"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  data-testid="input-email-recipient"
                />
                <Button
                  type="button"
                  onClick={handleAddEmail}
                  size="icon"
                  variant="outline"
                  data-testid="button-add-recipient"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {recipients.length > 0 && (
              <div className="space-y-2">
                <Label>Recipients ({recipients.length})</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {recipients.map((email, index) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                      data-testid={`recipient-item-${index}`}
                    >
                      <span className="text-sm">{email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveEmail(email)}
                        className="h-6 w-6"
                        data-testid={`button-remove-recipient-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              Report will include data from {filters.dateFrom} to {filters.dateTo} 
              ({filters.scope === 'bci' ? 'BCI-Managed Only' : 'All'})
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setRecipients([]);
                setCurrentEmail('');
              }}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSending || recipients.length === 0}
              data-testid="button-send-email"
            >
              {isSending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
