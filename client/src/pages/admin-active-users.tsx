import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, FileSpreadsheet, Users, LogIn, Calendar, BookOpen } from 'lucide-react';
import { exportActiveUsersReport, type ActiveUsersReportData } from '@/utils/report-export';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getDefaultDates() {
  const now = new Date();
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: firstOfPrevMonth.toISOString().split('T')[0],
    to: lastOfPrevMonth.toISOString().split('T')[0]
  };
}

export default function AdminActiveUsersPage() {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [todayOnly, setTodayOnly] = useState(false);
  const [loginOpen, setLoginOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [bookOpen, setBookOpen] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const isDateRangeValid = Boolean(dateFrom && dateTo && dateFrom <= dateTo);

  const query = useQuery<ActiveUsersReportData>({
    queryKey: ['/api/admin/reports/active-users', dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const response = await fetch(`/api/admin/reports/active-users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch active users report');
      return response.json();
    },
    enabled: isDateRangeValid
  });

  const handleMonthSelect = (monthIndex: number) => {
    const year = new Date().getFullYear();
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    setDateFrom(first.toISOString().split('T')[0]);
    setDateTo(last.toISOString().split('T')[0]);
    setTodayOnly(false);
  };

  const displayedLoginUsers = todayOnly
    ? (query.data?.loggedInUsers || []).filter(u => {
        if (!u.lastLogin) return false;
        return u.lastLogin.startsWith(today);
      })
    : (query.data?.loggedInUsers || []);

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-active-users">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-active-users">
          Active Users
        </h1>
        <p className="text-muted-foreground mt-2">
          See who has been engaging with the system — logins, spot listings, and bookings.
        </p>
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

      {/* Summary Stats */}
      {query.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : query.data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="stat-bar">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Logins Today</p>
              <p className="text-2xl font-bold" data-testid="stat-logins-today">{query.data.summary.loginsToday}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Logins in Period</p>
              <p className="text-2xl font-bold" data-testid="stat-logins-period">{query.data.summary.loginsInPeriod}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Unique Listers</p>
              <p className="text-2xl font-bold" data-testid="stat-unique-listers">{query.data.summary.uniqueListers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Unique Bookers</p>
              <p className="text-2xl font-bold" data-testid="stat-unique-bookers">{query.data.summary.uniqueBookers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Listings Created</p>
              <p className="text-2xl font-bold" data-testid="stat-total-listings">{query.data.summary.totalListings}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Bookings Made</p>
              <p className="text-2xl font-bold" data-testid="stat-total-bookings">{query.data.summary.totalBookings}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Export Button */}
      {query.data && (
        <div className="flex justify-end">
          <Button
            onClick={() => exportActiveUsersReport(query.data!)}
            data-testid="btn-export-active-users"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      )}

      {/* Logged In Section */}
      <Card data-testid="section-logged-in">
        <CardHeader
          className="cursor-pointer flex flex-row items-center justify-between gap-2 flex-wrap"
          onClick={() => setLoginOpen(o => !o)}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            {loginOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <LogIn className="h-4 w-4" />
            Logged In
            {query.data && (
              <Badge variant="secondary">{displayedLoginUsers.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant={todayOnly ? 'default' : 'outline'}
            size="sm"
            onClick={(e) => { e.stopPropagation(); setTodayOnly(o => !o); }}
            data-testid="btn-today-only"
          >
            Today only
          </Button>
        </CardHeader>
        {loginOpen && (
          <CardContent>
            {query.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : displayedLoginUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-logged-in">
                No users logged in during the selected period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedLoginUsers.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Listed Spots Section */}
      <Card data-testid="section-listed-spots">
        <CardHeader
          className="cursor-pointer flex flex-row items-center gap-2 flex-wrap"
          onClick={() => setListOpen(o => !o)}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            {listOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Calendar className="h-4 w-4" />
            Listed Spots
            {query.data && (
              <Badge variant="secondary">{query.data.listedSpotUsers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        {listOpen && (
          <CardContent>
            {query.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !query.data || query.data.listedSpotUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-listed-spots">
                No users listed spots during the selected period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Listings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.listedSpotUsers.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell className="text-right font-semibold">{u.listingCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Booked Spots Section */}
      <Card data-testid="section-booked-spots">
        <CardHeader
          className="cursor-pointer flex flex-row items-center gap-2 flex-wrap"
          onClick={() => setBookOpen(o => !o)}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            {bookOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BookOpen className="h-4 w-4" />
            Booked Spots
            {query.data && (
              <Badge variant="secondary">{query.data.bookedSpotUsers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        {bookOpen && (
          <CardContent>
            {query.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !query.data || query.data.bookedSpotUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-booked-spots">
                No users booked spots during the selected period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.bookedSpotUsers.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.department}</TableCell>
                      <TableCell className="text-right font-semibold">{u.bookingCount}</TableCell>
                      <TableCell className="text-right font-semibold">${u.totalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
