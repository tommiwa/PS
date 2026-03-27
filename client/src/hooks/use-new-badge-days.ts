import { useQuery } from "@tanstack/react-query";

export function useNewBadgeDays(): number {
  const { data } = useQuery<{ key: string; value: string }>({
    queryKey: ["/api/app-configs/new_badge_days"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const parsed = data?.value ? parseInt(data.value, 10) : NaN;
  return isNaN(parsed) || parsed <= 0 ? 30 : parsed;
}
