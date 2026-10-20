import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Search, X, Zap, Accessibility, Calendar, Filter, SlidersHorizontal } from "lucide-react"
import { effectiveDateFilter, toggleSearchFilter, type SearchInput, type ParsedSearch } from "@/lib/parking-search"

interface EnhancedSearchProps {
  value: SearchInput
  criteria: ParsedSearch
  onChange: (value: SearchInput, debounce?: boolean) => void
  isMobile: boolean
  weekStartDay: string
  className?: string
}

const QUICK_FILTERS = [
  { label: "Today", value: "today", icon: Calendar, type: "date", tooltip: "Filter for parking spots available today" },
  { label: "Tomorrow", value: "tomorrow", icon: Calendar, type: "date", tooltip: "Filter for parking spots available tomorrow" },
  { label: "This Week", value: "this_week", icon: Calendar, type: "date", tooltip: "Filter for parking spots available this week" },
  { label: "Electric", value: "electric", icon: Zap, type: "spotType", tooltip: "Filter for electric vehicle charging stations with standard EV connectors" },
  { label: "Tesla", value: "tesla_ev", icon: Zap, type: "spotType", tooltip: "Filter for Tesla-specific charging stations optimized for Tesla vehicles" },
  { label: "Accessible", value: "accessible", icon: Accessibility, type: "spotType", tooltip: "Filter for accessible parking spots designed for mobility accommodations" }
]

const MOBILE_VISIBLE_FILTERS = 5

export function EnhancedSearch({ value, criteria, onChange, isMobile, weekStartDay, className }: EnhancedSearchProps) {
  const { query, quickFilters: activeFilters } = value
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = () => {
    onChange(value)
  }

  const handleQuickFilter = (filter: typeof QUICK_FILTERS[0]) => {
    onChange(toggleSearchFilter(value, filter.value, isMobile, weekStartDay))
  }

  const clearSearch = () => {
    onChange({ query: "", quickFilters: [] })
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
      'tomorrow': 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
      'this_week': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
      'inside': 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
      'bci_managed': 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
      'budget': 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
      'electric': 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
      'tesla_ev': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
      'accessible': 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    }
    
    return colorMap[filterValue] || 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
  }

  const renderFilterButton = (filter: typeof QUICK_FILTERS[0]) => {
    const Icon = filter.icon
    const isActive = isMobile && filter.type === "date"
      ? effectiveDateFilter(criteria, weekStartDay) === filter.value
      : activeFilters.includes(filter.value)
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
          
          {hiddenFilters.length > 0 && <Sheet open={showMoreFilters} onOpenChange={setShowMoreFilters}>
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
          </Sheet>}
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
            onChange={(e) => onChange({ ...value, query: e.target.value }, true)}
            onKeyDown={handleKeyDown}
            className={`pl-10 min-h-[44px] md:h-12 text-base ${query || (isMobile && activeFilters.length > 0) ? 'pr-10' : 'pr-4'}`}
            data-testid="input-enhanced-search"
            title="Search using natural language"
          />
           {(query || (isMobile && activeFilters.length > 0)) && (
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
