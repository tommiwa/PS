import { useState, useEffect, useRef, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, X, MapPin, Car, Zap, Accessibility, DollarSign, Calendar, Clock, Filter, Building } from "lucide-react"

export interface ParsedSearch {
  query: string
  location?: string
  spotType?: "regular" | "accessible" | "electric" | "tesla_ev" | "reserved" | "all"
  priceMin?: number
  priceMax?: number
  date?: string
  isInside?: boolean
  quickFilters: string[]
}

interface EnhancedSearchProps {
  onSearch: (parsed: ParsedSearch) => void
  className?: string
}

const SEARCH_SUGGESTIONS = [
  "750 pandora ave electric",
  "tesla charging spots",
  "accessible spots under $25", 
  "inside spots",
  "electric charging",
  "level 1",
  "level 2 parking",
  "accessible tomorrow",
  "regular spots 750 pandora ave",
  "tesla ev charger",
  "reserved spots"
]

const QUICK_FILTERS = [
  { label: "Electric Charging", value: "electric", icon: Zap, type: "spotType" },
  { label: "Tesla EV", value: "tesla_ev", icon: Zap, type: "spotType" },
  { label: "Accessible", value: "accessible", icon: Accessibility, type: "spotType" },
  { label: "Inside Building", value: "inside", icon: MapPin, type: "location" },
  { label: "Under $25", value: "cheap", icon: DollarSign, type: "price" },
  { label: "Main Building", value: "750 pandora ave", icon: MapPin, type: "location" },
  { label: "Today", value: "today", icon: Calendar, type: "date" }
]

export function EnhancedSearch({ onSearch, className }: EnhancedSearchProps) {
  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
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
      } else if (filterValue === "inside") {
        parsed.isInside = true
      } else if (filterValue === "cheap") {
        parsed.priceMax = 25
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

  return (
    <div className={`space-y-4 ${className}`} data-testid="enhanced-search">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 py-1">
          <Filter className="h-3 w-3" />
          Quick filters:
        </span>
        {QUICK_FILTERS.map((filter) => {
          const Icon = filter.icon
          const isActive = activeFilters.includes(filter.value)
          return (
            <Badge
              key={filter.value}
              variant={isActive ? "default" : "secondary"}
              className={`cursor-pointer gap-1 hover-elevate ${isActive ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => handleQuickFilter(filter)}
              data-testid={`filter-${filter.value}`}
            >
              <Icon className="h-3 w-3" />
              {filter.label}
              {isActive && <X className="h-3 w-3" />}
            </Badge>
          )
        })}
      </div>

      {/* Search Input */}
      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
        <PopoverTrigger asChild>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search parking spots... (e.g., '750 pandora ave electric $20-30', 'accessible north lot today')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                className={`pl-10 h-12 text-base ${query ? 'pr-12' : 'pr-4'}`}
                data-testid="input-enhanced-search"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              onClick={handleSearch}
              className="h-12 px-6"
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
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
                    <CommandItem
                      key={index}
                      onSelect={() => handleSuggestionSelect(suggestion)}
                      className="cursor-pointer"
                      data-testid={`suggestion-${index}`}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {suggestion}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty>No suggestions found.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Search Examples */}
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">Try searching:</span> "tesla ev charger", "accessible under $25", "level 1 inside", or "electric charging"
      </div>
    </div>
  )
}