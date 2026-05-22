import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Trophy, Crown, Users, FileSpreadsheet, Medal, CalendarCheck, DollarSign, TrendingUp, UserCheck, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getDefaultDates() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: first.toISOString().split('T')[0],
    to: last.toISOString().split('T')[0]
  };
}

interface RenterRanking {
  rank: number;
  userId: string;
  name: string;
  email: string;
  department: string;
  bookingCount: number;
  totalAmount: number;
}

interface OwnerRanking {
  rank: number;
  userId: string;
  name: string;
  email: string;
  department: string;
  bookingCount: number;
  totalEarnings: number;
}

interface RankingsResponse<T> {
  rankings: T[];
  dateRange: { from: string; to: string };
  generatedAt: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 font-bold text-sm border border-yellow-300 dark:border-yellow-700">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold text-sm border border-slate-300 dark:border-slate-500">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold text-sm border border-orange-300 dark:border-orange-700">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground font-medium text-sm">
      {rank}
    </span>
  );
}

async function exportRenterRankings(
  rankings: RenterRanking[],
  dateRange: { from: string; to: string }
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Renter Rankings');

  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = 'BCI ParkShare — Renter Rankings';
  title.font = { bold: true, size: 16 };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Date Range: ${dateRange.from} to ${dateRange.to}`;
  sheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.addRow([]);

  const header = sheet.addRow(['Rank', 'Name', 'Email', 'Department', 'Bookings', 'Total Paid']);
  header.font = { bold: true };
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  rankings.forEach(r => {
    sheet.addRow([r.rank, r.name, r.email, r.department, r.bookingCount, `$${r.totalAmount.toFixed(2)}`]);
  });

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 32;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 15;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `renter-rankings-${dateRange.from}-to-${dateRange.to}.xlsx`);
}

async function exportOwnerRankings(
  rankings: OwnerRanking[],
  dateRange: { from: string; to: string }
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Owner Rankings');

  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = 'BCI ParkShare — Owner Rankings (Peer-to-Peer)';
  title.font = { bold: true, size: 16 };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Date Range: ${dateRange.from} to ${dateRange.to}`;
  sheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.addRow([]);

  const header = sheet.addRow(['Rank', 'Name', 'Email', 'Department', 'Bookings Fulfilled', 'Total Earnings']);
  header.font = { bold: true };
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  rankings.forEach(r => {
    sheet.addRow([r.rank, r.name, r.email, r.department, r.bookingCount, `$${r.totalEarnings.toFixed(2)}`]);
  });

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 28;
  sheet.getColumn(3).width = 32;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 20;
  sheet.getColumn(6).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `owner-rankings-${dateRange.from}-to-${dateRange.to}.xlsx`);
}

