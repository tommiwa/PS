import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Layers, 
  Calendar, 
  DollarSign, 
  Users, 
  ListOrdered, 
  TrendingUp,
  Clock,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import type { ReportOverviewResponse } from '@shared/schema';

interface OverviewReportProps {
  data: ReportOverviewResponse | undefined;
  isLoading: boolean;
}

export function OverviewReport({ data, isLoading }: OverviewReportProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-32 mt-2" />
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
      title: 'Total Spots',
      value: data.summary.totalSpots,
      icon: Layers,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Active Bookings',
      value: data.summary.activeBookings,
      icon: Calendar,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Total Revenue',
      value: `$${data.summary.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      title: 'Active Users',
      value: data.summary.activeUsers,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Waitlist Count',
      value: data.summary.waitlistCount,
      icon: ListOrdered,
      color: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: 'Utilization Rate',
      value: `${data.summary.utilizationRate.toFixed(2)}%`,
      icon: TrendingUp,
      color: 'text-cyan-600 dark:text-cyan-400'
    }
  ];

  const quickStatsCards = [
    {
      title: 'Today Bookings',
      value: data.quickStats.todayBookings,
      icon: Clock,
      color: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      title: 'This Week Revenue',
      value: `$${data.quickStats.thisWeekRevenue.toFixed(2)}`,
      icon: CreditCard,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Pending Payments',
      value: data.quickStats.pendingPayments,
      icon: DollarSign,
      color: 'text-yellow-600 dark:text-yellow-400'
    },
    {
      title: 'Active Disputes',
      value: data.quickStats.activeDisputes,
      icon: AlertTriangle,
      color: data.quickStats.activeDisputes > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
    }
  ];

  return (
    <div className="space-y-8" data-testid="overview-report">
      <div>
        <h3 className="text-lg font-semibold mb-4">Summary Metrics</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
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
        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickStatsCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} data-testid={`card-quick-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={`value-quick-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {card.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
