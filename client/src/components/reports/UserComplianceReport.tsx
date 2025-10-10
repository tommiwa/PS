import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, UserCheck, UserPlus, UserX, FileCheck, AlertCircle } from 'lucide-react';
import type { ReportUserComplianceResponse } from '@shared/schema';

interface UserComplianceReportProps {
  data: ReportUserComplianceResponse | undefined;
  isLoading: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function UserComplianceReport({ data, isLoading }: UserComplianceReportProps) {
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

  const userActivityCards = [
    {
      title: 'Total Users',
      value: data.userActivity.totalUsers,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Active Users',
      value: data.userActivity.activeUsers,
      icon: UserCheck,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'New Registrations',
      value: data.userActivity.newRegistrations,
      icon: UserPlus,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Suspended Users',
      value: data.userActivity.suspendedUsers,
      icon: UserX,
      color: data.userActivity.suspendedUsers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
    }
  ];

  const complianceCards = [
    {
      title: 'Accepted Latest Terms',
      value: data.termsCompliance.acceptedLatestTerms,
      icon: FileCheck,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Pending Acceptance',
      value: data.termsCompliance.pendingAcceptance,
      icon: AlertCircle,
      color: data.termsCompliance.pendingAcceptance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="user-compliance-report">
      <div>
        <h3 className="text-lg font-semibold mb-4">User Activity</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {userActivityCards.map((card) => {
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
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Terms Compliance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {complianceCards.map((card) => {
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
          <Card data-testid="card-compliance-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <FileCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="value-compliance-rate">
                {data.termsCompliance.complianceRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {data.roleDistribution.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-role-distribution-chart">
            <CardHeader>
              <CardTitle>Role Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.roleDistribution}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {data.roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-role-distribution-table">
            <CardHeader>
              <CardTitle>Role Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.roleDistribution.map((role) => (
                    <TableRow key={role.role} data-testid={`row-role-${role.role}`}>
                      <TableCell className="font-medium capitalize">{role.role}</TableCell>
                      <TableCell>{role.count}</TableCell>
                      <TableCell>{role.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {data.departmentBreakdown.length > 0 && (
        <Card data-testid="card-department-breakdown">
          <CardHeader>
            <CardTitle>Department Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Spots Owned</TableHead>
                  <TableHead>Bookings Made</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.departmentBreakdown.map((dept) => (
                  <TableRow key={dept.department} data-testid={`row-dept-${dept.department}`}>
                    <TableCell className="font-medium">{dept.department}</TableCell>
                    <TableCell>{dept.userCount}</TableCell>
                    <TableCell>{dept.activeUsers}</TableCell>
                    <TableCell>{dept.spotsOwned}</TableCell>
                    <TableCell>{dept.bookingsMade}</TableCell>
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
