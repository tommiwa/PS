import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export type ReportScope = 'all' | 'bci';

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  scope: ReportScope;
}

// Format a local Date as YYYY-MM-DD without UTC conversion
function toLocalDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useReportFilters() {
  // Default to current calendar month (1st to last day)
  const getDefaultDates = () => {
    const now = new Date();
    const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      from: toLocalDateString(firstOfCurrentMonth),
      to: toLocalDateString(lastOfCurrentMonth)
    };
  };

  const defaults = getDefaultDates();
  const [location, setLocation] = useLocation();

  // Parse URL search params
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: searchParams.get('from') || defaults.from,
    dateTo: searchParams.get('to') || defaults.to,
    scope: (searchParams.get('scope') as ReportScope) || 'all'
  });

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('from', filters.dateFrom);
    params.set('to', filters.dateTo);
    params.set('scope', filters.scope);
    
    const basePath = location.split('?')[0];
    setLocation(`${basePath}?${params.toString()}`, { replace: true });
  }, [filters]);

  const updateFilters = (updates: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  return {
    filters,
    updateFilters,
    setDateFrom: (dateFrom: string) => updateFilters({ dateFrom }),
    setDateTo: (dateTo: string) => updateFilters({ dateTo }),
    setScope: (scope: ReportScope) => updateFilters({ scope })
  };
}
