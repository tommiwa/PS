import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getConfiguredTimezone, TIMEZONE_REFRESH_MS } from "@/lib/timezone";
import { Button } from "@/components/ui/button";

/** Mounted after authentication, before any date-dependent screen can render. */
export function TimezoneGate({ children }: { children: ReactNode }) {
  const timezone = useQuery({
    queryKey: ["/api/app-configs/timezone"],
    queryFn: () => getConfiguredTimezone(true),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: TIMEZONE_REFRESH_MS,
  });

  if (!timezone.data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        {timezone.isError ? (
          <div className="text-center space-y-3">
            <p>Unable to load the parking timezone. Please try again.</p>
            <Button onClick={() => timezone.refetch()}>Try again</Button>
          </div>
        ) : <p>Loading parking settings...</p>}
      </div>
    );
  }
  // A failed background refresh retains the last verified setting, never LA.
  return <>{children}</>;
}
