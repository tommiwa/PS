import { useState, useEffect } from "react"
import { formatCurrency } from "@/lib/utils"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Calendar,
  MessageSquare,
  Ban,
  Activity,
  CheckCircle2,
  XCircle,
  Settings,
  Zap,
  Eye,
  Download,
  User,
  Loader2,
} from "lucide-react"

interface AdminBookingData {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  renterDepartment: string;
  ownerName: string;
  ownerEmail: string;
  ownerDepartment: string;
  bookingDate: string;
  dailyRate: number;
  totalAmount: number;
  status: string;
  paymentStatus?: 'pending' | 'paid' | 'received';
  notes: string;
  createdAt: string;
  lastActivity: string;
  ownerPaymentType?: string;
  ownerPaymentInstructions?: string;
}

interface AuditLogData {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  success: boolean;
  message: string | null;
  before: any;
  after: any;
}

interface BookingDetailsDialogProps {
  bookingId: string | null;
  onClose: () => void;
  scope?: 'all' | 'bci';
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    confirmed: { variant: "default", label: "Confirmed" },
    pending: { variant: "secondary", label: "Pending" },
    cancelled: { variant: "destructive", label: "Cancelled" },
    completed: { variant: "outline", label: "Completed" }
  };
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getAuditIcon(action: string) {
  const iconMap: Record<string, JSX.Element> = {
    CREATE: <Calendar className="h-4 w-4 text-blue-600" />,
    UPDATE: <Settings className="h-4 w-4 text-amber-600" />,
    DELETE: <XCircle className="h-4 w-4 text-red-600" />,
    CANCEL: <Ban className="h-4 w-4 text-red-600" />,
    COMPLETE: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    APPROVE: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    REJECT: <XCircle className="h-4 w-4 text-red-600" />,
    ACTIVATE: <Zap className="h-4 w-4 text-green-600" />,
    DEACTIVATE: <Ban className="h-4 w-4 text-gray-600" />,
    VIEW: <Eye className="h-4 w-4 text-blue-600" />,
    EXPORT: <Download className="h-4 w-4 text-purple-600" />,
  };
  return iconMap[action] || <Activity className="h-4 w-4 text-gray-600" />;
}

