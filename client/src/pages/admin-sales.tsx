import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tag, Plus, Power, PowerOff, Trash2, Calendar, Percent, DollarSign, AlertTriangle, CheckCircle2, Info, Pencil } from "lucide-react";
import { format } from "date-fns";

type SaleEventStatus = "active" | "inactive";
type DiscountType = "percentage" | "fixed_price";

interface SaleEvent {
  id: string;
  name: string;
  calendarLabel: string;
  startDate: string;
  endDate: string;
  discountType: DiscountType;
  discountValue: string;
  status: SaleEventStatus;
  affectedListingCount: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PreviewResult {
  count: number;
  listingIds: string[];
}

const createSaleEventSchema = z.object({
  name: z.string().min(1, "Event name is required").max(100, "Name too long"),
  calendarLabel: z.string().min(1, "Calendar label is required").max(30, "Label must be 30 characters or less"),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
  discountType: z.enum(["percentage", "fixed_price"]),
  discountValue: z.coerce.number().positive("Must be a positive number"),
}).refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
}).refine((d) => {
  if (d.discountType === "percentage" && d.discountValue > 100) return false;
  return true;
}, { message: "Percentage cannot exceed 100%", path: ["discountValue"] });

type CreateSaleEventForm = z.infer<typeof createSaleEventSchema>;

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function SaleEventStatusBadge({ status }: { status: SaleEventStatus }) {
  if (status === "active") {
    return (
      <Badge className="gap-1 bg-emerald-500 text-white border-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      Inactive
    </Badge>
  );
}

function DiscountDisplay({ type, value }: { type: DiscountType; value: string }) {
  const num = parseFloat(value);
  if (type === "percentage") {
    return <span>{num.toFixed(0)}% off</span>;
  }
  return <span>${num.toFixed(2)} flat rate</span>;
}

export default function AdminSalesPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<SaleEvent | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: saleEvents = [], isLoading } = useQuery<SaleEvent[]>({
    queryKey: ["/api/admin/sale-events"],
  });

  const form = useForm<CreateSaleEventForm>({
    resolver: zodResolver(createSaleEventSchema),
    defaultValues: {
      name: "",
      calendarLabel: "",
      startDate: "",
      endDate: "",
      discountType: "percentage",
      discountValue: 10,
    },
  });

  const editForm = useForm<CreateSaleEventForm>({
    resolver: zodResolver(createSaleEventSchema),
    defaultValues: {
      name: "",
      calendarLabel: "",
      startDate: "",
      endDate: "",
      discountType: "percentage",
      discountValue: 10,
    },
  });

  const openEditDialog = (event: SaleEvent) => {
    setEditEvent(event);
    editForm.reset({
      name: event.name,
      calendarLabel: event.calendarLabel,
      startDate: event.startDate,
      endDate: event.endDate,
      discountType: event.discountType as DiscountType,
      discountValue: parseFloat(event.discountValue),
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: CreateSaleEventForm) => {
      const res = await apiRequest("/api/admin/sale-events", { method: "POST", body: data });
      return res.json() as Promise<SaleEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sale-events"] });
      setCreateDialogOpen(false);
      setPreviewResult(null);
      form.reset();
      toast({ title: "Sale event created", description: "The sale event has been saved. Activate it when ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create sale event", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateSaleEventForm }) => {
      const res = await apiRequest(`/api/admin/sale-events/${id}`, { method: "PUT", body: data });
      return res.json() as Promise<SaleEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sale-events"] });
      setEditEvent(null);
      toast({ title: "Sale event updated", description: "Changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update sale event", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/admin/sale-events/${id}/activate`, { method: "POST" });
      return res.json() as Promise<{ updatedCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sale-events"] });
      toast({
        title: "Sale activated",
        description: `${data.updatedCount} WPS listing(s) have been repriced. Spot alert emails are being sent to eligible subscribers.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to activate sale", description: error.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/admin/sale-events/${id}/deactivate`, { method: "POST" });
      return res.json() as Promise<{ restoredCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sale-events"] });
      toast({
        title: "Sale deactivated",
        description: `Original prices restored for ${data.restoredCount} listing(s).`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to deactivate sale", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/admin/sale-events/${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sale-events"] });
      setDeleteConfirmId(null);
      toast({ title: "Sale event deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete sale event", description: error.message, variant: "destructive" });
    },
  });

  const handlePreview = async () => {
    const startDate = form.getValues("startDate");
    const endDate = form.getValues("endDate");
    if (!startDate || !endDate) {
      toast({ title: "Enter date range first", description: "Please fill in start and end dates before previewing.", variant: "destructive" });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast({ title: "Invalid date range", description: "End date must be on or after start date.", variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await apiRequest(`/api/admin/sale-events/preview?startDate=${startDate}&endDate=${endDate}`);
      const result = await res.json() as PreviewResult;
      setPreviewResult(result);
    } catch (err: Error | unknown) {
      toast({ title: "Preview failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const activeSales = saleEvents.filter((e) => e.status === "active");
  const inactiveSales = saleEvents.filter((e) => e.status === "inactive");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" />
            Sales &amp; Promotions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create time-limited discount sale events that apply to WPS-managed spot listings.
          </p>
        </div>
        <Button onClick={() => { setCreateDialogOpen(true); setPreviewResult(null); form.reset(); }}>
          <Plus className="h-4 w-4 mr-1" />
          New Sale Event
        </Button>
      </div>

      <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p className="font-medium">How sale events work</p>
          <ul className="list-disc ml-4 space-y-0.5 text-blue-700 dark:text-blue-300">
            <li>Sales only affect WPS / BCI-managed listings (<strong>isBciManaged = true</strong>)</li>
            <li>Owner-listed spots are never touched</li>
            <li>Activating a sale reprices matching available listings and notifies eligible spot-alert subscribers</li>
            <li>Deactivating restores the original price — no alert emails are sent on deactivation</li>
            <li>A listing can only belong to one sale at a time</li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading sale events...</div>
      ) : saleEvents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No sale events yet</p>
            <p className="text-sm mt-1">Create your first sale event to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeSales.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Active Sales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeSales.map((event) => (
                  <SaleEventCard
                    key={event.id}
                    event={event}
                    onActivate={() => activateMutation.mutate(event.id)}
                    onDeactivate={() => deactivateMutation.mutate(event.id)}
                    onEdit={() => openEditDialog(event)}
                    onDelete={() => setDeleteConfirmId(event.id)}
                    isActivating={activateMutation.isPending}
                    isDeactivating={deactivateMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
          {inactiveSales.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Inactive / Past Sales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {inactiveSales.map((event) => (
                  <SaleEventCard
                    key={event.id}
                    event={event}
                    onActivate={() => activateMutation.mutate(event.id)}
                    onDeactivate={() => deactivateMutation.mutate(event.id)}
                    onEdit={() => openEditDialog(event)}
                    onDelete={() => setDeleteConfirmId(event.id)}
                    isActivating={activateMutation.isPending}
                    isDeactivating={deactivateMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) setPreviewResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Create Sale Event
            </DialogTitle>
            <DialogDescription>
              Define the discount sale parameters. The sale will be saved as inactive until you activate it.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Easter Week Sale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="calendarLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calendar Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Easter Deal (max 30 chars)" maxLength={30} {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Short label shown on spot cards and calendar tiles during the sale.</p>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} onChange={(e) => { field.onChange(e); setPreviewResult(null); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} onChange={(e) => { field.onChange(e); setPreviewResult(null); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage off (e.g., 20% off current rate)</SelectItem>
                        <SelectItem value="fixed_price">Fixed sale price (e.g., $8.00 flat)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("discountType") === "percentage" ? "Percentage Off (%)" : "Fixed Sale Price ($)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={form.watch("discountType") === "percentage" ? "100" : undefined}
                        placeholder={form.watch("discountType") === "percentage" ? "e.g., 20" : "e.g., 8.00"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview Section */}
              <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
                  {previewLoading ? "Checking..." : "Preview Affected Listings"}
                </Button>
                {previewResult !== null && (
                  <div className={`rounded-md p-3 text-sm flex items-center gap-2 ${previewResult.count > 0 ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"}`}>
                    {previewResult.count > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    {previewResult.count > 0
                      ? `${previewResult.count} WPS listing(s) will be repriced when activated.`
                      : "No WPS listings found overlapping this date range."}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Sale Event"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) setEditEvent(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Sale Event
            </DialogTitle>
            <DialogDescription>
              Update the sale event details. You can only edit inactive events.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editEvent && updateMutation.mutate({ id: editEvent.id, data }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Easter Week Sale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="calendarLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calendar Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Easter Deal (max 30 chars)" maxLength={30} {...field} />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Short label shown on spot cards and calendar tiles during the sale.</p>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage off (e.g., 20% off current rate)</SelectItem>
                        <SelectItem value="fixed_price">Fixed sale price (e.g., $8.00 flat)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {editForm.watch("discountType") === "percentage" ? "Percentage Off (%)" : "Fixed Sale Price ($)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={editForm.watch("discountType") === "percentage" ? "100" : undefined}
                        placeholder={editForm.watch("discountType") === "percentage" ? "e.g., 20" : "e.g., 8.00"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditEvent(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Sale Event
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the sale event. If it is currently active, all repriced listings will have their original rates restored first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SaleEventCardProps {
  event: SaleEvent;
  onActivate: () => void;
  onDeactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isDeactivating: boolean;
}

function SaleEventCard({ event, onActivate, onDeactivate, onEdit, onDelete, isActivating, isDeactivating }: SaleEventCardProps) {
  const isActive = event.status === "active";

  return (
    <Card className={isActive ? "border-emerald-300 dark:border-emerald-700" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold">{event.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Calendar label: <span className="font-medium text-foreground">{event.calendarLabel}</span>
            </CardDescription>
          </div>
          <SaleEventStatusBadge status={event.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {event.discountType === "percentage" ? <Percent className="h-3.5 w-3.5" /> : <DollarSign className="h-3.5 w-3.5" />}
            <DiscountDisplay type={event.discountType} value={event.discountValue} />
          </div>
        </div>
        {event.affectedListingCount !== null && event.affectedListingCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {isActive ? `${event.affectedListingCount} listing(s) currently repriced` : `Last affected ${event.affectedListingCount} listing(s)`}
          </p>
        )}
        <Separator />
        <div className="flex items-center gap-2 flex-wrap">
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onDeactivate}
              disabled={isDeactivating}
              className="gap-1"
            >
              <PowerOff className="h-3.5 w-3.5" />
              Deactivate
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={onActivate}
                disabled={isActivating}
                className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Power className="h-3.5 w-3.5" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                className="gap-1"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="gap-1 text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
