import { useMemo } from "react";

export interface ClientSortState {
  column: string | null;
  direction: "asc" | "desc" | null;
}

/**
 * Generic hook for client-side filtering, sorting, and pagination of a raw array.
 * All filtering and sorting is memoized so re-renders from unrelated state are cheap.
 *
 * @param rawData     Full unfiltered dataset loaded from the server
 * @param filterFn    Pure predicate — return true if the item should be included
 * @param sortFn      Comparator for two items given the current sort state
 * @param sortState   Current sort column + direction
 * @param pageIndex   0-based current page
 * @param pageSize    Rows per page
 */
export function useClientTableData<T>(
  rawData: T[],
  filterFn: (item: T) => boolean,
  sortFn: (a: T, b: T, sortState: ClientSortState) => number,
  sortState: ClientSortState,
  pageIndex: number,
  pageSize: number
): { page: T[]; total: number } {
  const filtered = useMemo(() => rawData.filter(filterFn), [rawData, filterFn]);

  const sorted = useMemo(() => {
    if (!sortState.column || !sortState.direction) return filtered;
    return [...filtered].sort((a, b) => sortFn(a, b, sortState));
  }, [filtered, sortFn, sortState]);

  const page = useMemo(() => {
    const start = pageIndex * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageIndex, pageSize]);

  return { page, total: sorted.length };
}

// ── Helpers shared by callers ──────────────────────────────────────────────

/** Case-insensitive substring check */
export function includesSearch(value: string | null | undefined, search: string): boolean {
  if (!search) return true;
  return (value ?? "").toLowerCase().includes(search.toLowerCase());
}

/** Compare two string-or-number values for sort; respects direction. */
export function compareValues(
  aVal: string | number | null | undefined,
  bVal: string | number | null | undefined,
  direction: "asc" | "desc"
): number {
  const a = aVal ?? "";
  const b = bVal ?? "";
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }
  return direction === "asc" ? cmp : -cmp;
}
