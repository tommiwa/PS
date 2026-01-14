import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReportFilters } from '@/components/reports/useReportFilters';
import { exportSharedPoolUsageReport } from '@/utils/report-export';
import { 
  BarChart3, 
  AlertCircle,
  DollarSign,
  Users,
  FileSpreadsheet
} from 'lucide-react';
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
      <Card data-testid="card-report-filters">
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>
            Select the period to calculate usage amounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 max-w-md">
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
            <Alert variant="destructive" className="mt-4" data-testid="alert-invalid-date-range">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                To Date must be greater than or equal to From Date
              </AlertDescription>
            </Alert>
          )}

          {filters.dateTo > today && (
            <Alert className="mt-4" data-testid="alert-future-dates-excluded">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Future dates are excluded. Showing data up to {today}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Report Content */}
      {isDateRangeValid ? (
        <>
          {sharedPoolUsageQuery.isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </div>
          ) : sharedPoolUsageQuery.data ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3" data-testid="shared-pool-summary-cards">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sharedPoolUsageQuery.data.summary.totalBookings}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">Total Amount Owed</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${sharedPoolUsageQuery.data.summary.totalAmount.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                    <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sharedPoolUsageQuery.data.summary.uniqueUsers}</div>
                  </CardContent>
                </Card>
              </div>

              {/* User Usage Table */}
              <Card data-testid="shared-pool-usage-table">
                <CardHeader>
                  <CardTitle>Usage by User</CardTitle>
                  <CardDescription>Amounts owed per user for salary deduction</CardDescription>
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
            </>
          ) : null}
        </>
      ) : (
        <Card className="p-8 text-center" data-testid="card-select-dates-message">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select Date Range</h3>
          <p className="text-muted-foreground">
            Please select a valid date range to view the report
          </p>
        </Card>
      )}
    </div>
  );
}
