import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Filter, X, Calendar } from "lucide-react"

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: string
  label: string
  type: "select" | "date" | "dateRange" | "text"
  options?: FilterOption[]
  placeholder?: string
}

export interface FilterValues {
  [key: string]: string | undefined
}

interface EnhancedFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  filterConfigs: FilterConfig[]
  filterValues: FilterValues
  onFilterChange: (key: string, value: string | undefined) => void
  onClearFilters: () => void
  searchPlaceholder?: string
  className?: string
}

export function EnhancedFilters({
  searchValue,
  onSearchChange,
  filterConfigs,
  filterValues,
  onFilterChange,
  onClearFilters,
  searchPlaceholder = "Search...",
  className
}: EnhancedFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)
  
  // Count active filters (excluding search)
  const activeFilterCount = Object.values(filterValues).filter(value => 
    value !== undefined && value !== "" && value !== "all"
  ).length

  const hasActiveFilters = searchValue.trim() !== "" || activeFilterCount > 0

  const renderFilter = (config: FilterConfig) => {
    const value = filterValues[config.key]

    switch (config.type) {
      case "select":
        return (
          <div key={config.key} className="space-y-2">
            <Label className="text-sm font-medium">{config.label}</Label>
            <Select
              value={value || "all"}
              onValueChange={(newValue) => 
                onFilterChange(config.key, newValue === "all" ? undefined : newValue)
              }
            >
              <SelectTrigger data-testid={`select-filter-${config.key}`}>
                <SelectValue placeholder={config.placeholder || `All ${config.label}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {config.label}</SelectItem>
                {config.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case "date":
        return (
          <div key={config.key} className="space-y-2">
            <Label className="text-sm font-medium">{config.label}</Label>
            <Input
              type="date"
              value={value || ""}
              onChange={(e) => onFilterChange(config.key, e.target.value || undefined)}
              data-testid={`input-filter-${config.key}`}
            />
          </div>
        )

      case "dateRange":
        const [fromKey, toKey] = [`${config.key}From`, `${config.key}To`]
        const fromValue = filterValues[fromKey] || ""
        return (
          <div key={config.key} className="space-y-2">
            <Label className="text-sm font-medium">{config.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="From"
                value={fromValue}
                onChange={(e) => {
                  const newFrom = e.target.value || undefined
                  onFilterChange(fromKey, newFrom)
                  if (filterValues[toKey] && newFrom && filterValues[toKey]! < newFrom) {
                    onFilterChange(toKey, undefined)
                  }
                }}
                data-testid={`input-filter-${fromKey}`}
              />
              <Input
                type="date"
                placeholder="To"
                value={filterValues[toKey] || ""}
                min={fromValue || undefined}
                disabled={!fromValue}
                onChange={(e) => onFilterChange(toKey, e.target.value || undefined)}
                data-testid={`input-filter-${toKey}`}
                className={!fromValue ? "opacity-50 cursor-not-allowed" : ""}
              />
            </div>
            {!fromValue && (
              <p className="text-xs text-muted-foreground">Select a start date first</p>
            )}
          </div>
        )

      case "text":
        return (
          <div key={config.key} className="space-y-2">
            <Label className="text-sm font-medium">{config.label}</Label>
            <Input
              type="text"
              placeholder={config.placeholder || `Enter ${config.label.toLowerCase()}...`}
              value={value || ""}
              onChange={(e) => onFilterChange(config.key, e.target.value || undefined)}
              data-testid={`input-filter-${config.key}`}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            {showFilters ? "Hide Filters" : "Show Filters"}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
              data-testid="input-search"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="shrink-0"
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>

        {/* Filter Controls */}
        {showFilters && filterConfigs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2 border-t">
            {filterConfigs.map(renderFilter)}
          </div>
        )}

        {/* Active Filter Tags */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {searchValue.trim() && (
              <Badge variant="outline" className="flex items-center gap-1">
                Search: "{searchValue}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {Object.entries(filterValues).map(([key, value]) => {
              if (!value || value === "all") return null
              
              const config = filterConfigs.find(c => 
                c.key === key || 
                key === `${c.key}From` || 
                key === `${c.key}To`
              )
              
              if (!config) return null
              
              let displayValue = value
              if (config.type === "select") {
                const option = config.options?.find(o => o.value === value)
                displayValue = option?.label || value
              }
              
              let label = config.label
              if (key.endsWith("From")) label = `${config.label} From`
              if (key.endsWith("To")) label = `${config.label} To`
              
              return (
                <Badge key={key} variant="outline" className="flex items-center gap-1">
                  {label}: {displayValue}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => onFilterChange(key, undefined)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}