import { useEffect, useMemo, useState } from "react"
import { createSearchDebouncer, initialSearchInput, parseSearchInput, type SearchInput } from "@/lib/parking-search"
import { useConfiguredTimezone } from "./use-configured-timezone"
import { useParkingDay } from "./use-parking-clock"

// One owner for the visible input and the applied search. Only typing is delayed;
// quick filters, explicit Search, and either Clear control cancel pending typing.
export function useParkingSearch(mobile: boolean, weekStartDay: string) {
  const timezone = useConfiguredTimezone()
  const parkingDay = useParkingDay()
  const [input, setInput] = useState(() => initialSearchInput(
    typeof window === "undefined" ? undefined : window.innerWidth,
  ))
  const [applied, setApplied] = useState({ input, mobile })
  const [debouncer] = useState(() => createSearchDebouncer(setApplied))
  useEffect(() => () => debouncer.cancel(), [debouncer])
  const criteria = useMemo(
    () => parseSearchInput(applied.input, applied.mobile, weekStartDay),
    [applied, weekStartDay, timezone, parkingDay],
  )
  const update = (next: SearchInput, debounce = false) => {
    setInput(next)
    debouncer.update({ input: next, mobile }, debounce)
  }
  return { input, criteria, update, clear: () => update({ query: "", quickFilters: [] }) }
}
