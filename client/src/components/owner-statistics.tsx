import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ComposedChart, BarChart, Bar, Line, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer
} from "recharts"
import {
  TrendingUp, DollarSign, Calendar, Target, AlertTriangle,
  Users, Clock, Download, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  Car, MapPin, BarChart3, Award
} from "lucide-react"
import type {
  OwnerStatisticsV2Response,
  OwnerStatsPeriod,
  OwnerStatsStatus,
  OwnerSpotPerformance,
  OwnerBookingCSVRow,
  OwnerSharingRank,
} from "@shared/schema"
import { useQueryClient } from "@tanstack/react-query"

const PERIOD_OPTIONS: { value: OwnerStatsPeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: '6months', label: 'Last 6 Months' },
  { value: 'year', label: 'This Year' },
  { value: 'lastyear', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

const todayStr = () => new Date().toISOString().split('T')[0]
const thirtyDaysAgoStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}

const STATUS_OPTIONS: { value: OwnerStatsStatus; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'received', label: 'Received' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'hsl(var(--chart-1))',
  completed: 'hsl(var(--chart-2))',
  paid: 'hsl(var(--chart-2))',
  received: 'hsl(142, 71%, 45%)',
  pending: 'hsl(var(--chart-4))',
  cancelled: 'hsl(var(--chart-3))',
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

type NumericSortKey = keyof Pick<OwnerSpotPerformance, 'totalBookings' | 'totalIncome' | 'occupancyRate' | 'avgBookingValue' | 'cancellationRate'>
type StringSortKey = 'spotNumber' | 'locationName'
type SortKey = NumericSortKey | StringSortKey
type SortDir = 'asc' | 'desc'
const STRING_SORT_KEYS: StringSortKey[] = ['spotNumber', 'locationName']

export function OwnerStatistics() {
  const queryClient = useQueryClient()

  const [period, setPeriod] = useState<OwnerStatsPeriod>('month')
  // Multi-select statuses: empty set = 'all'
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OwnerStatsStatus>>(new Set())
  const [spotId, setSpotId] = useState<string>('all')
  const [customStart, setCustomStart] = useState<string>(thirtyDaysAgoStr())
  const [customEnd, setCustomEnd] = useState<string>(todayStr())
  const [showPrevPeriod, setShowPrevPeriod] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('totalIncome')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeTab, setActiveTab] = useState('earnings')

  const isCustom = period === 'custom'
  // Build the comma-separated status param for the API
  const SELECTABLE_STATUSES = STATUS_OPTIONS.filter(o => o.value !== 'all')
  const selectedStatusArray = Array.from(selectedStatuses)
  const statusParam = selectedStatusArray.length === 0 ? 'all' : selectedStatusArray.join(',')
  const statusLabel = selectedStatusArray.length === 0
    ? 'All Statuses'
    : selectedStatusArray.length === 1
      ? STATUS_OPTIONS.find(o => o.value === selectedStatusArray[0])?.label ?? 'Filtered'
      : `${selectedStatusArray.length} statuses`

  const toggleStatus = (s: OwnerStatsStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) { next.delete(s) } else { next.add(s) }
      return next
    })
  }

  const queryParams = { period, status: statusParam, spotId, ...(isCustom ? { startDate: customStart, endDate: customEnd } : {}) }

  const { data: sharingRank, isLoading: rankLoading } = useQuery<OwnerSharingRank>({
    queryKey: ['/api/owner/sharing-rank'],
    queryFn: async () => {
      const res = await fetch('/api/owner/sharing-rank', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch sharing rank')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading, error, refetch } = useQuery<OwnerStatisticsV2Response>({
    queryKey: ['/api/owner/statistics/v2', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams({ period, status: statusParam })
      if (spotId !== 'all') params.set('spotId', spotId)
      if (isCustom && customStart && customEnd) {
        params.set('startDate', customStart)
        params.set('endDate', customEnd)
      }
      const res = await fetch(`/api/owner/statistics/v2?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch owner statistics')
      return res.json()
    },
    enabled: !isCustom || (customStart <= customEnd),
    staleTime: 3 * 60 * 1000,
  })

  // Merge current + prev period trends into one array (index-aligned) for ComposedChart
  const mergedIncomeTrend = useMemo(() => {
    if (!data?.incomeTrend) return []
    return data.incomeTrend.map((point, i) => ({
      ...point,
      prevEarned: data.prevPeriodTrend[i]?.earned ?? null,
    }))
  }, [data?.incomeTrend, data?.prevPeriodTrend])

  const uniqueRentersCount = useMemo(() => {
    if (!data?.filteredBookingsCSV) return 0
    return new Set(data.filteredBookingsCSV.map(b => b.renterEmail)).size
  }, [data?.filteredBookingsCSV])

  const sortedSpotPerformance = useMemo(() => {
    if (!data?.spotPerformance) return []
    return [...data.spotPerformance].sort((a, b) => {
      if ((STRING_SORT_KEYS as string[]).includes(sortKey)) {
        const va = (a[sortKey as StringSortKey] ?? '').toString()
        const vb = (b[sortKey as StringSortKey] ?? '').toString()
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const va = a[sortKey as NumericSortKey]
      const vb = b[sortKey as NumericSortKey]
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [data?.spotPerformance, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-50" />
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
  }

  const handleExportCSV = () => {
    if (!data) return
    const rows = data.filteredBookingsCSV.map((b: OwnerBookingCSVRow) => [
      b.bookingDate,
      b.spotNumber,
      b.locationName,
      b.amount.toFixed(2),
    ])
    const csv = [
      [`Period: ${data.periodLabel}`],
      [],
      ['Date', 'Spot', 'Location', 'Amount'],
      ...rows,
    ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showSpotDropdown = (data?.ownedSpots?.length ?? 0) >= 2
  const showPerSpotTable = spotId === 'all' && (data?.ownedSpots?.length ?? 0) >= 2

  if (error) {
    return (
      <Card data-testid="card-owner-stats-error">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Failed to load statistics</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6" data-testid="owner-statistics">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2" data-testid="owner-filter-bar">
        <Select value={period} onValueChange={v => setPeriod(v as OwnerStatsPeriod)}>
          <SelectTrigger className="w-44" data-testid="select-owner-period">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeTab === 'earnings' && <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-44 justify-between font-normal"
              data-testid="select-owner-status"
            >
              <span className="truncate">{statusLabel}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              <button
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover-elevate"
                onClick={() => setSelectedStatuses(new Set())}
              >
                <div className={`h-4 w-4 rounded border flex items-center justify-center ${selectedStatuses.size === 0 ? 'bg-primary border-primary' : 'border-input'}`}>
                  {selectedStatuses.size === 0 && <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                All Statuses
              </button>
              <div className="h-px bg-border my-1" />
              {SELECTABLE_STATUSES.map(o => (
                <button
                  key={o.value}
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover-elevate"
                  onClick={() => toggleStatus(o.value as OwnerStatsStatus)}
                >
                  <Checkbox
                    checked={selectedStatuses.has(o.value as OwnerStatsStatus)}
                    onCheckedChange={() => toggleStatus(o.value as OwnerStatsStatus)}
                    className="pointer-events-none"
                  />
                  {o.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>}

        {isCustom && (
          <>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-custom-start"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayStr()}
              onChange={e => setCustomEnd(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-custom-end"
            />
          </>
        )}

        {activeTab === 'earnings' && showSpotDropdown && (
          <Select value={spotId} onValueChange={setSpotId}>
            <SelectTrigger className="w-52" data-testid="select-owner-spot">
              <SelectValue placeholder="All Spots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Spots</SelectItem>
              {data?.ownedSpots.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.spotNumber} – {s.locationName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="default"
          onClick={handleExportCSV}
          disabled={!data}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="default"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/owner/statistics/v2'] })
            queryClient.invalidateQueries({ queryKey: ['/api/owner/sharing-rank'] })
          }}
          data-testid="button-refresh-stats"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="owner-stats-tabs">
        <TabsList>
          <TabsTrigger value="earnings" data-testid="tab-earnings">My Spots Earnings</TabsTrigger>
          <TabsTrigger value="renter" data-testid="tab-renter">As Renter</TabsTrigger>
        </TabsList>

        {/* ── EARNINGS TAB ── */}
        <TabsContent value="earnings" className="space-y-6 mt-4">

          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="kpi-skeleton">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="kpi-cards">
              <KpiCard
                title="Total Income"
                value={fmt(data.totalIncome)}
                sub={`${data.totalBookings} booking${data.totalBookings !== 1 ? 's' : ''}`}
                icon={<DollarSign className="h-4 w-4" />}
                variant="positive"
                testId="kpi-total-income"
              />
              <KpiCard
                title="Total Bookings"
                value={String(data.totalBookings)}
                sub={data.periodLabel}
                icon={<Calendar className="h-4 w-4" />}
                variant="neutral"
                testId="kpi-total-bookings"
              />
              <KpiCard
                title="Occupancy Rate"
                value={`${data.occupancyRate}%`}
                sub="of available days booked"
                icon={<Target className="h-4 w-4" />}
                variant="positive"
                testId="kpi-occupancy"
              />
              <KpiCard
                title="Avg Booking Value"
                value={fmt(data.avgBookingValue)}
                sub="per paid booking"
                icon={<TrendingUp className="h-4 w-4" />}
                variant="neutral"
                testId="kpi-avg-value"
              />
              <KpiCard
                title="Upcoming Revenue"
                value={fmt(data.upcomingRevenue)}
                sub="confirmed, not yet paid"
                icon={<Clock className="h-4 w-4" />}
                variant="info"
                testId="kpi-upcoming"
              />
              <KpiCard
                title="Unique Renters"
                value={String(uniqueRentersCount)}
                sub="people who parked with you"
                icon={<Users className="h-4 w-4" />}
                variant="positive"
                testId="kpi-unique-renters"
              />
            </div>
          ) : null}

          {/* Sharing Rank Widget */}
          <SharingRankWidget data={sharingRank ?? null} isLoading={rankLoading} />

          {/* Income Trend + Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-income-trend">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Income Trend
                    {data && <span className="text-sm font-normal text-muted-foreground ml-1">— {data.periodLabel}</span>}
                  </CardTitle>
                  <Button
                    variant={showPrevPeriod ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowPrevPeriod(v => !v)}
                    data-testid="button-toggle-prev-period"
                  >
                    vs Prev Period
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64" />
                ) : data ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={mergedIncomeTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <RechartsTooltip {...tooltipStyle} formatter={(v: number | string) => v == null ? '–' : `$${Number(v).toFixed(2)}`} />
                        <Legend />
                        <Bar dataKey="earned" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Earned ($)" />
                        <Bar dataKey="cancelled" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} name="Cancelled ($)" />
                        {showPrevPeriod && data.prevPeriodTrend.length > 0 && (
                          <Line
                            type="monotone"
                            dataKey="prevEarned"
                            stroke="hsl(var(--chart-4))"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            name="Prev Period ($)"
                            connectNulls={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card data-testid="card-status-breakdown">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Booking Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64" />
                ) : data ? (
                  data.statusBreakdown.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                      No bookings in this period
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={data.statusBreakdown}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {data.statusBreakdown.map((entry, i) => (
                              <Cell
                                key={entry.status}
                                fill={STATUS_COLORS[entry.status] || `hsl(var(--chart-${(i % 4) + 1}))`}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            {...tooltipStyle}
                            formatter={(v: number, name: string) => [v, name.charAt(0).toUpperCase() + name.slice(1)]}
                          />
                          <Legend formatter={v => v.charAt(0).toUpperCase() + v.slice(1)} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Day-of-week + Top Renters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-day-of-week">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Day-of-Week Popularity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48" />
                ) : data ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dayOfWeekData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="shortDay" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                        <RechartsTooltip {...tooltipStyle} formatter={(v: number) => [v, 'Bookings']} />
                        <Bar dataKey="bookings" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Bookings" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card data-testid="card-top-renters">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Top Renters
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                  </div>
                ) : data ? (
                  data.topRenters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No renters in this period</p>
                  ) : (
                    <div className="space-y-2">
                      {data.topRenters.map((renter, i) => (
                        <div key={renter.userId} className="flex items-center justify-between gap-2 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{renter.name || renter.email}</p>
                              {renter.name && <p className="text-xs text-muted-foreground truncate">{renter.email}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary">{renter.bookingCount} booking{renter.bookingCount !== 1 ? 's' : ''}</Badge>
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400">{fmt(renter.totalPaid)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Per-spot performance table */}
          {showPerSpotTable && (
            <Card data-testid="card-spot-performance">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Per-Spot Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <SortableTh col="spotNumber" label="Spot" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="spotNumber" />} />
                          <SortableTh col="locationName" label="Location" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="locationName" />} />
                          <SortableTh col="totalBookings" label="Bookings" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="totalBookings" />} />
                          <SortableTh col="totalIncome" label="Income" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="totalIncome" />} />
                          <SortableTh col="occupancyRate" label="Occupancy" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="occupancyRate" />} />
                          <SortableTh col="avgBookingValue" label="Avg Value" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="avgBookingValue" />} />
                          <SortableTh col="cancellationRate" label="Cancel Rate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} icon={<SortIcon col="cancellationRate" />} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSpotPerformance.map((s, i) => (
                          <tr key={s.spotId} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                            <td className="px-4 py-3 font-medium">{s.spotNumber}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{s.locationName}</td>
                            <td className="px-4 py-3 text-center">{s.totalBookings}</td>
                            <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">{fmt(s.totalIncome)}</td>
                            <td className="px-4 py-3 text-center">{s.occupancyRate}%</td>
                            <td className="px-4 py-3">{fmt(s.avgBookingValue)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={s.cancellationRate > 20 ? 'text-destructive font-medium' : ''}>
                                {s.cancellationRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {sortedSpotPerformance.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No spot data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── AS RENTER TAB ── */}
        <TabsContent value="renter" className="space-y-6 mt-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : data ? (
            data.renterSummary.bookingCount === 0 ? (
              <Card data-testid="card-renter-empty">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <MapPin className="h-12 w-12 text-muted-foreground/50" />
                  <div className="text-center">
                    <p className="font-medium text-lg">No renter activity in this period</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You haven't booked any spots during {data.periodLabel}.
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="/search">Find Parking</a>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard
                    title="Total Spent"
                    value={fmt(data.renterSummary.totalSpent)}
                    sub={data.periodLabel}
                    icon={<DollarSign className="h-4 w-4" />}
                    variant="neutral"
                    testId="kpi-renter-spent"
                  />
                  <KpiCard
                    title="Total Bookings"
                    value={String(data.renterSummary.bookingCount)}
                    sub="as renter"
                    icon={<Calendar className="h-4 w-4" />}
                    variant="neutral"
                    testId="kpi-renter-bookings"
                  />
                  <KpiCard
                    title="Avg per Booking"
                    value={data.renterSummary.bookingCount > 0
                      ? fmt(data.renterSummary.totalSpent / data.renterSummary.bookingCount)
                      : '$0.00'}
                    sub="average spend"
                    icon={<TrendingUp className="h-4 w-4" />}
                    variant="neutral"
                    testId="kpi-renter-avg"
                  />
                </div>

                <Card data-testid="card-renter-spending-trend">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Spending Trend — {data.periodLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.renterSummary.spendingTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <RechartsTooltip {...tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spent']} />
                          <Bar dataKey="spent" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Spent ($)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </>
            )
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------- Sharing Rank Widget ----------
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function SharingRankWidget({ data, isLoading }: { data: OwnerSharingRank | null; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-16 w-full" data-testid="sharing-rank-skeleton" />
  }

  if (!data) return null

  const hasListings = data.rank !== null && data.totalListedDays > 0

  return (
    <div
      className="flex items-center gap-4 rounded-md border bg-muted/30 px-5 py-3"
      data-testid="sharing-rank-widget"
    >
      <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
        <Award className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        {hasListings ? (
          <>
            <p className="text-sm font-semibold leading-tight">
              Sharing Rank: {ordinal(data.rank!)} out of {data.totalOwners} owner{data.totalOwners !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.rank === 1
                ? 'You are ranked #1 — thank you for sharing your spot with your colleagues!'
                : `You've listed ${data.totalListedDays} spot-day${data.totalListedDays !== 1 ? 's' : ''} — thank you for sharing your spot with your colleagues!`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold leading-tight">Sharing Leaderboard</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              List your spot to join the sharing leaderboard!
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- KPI Card ----------
interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  variant: 'positive' | 'neutral' | 'info' | 'attention'
  testId?: string
}

function KpiCard({ title, value, sub, icon, variant, testId }: KpiCardProps) {
  const iconBg = {
    positive: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    neutral: 'bg-primary/10 text-primary',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    attention: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  }[variant]

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold leading-tight">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ---------- Sortable Table Header ----------
function SortableTh({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  icon,
}: {
  col: SortKey
  label: string
  sortKey: SortKey
  sortDir: SortDir
  onSort: (col: SortKey) => void
  icon: React.ReactNode
}) {
  return (
    <th
      className="px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {icon}
      </div>
    </th>
  )
}
