import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useReportFilters } from '@/components/reports/useReportFilters';
import { exportSharedPoolUsageReport, exportSpotAssignmentsReport } from '@/utils/report-export';
import { AlertCircle, FileSpreadsheet, ChevronDown, ChevronRight, Car, UserPlus, UserMinus, ArrowRightLeft, Heart, Ban, RotateCcw } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/use-confirm';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo } = useReportFilters();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [actionFilter, setActionFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const { toast } = useToast();
  const { confirm } = useConfirm();

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

  // Spot Assignment Report Query - fetch all actions (assignments and unassignments)
  const spotAssignmentQuery = useQuery<SpotAssignmentReportResponse>({
    queryKey: ['/api/admin/reports/spot-assignments', filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        action: 'all',
        scope: 'bci'
      });
      const response = await fetch(`/api/admin/reports/spot-assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch spot assignment report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  // Mutation to toggle payroll exclusion for a booking — shared source of truth with Payroll Summary
  const excludeFromPayrollMutation = useMutation({
    mutationFn: async (data: { bookingId: string; excluded: boolean }) => {
      const response = await apiRequest(`/api/admin/bookings/${data.bookingId}/payroll-exclusion`, {
        method: 'PATCH',
        body: { excluded: data.excluded }
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/reports/shared-pool-usage'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payroll-summary'] });
      toast({
        title: data.excluded ? "Removed from Payroll" : "Restored to Payroll",
        description: data.message,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update",
        description: error instanceof Error ? error.message : "Failed to update payroll status. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Filter and compute stats for spot assignments
  const filteredAssignments = spotAssignmentQuery.data?.assignments.filter(a => 
    actionFilter === 'all' || a.action === actionFilter
  ) || [];
  
  const assignmentStats = {
    total: spotAssignmentQuery.data?.assignments.length || 0,
    optIn: spotAssignmentQuery.data?.assignments.filter(a => a.action === 'assigned').length || 0,
    optOut: spotAssignmentQuery.data?.assignments.filter(a => a.action === 'unassigned').length || 0
  };

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
          <Label htmlFor="date-to" className={!filters.dateFrom ? "text-muted-foreground" : ""}>To Date</Label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={filters.dateFrom}
            disabled={!filters.dateFrom}
            className={!filters.dateFrom ? "opacity-50 cursor-not-allowed" : ""}
            data-testid="input-date-to"
          />
          {!filters.dateFrom && (
            <p className="text-xs text-muted-foreground">Select a start date first</p>
          )}
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
              <ArrowRightLeft className="h-4 w-4" />
              Spot Assignment Changes
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
                      <CardTitle className="flex items-center gap-3 flex-wrap">
                        Usage by Employee
                        {(() => {
                          const from = new Date(filters.dateFrom + 'T00:00:00');
                          const to = new Date(sharedPoolDateTo + 'T00:00:00');
                          const fromLabel = from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          const toLabel = to.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                          const label = fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
                          return (
                            <span className="text-sm font-normal text-muted-foreground">{label}</span>
                          );
                        })()}
                      </CardTitle>
                      <CardDescription>
                        {(() => {
                          const allBookings = sharedPoolUsageQuery.data!.usageByUser.flatMap(u => u.bookings);
                          const removedCount = allBookings.filter(b => b.excludedFromPayroll).length;
                          return (
                            <>
                              {sharedPoolUsageQuery.data!.summary.totalBookings} active booking{sharedPoolUsageQuery.data!.summary.totalBookings !== 1 ? 's' : ''} | ${sharedPoolUsageQuery.data!.summary.totalAmount.toFixed(2)} total
                              {removedCount > 0 && (
                                <span className="ml-2 text-red-500">· {removedCount} removed from payroll</span>
                              )}
                            </>
                          );
                        })()}
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
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-16"></TableHead>
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
                                <TableCell className="text-muted-foreground">—</TableCell>
                                <TableCell className="text-right font-semibold">
                                  ${user.totalAmount.toFixed(2)}
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                              
                              {/* Individual booking rows (shown when expanded) */}
                              {isExpanded && sortedBookings.map((booking) => (
                                <TableRow 
                                  key={booking.bookingId} 
                                  className={booking.excludedFromPayroll 
                                    ? "bg-red-50/50 text-red-600" 
                                    : "bg-background"
                                  }
                                >
                                  <TableCell></TableCell>
                                  <TableCell className={booking.excludedFromPayroll ? "text-red-600" : ""}>
                                    {booking.bookingDate}
                                  </TableCell>
                                  <TableCell className={`font-medium ${booking.excludedFromPayroll ? "text-red-600" : ""}`}>
                                    {booking.spotNumber}
                                  </TableCell>
                                  <TableCell className={booking.excludedFromPayroll ? "text-red-600" : ""}>
                                    {booking.location}
                                  </TableCell>
                                  <TableCell className={booking.excludedFromPayroll ? "text-red-600" : "text-muted-foreground"}>
                                    {user.firstName} {user.lastName}
                                  </TableCell>
                                  <TableCell className={booking.excludedFromPayroll ? "text-red-600" : "text-muted-foreground"}>
                                    {user.email}
                                  </TableCell>
                                  <TableCell className={booking.excludedFromPayroll ? "text-red-600" : "text-muted-foreground"}>
                                    {user.department}
                                  </TableCell>
                                  <TableCell>
                                    {booking.excludedFromPayroll ? (
                                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                                        Removed
                                      </Badge>
                                    ) : booking.donateToCharity ? (
                                      <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
                                        <Heart className="h-3 w-3 mr-1 fill-pink-500" />
                                        Charity
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                        Regular
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className={`text-right ${booking.excludedFromPayroll ? "text-red-600 line-through" : ""}`}>
                                    ${booking.amount.toFixed(2)}
                                  </TableCell>
                                  <TableCell>
                                    {booking.excludedFromPayroll ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-green-600 hover:text-green-700"
                                            disabled={excludeFromPayrollMutation.isPending}
                                            data-testid={`button-restore-payroll-${booking.bookingId}`}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const confirmed = await confirm({
                                                title: "Restore to Payroll",
                                                description: `Restore booking for ${user.firstName} ${user.lastName} (${booking.spotNumber}, ${booking.bookingDate}) back into payroll? The amount of $${booking.amount.toFixed(2)} will be included in the deduction.`,
                                                confirmText: "Restore",
                                                cancelText: "Cancel",
                                                variant: "default"
                                              });
                                              if (confirmed) {
                                                excludeFromPayrollMutation.mutate({ bookingId: booking.bookingId, excluded: false });
                                              }
                                            }}
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Restore to Payroll</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            disabled={excludeFromPayrollMutation.isPending}
                                            data-testid={`button-remove-payroll-${booking.bookingId}`}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const confirmed = await confirm({
                                                title: "Remove from Payroll",
                                                description: `Remove this booking for ${user.firstName} ${user.lastName} (${booking.spotNumber}, ${booking.bookingDate}) from payroll? The amount of $${booking.amount.toFixed(2)} will not be deducted.`,
                                                confirmText: "Remove",
                                                cancelText: "Cancel",
                                                variant: "destructive"
                                              });
                                              if (confirmed) {
                                                excludeFromPayrollMutation.mutate({ bookingId: booking.bookingId, excluded: true });
                                              }
                                            }}
                                          >
                                            <Ban className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Remove from Payroll</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </TableCell>
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

          {/* Spot Assignment Changes Tab */}
          <TabsContent value="spot-assignments" className="space-y-4">
            {/* Summary Stats */}
            {spotAssignmentQuery.data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Changes</p>
                        <p className="text-2xl font-bold text-blue-700">{assignmentStats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-50 to-green-100/50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <UserPlus className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Opt-In (New Assignments)</p>
                        <p className="text-2xl font-bold text-green-700">{assignmentStats.optIn}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <UserMinus className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Opt-Out (Unassignments)</p>
                        <p className="text-2xl font-bold text-orange-700">{assignmentStats.optOut}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Filter and Export Row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="action-filter" className="text-sm whitespace-nowrap">Filter by Action:</Label>
                <Select value={actionFilter} onValueChange={(v: 'all' | 'assigned' | 'unassigned') => setActionFilter(v)}>
                  <SelectTrigger className="w-40" id="action-filter" data-testid="select-action-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Changes</SelectItem>
                    <SelectItem value="assigned">Opt-In Only</SelectItem>
                    <SelectItem value="unassigned">Opt-Out Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  <CardTitle>Spot Assignment Changes</CardTitle>
                  <CardDescription>
                    Track employees who have opted in or out of permanent spot rental for payroll deduction adjustments.
                    {filteredAssignments.length !== assignmentStats.total && (
                      <span className="ml-2 font-medium">Showing {filteredAssignments.length} of {assignmentStats.total}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredAssignments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No spot assignment changes found for the selected criteria.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Spot</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Spot Type</TableHead>
                          <TableHead>Monthly Fee</TableHead>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssignments
                          .slice()
                          .sort((a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime())
                          .map((assignment) => (
                            <TableRow key={assignment.id} className={assignment.action === 'unassigned' ? 'bg-orange-50/50' : ''}>
                              <TableCell>{new Date(assignment.effectiveAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                {assignment.action === 'assigned' ? (
                                  <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50">
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Opt-In
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-orange-400 text-orange-700 bg-orange-50">
                                    <UserMinus className="h-3 w-3 mr-1" />
                                    Opt-Out
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{assignment.spot.spotNumber}</TableCell>
                              <TableCell>{assignment.spot.location}</TableCell>
                              <TableCell>{assignment.spot.spotType}</TableCell>
                              <TableCell>
                                {assignment.action === 'assigned' ? (
                                  <span className="text-green-700 font-medium">+${parseFloat(assignment.spot.monthlyFee ?? "0").toFixed(2)}</span>
                                ) : (
                                  <span className="text-orange-700 font-medium">-${parseFloat(assignment.spot.monthlyFee ?? "0").toFixed(2)}</span>
                                )}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {assignment.user.firstName} {assignment.user.lastName}
                              </TableCell>
                              <TableCell>
                                <a href={`mailto:${assignment.user.email}`} className="text-blue-600 hover:underline">
                                  {assignment.user.email}
                                </a>
                              </TableCell>
                              <TableCell>{assignment.user.department}</TableCell>
                            </TableRow>
                          ))}
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
