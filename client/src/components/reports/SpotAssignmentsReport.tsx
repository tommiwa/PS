import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, UserMinus, Mail, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { SpotAssignmentReportResponse } from '@shared/schema';

interface SpotAssignmentsReportProps {
  data: SpotAssignmentReportResponse | undefined;
  isLoading: boolean;
}

export function SpotAssignmentsReport({ data, isLoading }: SpotAssignmentsReportProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  const assignedCount = data.assignments.filter(a => a.action === 'assigned').length;
  const unassignedCount = data.assignments.filter(a => a.action === 'unassigned').length;

  const summaryCards = [
    {
      title: 'Assignments',
      value: assignedCount,
      icon: UserPlus,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Unassignments',
      value: unassignedCount,
      icon: UserMinus,
      color: 'text-red-600 dark:text-red-400'
    },
    {
      title: 'Total Changes',
      value: data.totalCount,
      icon: Calendar,
      color: 'text-blue-600 dark:text-blue-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="spot-assignments-report">
      <div className="grid gap-4 md:grid-cols-3">
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

      {data.assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <UserPlus className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg">No spot assignments found</p>
              <p className="text-sm mt-2">Try adjusting the date range or filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card data-testid="card-assignments-table">
          <CardHeader>
            <CardTitle>Assignment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Spot Number</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Spot Type</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignments.map((assignment) => (
                    <TableRow 
                      key={assignment.id} 
                      data-testid={`row-assignment-${assignment.id}`}
                    >
                      <TableCell>
                        <Badge 
                          variant={assignment.action === 'assigned' ? 'default' : 'destructive'}
                          data-testid={`badge-action-${assignment.id}`}
                        >
                          {assignment.action === 'assigned' ? 'Assigned' : 'Unassigned'}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-user-name-${assignment.id}`}>
                        {assignment.user.firstName} {assignment.user.lastName}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`mailto:${assignment.user.email}`}
                          className="text-primary hover:underline flex items-center gap-1"
                          data-testid={`link-email-${assignment.id}`}
                        >
                          <Mail className="h-3 w-3" />
                          {assignment.user.email}
                        </a>
                      </TableCell>
                      <TableCell data-testid={`text-department-${assignment.id}`}>
                        {assignment.user.department}
                      </TableCell>
                      <TableCell data-testid={`text-spot-number-${assignment.id}`}>
                        {assignment.spot.spotNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" data-testid={`text-location-${assignment.id}`}>
                          <MapPin className="h-3 w-3" />
                          {assignment.spot.location}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-spot-type-${assignment.id}`}>
                        {assignment.spot.spotType}
                      </TableCell>
                      <TableCell data-testid={`text-monthly-fee-${assignment.id}`}>
                        ${parseFloat(assignment.spot.monthlyFee ?? "0").toFixed(2)}
                      </TableCell>
                      <TableCell data-testid={`text-date-${assignment.id}`}>
                        {format(new Date(assignment.effectiveAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell data-testid={`text-actor-${assignment.id}`}>
                        {assignment.actor 
                          ? `${assignment.actor.firstName} ${assignment.actor.lastName}`
                          : 'System'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
