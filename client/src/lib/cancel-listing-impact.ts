/**
 * Gating rules for the admin "cancel listing / remove day" confirm dialog.
 *
 * The dialog warns which renters lose a booking before the admin confirms. That
 * warning is only worth anything if the admin cannot confirm around it — while
 * it is still loading, after it failed, or while it still describes the previous
 * day/range because the admin just widened the removal. These predicates decide
 * when the answer on screen actually describes what the confirm button will do.
 */

/** The day/range the confirm button would submit right now. */
export interface CancelImpactSelection {
  listingId?: string;
  /** null when the whole listing is being cancelled rather than specific days. */
  startDate: string | null;
  endDate: string | null;
}

/** What the server echoed back with its answer. */
export interface CancelImpactResult {
  listingId: string;
  startDate: string | null;
  endDate: string | null;
}

export interface CancelImpactQueryState {
  data?: CancelImpactResult | null;
  isFetching: boolean;
  isError: boolean;
}

const sameDate = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? null) === (b ?? null);

/**
 * True only when the loaded impact answer describes exactly the listing and
 * day/range currently selected, and nothing is in flight or failed.
 *
 * The server echoes the listing and range it answered for, so this compares the
 * answer against the selection instead of trusting that a fetch settled — which
 * is what makes a stale answer for the previous range detectable.
 */
export function isCancelImpactCurrent(
  selection: CancelImpactSelection,
  state: CancelImpactQueryState,
): boolean {
  if (state.isError || state.isFetching) return false;
  if (!selection.listingId) return false;

  const data = state.data;
  if (!data) return false;

  return (
    data.listingId === selection.listingId &&
    sameDate(data.startDate, selection.startDate) &&
    sameDate(data.endDate, selection.endDate)
  );
}

/**
 * Whether the destructive confirm button may fire. A reason is mandatory, no
 * submit may already be running, and the renter impact must be known and
 * current — an admin must never be able to cancel a renter's booking without
 * the dialog having told them about it first.
 */
export function canConfirmCancelListing(input: {
  hasReason: boolean;
  isSubmitting: boolean;
  impactIsCurrent: boolean;
}): boolean {
  return input.hasReason && !input.isSubmitting && input.impactIsCurrent;
}
