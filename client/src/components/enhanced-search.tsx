import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Search, X, Zap, Accessibility, Calendar, Filter, SlidersHorizontal } from "lucide-react"

export interface ParsedSearch {
  query: string
  location?: string
  spotType?: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved" | "all"
  priceMin?: number
  priceMax?: number
  date?: string
  dateRange?: { start: string; end: string }
  isInside?: boolean
  isBciManaged?: boolean
  quickFilters: string[]
}

interface EnhancedSearchProps {
  onSearch: (parsed: ParsedSearch) => void
  className?: string
}

const QUICK_FILTERS = [
  { label: "Today", value: "today", icon: Calendar, type: "date", tooltip: "Filter for parking spots available today" },
  { label: "This Week", value: "this_week", icon: Calendar, type: "date", tooltip: "Filter for parking spots available this week" },
  { label: "Electric", value: "electric", icon: Zap, type: "spotType", tooltip: "Filter for electric vehicle charging stations with standard EV connectors" },
  { label: "Tesla", value: "tesla_ev", icon: Zap, type: "spotType", tooltip: "Filter for Tesla-specific charging stations optimized for Tesla vehicles" },
  { label: "Accessible", value: "accessible", icon: Accessibility, type: "spotType", tooltip: "Filter for accessible parking spots designed for mobility accommodations" }
]

const MOBILE_VISIBLE_FILTERS = 5

