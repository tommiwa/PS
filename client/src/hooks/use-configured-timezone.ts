import { useSyncExternalStore } from "react";
import { getConfiguredTimezoneSync, subscribeToTimezone } from "@/lib/timezone";

/** Subscribe date-dependent calculations to the same source used by helpers. */
export function useConfiguredTimezone(): string {
  return useSyncExternalStore(subscribeToTimezone, getConfiguredTimezoneSync);
}
