import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportFilters, type ReportScope } from '@/components/reports/useReportFilters';
import { UtilizationReport } from '@/components/reports/UtilizationReport';
import { ReportActions } from '@/components/reports/ReportActions';
import { 
  exportUtilizationReport,
  exportSpotAssignmentsReport
} from '@/utils/report-export';
import { 
  BarChart3, 
  UserPlus
} from 'lucide-react';
import type {
  ReportUtilizationResponse,
  SpotAssignmentReportResponse
} from '@shared/schema';
import { SpotAssignmentsReport } from '@/components/reports/SpotAssignmentsReport';

export default function AdminReportsPage() {
  const { filters, setDateFrom, setDateTo, setScope } = useReportFilters();

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
      <Tabs defaultValue="spot-assignments" className="space-y-6" data-testid="tabs-reports">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="spot-assignments" data-testid="tab-spot-assignments">
            <UserPlus className="w-4 h-4 mr-2" />
            Spot Assignments
          </TabsTrigger>
          <TabsTrigger value="utilization" data-testid="tab-utilization">
            <BarChart3 className="w-4 h-4 mr-2" />
            Utilization
          </TabsTrigger>
        </TabsList>

        {/* Spot Assignments Tab */}
        <TabsContent value="spot-assignments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Spot Assignment Report</h2>
            <ReportActions
              reportType="spot-assignments"
              onExport={() => {
                if (!spotAssignmentsQuery.data) return;
                exportSpotAssignmentsReport(spotAssignmentsQuery.data);
              }}
              filters={filters}
            />
          </div>
          <SpotAssignmentsReport
            data={spotAssignmentsQuery.data}
            isLoading={spotAssignmentsQuery.isLoading}
          />
        </TabsContent>

        {/* Utilization Tab */}
        <TabsContent value="utilization" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Parking Utilization Report</h2>
            <ReportActions
              reportType="utilization"
              onExport={() => {
                if (!utilizationQuery.data) return;
                exportUtilizationReport(utilizationQuery.data);
              }}
              filters={filters}
            />
          </div>
          <UtilizationReport
            data={utilizationQuery.data}
            isLoading={utilizationQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
