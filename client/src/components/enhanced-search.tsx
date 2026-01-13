import { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Search, X, MapPin, Car, Zap, Accessibility, Calendar, Clock, Filter, SlidersHorizontal } from "lucide-react"

export interface ParsedSearch {
  query: string
  location?: string
  spotType?: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved" | "all"
  priceMin?: number
  priceMax?: number
  date?: string
  isInside?: boolean
  isBciManaged?: boolean
  quickFilters: string[]
}

interface EnhancedSearchProps {
  onSearch: (parsed: ParsedSearch) => void
  className?: string
}

const SEARCH_SUGGESTIONS = [
  "spots under $16",
  "electric charging",
  "tesla charger",
  "accessible spots",
  "indoor parking",
  "level 1",
  "level 2",
  "Victoria office",
  "regular spots"
]

const QUICK_FILTERS = [
  { label: "Today", value: "today", icon: Calendar, type: "date", tooltip: "Filter for parking spots available today" },
  { label: "Electric Charging", value: "electric", icon: Zap, type: "spotType", tooltip: "Filter for electric vehicle charging stations with standard EV connectors" },
  { label: "Tesla Charger", value: "tesla_ev", icon: Zap, type: "spotType", tooltip: "Filter for Tesla-specific charging stations optimized for Tesla vehicles" },
  { label: "Accessible", value: "accessible", icon: Accessibility, type: "spotType", tooltip: "Filter for accessible parking spots designed for mobility accommodations" }
]

const MOBILE_VISIBLE_FILTERS = 4

export function EnhancedSearch({ onSearch, className }: EnhancedSearchProps) {
  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    const priceMatch = searchQuery.match(/\$?(\d+)[\s-]*(?:to|-)?\s*\$?(\d+)?/)
    if (priceMatch) {
      parsed.priceMin = parseInt(priceMatch[1])
      if (priceMatch[2]) {
        parsed.priceMax = parseInt(priceMatch[2])
      }
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

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return SEARCH_SUGGESTIONS.slice(0, 6)
    
    const queryLower = query.toLowerCase()
    return SEARCH_SUGGESTIONS.filter(suggestion =>
      suggestion.toLowerCase().includes(queryLower) ||
      queryLower.split(' ').some(term => suggestion.toLowerCase().includes(term))
    ).slice(0, 6)
  }, [query])

  const handleSearch = () => {
    const parsed = parseSearchQuery(query)
    onSearch(parsed)
    setShowSuggestions(false)
  }

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    const parsed = parseSearchQuery(suggestion)
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
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  useEffect(() => {
    if (focused && query.length > 0) {
      setShowSuggestions(true)
    }
  }, [focused, query])

  const getFilterColors = (filterValue: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-primary text-primary-foreground border-primary'
    }
    
    // Light, distinct colors for each filter
    const colorMap: Record<string, string> = {
      'today': 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
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
                  variant={hasActiveHiddenFilters ? "default" : "secondary"}
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
      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <PopoverTrigger asChild>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Search parking spots... (e.g., 'Victoria electric $20-30')"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    className={`pl-10 min-h-[44px] md:h-12 text-base ${query ? 'pr-12' : 'pr-4'}`}
                    data-testid="input-enhanced-search"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search using natural language</p>
                </TooltipContent>
              </Tooltip>
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  data-testid="button-clear-search"
                  title="Clear search and filters"
                >
                  <X className="h-4 w-4" />
                </Button>
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
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
        >
          <Command>
            <CommandList>
              {filteredSuggestions.length > 0 ? (
                <CommandGroup heading="Suggestions">
                  {filteredSuggestions.map((suggestion, index) => (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <CommandItem
                          onSelect={() => handleSuggestionSelect(suggestion)}
                          className="cursor-pointer"
                          data-testid={`suggestion-${index}`}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {suggestion}
                        </CommandItem>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to search for "{suggestion}"</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty>No suggestions found.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Search Examples - Hidden on mobile, shown on desktop */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:block h-auto p-0 text-sm text-muted-foreground hover:bg-transparent hover:text-muted-foreground text-left justify-start"
            data-testid="text-search-examples"
          >
            <span className="font-medium">Try searching:</span> "tesla charger", "accessible under $16", "level 1 inside", or "electric charging"
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Example search phrases</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
