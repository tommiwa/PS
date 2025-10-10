import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import type { ReportRevenueResponse } from '@shared/schema';

interface RevenueReportProps {
  data: ReportRevenueResponse | undefined;
  isLoading: boolean;
}

export function RevenueReport({ data, isLoading }: RevenueReportProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
      title: 'Total Revenue',
      value: `$${data.summary.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      subtitle: 'All bookings'
    },
    {
      title: 'Owner Earnings',
      value: `$${data.summary.ownerEarnings.toFixed(2)}`,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      subtitle: '85% share'
    },
    {
      title: 'BCI Revenue',
      value: `$${data.summary.bciRevenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      subtitle: '15% commission'
    },
    {
      title: 'Avg Booking Value',
      value: `$${data.summary.averageBookingValue.toFixed(2)}`,
      icon: Calendar,
      color: 'text-cyan-600 dark:text-cyan-400',
      subtitle: `${data.summary.totalBookings} bookings`
    }
  ];

  return (
    <div className="space-y-6" data-testid="revenue-report">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.monthlyTrends.length > 0 && (
        <Card data-testid="card-monthly-trends">
          <CardHeader>
            <CardTitle>Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue ($)" />
                <Line yAxisId="right" type="monotone" dataKey="bookings" stroke="#3b82f6" name="Bookings" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.revenueByLocation.length > 0 && (
          <Card data-testid="card-revenue-by-location">
            <CardHeader>
              <CardTitle>Revenue by Location</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.revenueByLocation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {data.revenueBySpotType.length > 0 && (
          <Card data-testid="card-revenue-by-type">
            <CardHeader>
              <CardTitle>Revenue by Spot Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.revenueBySpotType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {data.topEarners.length > 0 && (
        <Card data-testid="card-top-earners">
          <CardHeader>
            <CardTitle>Top Earners</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Avg per Booking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topEarners.map((earner, index) => (
                  <TableRow key={earner.ownerName} data-testid={`row-earner-${index}`}>
                    <TableCell className="font-medium">{earner.ownerName}</TableCell>
                    <TableCell>${earner.totalEarnings.toFixed(2)}</TableCell>
                    <TableCell>{earner.bookingsCount}</TableCell>
                    <TableCell>
                      ${(earner.totalEarnings / earner.bookingsCount).toFixed(2)}
                    </TableCell>
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
