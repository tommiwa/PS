import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportFilters, type ReportScope } from '@/components/reports/useReportFilters';
import { OverviewReport } from '@/components/reports/OverviewReport';
import { UtilizationReport } from '@/components/reports/UtilizationReport';
import { RevenueReport } from '@/components/reports/RevenueReport';
import { UserComplianceReport } from '@/components/reports/UserComplianceReport';
import { WaitlistPerformanceReport } from '@/components/reports/WaitlistPerformanceReport';
import { ReportActions } from '@/components/reports/ReportActions';
import { 
  exportOverviewReport,
  exportUtilizationReport,
  exportRevenueReport,
  exportUserComplianceReport,
  exportWaitlistPerformanceReport,
  exportSpotAssignmentsReport
} from '@/utils/report-export';
import { 
  BarChart3, 
  DollarSign, 
  Users, 
  ListOrdered,
  LayoutDashboard,
  UserPlus
} from 'lucide-react';
import type {
  ReportOverviewResponse,
  ReportUtilizationResponse,
  ReportRevenueResponse,
  ReportUserComplianceResponse,
  ReportWaitlistPerformanceResponse,
  SpotAssignmentReportResponse
} from '@shared/schema';
import { SpotAssignmentsReport } from '@/components/reports/SpotAssignmentsReport';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo, setScope } = useReportFilters();

  // Fetch all report data
  const overviewQuery = useQuery<ReportOverviewResponse>({
    queryKey: ['/api/admin/reports/overview', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/overview?${params}`);
      if (!response.ok) throw new Error('Failed to fetch overview report');
      return response.json();
    }
  });

  const utilizationQuery = useQuery<ReportUtilizationResponse>({
    queryKey: ['/api/admin/reports/utilization', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/utilization?${params}`);
      if (!response.ok) throw new Error('Failed to fetch utilization report');
      return response.json();
    }
  });

  const revenueQuery = useQuery<ReportRevenueResponse>({
    queryKey: ['/api/admin/reports/revenue', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/revenue?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue report');
      return response.json();
    }
  });

  const userComplianceQuery = useQuery<ReportUserComplianceResponse>({
    queryKey: ['/api/admin/reports/user-compliance', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/user-compliance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch user compliance report');
      return response.json();
    }
  });

  const waitlistQuery = useQuery<ReportWaitlistPerformanceResponse>({
    queryKey: ['/api/admin/reports/waitlist-performance', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/waitlist-performance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch waitlist performance report');
      return response.json();
    }
  });

  const spotAssignmentsQuery = useQuery<SpotAssignmentReportResponse>({
    queryKey: ['/api/admin/reports/spot-assignments', filters.dateFrom, filters.dateTo, filters.scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: filters.dateFrom,
        to: filters.dateTo,
        scope: filters.scope
      });
      const response = await fetch(`/api/admin/reports/spot-assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch spot assignments report');
      return response.json();
    }
  });

  return (
    <div className="flex-1 space-y-6 p-6" data-testid="page-admin-reports">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-reports">
          Reports Hub
        </h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive analytics and reporting for BCI ParkShare
        </p>
      </div>

      {/* Filters */}
      <Card data-testid="card-report-filters">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Select date range and scope to customize your reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={filters.scope}
                onValueChange={(value) => setScope(value as ReportScope)}
              >
                <SelectTrigger id="scope" data-testid="select-scope">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-scope-all">All Spots</SelectItem>
                  <SelectItem value="bci" data-testid="option-scope-bci">BCI-Managed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="overview" className="space-y-6" data-testid="tabs-reports">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="utilization" data-testid="tab-utilization">
            <BarChart3 className="w-4 h-4 mr-2" />
            Utilization
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <DollarSign className="w-4 h-4 mr-2" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="user-compliance" data-testid="tab-user-compliance">
            <Users className="w-4 h-4 mr-2" />
            User & Compliance
          </TabsTrigger>
          <TabsTrigger value="waitlist" data-testid="tab-waitlist">
            <ListOrdered className="w-4 h-4 mr-2" />
            Waitlist
          </TabsTrigger>
          <TabsTrigger value="spot-assignments" data-testid="tab-spot-assignments">
            <UserPlus className="w-4 h-4 mr-2" />
            Spot Assignments
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Overview Report</h2>
            <ReportActions
              reportType="overview"
              onExport={() => exportOverviewReport(overviewQuery.data!)}
              filters={filters}
            />
          </div>
          <OverviewReport
            data={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
          />
        </TabsContent>

        {/* Utilization Tab */}
        <TabsContent value="utilization" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Parking Utilization Report</h2>
            <ReportActions
              reportType="utilization"
              onExport={() => exportUtilizationReport(utilizationQuery.data!)}
              filters={filters}
            />
          </div>
          <UtilizationReport
            data={utilizationQuery.data}
            isLoading={utilizationQuery.isLoading}
          />
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Booking & Revenue Report</h2>
            <ReportActions
              reportType="revenue"
              onExport={() => exportRevenueReport(revenueQuery.data!)}
              filters={filters}
            />
          </div>
          <RevenueReport
            data={revenueQuery.data}
            isLoading={revenueQuery.isLoading}
          />
        </TabsContent>

        {/* User Compliance Tab */}
        <TabsContent value="user-compliance" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">User & Compliance Report</h2>
            <ReportActions
              reportType="user-compliance"
              onExport={() => exportUserComplianceReport(userComplianceQuery.data!)}
              filters={filters}
            />
          </div>
          <UserComplianceReport
            data={userComplianceQuery.data}
            isLoading={userComplianceQuery.isLoading}
          />
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Waitlist & Performance Report</h2>
            <ReportActions
              reportType="waitlist-performance"
              onExport={() => exportWaitlistPerformanceReport(waitlistQuery.data!)}
              filters={filters}
            />
          </div>
          <WaitlistPerformanceReport
            data={waitlistQuery.data}
            isLoading={waitlistQuery.isLoading}
          />
        </TabsContent>

        {/* Spot Assignments Tab */}
        <TabsContent value="spot-assignments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Spot Assignment Report</h2>
            <ReportActions
              reportType="spot-assignments"
              onExport={() => exportSpotAssignmentsReport(spotAssignmentsQuery.data!)}
              filters={filters}
            />
          </div>
          <SpotAssignmentsReport
            data={spotAssignmentsQuery.data}
            isLoading={spotAssignmentsQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
