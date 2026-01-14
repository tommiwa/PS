import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportFilters, type ReportScope } from '@/components/reports/useReportFilters';
import { UtilizationReport } from '@/components/reports/UtilizationReport';
import { ReportActions } from '@/components/reports/ReportActions';
import { 
  exportUtilizationReport,
  exportSpotAssignmentsReport,
  exportSharedPoolUsageReport
} from '@/utils/report-export';
import { 
  BarChart3, 
  UserPlus,
  AlertCircle,
  DollarSign,
  Users,
  FileSpreadsheet
} from 'lucide-react';
import type {
  ReportUtilizationResponse,
  SpotAssignmentReportResponse,
  SharedPoolUsageReportResponse
} from '@shared/schema';
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
import { SpotAssignmentsReport } from '@/components/reports/SpotAssignmentsReport';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo, setScope } = useReportFilters();

  // Validate date range - must have both dates and To Date >= From Date
  const isDateRangeValid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom <= filters.dateTo);

  const utilizationQuery = useQuery<ReportUtilizationResponse>({
    queryKey: ['/api/admin/reports/utilization', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/utilization?${params}`);
      if (!response.ok) throw new Error('Failed to fetch utilization report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  const spotAssignmentsQuery = useQuery<SpotAssignmentReportResponse>({
    queryKey: ['/api/admin/reports/spot-assignments', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/spot-assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch spot assignments report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  const today = new Date().toISOString().split('T')[0];
  const sharedPoolDateTo = filters.dateTo > today ? today : filters.dateTo;
  const isSharedPoolDateValid = Boolean(filters.dateFrom && sharedPoolDateTo && filters.dateFrom <= sharedPoolDateTo);

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
    enabled: isSharedPoolDateValid
  });

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-reports">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-reports">
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          Analytics for spot assignments and parking utilization
        </p>
      </div>

      {/* Filters */}
      <Card data-testid="card-report-filters">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select date range and scope to customize your reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={filters.scope}
                onValueChange={(value) => setScope(value as ReportScope)}
              >
                <SelectTrigger id="scope" data-testid="select-scope">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-scope-all">All Spots</SelectItem>
                  <SelectItem value="bci" data-testid="option-scope-bci">BCI-Managed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isDateRangeValid && (
            <Alert variant="destructive" className="mt-4" data-testid="alert-invalid-date-range">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                To Date must be greater than or equal to From Date
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="spot-assignments" className="space-y-6" data-testid="tabs-reports">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="spot-assignments" data-testid="tab-spot-assignments">
            <UserPlus className="w-4 h-4 mr-2" />
            Spot Assignments
          </TabsTrigger>
          <TabsTrigger value="utilization" data-testid="tab-utilization">
            <BarChart3 className="w-4 h-4 mr-2" />
            Utilization
          </TabsTrigger>
          <TabsTrigger value="shared-pool-usage" data-testid="tab-shared-pool-usage">
            <DollarSign className="w-4 h-4 mr-2" />
            Shared Pool Usage
          </TabsTrigger>
        </TabsList>

        {/* Spot Assignments Tab */}
        <TabsContent value="spot-assignments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Spot Assignment Report</h2>
            {isDateRangeValid && (
              <ReportActions
                reportType="spot-assignments"
                onExport={async () => {
                  if (!spotAssignmentsQuery.data) return;
                  await exportSpotAssignmentsReport(spotAssignmentsQuery.data);
                }}
                filters={filters}
              />
            )}
          </div>
          {isDateRangeValid ? (
            <SpotAssignmentsReport
              data={spotAssignmentsQuery.data}
              isLoading={spotAssignmentsQuery.isLoading}
            />
          ) : (
            <Card className="p-8 text-center" data-testid="card-invalid-dates-message">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Date Range</h3>
              <p className="text-muted-foreground">
                Please select a valid date range to view the report
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Utilization Tab */}
        <TabsContent value="utilization" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Parking Utilization Report</h2>
            {isDateRangeValid && (
              <ReportActions
                reportType="utilization"
                onExport={async () => {
                  if (!utilizationQuery.data) return;
                  await exportUtilizationReport(utilizationQuery.data);
                }}
                filters={filters}
              />
            )}
          </div>
          {isDateRangeValid ? (
            <UtilizationReport
              data={utilizationQuery.data}
              isLoading={utilizationQuery.isLoading}
            />
          ) : (
            <Card className="p-8 text-center" data-testid="card-invalid-dates-message">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Date Range</h3>
              <p className="text-muted-foreground">
                Please select a valid date range to view the report
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Shared Pool Usage Tab */}
        <TabsContent value="shared-pool-usage" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Shared Pool Usage Report</h2>
              <p className="text-muted-foreground text-sm">
                BCI-managed spots with no owner - for salary deductions
              </p>
            </div>
            {isSharedPoolDateValid && sharedPoolUsageQuery.data && (
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

          {filters.dateTo > today && (
            <Alert data-testid="alert-future-dates-excluded">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Future dates are excluded. Showing data up to {today}.
              </AlertDescription>
            </Alert>
          )}

          {isSharedPoolDateValid ? (
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
            <Card className="p-8 text-center" data-testid="card-invalid-dates-message">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Date Range</h3>
              <p className="text-muted-foreground">
                Please select a valid date range to view the report
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