function formatDate(timestamp: string) {
  if (timestamp && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    const [year, month, day] = timestamp.split('-').map(Number);
    return `${month}/${day}/${year}`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function BookingDetailsDialog({ bookingId, onClose, scope }: BookingDetailsDialogProps) {
  const { toast } = useToast()
  const isOpen = bookingId !== null

  const [bookingDetailsTab, setBookingDetailsTab] = useState("details")
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [contactMessage, setContactMessage] = useState("")
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(["renter", "owner"])
  const [isSendingContact, setIsSendingContact] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setBookingDetailsTab("details")
    }
  }, [isOpen])

  const { data: booking, isLoading: isLoadingBooking } = useQuery<AdminBookingData>({
    queryKey: ['/api/admin/bookings', bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId!)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch booking');
      return res.json();
    },
    enabled: !!bookingId,
  });

  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useQuery<AuditLogData[]>({
    queryKey: ["/api/admin/audits", { entityType: 'booking', entityId: bookingId }],
    queryFn: async ({ queryKey }) => {
      const params = queryKey[1] as Record<string, unknown>;
      const searchParams = new URLSearchParams({ entityType: String(params.entityType), entityId: String(params.entityId) });
      const response = await fetch(`/api/admin/audits?${searchParams}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      return data.items ?? [];
    },
    enabled: isOpen && !!bookingId
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const response = await apiRequest(`/api/admin/bookings/${bookingId}/cancel`, { method: 'POST', body: { reason } });
      return response.json();
    },
    onSuccess: () => {
      if (scope) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings", scope] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity", scope] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      }
      toast({
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled and both users have been notified.",
      });
      setShowCancelDialog(false);
      setCancelReason("");
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel booking. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCancelBooking = () => {
    if (!booking || !cancelReason.trim()) return;
    cancelBookingMutation.mutate({ bookingId: booking.id, reason: cancelReason });
  };

  const handleContactUser = async () => {
    if (!booking || !contactMessage.trim() || selectedRecipients.length === 0) return;
    setIsSendingContact(true);
    try {
      const response = await apiRequest(`/api/admin/bookings/${booking.id}/contact`, {
        method: 'POST',
        body: { message: contactMessage, recipients: selectedRecipients }
      });
      const data = await response.json();
      toast({
        title: "Message Sent",
        description: `Your message has been sent to ${data.emailsSent} recipient(s).`,
      });
      setShowContactDialog(false);
      setContactMessage("");
      setSelectedRecipients(["renter", "owner"]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to send contact email",
        variant: "destructive"
      });
    } finally {
      setIsSendingContact(false);
    }
  };

  const handleMainDialogClose = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showCancelDialog && !showContactDialog} onOpenChange={handleMainDialogClose}>
        <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="dialog-booking-details">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              View complete information about this booking
            </DialogDescription>
          </DialogHeader>
          {isLoadingBooking ? (
            <div className="space-y-4 py-4" data-testid="skeleton-booking-loading">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ) : booking ? (
            <Tabs value={bookingDetailsTab} onValueChange={setBookingDetailsTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-booking-details">
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                <TabsTrigger value="audit-history" data-testid="tab-audit-history">
                  Audit History
                  {Array.isArray(auditLogs) && auditLogs.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{auditLogs.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Spot Information</Label>
                    <p className="font-medium" data-testid="text-spot-number">{booking.spotNumber}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-spot-location">{booking.spotLocation}</p>
                  </div>
                  <div>
                    <Label>Usage Date</Label>
                    <p className="font-medium" data-testid="text-booking-date">{formatDate(booking.bookingDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Renter</Label>
                    <p className="font-medium" data-testid="text-renter-name">{booking.renterName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-renter-email">{booking.renterEmail}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-renter-department">{booking.renterDepartment}</p>
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    <p className="font-medium" data-testid="text-owner-name">{booking.ownerName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-owner-email">{booking.ownerEmail}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-owner-department">{booking.ownerDepartment}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Total Amount</Label>
                    <p className="font-medium" data-testid="text-total-amount">${Number(booking.totalAmount).toFixed(2)}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div data-testid="badge-booking-status">
                      {getStatusBadge(booking.status)}
                    </div>
                  </div>
                  <div>
                    <Label>Payment</Label>
                    {(() => {
                      const status = booking.paymentStatus || 'pending';
                      const isPayrollBooking = booking.ownerName === 'BCI Workplace Services';
                      return (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={status === 'received' ? 'default' : status === 'paid' ? 'secondary' : 'outline'}
                            data-testid="badge-payment-status"
                          >
                            {status === 'pending' ? 'Pending' : status === 'paid' ? 'Paid' : 'Received'}
                          </Badge>
                          {isPayrollBooking && status === 'received' && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200" data-testid="badge-payroll-indicator">
                              Payroll
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {booking.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p className="text-sm" data-testid="text-booking-notes">{booking.notes}</p>
                  </div>
                )}

                {(booking.ownerPaymentType || booking.ownerPaymentInstructions) && (
                  <div>
                    <Label>Owner Payment Preference</Label>
                    {booking.ownerPaymentType && (
                      <p className="text-sm font-medium capitalize">
                        {booking.ownerPaymentType === 'interac_transfer' ? 'Interac e-Transfer' : booking.ownerPaymentType}
                      </p>
                    )}
                    {booking.ownerPaymentInstructions && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{booking.ownerPaymentInstructions}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowContactDialog(true)}
                    data-testid="button-contact-from-details"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Users
                  </Button>
                  {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                    <Button
                      variant="destructive"
                      onClick={() => setShowCancelDialog(true)}
                      data-testid="button-cancel-from-details"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Cancel Booking
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="audit-history" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  {isLoadingAuditLogs ? (
                    <div className="space-y-4" data-testid="audit-loading">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="audit-empty-state">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">No Audit History</p>
                      <p className="text-sm text-muted-foreground">No audit logs found for this booking</p>
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="audit-timeline">
                      {[...auditLogs]
                        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                        .map((log, index) => (
                          <div
                            key={log.id}
                            className="flex gap-4 relative pb-4"
                            data-testid={`audit-log-${log.id}`}
                          >
                            {index < auditLogs.length - 1 && (
                              <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                            )}
                            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                              {getAuditIcon(log.action)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium" data-testid={`audit-action-${log.id}`}>
                                    {log.message || `${log.action} - ${log.entityType}`}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground" data-testid={`audit-actor-${log.id}`}>
                                      {log.actorEmail || "System"}
                                    </p>
                                    {log.actorRole && (
                                      <Badge variant="outline" className="text-xs" data-testid={`audit-role-${log.id}`}>
                                        {log.actorRole}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium" data-testid={`audit-time-${log.id}`}>
                                    {new Date(log.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  <p className="text-xs text-muted-foreground" data-testid={`audit-date-${log.id}`}>
                                    {new Date(log.occurredAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={log.success ? "default" : "destructive"}
                                  className="text-xs"
                                  data-testid={`audit-status-${log.id}`}
                                >
                                  {log.success ? "SUCCESS" : "FAILED"}
                                </Badge>
                                <Badge variant="outline" className="text-xs" data-testid={`audit-action-type-${log.id}`}>
                                  {log.action}
                                </Badge>
                              </div>
                              {(log.before || log.after) && (
                                <details className="mt-2">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                    View details
                                  </summary>
                                  <div className="mt-2 space-y-2 text-xs">
                                    {log.before && (
                                      <div>
                                        <p className="font-medium">Before:</p>
                                        <pre className="bg-muted p-2 rounded overflow-auto">
                                          {JSON.stringify(log.before, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {log.after && (
                                      <div>
                                        <p className="font-medium">After:</p>
                                        <pre className="bg-muted p-2 rounded overflow-auto">
                                          {JSON.stringify(log.after, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent data-testid="dialog-cancel-booking">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              This action will cancel the booking and notify both users. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bdd-cancel-reason">Cancellation Reason</Label>
              <Textarea
                id="bdd-cancel-reason"
                placeholder="Explain why this booking is being cancelled..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="textarea-cancel-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason("");
                }}
                data-testid="button-cancel-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={!cancelReason.trim() || cancelBookingMutation.isPending}
                data-testid="button-confirm-cancel"
              >
                {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Users Dialog */}
      <Dialog open={showContactDialog} onOpenChange={(open) => {
        setShowContactDialog(open);
        if (!open) {
          setContactMessage("");
          setSelectedRecipients(["renter", "owner"]);
        }
      }}>
        <DialogContent data-testid="dialog-contact-users">
          <DialogHeader>
            <DialogTitle>Contact Users</DialogTitle>
            <DialogDescription>
              Send a message to the users involved in this booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Recipients</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bdd-recipient-renter"
                    checked={selectedRecipients.includes("renter")}
                    onCheckedChange={(checked) => {
                      setSelectedRecipients(prev =>
                        checked ? [...prev, "renter"] : prev.filter(r => r !== "renter")
                      );
                    }}
                  />
                  <Label htmlFor="bdd-recipient-renter" className="text-sm font-normal cursor-pointer">
                    Renter: {booking?.renterName} ({booking?.renterEmail})
                  </Label>
                </div>
                {booking?.ownerEmail && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="bdd-recipient-owner"
                      checked={selectedRecipients.includes("owner")}
                      onCheckedChange={(checked) => {
                        setSelectedRecipients(prev =>
                          checked ? [...prev, "owner"] : prev.filter(r => r !== "owner")
                        );
                      }}
                    />
                    <Label htmlFor="bdd-recipient-owner" className="text-sm font-normal cursor-pointer">
                      Owner/Assigned User: {booking?.ownerName} ({booking?.ownerEmail})
                    </Label>
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="bdd-contact-message">Message</Label>
              <Textarea
                id="bdd-contact-message"
                placeholder="Type your message here..."
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                data-testid="textarea-contact-message"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowContactDialog(false)}
                disabled={isSendingContact}
                data-testid="button-cancel-contact"
              >
                Cancel
              </Button>
              <Button
                onClick={handleContactUser}
                disabled={!contactMessage.trim() || selectedRecipients.length === 0 || isSendingContact}
                data-testid="button-send-message"
              >
                {isSendingContact ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
