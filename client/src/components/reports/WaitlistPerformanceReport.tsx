import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ListOrdered, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import type { ReportWaitlistPerformanceResponse } from '@shared/schema';

interface WaitlistPerformanceReportProps {
  data: ReportWaitlistPerformanceResponse | undefined;
  isLoading: boolean;
}

export function WaitlistPerformanceReport({ data, isLoading }: WaitlistPerformanceReportProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  const summaryCards = [
    {
      title: 'Total Requests',
      value: data.summary.totalRequests,
      icon: ListOrdered,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Active Requests',
      value: data.summary.activeRequests,
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: 'Assigned Requests',
      value: data.summary.assignedRequests,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Cancelled Requests',
      value: data.summary.cancelledRequests,
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400'
    },
    {
      title: 'Avg Wait Time',
      value: `${data.summary.averageWaitTime} days`,
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Fulfillment Rate',
      value: `${data.summary.fulfillmentRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-cyan-600 dark:text-cyan-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="waitlist-performance-report">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`value-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.priorityBreakdown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-priority-breakdown-chart">
            <CardHeader>
              <CardTitle>Requests by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.priorityBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priorityLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-priority-breakdown-table">
            <CardHeader>
              <CardTitle>Priority Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Avg Wait</TableHead>
                    <TableHead>Fulfill %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.priorityBreakdown.map((priority) => (
                    <TableRow key={priority.priorityLabel} data-testid={`row-priority-${priority.priorityLabel}`}>
                      <TableCell className="font-medium">{priority.priorityLabel}</TableCell>
                      <TableCell>{priority.count}</TableCell>
                      <TableCell>{priority.averageWaitDays} days</TableCell>
                      <TableCell>{priority.fulfillmentRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {data.spotTypePreferences.length > 0 && (
        <Card data-testid="card-spot-type-preferences">
          <CardHeader>
            <CardTitle>Spot Type Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spot Type</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Fulfilled</TableHead>
                  <TableHead>Fulfillment Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.spotTypePreferences.map((type) => (
                  <TableRow key={type.spotType} data-testid={`row-spot-type-${type.spotType}`}>
                    <TableCell className="font-medium">{type.spotType}</TableCell>
                    <TableCell>{type.requestCount}</TableCell>
                    <TableCell>{type.fulfilledCount}</TableCell>
                    <TableCell>{type.fulfillmentRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.departmentRequests.length > 0 && (
        <Card data-testid="card-department-requests">
          <CardHeader>
            <CardTitle>Department Waitlist Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Avg Wait Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.departmentRequests.map((dept) => (
                  <TableRow key={dept.department} data-testid={`row-dept-${dept.department}`}>
                    <TableCell className="font-medium">{dept.department}</TableCell>
                    <TableCell>{dept.activeRequests}</TableCell>
                    <TableCell>{dept.assignedRequests}</TableCell>
                    <TableCell>{dept.averageWaitDays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
