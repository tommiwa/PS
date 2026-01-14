import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReportFilters } from '@/components/reports/useReportFilters';
import { exportSharedPoolUsageReport } from '@/utils/report-export';
import { AlertCircle, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';
import type { SharedPoolUsageReportResponse } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo } = useReportFilters();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];
  const sharedPoolDateTo = filters.dateTo > today ? today : filters.dateTo;
  const isDateRangeValid = Boolean(filters.dateFrom && sharedPoolDateTo && filters.dateFrom <= sharedPoolDateTo);

  const sharedPoolUsageQuery = useQuery<SharedPoolUsageReportResponse>({
    queryKey: ['/api/admin/reports/shared-pool-usage', filters.dateFrom, sharedPoolDateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: sharedPoolDateTo
      });
      const response = await fetch(`/api/admin/reports/shared-pool-usage?${params}`);
      if (!response.ok) throw new Error('Failed to fetch shared pool usage report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (sharedPoolUsageQuery.data) {
      setExpandedUsers(new Set(sharedPoolUsageQuery.data.usageByUser.map(u => u.userId)));
    }
  };

  const collapseAll = () => {
    setExpandedUsers(new Set());
  };

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-reports">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-reports">
            Shared Pool Usage Report
          </h1>
          <p className="text-muted-foreground mt-2">
            Track usage of shared pool spots for salary deductions
          </p>
        </div>
        {isDateRangeValid && sharedPoolUsageQuery.data && (
          <Button
            onClick={async () => {
              await exportSharedPoolUsageReport(sharedPoolUsageQuery.data!);
            }}
            data-testid="btn-export-shared-pool"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        )}
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="date-from">From Date</Label>
          <Input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={filters.dateTo}
            data-testid="input-date-from"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date-to">To Date</Label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={filters.dateFrom}
            data-testid="input-date-to"
          />
        </div>
      </div>

      {!isDateRangeValid && filters.dateFrom && filters.dateTo && (
        <Alert variant="destructive" data-testid="alert-invalid-date-range">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            To Date must be greater than or equal to From Date
          </AlertDescription>
        </Alert>
      )}

      {filters.dateTo > today && (
        <Alert data-testid="alert-future-dates-excluded">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Future dates are excluded. Showing data up to {today}.
          </AlertDescription>
        </Alert>
      )}

      {/* Report Table */}
      {isDateRangeValid ? (
        sharedPoolUsageQuery.isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ) : sharedPoolUsageQuery.data ? (
          <Card data-testid="shared-pool-usage-table">
            <CardHeader>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <CardTitle>Usage by Employee</CardTitle>
                  <CardDescription>
                    {sharedPoolUsageQuery.data.summary.totalBookings} bookings | ${sharedPoolUsageQuery.data.summary.totalAmount.toFixed(2)} total
                  </CardDescription>
                </div>
                {sharedPoolUsageQuery.data.usageByUser.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={expandAll}>
                      Expand All
                    </Button>
                    <Button variant="outline" size="sm" onClick={collapseAll}>
                      Collapse All
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sharedPoolUsageQuery.data.usageByUser.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No shared pool usage found for the selected date range.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Spot</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedPoolUsageQuery.data.usageByUser.map((user) => {
                      const isExpanded = expandedUsers.has(user.userId);
                      const sortedBookings = [...user.bookings].sort((a, b) => 
                        b.bookingDate.localeCompare(a.bookingDate)
                      );
                      
                      return (
                        <>
                          {/* User summary row */}
                          <TableRow 
                            key={user.userId}
                            className="bg-muted/50 cursor-pointer hover-elevate"
                            onClick={() => toggleUser(user.userId)}
                          >
                            <TableCell className="w-10">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell colSpan={3} className="font-medium">
                              {user.bookingCount} booking{user.bookingCount !== 1 ? 's' : ''}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.department}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ${user.totalAmount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                          
                          {/* Individual booking rows (shown when expanded) */}
                          {isExpanded && sortedBookings.map((booking) => (
                            <TableRow key={booking.bookingId} className="bg-background">
                              <TableCell></TableCell>
                              <TableCell>{booking.bookingDate}</TableCell>
                              <TableCell className="font-medium">{booking.spotNumber}</TableCell>
                              <TableCell>{booking.location}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {user.firstName} {user.lastName}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{user.email}</TableCell>
                              <TableCell className="text-muted-foreground">{user.department}</TableCell>
                              <TableCell className="text-right">${booking.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : null
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Select a date range to view the report.
        </div>
      )}
    </div>
  );
}
