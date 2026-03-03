import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

export type ReportScope = 'all' | 'bci';

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  scope: ReportScope;
}

export function useReportFilters() {
  // Default to previous calendar month (1st to last day)
  const getDefaultDates = () => {
    const now = new Date();
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return {
      from: firstOfPrevMonth.toISOString().split('T')[0],
      to: lastOfPrevMonth.toISOString().split('T')[0]
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
