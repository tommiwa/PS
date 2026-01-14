import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReportFilters } from '@/components/reports/useReportFilters';
import { exportSharedPoolUsageReport, exportSpotAssignmentsReport } from '@/utils/report-export';
import { AlertCircle, FileSpreadsheet, ChevronDown, ChevronRight, UserPlus, Car } from 'lucide-react';
import type { SharedPoolUsageReportResponse, SpotAssignmentReportResponse } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Badge } from '@/components/ui/badge';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo } = useReportFilters();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedAssignmentUsers, setExpandedAssignmentUsers] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];
  const sharedPoolDateTo = filters.dateTo > today ? today : filters.dateTo;
  const isDateRangeValid = Boolean(filters.dateFrom && sharedPoolDateTo && filters.dateFrom <= sharedPoolDateTo);

  // Shared Pool Usage Query
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

  // Spot Assignment Report Query
  const spotAssignmentQuery = useQuery<SpotAssignmentReportResponse>({
    queryKey: ['/api/admin/reports/spot-assignments', filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        action: 'assigned',
        scope: 'bci'
      });
      const response = await fetch(`/api/admin/reports/spot-assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch spot assignment report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  // Group assignments by user for collapsible view
  const assignmentsByUser = spotAssignmentQuery.data?.assignments.reduce((acc, assignment) => {
    const userId = assignment.user.id;
    if (!acc[userId]) {
      acc[userId] = {
        user: assignment.user,
        assignments: []
      };
    }
    acc[userId].assignments.push(assignment);
    return acc;
  }, {} as Record<string, { user: typeof spotAssignmentQuery.data.assignments[0]['user']; assignments: typeof spotAssignmentQuery.data.assignments }>) || {};

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

  const toggleAssignmentUser = (userId: string) => {
    setExpandedAssignmentUsers(prev => {
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

  const expandAllAssignments = () => {
    setExpandedAssignmentUsers(new Set(Object.keys(assignmentsByUser)));
  };

  const collapseAllAssignments = () => {
    setExpandedAssignmentUsers(new Set());
  };

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-reports">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-reports">
          Payroll Reports
        </h1>
        <p className="text-muted-foreground mt-2">
          Reports for payroll processing and salary deductions
        </p>
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

      {/* Reports Tabs */}
      {isDateRangeValid ? (
        <Tabs defaultValue="shared-pool" className="w-full">
          <TabsList>
            <TabsTrigger value="shared-pool" className="gap-2">
              <Car className="h-4 w-4" />
              Shared Pool Usage
            </TabsTrigger>
            <TabsTrigger value="spot-assignments" className="gap-2">
              <UserPlus className="h-4 w-4" />
              New Spot Assignments
            </TabsTrigger>
          </TabsList>

          {/* Shared Pool Usage Tab */}
          <TabsContent value="shared-pool" className="space-y-4">
            {filters.dateTo > today && (
              <Alert data-testid="alert-future-dates-excluded">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Future dates are excluded. Showing data up to {today}.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              {sharedPoolUsageQuery.data && (
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

            {sharedPoolUsageQuery.isLoading ? (
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
            ) : null}
          </TabsContent>

          {/* New Spot Assignments Tab */}
          <TabsContent value="spot-assignments" className="space-y-4">
            <div className="flex justify-end">
              {spotAssignmentQuery.data && spotAssignmentQuery.data.assignments.length > 0 && (
                <Button
                  onClick={async () => {
                    await exportSpotAssignmentsReport(spotAssignmentQuery.data!);
                  }}
                  data-testid="btn-export-spot-assignments"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              )}
            </div>

            {spotAssignmentQuery.isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ) : spotAssignmentQuery.data ? (
              <Card data-testid="spot-assignments-table">
                <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <CardTitle>New Permanent Spot Assignments</CardTitle>
                      <CardDescription>
                        {spotAssignmentQuery.data.totalCount} assignment{spotAssignmentQuery.data.totalCount !== 1 ? 's' : ''} in selected period
                      </CardDescription>
                    </div>
                    {Object.keys(assignmentsByUser).length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={expandAllAssignments}>
                          Expand All
                        </Button>
                        <Button variant="outline" size="sm" onClick={collapseAllAssignments}>
                          Collapse All
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {spotAssignmentQuery.data.assignments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No new spot assignments found for the selected date range.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Spot</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Spot Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(assignmentsByUser).map(([userId, { user, assignments }]) => {
                          const isExpanded = expandedAssignmentUsers.has(userId);
                          const sortedAssignments = [...assignments].sort((a, b) => 
                            new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime()
                          );
                          
                          return (
                            <>
                              {/* User summary row */}
                              <TableRow 
                                key={userId}
                                className="bg-muted/50 cursor-pointer hover-elevate"
                                onClick={() => toggleAssignmentUser(userId)}
                              >
                                <TableCell className="w-10">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </TableCell>
                                <TableCell colSpan={4}>
                                  <Badge variant="secondary">
                                    {assignments.length} spot{assignments.length !== 1 ? 's' : ''} assigned
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {user.firstName} {user.lastName}
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.department}</TableCell>
                              </TableRow>
                              
                              {/* Individual assignment rows (shown when expanded) */}
                              {isExpanded && sortedAssignments.map((assignment) => (
                                <TableRow key={assignment.id} className="bg-background">
                                  <TableCell></TableCell>
                                  <TableCell>{new Date(assignment.effectiveAt).toLocaleDateString()}</TableCell>
                                  <TableCell className="font-medium">{assignment.spot.spotNumber}</TableCell>
                                  <TableCell>{assignment.spot.location}</TableCell>
                                  <TableCell>{assignment.spot.spotType}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.firstName} {user.lastName}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                  <TableCell className="text-muted-foreground">{user.department}</TableCell>
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
            ) : null}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Select a date range to view the reports.
        </div>
      )}
    </div>
  );
}
