import { useState, useMemo } from "react"

export type SortDirection = "asc" | "desc" | null

interface SortState {
  column: string | null
  direction: SortDirection
}

interface UseSortReturn<T> {
  sortState: SortState
  sortedData: T[]
  handleSort: (column: string) => void
  clearSort: () => void
}

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  initialSortColumn?: string,
  initialSortDirection?: SortDirection
): UseSortReturn<T> {
  const [sortState, setSortState] = useState<SortState>({
    column: initialSortColumn || null,
    direction: initialSortDirection || null
  })

  const handleSort = (column: string) => {
    setSortState(prevState => {
      if (prevState.column === column) {
        // Cycle through: asc -> desc -> null
        if (prevState.direction === "asc") {
          return { column, direction: "desc" }
        } else if (prevState.direction === "desc") {
          return { column: null, direction: null }
        } else {
          return { column, direction: "asc" }
        }
      } else {
        // New column, start with asc
        return { column, direction: "asc" }
      }
    })
  }

  const clearSort = () => {
    setSortState({ column: null, direction: null })
  }

  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortState.column!)
      const bValue = getNestedValue(b, sortState.column!)

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortState.direction === "asc" ? 1 : -1
      if (bValue == null) return sortState.direction === "asc" ? -1 : 1

      // Convert to comparable values
      const aCompare = getComparableValue(aValue)
      const bCompare = getComparableValue(bValue)

      let result = 0
      if (aCompare < bCompare) result = -1
      else if (aCompare > bCompare) result = 1

      return sortState.direction === "asc" ? result : -result
    })
  }, [data, sortState.column, sortState.direction])

  return {
    sortState,
    sortedData,
    handleSort,
    clearSort
  }
}

// Helper function to get nested property values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Helper function to convert values to comparable format
function getComparableValue(value: any): any {
  if (typeof value === "string") {
    // Handle dates in string format
    const dateValue = Date.parse(value)
    if (!isNaN(dateValue)) {
      return dateValue
    }
    return value.toLowerCase()
  }
  
  if (value instanceof Date) {
    return value.getTime()
  }
  
  if (typeof value === "number") {
    return value
  }
  
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  
  return String(value).toLowerCase()
}