import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, ReferenceLine, ReferenceArea } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { ArrowLeft, BarChart3, ExternalLink, Layers, MapPin, ParkingSquare, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import type { ReportUtilizationResponse } from '@shared/schema';

interface UtilizationReportProps {
  data: ReportUtilizationResponse | undefined;
  isLoading: boolean;
  hideStatCards?: boolean;
  /** When provided, a vertical reference line is drawn at this date to mark "today" */
  todayStr?: string;
  /** When provided, drill-down calls are scoped to match the chart's scope filter */
  scope?: 'all' | 'bci';
}

interface DayBooking {
  id: string;
  renterName: string;
  spotNumber: string;
  locationName: string;
  status: string;
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

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function DayBookingsList({ date, scope, onBack }: { date: string; scope?: string; onBack: () => void }) {
  const params = new URLSearchParams({ date });
  if (scope && scope !== 'all') params.set('scope', scope);
  const { data, isLoading, isError } = useQuery<DayBooking[]>({
    queryKey: ['/api/admin/bookings/by-date', date, scope],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/by-date?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
  });

  return (
    <Card data-testid="card-day-bookings">
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap pb-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to chart">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <CardTitle className="text-base">{formatDisplayDate(date)}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">Bookings for this day</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-destructive py-8">Failed to load bookings. Please try again.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No bookings for this day.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Renter</TableHead>
                <TableHead>Spot</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.renterName}</TableCell>
                  <TableCell>{booking.spotNumber}</TableCell>
                  <TableCell className="text-muted-foreground">{booking.locationName}</TableCell>
                  <TableCell>
                    <span className="capitalize">{booking.status}</span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/bookings?bookingId=${booking.id}`}>
                      <Button variant="ghost" size="icon" title="View full booking details">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function UtilizationReport({ data, isLoading, hideStatCards = false, todayStr, scope }: UtilizationReportProps) {
  const colors = useChartColors();
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem('utilization-last-drilled-date') ?? todayStr ?? null;
    } catch {
      return todayStr ?? null;
    }
  });

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
    if (date) {
      try { localStorage.setItem('utilization-last-drilled-date', date); } catch {}
    }
  };

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
          const noData = d.bookedSpots === 0 && d.availableForSharing === 0 ? 1 : 0;
          return { ...d, occupancyRate, noData };
        });

        const dayCount = chartData.length;
        const tickInterval = dayCount <= 14 ? 0 : dayCount <= 44 ? 3 : dayCount <= 60 ? 6 : 14;

        const formatDate = (dateStr: string) => {
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const lastDate = chartData[chartData.length - 1]?.date ?? '';
        const showTodayLine = todayStr && lastDate > todayStr;
        const hasBookings = chartData.some((d) => d.bookedSpots > 0);

        const FORECAST_COLOR = 'hsl(38 92% 50%)';

        const NO_DATA_COLOR = 'hsl(var(--muted-foreground) / 0.18)';

        const legendItems = [
          { color: colors.chart1, label: 'Booked Spots' },
          { color: colors.chart3, label: 'Available for Sharing' },
          { color: colors.chart5, label: 'Occupancy Rate %' },
          { color: NO_DATA_COLOR, label: 'No Activity', isDashed: true },
          ...(showTodayLine ? [{ color: FORECAST_COLOR, label: 'Forecast', isArea: true }] : []),
        ];

        const CustomLegend = () => (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
            {legendItems.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                {item.isArea ? (
                  <span
                    style={{ backgroundColor: item.color, opacity: 0.35, border: `2px solid ${item.color}` }}
                    className="inline-block h-3 w-5 rounded-sm"
                  />
                ) : item.isDashed ? (
                  <span
                    style={{ backgroundColor: item.color, border: '1.5px dashed var(--muted-foreground)', borderOpacity: 0.35 }}
                    className="inline-block h-3 w-3 rounded-sm"
                  />
                ) : (
                  <span
                    style={{ backgroundColor: item.color }}
                    className="inline-block h-3 w-3 rounded-sm"
                  />
                )}
                {item.label}
              </span>
            ))}
          </div>
        );

        const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
          if (!active || !payload || !payload.length) return null;
          const booked = payload.find((p) => p.dataKey === 'bookedSpots')?.value ?? 0;
          const available = payload.find((p) => p.dataKey === 'availableForSharing')?.value ?? 0;
          const rate = payload.find((p) => p.dataKey === 'occupancyRate')?.value ?? 0;
          const noDataVal = payload.find((p) => p.dataKey === 'noData')?.value ?? 0;
          const isFuture = todayStr && label > todayStr;
          const isNoData = Number(noDataVal) > 0;
          return (
            <div className="bg-card border border-border rounded-md shadow-sm p-3 text-sm space-y-1">
              <p className="font-semibold text-card-foreground">
                {formatDate(label)}{isFuture ? ' (forecast)' : ''}
              </p>
              {isNoData ? (
                <p className="text-muted-foreground italic">No activity recorded</p>
              ) : (
                <>
                  <p style={{ color: colors.chart1 }}>Booked Spots: {booked}</p>
                  <p style={{ color: colors.chart3 }}>Available for Sharing: {available}</p>
                  <p style={{ color: colors.chart5 }}>Occupancy Rate: {rate}%</p>
                  {Number(booked) > 0 && <p className="text-xs text-muted-foreground pt-1">Click bar to see bookings</p>}
                </>
              )}
            </div>
          );
        };

        const handleBarClick = (barData: any) => {
          const payload = barData?.payload ?? barData;
          if (!payload?.bookedSpots) return;
          const date = payload?.date;
          if (date) handleDateSelect(date);
        };

        if (selectedDate) {
          return <DayBookingsList date={selectedDate} scope={scope} onBack={() => setSelectedDate(null)} />;
        }

        return (
          <Card data-testid="card-daily-occupancy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Occupancy Timeline
              </CardTitle>
              {hasBookings && (
                <p className="text-xs text-muted-foreground">Click a bar with bookings to see that day&apos;s details</p>
              )}
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 40, left: 0, bottom: 8 }}
                >
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
                  <Legend content={<CustomLegend />} />
                  {showTodayLine && (
                    <ReferenceArea
                      x1={todayStr}
                      x2={lastDate}
                      yAxisId="left"
                      fill="hsl(38 92% 50%)"
                      fillOpacity={0.08}
                      ifOverflow="visible"
                    />
                  )}
                  <Bar yAxisId="left" dataKey="noData" stackId="occupancy" name="noData" isAnimationActive={false} legendType="none">
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`nodata-${index}`}
                        fill={NO_DATA_COLOR}
                        cursor="default"
                        stroke="hsl(var(--muted-foreground) / 0.25)"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                      />
                    ))}
                  </Bar>
                  <Bar yAxisId="left" dataKey="bookedSpots" stackId="occupancy" fill={colors.chart1} name="bookedSpots" onClick={handleBarClick}>
                    {chartData.map((entry, index) => (
                      <Cell key={`booked-${index}`} fill={colors.chart1} cursor={entry.bookedSpots > 0 ? 'pointer' : 'default'} />
                    ))}
                  </Bar>
                  <Bar yAxisId="left" dataKey="availableForSharing" stackId="occupancy" fill={colors.chart3} name="availableForSharing" onClick={handleBarClick}>
                    {chartData.map((entry, index) => (
                      <Cell key={`avail-${index}`} fill={colors.chart3} cursor={entry.bookedSpots > 0 ? 'pointer' : 'default'} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="occupancyRate" stroke={colors.chart5} strokeWidth={2} dot={false} name="occupancyRate" />
                  {showTodayLine && (
                    <ReferenceLine
                      x={todayStr}
                      yAxisId="left"
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={2.5}
                      label={{
                        value: 'Today',
                        position: 'insideTopRight',
                        fontSize: 11,
                        fontWeight: 600,
                        fill: 'hsl(38 92% 50%)',
                        offset: 6,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
