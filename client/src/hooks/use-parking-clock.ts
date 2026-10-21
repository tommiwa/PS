import { useSyncExternalStore } from "react";
import { liveClock } from "@/lib/live-clock";
import { getTodayInTimezoneSync } from "@/lib/timezone";
import { useConfiguredTimezone } from "./use-configured-timezone";

export function useCurrentTime(): number {
  return useSyncExternalStore(liveClock.subscribe, liveClock.getSnapshot);
}

/** Only rerender date-based consumers when the parking calendar day changes. */
export function useParkingDay(): string {
  useConfiguredTimezone();
  return useSyncExternalStore(liveClock.subscribe, getTodayInTimezoneSync);
}
