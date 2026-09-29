import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, ChevronsUpDown, CalendarIcon } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";

/**
 * Admin "create booking on behalf of a renter" dialog.
 *
 * Kept as its own lightweight, independently-loaded component (no chart/export deps) so it can
 * be opened directly from the admin dashboard's quick actions without pulling in the heavier
 * Spot Booking Management page. Used both there and as a header action on that page.
 *
 * Restricted server-side (and here, for the picker) to BCI-managed (shared pool) spots only —
 * an admin must never create a booking on an individually-owned peer-to-peer spot.
 */

interface SearchedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  departmentId: number | null;
}

interface AdminSpotOption {
  id: string;
  spotNumber: string;
  ownerId: string | null;
  isBciManaged: boolean;
  isBookable: boolean;
  locationName?: string;
}

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

function renterLabel(user: SearchedUser): string {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name ? `${name} (${user.email || 'no email'})` : (user.email || user.id);
}

export function CreateBookingDialog({ open, onOpenChange, onCreated }: CreateBookingDialogProps) {
  const { toast } = useToast();

  const [renterQuery, setRenterQuery] = useState("");
  const [debouncedRenterQuery, setDebouncedRenterQuery] = useState("");
  const [renterPickerOpen, setRenterPickerOpen] = useState(false);
  const [selectedRenter, setSelectedRenter] = useState<SearchedUser | null>(null);

  const [spotPickerOpen, setSpotPickerOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<AdminSpotOption | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState<Date>(new Date());

  const [dailyRate, setDailyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form state whenever the dialog is closed so re-opening starts fresh.
  useEffect(() => {
    if (!open) {
      setRenterQuery("");
      setDebouncedRenterQuery("");
      setSelectedRenter(null);
      setSelectedSpot(null);
      setBookingDate(new Date());
      setDailyRate("");
      setNotes("");
      setFormError(null);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRenterQuery(renterQuery), 300);
    return () => clearTimeout(timer);
  }, [renterQuery]);

  const { data: searchedRenters = [], isFetching: isSearchingRenters } = useQuery<SearchedUser[]>({
    queryKey: [`/api/admin/search-users?query=${encodeURIComponent(debouncedRenterQuery)}`],
    enabled: open && debouncedRenterQuery.trim().length >= 3,
  });

  // All spots, filtered client-side down to BCI-managed (shared pool) spots only — this dialog
  // must never offer an individually-owned peer-to-peer spot.
  const { data: allSpots = [], isFetching: isLoadingSpots } = useQuery<AdminSpotOption[]>({
    queryKey: ["/api/admin/all-spots"],
    enabled: open,
  });

  const bciSpots = allSpots.filter(spot => !spot.ownerId && spot.isBciManaged);

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRenter) throw new Error("Select a renter");
      if (!selectedSpot) throw new Error("Select a spot");

      const body: Record<string, unknown> = {
        renterId: selectedRenter.id,
        spotId: selectedSpot.id,
        bookingDate: format(bookingDate, "yyyy-MM-dd"),
      };
      if (dailyRate.trim()) body.dailyRate = dailyRate.trim();
      if (notes.trim()) body.notes = notes.trim();

      const res = await apiRequest("/api/admin/bookings", { method: "POST", body });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking created",
        description: `Booking created for ${selectedRenter ? renterLabel(selectedRenter) : "renter"} on spot ${selectedSpot?.spotNumber} (${format(bookingDate, "PPP")}).`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/past-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-activity"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error: any) => {
      setFormError(error?.message || "Failed to create booking.");
    },
  });

  const canSubmit = !!selectedRenter && !!selectedSpot && !!bookingDate && !createBookingMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-create-booking">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
          <DialogDescription>
            Record a booking on behalf of a renter. Only available for BCI-managed (shared pool) spots.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2" data-testid="text-create-booking-error">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Renter</Label>
            <Popover open={renterPickerOpen} onOpenChange={setRenterPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={renterPickerOpen}
                  className="w-full justify-between font-normal"
                  data-testid="button-select-renter"
                >
                  {selectedRenter ? renterLabel(selectedRenter) : "Search renter by name or email..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type at least 3 characters..."
                    value={renterQuery}
                    onValueChange={setRenterQuery}
                    data-testid="input-renter-search"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {debouncedRenterQuery.trim().length < 3
                        ? "Type at least 3 characters to search."
                        : isSearchingRenters ? "Searching..." : "No matching renters found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {searchedRenters.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.firstName || ''} ${user.lastName || ''} ${user.email || ''}`}
                          onSelect={() => {
                            setSelectedRenter(user);
                            setRenterPickerOpen(false);
                          }}
                          data-testid={`option-renter-${user.id}`}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedRenter?.id === user.id ? "opacity-100" : "opacity-0"}`} />
                          <div className="flex flex-col">
                            <span className="font-medium">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Spot (BCI-managed / shared pool only)</Label>
            <Popover open={spotPickerOpen} onOpenChange={setSpotPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={spotPickerOpen}
                  className="w-full justify-between font-normal"
                  data-testid="button-select-spot"
                >
                  {selectedSpot ? `${selectedSpot.spotNumber}${selectedSpot.locationName ? ` — ${selectedSpot.locationName}` : ''}` : (isLoadingSpots ? "Loading spots..." : "Select a shared-pool spot...")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search spot number or location..." data-testid="input-spot-search" />
                  <CommandList>
                    <CommandEmpty>No BCI-managed spots found.</CommandEmpty>
                    <CommandGroup>
                      {bciSpots.map((spot) => (
                        <CommandItem
                          key={spot.id}
                          value={`${spot.spotNumber} ${spot.locationName || ''}`}
                          onSelect={() => {
                            setSelectedSpot(spot);
                            setSpotPickerOpen(false);
                          }}
                          data-testid={`option-spot-${spot.id}`}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedSpot?.id === spot.id ? "opacity-100" : "opacity-0"}`} />
                          <div className="flex flex-col">
                            <span className="font-medium">{spot.spotNumber}</span>
                            {spot.locationName && <span className="text-xs text-muted-foreground">{spot.locationName}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Booking date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-booking-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(bookingDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {/* Past dates are explicitly allowed here — unlike the renter-facing flow, this
                    admin-only action must support backdating a booking that already happened. */}
                <Calendar
                  mode="single"
                  selected={bookingDate}
                  defaultMonth={bookingDate}
                  onSelect={(date) => {
                    if (date) setBookingDate(date);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-booking-daily-rate">Daily rate override (optional)</Label>
            <Input
              id="create-booking-daily-rate"
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave blank to use the existing listing's rate"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              data-testid="input-daily-rate"
            />
            <p className="text-xs text-muted-foreground">
              Only used if there's no active listing for this spot on the selected date.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-booking-notes">Notes (optional)</Label>
            <Textarea
              id="create-booking-notes"
              placeholder="e.g. Renter couldn't complete the booking due to a login issue."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-booking-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-booking">
            Cancel
          </Button>
          <Button
            onClick={() => {
              setFormError(null);
              createBookingMutation.mutate();
            }}
            disabled={!canSubmit}
            data-testid="button-submit-create-booking"
          >
            {createBookingMutation.isPending ? "Creating..." : "Create Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
