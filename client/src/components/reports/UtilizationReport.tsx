import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { BarChart3, Layers, MapPin, ParkingSquare, TrendingUp } from 'lucide-react';
import type { ReportUtilizationResponse } from '@shared/schema';

interface UtilizationReportProps {
  data: ReportUtilizationResponse | undefined;
  isLoading: boolean;
  hideStatCards?: boolean;
}

function getCssVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : '';
}

function useChartColors() {
  return useMemo(() => ({
    chart1: getCssVar('--chart-1'),
    chart2: getCssVar('--chart-2'),
    chart3: getCssVar('--chart-3'),
    chart4: getCssVar('--chart-4'),
    chart5: getCssVar('--chart-5'),
    muted: getCssVar('--muted-foreground'),
    border: getCssVar('--border'),
  }), []);
}

export function UtilizationReport({ data, isLoading, hideStatCards = false }: UtilizationReportProps) {
  const colors = useChartColors();

  const COLORS = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {!hideStatCards && (
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
        )}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  const usageCards = [
    {
      title: 'Total Spots',
      value: data.spotUsage.totalSpots,
      icon: Layers,
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Allocated Spots',
      value: data.spotUsage.allocatedSpots,
      icon: ParkingSquare,
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Bookable Spots',
      value: data.spotUsage.bookableSpots,
      icon: MapPin,
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Utilization Rate',
      value: `${data.spotUsage.utilizationRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-cyan-600 dark:text-cyan-400'
    }
  ];

  return (
    <div className="space-y-6" data-testid="utilization-report">
      {!hideStatCards && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {usageCards.map((card) => {
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
      )}

      {data.locationBreakdown.length > 0 && (
        <Card data-testid="card-location-breakdown">
          <CardHeader>
            <CardTitle>Location Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.locationBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} tick={{ fill: colors.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: colors.muted, fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: getCssVar('--card'),
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: getCssVar('--card-foreground'),
                  }}
                />
                <Legend />
                <Bar dataKey="totalSpots" fill={colors.chart1} name="Total Spots" />
                <Bar dataKey="occupiedSpots" fill={colors.chart2} name="Occupied" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {data.spotTypeBreakdown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-spot-type-chart">
            <CardHeader>
              <CardTitle>Spot Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={data.spotTypeBreakdown}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {data.spotTypeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: getCssVar('--card'),
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: getCssVar('--card-foreground'),
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-spot-type-table">
            <CardHeader>
              <CardTitle>Utilization by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Booked</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.spotTypeBreakdown.map((type) => (
                    <TableRow key={type.type} data-testid={`row-spot-type-${type.type}`}>
                      <TableCell className="font-medium">{type.type}</TableCell>
                      <TableCell>{type.count}</TableCell>
                      <TableCell>{type.bookedCount}</TableCell>
                      <TableCell>{type.utilizationRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {data.dailyOccupancy.length > 0 && (() => {
        const chartData = data.dailyOccupancy.map((d) => {
          const total = d.bookedSpots + d.availableForSharing;
          const occupancyRate = total > 0 ? parseFloat(((d.bookedSpots / total) * 100).toFixed(1)) : 0;
          return { ...d, occupancyRate };
        });

        const dayCount = chartData.length;
        const tickInterval = dayCount <= 14 ? 0 : dayCount <= 60 ? 6 : 14;

        const formatDate = (dateStr: string) => {
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
          if (!active || !payload || !payload.length) return null;
          const booked = payload.find((p) => p.dataKey === 'bookedSpots')?.value ?? 0;
          const available = payload.find((p) => p.dataKey === 'availableForSharing')?.value ?? 0;
          const rate = payload.find((p) => p.dataKey === 'occupancyRate')?.value ?? 0;
          return (
            <div className="bg-card border border-border rounded-md shadow-sm p-3 text-sm space-y-1">
              <p className="font-semibold text-card-foreground">{formatDate(label)}</p>
              <p style={{ color: colors.chart1 }}>Booked Spots: {booked}</p>
              <p style={{ color: colors.chart3 }}>Available for Sharing: {available}</p>
              <p style={{ color: colors.chart5 }}>Occupancy Rate: {rate}%</p>
            </div>
          );
        };

        return (
          <Card data-testid="card-daily-occupancy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Occupancy Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    interval={tickInterval}
                    tick={{ fontSize: 12, fill: colors.muted }}
                  />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fill: colors.muted }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 12, fill: colors.muted }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) =>
                      value === 'bookedSpots'
                        ? 'Booked Spots'
                        : value === 'availableForSharing'
                        ? 'Available for Sharing'
                        : 'Occupancy Rate %'
                    }
                  />
                  <Bar yAxisId="left" dataKey="bookedSpots" stackId="occupancy" fill={colors.chart1} name="bookedSpots" />
                  <Bar yAxisId="left" dataKey="availableForSharing" stackId="occupancy" fill={colors.chart3} name="availableForSharing" />
                  <Line yAxisId="right" type="monotone" dataKey="occupancyRate" stroke={colors.chart5} strokeWidth={2} dot={false} name="occupancyRate" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
