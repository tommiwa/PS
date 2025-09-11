import { SearchFilters } from '../search-filters'

export default function SearchFiltersExample() {
  return (
    <SearchFilters 
      onFilterChange={(filters) => console.log('Filters changed:', filters)}
      onSearch={() => console.log('Search triggered')}
    />
  )
}