export function EnhancedSearch({ onSearch, className }: EnhancedSearchProps) {
  const [query, setQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Parse the search query intelligently
  const parseSearchQuery = (searchQuery: string, filters: string[] = activeFilters): ParsedSearch => {
    const parsed: ParsedSearch = {
      query: searchQuery,
      quickFilters: [...filters]
    }

    const terms = searchQuery.toLowerCase().split(/\s+/)

    // Handle active filters first
    filters.forEach(filterValue => {
      if (filterValue === "today") {
        parsed.date = new Date().toISOString().split('T')[0]
      } else if (filterValue === "this_week") {
        // Calculate end of week (Sunday)
        const today = new Date()
        const endOfWeek = new Date(today)
        const dayOfWeek = today.getDay()
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
        endOfWeek.setDate(today.getDate() + daysUntilSunday)
        parsed.dateRange = {
          start: today.toISOString().split('T')[0],
          end: endOfWeek.toISOString().split('T')[0]
        }
      } else if (filterValue === "electric") {
        parsed.spotType = "electric"
      } else if (filterValue === "tesla_ev") {
        parsed.spotType = "tesla_ev"
      } else if (filterValue === "accessible") {
        parsed.spotType = "accessible"
      } else if (filterValue === "750 pandora ave") {
        parsed.location = "750 pandora ave"
      }
    })

    // Location parsing from query text
    if (terms.some(t => ["main", "building"].every(w => searchQuery.toLowerCase().includes(w)))) {
      parsed.location = "750 pandora ave"
    } else if (terms.includes("north")) {
      parsed.location = "north lot"
    } else if (terms.includes("south")) {
      parsed.location = "south lot"
    } else if (terms.includes("west")) {
      parsed.location = "west garage"
    }

    // Spot type parsing from query text
    if (terms.includes("tesla") && (terms.includes("ev") || terms.includes("electric") || terms.includes("charging"))) {
      parsed.spotType = "tesla_ev"
    } else if (terms.includes("electric") || terms.includes("ev") || terms.includes("charging")) {
      parsed.spotType = "electric"
    } else if (terms.includes("accessible") || terms.includes("handicap") || terms.includes("disabled")) {
      parsed.spotType = "accessible"
    } else if (terms.includes("reserved") || terms.includes("executive")) {
      parsed.spotType = "reserved"
    } else if (terms.includes("regular") || terms.includes("normal")) {
      parsed.spotType = "regular"
    }

    // Location type parsing (inside/outside) from query text
    if (terms.includes("inside") || terms.includes("indoor") || terms.includes("covered")) {
      parsed.isInside = true
    } else if (terms.includes("outside") || terms.includes("outdoor") || terms.includes("open")) {
      parsed.isInside = false
    }

    // Price parsing from query text
    // Range match: "$10-20", "$10 to $20", "10-20"
    const rangeMatch = searchQuery.match(/\$?(\d+)\s*(?:to|-)\s*\$?(\d+)/)
    if (rangeMatch) {
      parsed.priceMin = parseInt(rangeMatch[1])
      parsed.priceMax = parseInt(rangeMatch[2])
    } else if (searchQuery.includes("under") || searchQuery.includes("less than") || searchQuery.includes("below")) {
      const underMatch = searchQuery.match(/(?:under|less than|below)\s*\$?(\d+)/)
      if (underMatch) {
        parsed.priceMax = parseInt(underMatch[1])
      }
    } else if (searchQuery.includes("over") || searchQuery.includes("more than") || searchQuery.includes("above")) {
      const overMatch = searchQuery.match(/(?:over|more than|above)\s*\$?(\d+)/)
      if (overMatch) {
        parsed.priceMin = parseInt(overMatch[1])
      }
    } else if (terms.includes("cheap") || terms.includes("affordable")) {
      parsed.priceMax = 25
    } else if (terms.includes("expensive") || terms.includes("premium")) {
      parsed.priceMin = 30
    }

    // Date parsing from query text
    if (terms.includes("today")) {
      parsed.date = new Date().toISOString().split('T')[0]
    } else if (terms.includes("tomorrow")) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      parsed.date = tomorrow.toISOString().split('T')[0]
    }

    return parsed
  }

  // Auto-search as user types (debounced 300ms)
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new timer to search after 300ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      const parsed = parseSearchQuery(query, activeFilters)
      onSearch(parsed)
    }, 300)
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, activeFilters])

  const handleSearch = () => {
    const parsed = parseSearchQuery(query)
    onSearch(parsed)
  }

  const handleQuickFilter = (filter: typeof QUICK_FILTERS[0]) => {
    let newQuery = query

    // Add or remove filter
    const filterExists = activeFilters.includes(filter.value)
    let newActiveFilters = [...activeFilters]

    if (filterExists) {
      newActiveFilters = newActiveFilters.filter(f => f !== filter.value)
      // Remove from query if it exists
      newQuery = newQuery.replace(new RegExp(`\\b${filter.value}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim()
    } else {
      newActiveFilters.push(filter.value)
      // Only add to query text if it's not a date filter
      if (filter.type !== "date" && !newQuery.toLowerCase().includes(filter.value.toLowerCase())) {
        newQuery = newQuery ? `${newQuery} ${filter.value}` : filter.value
      }
    }

    setActiveFilters(newActiveFilters)
    setQuery(newQuery)
    
    const parsed = parseSearchQuery(newQuery, newActiveFilters)
    onSearch(parsed)
  }

  const clearSearch = () => {
    setQuery("")
    setActiveFilters([])
    onSearch({ query: "", quickFilters: [] })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const getFilterColors = (filterValue: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-primary text-primary-foreground border-primary'
    }
    
    // Light, distinct colors for each filter
    const colorMap: Record<string, string> = {
      'today': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      'this_week': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
      'inside': 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
      'bci_managed': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
      'budget': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
      'electric': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
      'tesla_ev': 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
      'accessible': 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    }
    
    return colorMap[filterValue] || 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
  }

  const renderFilterButton = (filter: typeof QUICK_FILTERS[0]) => {
    const Icon = filter.icon
    const isActive = activeFilters.includes(filter.value)
    return (
      <Tooltip key={filter.value}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={() => handleQuickFilter(filter)}
            aria-pressed={isActive}
            role="button"
            data-testid={`filter-${filter.value}`}
          >
            <Badge
              variant="outline"
              className={`gap-1 min-h-11 md:min-h-8 px-3 ${getFilterColors(filter.value, isActive)}`}
            >
              <Icon className="h-3 w-3" />
              {filter.label}
              {isActive && <X className="h-3 w-3" />}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isActive ? `Remove filter` : filter.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const visibleFilters = QUICK_FILTERS.slice(0, MOBILE_VISIBLE_FILTERS)
  const hiddenFilters = QUICK_FILTERS.slice(MOBILE_VISIBLE_FILTERS)
  const hasActiveHiddenFilters = hiddenFilters.some(f => activeFilters.includes(f.value))

  return (
    <div className={`space-y-3 md:space-y-4 ${className}`} data-testid="enhanced-search">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-muted-foreground shrink-0"
              data-testid="text-quick-filters-label"
            >
              <Filter className="h-3 w-3 mr-1" />
              Quick filters:
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click buttons for quick filters</p>
          </TooltipContent>
        </Tooltip>
        
        {/* Mobile: Show first 4 filters + More Filters button */}
        <div className="flex flex-wrap gap-2 md:hidden">
          {visibleFilters.map(renderFilterButton)}
          
          <Sheet open={showMoreFilters} onOpenChange={setShowMoreFilters}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 hover:bg-transparent"
                data-testid="button-more-filters"
              >
                <Badge 
                  variant={hasActiveHiddenFilters ? "default" : "outline"}
                  className={`gap-1 min-h-11 md:min-h-8 px-3 ${hasActiveHiddenFilters ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  More Filters
                  {hasActiveHiddenFilters && <span className="ml-1 bg-primary-foreground text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {hiddenFilters.filter(f => activeFilters.includes(f.value)).length}
                  </span>}
                </Badge>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Additional Filters</SheetTitle>
                <SheetDescription>
                  Select additional filters to refine your search
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 mt-4 pb-4">
                {hiddenFilters.map(renderFilterButton)}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: Show all filters */}
        <div className="hidden md:flex md:flex-wrap md:gap-2">
          {QUICK_FILTERS.map(renderFilterButton)}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search by owner name, price, type, label (e.g., 'charity', 'top deal', 'free', 'monday')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`pl-10 min-h-[44px] md:h-12 text-base ${query ? 'pr-10' : 'pr-4'}`}
            data-testid="input-enhanced-search"
            title="Search using natural language"
          />
          {query && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearSearch()
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
              data-testid="button-clear-search"
              title="Clear search and filters"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Mobile: Icon-only button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSearch}
              className="md:hidden min-h-[44px] min-w-[44px] p-0"
              size="icon"
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Search with current criteria</p>
          </TooltipContent>
        </Tooltip>

        {/* Desktop: Full button with text */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSearch}
              className="hidden md:flex h-12 px-6"
              data-testid="button-search-desktop"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Search with current criteria</p>
          </TooltipContent>
        </Tooltip>
      </div>

    </div>
  )
}