export default function AdminLeaderboardPage() {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const currentYear = new Date().getFullYear();
  const isDateRangeValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo);

  const renterQuery = useQuery<RankingsResponse<RenterRanking>>({
    queryKey: ['/api/admin/rankings/renters', { from: dateFrom, to: dateTo }],
    enabled: isDateRangeValid
  });

  const ownerQuery = useQuery<RankingsResponse<OwnerRanking>>({
    queryKey: ['/api/admin/rankings/owners', { from: dateFrom, to: dateTo }],
    enabled: isDateRangeValid
  });

  const isRefreshing = renterQuery.isFetching || ownerQuery.isFetching;

  const handleRefresh = () => {
    renterQuery.refetch();
    ownerQuery.refetch();
  };

  const handleMonthSelect = (monthIndex: number) => {
    const first = new Date(currentYear, monthIndex, 1);
    const last = new Date(currentYear, monthIndex + 1, 0);
    setDateFrom(first.toISOString().split('T')[0]);
    setDateTo(last.toISOString().split('T')[0]);
  };

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-leaderboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="heading-leaderboard">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Parking Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Renter and owner rankings for the selected period.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={!isDateRangeValid || isRefreshing}
          data-testid="btn-refresh-leaderboard"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Date Range Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                data-testid="input-date-to"
              />
            </div>
          </div>

          {/* Month Quick Selector */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">{currentYear} — Quick month select</Label>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month, i) => {
                const first = new Date(currentYear, i, 1).toISOString().split('T')[0];
                const last = new Date(currentYear, i + 1, 0).toISOString().split('T')[0];
                const isActive = dateFrom === first && dateTo === last;
                return (
                  <Button
                    key={month}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMonthSelect(i)}
                    data-testid={`btn-month-${month.toLowerCase()}`}
                  >
                    {month}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stat Cards */}
      {isDateRangeValid && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="leaderboard-summary-stats">
          {/* Total Bookings */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  {renterQuery.isLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1" data-testid="stat-total-bookings">
                      {renterQuery.data
                        ? renterQuery.data.rankings.reduce((sum, r) => sum + r.bookingCount, 0)
                        : 0}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">confirmed &amp; completed</p>
                </div>
                <CalendarCheck className="h-8 w-8 text-muted-foreground/40 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Total Spend (Renters) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  {renterQuery.isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1" data-testid="stat-total-spend">
                      ${renterQuery.data
                        ? renterQuery.data.rankings.reduce((sum, r) => sum + r.totalAmount, 0).toFixed(2)
                        : '0.00'}
                    </p>
                  )}
                  {renterQuery.isLoading ? (
                    <Skeleton className="h-3 w-28 mt-1" />
                  ) : renterQuery.data && renterQuery.data.rankings.length > 0 ? (
                    (() => {
                      const topSpender = renterQuery.data.rankings.reduce((best, r) =>
                        r.totalAmount > best.totalAmount ? r : best
                      );
                      return (
                        <p className="text-xs text-muted-foreground mt-1 truncate" data-testid="stat-top-spender-name">
                          <span className="font-medium text-foreground">{topSpender.name}</span>
                          {' '}leads with ${topSpender.totalAmount.toFixed(2)}
                        </p>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">by renters in period</p>
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground/40 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Total P2P Revenue (Owners) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">P2P Revenue</p>
                  {ownerQuery.isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1" data-testid="stat-p2p-revenue">
                      ${ownerQuery.data
                        ? ownerQuery.data.rankings.reduce((sum, r) => sum + r.totalEarnings, 0).toFixed(2)
                        : '0.00'}
                    </p>
                  )}
                  {ownerQuery.isLoading ? (
                    <Skeleton className="h-3 w-28 mt-1" />
                  ) : ownerQuery.data && ownerQuery.data.rankings.length > 0 ? (
                    (() => {
                      const topEarner = ownerQuery.data.rankings.reduce((best, r) =>
                        r.totalEarnings > best.totalEarnings ? r : best
                      );
                      return (
                        <p className="text-xs text-muted-foreground mt-1 truncate" data-testid="stat-top-earner-name">
                          <span className="font-medium text-foreground">{topEarner.name}</span>
                          {' '}leads with ${topEarner.totalEarnings.toFixed(2)}
                        </p>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">earned by spot owners</p>
                  )}
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/40 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Unique Participants */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Participants</p>
                  {renterQuery.isLoading && ownerQuery.isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1" data-testid="stat-participants">
                      {(() => {
                        const ids = new Set<string>();
                        renterQuery.data?.rankings.forEach(r => ids.add(r.userId));
                        ownerQuery.data?.rankings.forEach(r => ids.add(r.userId));
                        return ids.size;
                      })()}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">unique users active</p>
                </div>
                <UserCheck className="h-8 w-8 text-muted-foreground/40 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Tabs */}
      <Tabs defaultValue="renters" className="w-full">
        <TabsList>
          <TabsTrigger value="renters" className="gap-2">
            <Users className="h-4 w-4" />
            Renter Rankings
            {renterQuery.data && (
              <Badge variant="secondary" className="ml-1">{renterQuery.data.rankings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2">
            <Medal className="h-4 w-4" />
            Owner Rankings
            {ownerQuery.data && (
              <Badge variant="secondary" className="ml-1">{ownerQuery.data.rankings.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Renter Rankings Tab */}
        <TabsContent value="renters" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {renterQuery.data && renterQuery.data.rankings.length > 0 && (
              <Button
                onClick={() => exportRenterRankings(renterQuery.data!.rankings, renterQuery.data!.dateRange)}
                data-testid="btn-export-renter-rankings"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
            )}
          </div>

          {!isDateRangeValid ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a valid date range to view rankings.
              </CardContent>
            </Card>
          ) : renterQuery.isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : renterQuery.data ? (
            <Card data-testid="table-renter-rankings">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Top Renters
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    by confirmed &amp; completed bookings
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renterQuery.data.rankings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="empty-renter-rankings">
                    No confirmed or completed bookings found for the selected period.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Rank</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renterQuery.data.rankings.map((r) => (
                        <TableRow
                          key={r.userId}
                          className={
                            r.rank === 1
                              ? 'bg-amber-50 dark:bg-amber-950/30'
                              : r.rank <= 3
                              ? 'bg-muted/30'
                              : ''
                          }
                          data-testid={`row-renter-rank-${r.rank}`}
                        >
                          <TableCell>
                            <RankBadge rank={r.rank} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.rank === 1 && (
                              <Crown className="inline-block w-4 h-4 text-amber-500 mr-1.5 mb-0.5" />
                            )}
                            {r.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.department}</TableCell>
                          <TableCell className="text-right font-semibold">{r.bookingCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${r.totalAmount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Owner Rankings Tab */}
        <TabsContent value="owners" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {ownerQuery.data && ownerQuery.data.rankings.length > 0 && (
              <Button
                onClick={() => exportOwnerRankings(ownerQuery.data!.rankings, ownerQuery.data!.dateRange)}
                data-testid="btn-export-owner-rankings"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
            )}
          </div>

          {!isDateRangeValid ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a valid date range to view rankings.
              </CardContent>
            </Card>
          ) : ownerQuery.isLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : ownerQuery.data ? (
            <Card data-testid="table-owner-rankings">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Medal className="h-5 w-5 text-primary" />
                  Top Spot Owners
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    peer-to-peer bookings only
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ownerQuery.data.rankings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="empty-owner-rankings">
                    No peer-to-peer bookings found for the selected period.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Rank</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Bookings Fulfilled</TableHead>
                        <TableHead className="text-right">Total Earnings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownerQuery.data.rankings.map((r) => (
                        <TableRow
                          key={r.userId}
                          className={
                            r.rank === 1
                              ? 'bg-amber-50 dark:bg-amber-950/30'
                              : r.rank <= 3
                              ? 'bg-muted/30'
                              : ''
                          }
                          data-testid={`row-owner-rank-${r.rank}`}
                        >
                          <TableCell>
                            <RankBadge rank={r.rank} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.rank === 1 && (
                              <Crown className="inline-block w-4 h-4 text-amber-500 mr-1.5 mb-0.5" />
                            )}
                            {r.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.department}</TableCell>
                          <TableCell className="text-right font-semibold">{r.bookingCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${r.totalEarnings.toFixed(2)}
                          </TableCell>
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
    </div>
  );
}
