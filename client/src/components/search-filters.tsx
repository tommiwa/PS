import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { X, Search, Filter } from "lucide-react"
import { useLanguage } from "@/hooks/use-language"

export interface SearchFilters {
  location: string
  spotType: string
  date: string
  priceMin: string
  priceMax: string
  isInside: string
}

interface SearchFiltersProps {
  onFilterChange: (filters: SearchFilters) => void
  onSearch: () => void
}

export function SearchFilters({ onFilterChange, onSearch }: SearchFiltersProps) {
  const { t } = useLanguage()
  const [filters, setFilters] = useState<SearchFilters>({
    location: "",
    spotType: "",
    date: "",
    priceMin: "",
    priceMax: "",
    isInside: ""
  })

  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
    
    // Update active filters for display
    const newActiveFilters = Object.entries(newFilters)
      .filter(([_, val]) => val !== "" && val !== "all")
      .map(([key, _]) => key)
    setActiveFilters(newActiveFilters)
  }

  const clearFilter = (key: keyof SearchFilters) => {
    const clearValue = (key === "location" || key === "spotType" || key === "isInside") ? "all" : ""
    updateFilter(key, clearValue)
  }

  const clearAllFilters = () => {
    const emptyFilters: SearchFilters = {
      location: "all",
      spotType: "all",
      date: "",
      priceMin: "",
      priceMax: "",
      isInside: "all"
    }
    setFilters(emptyFilters)
    setActiveFilters([])
    onFilterChange(emptyFilters)
  }

  const handleSearch = () => {
    console.log('Searching with filters:', filters)
    onSearch()
  }

  const getFilterLabel = (key: string) => {
    const labels = {
      location: t("filters.location"),
      spotType: t("filters.spotType"),
      date: t("filters.date"),
      priceMin: t("filters.priceMin"),
      priceMax: t("filters.priceMax"),
      isInside: t("filters.isInside")
    }
    return labels[key as keyof typeof labels] || key
  }

  return (
    <Card data-testid="card-search-filters">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          {t("filters.searchFilters")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">{t("filters.location")}</Label>
            <Select value={filters.location} onValueChange={(value) => updateFilter("location", value)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger data-testid="select-location">
                    <SelectValue placeholder={t("filters.anyLocation")} />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.filter.location")}</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="all">{t("filters.anyLocation")}</SelectItem>
                <SelectItem value="main-building">{t("location.mainBuilding")}</SelectItem>
                <SelectItem value="north-lot">{t("location.northLot")}</SelectItem>
                <SelectItem value="south-lot">{t("location.southLot")}</SelectItem>
                <SelectItem value="west-garage">{t("location.westGarage")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="spotType">{t("filters.spotType")}</Label>
            <Select value={filters.spotType} onValueChange={(value) => updateFilter("spotType", value)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger data-testid="select-spot-type">
                    <SelectValue placeholder={t("filters.anyType")} />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.filter.spotType")}</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="all">{t("filters.anyType")}</SelectItem>
                <SelectItem value="regular">{t("spotType.regular")}</SelectItem>
                <SelectItem value="accessible">{t("spotType.accessible")}</SelectItem>
                <SelectItem value="electric">{t("spotType.electricVehicle")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="date">{t("filters.date")}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => updateFilter("date", e.target.value)}
                  data-testid="input-date"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("tooltip.filter.date")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priceMin">{t("filters.priceMin")}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.priceMin}
                  onChange={(e) => updateFilter("priceMin", e.target.value)}
                  data-testid="input-price-min"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("tooltip.filter.priceMin")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priceMax">{t("filters.priceMax")}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Input
                  type="number"
                  placeholder="100"
                  value={filters.priceMax}
                  onChange={(e) => updateFilter("priceMax", e.target.value)}
                  data-testid="input-price-max"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("tooltip.filter.priceMax")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="isInside">{t("filters.isInside")}</Label>
            <Select value={filters.isInside} onValueChange={(value) => updateFilter("isInside", value)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger data-testid="select-inside">
                    <SelectValue placeholder={t("filters.anyInside")} />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.filter.inside")}</p>
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="all">{t("filters.anyInside")}</SelectItem>
                <SelectItem value="true">{t("filters.insideBuilding")}</SelectItem>
                <SelectItem value="false">{t("filters.outsidePublic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {activeFilters.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("filters.activeFilters")}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    data-testid="button-clear-all"
                  >
                    {t("filters.clearAllFilters")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tooltip.filter.clearAll")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filterKey) => (
                <Badge 
                  key={filterKey} 
                  variant="secondary" 
                  className="gap-1"
                  data-testid={`badge-filter-${filterKey}`}
                >
                  {getFilterLabel(filterKey)}
                  <button
                    onClick={() => clearFilter(filterKey as keyof SearchFilters)}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={handleSearch} 
              className="w-full gap-2"
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
              {t("filters.searchBtn")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("tooltip.filter.search")}</p>
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  )
}