import React, { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useLanguage } from "@/hooks/use-language"
import { format } from "date-fns"
import { 
  Calendar,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Activity,
  Database,
  TrendingUp,
  Users,
  RefreshCw,
  Shield,
  Info,
  X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { AuditLog, AuditAction, EntityType, UserRole } from "@shared/schema"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Available filter options
const AUDIT_ACTIONS: AuditAction[] = [
  "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "VIEW", "SEARCH", 
  "ASSIGN", "UNASSIGN", "APPROVE", "REJECT", "ACTIVATE", "DEACTIVATE",
  "EXPORT", "IMPORT", "TOGGLE_BOOKABILITY", "BULK_UPDATE", "CANCEL", "COMPLETE"
];

const ENTITY_TYPES: EntityType[] = [
  "user", "parking_spot", "spot_listing", "booking", "waiting_list", "notification", "system"
];

const USER_ROLES: UserRole[] = ["admin", "owner", "renter"];

interface AuditFilters {
  from?: string;
  to?: string;
  actorId?: string;
  action?: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  success?: boolean;
  q?: string;
}

interface ExpandedRow {
  [key: string]: boolean;
}

// Define the API response structure for audit logs
interface AuditLogsResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


export default function AdminAudits() {
  const { t } = useLanguage()
  const [filters, setFilters] = useState<AuditFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [expandedRows, setExpandedRows] = useState<ExpandedRow>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Build query parameters
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      queryParams.set(key, String(value));
    }
  });
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));

  // Fetch audit logs using standard authenticated fetcher
  const auditUrl = `/api/admin/audits?${queryParams.toString()}`;
  const { data, isLoading, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: [auditUrl],
    select: (data) => data || { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }
  });

  const { data: allUsers } = useQuery<Array<{ id: string; firstName: string; lastName: string; email: string }>>({
    queryKey: ['/api/admin/users'],
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    if (allUsers) {
      for (const u of allUsers) {
        map.set(u.id, `${u.firstName} ${u.lastName}`);
      }
    }
    return map;
  }, [allUsers]);

  // Handle search
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, q: searchTerm }));
    setPage(1);
  };

  // Handle filter change
  const handleFilterChange = (key: keyof AuditFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value === "" ? undefined : value }));
    setPage(1);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm("");
    setPage(1);
  };

  // Toggle row expansion
  const toggleRowExpansion = (logId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Export audit logs using authenticated request
  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams(queryParams);
      exportParams.delete("page");
      exportParams.delete("pageSize");
      exportParams.set("format", "csv");
      
      // Use apiRequest for authenticated request and handle blob response
      const response = await fetch(`/api/admin/audits/export?${exportParams}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'x-demo-auth': 'admin'  // Include demo auth header like other admin requests
        }
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  // Get action badge color - using professional light colors
  const getActionBadgeColor = (action: AuditAction): string => {
    const actionColors: Record<string, string> = {
      "CREATE": "bg-green-50 text-green-700 border-green-200",
      "UPDATE": "bg-blue-50 text-blue-700 border-blue-200",
      "DELETE": "bg-red-50 text-red-700 border-red-200",
      "LOGIN": "bg-green-50 text-green-700 border-green-200",
      "LOGOUT": "bg-gray-50 text-gray-700 border-gray-200",
      "VIEW": "bg-blue-50 text-blue-700 border-blue-200",
      "SEARCH": "bg-blue-50 text-blue-700 border-blue-200",
      "ASSIGN": "bg-orange-50 text-orange-700 border-orange-200",
      "UNASSIGN": "bg-orange-50 text-orange-700 border-orange-200",
      "APPROVE": "bg-green-50 text-green-700 border-green-200",
      "REJECT": "bg-red-50 text-red-700 border-red-200",
      "ACTIVATE": "bg-green-50 text-green-700 border-green-200",
      "DEACTIVATE": "bg-orange-50 text-orange-700 border-orange-200",
      "EXPORT": "bg-purple-50 text-purple-700 border-purple-200",
      "IMPORT": "bg-purple-50 text-purple-700 border-purple-200",
      "TOGGLE_BOOKABILITY": "bg-orange-50 text-orange-700 border-orange-200",
      "BULK_UPDATE": "bg-blue-50 text-blue-700 border-blue-200",
      "CANCEL": "bg-red-50 text-red-700 border-red-200",
      "COMPLETE": "bg-green-50 text-green-700 border-green-200",
    };
    return actionColors[action] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  // Get entity type icon
  const getEntityIcon = (entityType: EntityType) => {
    const icons: Record<EntityType, React.ElementType> = {
      "user": User,
      "parking_spot": Database,
      "spot_listing": FileText,
      "booking": Calendar,
      "waiting_list": Clock,
      "notification": AlertCircle,
      "system": Activity
    };
    return icons[entityType] || Database;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-audits">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            {t('admin.auditLogs.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('admin.auditLogs.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => refetch()}
                data-testid="button-refresh-data"
                aria-label="Refresh audit log data"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('admin.auditLogs.refreshData')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh audit log data and security events
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleExport}
                variant="outline"
                data-testid="button-export-audits"
                aria-label="Export audit trail to Excel"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('common.exportReport')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Export audit trail to Excel for compliance
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="hover-elevate">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.auditLogs.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-8"
                data-testid="input-audit-search"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleSearch} data-testid="button-search-audits" aria-label="Search audit logs">
                  Search
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Search audit logs by usernames and actions
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                  aria-label="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Clear Filters
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.fromDate')}</label>
              <Input
                type="date"
                value={filters.from || ""}
                onChange={(e) => handleFilterChange("from", e.target.value)}
                data-testid="input-filter-from-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.toDate')}</label>
              <Input
                type="date"
                value={filters.to || ""}
                onChange={(e) => handleFilterChange("to", e.target.value)}
                data-testid="input-filter-to-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.action')}</label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) => handleFilterChange("action", value === "all" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-filter-action">
                  <SelectValue placeholder={t('admin.auditLogs.allActions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.auditLogs.allActions')}</SelectItem>
                  {AUDIT_ACTIONS.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.entityType')}</label>
              <Select
                value={filters.entityType || "all"}
                onValueChange={(value) => handleFilterChange("entityType", value === "all" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-filter-entity-type">
                  <SelectValue placeholder={t('admin.auditLogs.allEntities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.auditLogs.allEntities')}</SelectItem>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.actorId')}</label>
              <Input
                placeholder={t('admin.auditLogs.userId')}
                value={filters.actorId || ""}
                onChange={(e) => handleFilterChange("actorId", e.target.value)}
                data-testid="input-filter-actor-id"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.entityId')}</label>
              <Input
                placeholder={t('admin.auditLogs.entityId')}
                value={filters.entityId || ""}
                onChange={(e) => handleFilterChange("entityId", e.target.value)}
                data-testid="input-filter-entity-id"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('admin.auditLogs.success')}</label>
              <Select
                value={filters.success === undefined ? "all" : String(filters.success)}
                onValueChange={(value) => handleFilterChange("success", value === "all" ? undefined : value === "true")}
              >
                <SelectTrigger data-testid="select-filter-success">
                  <SelectValue placeholder={t('admin.auditLogs.allResults')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.auditLogs.allResults')}</SelectItem>
                  <SelectItem value="true">Success only</SelectItem>
                  <SelectItem value="false">Failures only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="hover-elevate">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t('admin.auditLogs.auditResults')}
              {data && data.total > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({data.total.toLocaleString()} total entries)
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-audits"
              aria-label="Refresh audit results"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="text-error-message">
                Failed to load audit logs. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data && data.items && data.items.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{t('admin.auditLogs.timestamp')}</TableHead>
                    <TableHead>{t('admin.auditLogs.actor')}</TableHead>
                    <TableHead>{t('admin.auditLogs.action')}</TableHead>
                    <TableHead>{t('admin.auditLogs.entity')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>{t('admin.auditLogs.message')}</TableHead>
                    <TableHead className="w-32">Correlation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((log: AuditLog) => {
                    const EntityIcon = getEntityIcon(log.entityType);
                    const isExpanded = expandedRows[log.id];
                    
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleRowExpansion(log.id)}
                          data-testid={`row-audit-${log.id}`}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.occurredAt), "MM/dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {log.actorId ? (userMap.get(log.actorId) || log.actorEmail || "Unknown") : "System"}
                              </div>
                              {log.actorEmail && (
                                <div className="text-xs text-muted-foreground">
                                  {log.actorEmail}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={getActionBadgeColor(log.action)}
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <EntityIcon className="h-4 w-4" />
                              <span className="capitalize">
                                {log.entityType.replace("_", " ")}
                              </span>
                              {log.entityId && (
                                <code className="text-xs bg-muted px-1 rounded">
                                  {log.entityId.slice(-8)}
                                </code>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  Success
                                </Badge>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                  Failed
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.message}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.correlationId.slice(-8)}
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Row Details */}
                        {isExpanded && (
                          <TableRow key={`${log.id}-expanded`}>
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 bg-muted/20">
                                <Tabs defaultValue="details" className="w-full">
                                  <TabsList>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    {log.before !== null && <TabsTrigger value="before">Before</TabsTrigger>}
                                    {log.after !== null && <TabsTrigger value="after">After</TabsTrigger>}
                                    {log.requestMeta !== null && <TabsTrigger value="request">Request</TabsTrigger>}
                                  </TabsList>
                                  
                                  <TabsContent value="details" className="mt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <strong>Full Timestamp:</strong>
                                        <div className="font-mono">
                                          {format(new Date(log.occurredAt), "yyyy-MM-dd HH:mm:ss.SSS 'UTC'")}
                                        </div>
                                      </div>
                                      <div>
                                        <strong>Correlation ID:</strong>
                                        <div className="font-mono">{log.correlationId}</div>
                                      </div>
                                      <div>
                                        <strong>Actor Role:</strong>
                                        <div>{log.actorRole || "N/A"}</div>
                                      </div>
                                      <div>
                                        <strong>Success:</strong>
                                        <div>{log.success ? "✅ Yes" : "❌ No"}</div>
                                      </div>
                                      <div className="md:col-span-2">
                                        <strong>Full Message:</strong>
                                        <div className="break-words">{log.message || "No message"}</div>
                                      </div>
                                    </div>
                                  </TabsContent>
                                  
                                  {log.before !== null && (
                                    <TabsContent value="before" className="mt-4">
                                      <ScrollArea className="h-64 w-full border rounded p-2">
                                        <pre className="text-xs">
                                          {JSON.stringify(log.before, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </TabsContent>
                                  )}
                                  
                                  {log.after !== null && (
                                    <TabsContent value="after" className="mt-4">
                                      <ScrollArea className="h-64 w-full border rounded p-2">
                                        <pre className="text-xs">
                                          {JSON.stringify(log.after, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </TabsContent>
                                  )}
                                  
                                  {log.requestMeta !== null && (
                                    <TabsContent value="request" className="mt-4">
                                      <ScrollArea className="h-64 w-full border rounded p-2">
                                        <pre className="text-xs">
                                          {JSON.stringify(log.requestMeta, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </TabsContent>
                                  )}
                                </Tabs>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium">
                    Page {page} of {data?.totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= (data?.totalPages || 1)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12" data-testid="text-no-results">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No audit logs found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or search terms
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}