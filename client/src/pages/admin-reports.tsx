import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReportFilters } from '@/components/reports/useReportFilters';
import { exportSharedPoolUsageReport } from '@/utils/report-export';
import { AlertCircle, FileSpreadsheet } from 'lucide-react';
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
              <CardTitle>Usage by User</CardTitle>
              <CardDescription>
                {sharedPoolUsageQuery.data.summary.totalBookings} bookings | ${sharedPoolUsageQuery.data.summary.totalAmount.toFixed(2)} total
              </CardDescription>
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
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Bookings</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharedPoolUsageQuery.data.usageByUser.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell className="text-center">{user.bookingCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${user.totalAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
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
