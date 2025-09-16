import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { 
  Calendar,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Eye,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Activity,
  Database
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

export default function AdminAudits() {
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

  // Fetch audit logs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/admin/audits", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/admin/audits?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      return response.json() as Promise<{
        items: AuditLog[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>;
    },
  });

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

  // Toggle row expansion
  const toggleRowExpansion = (logId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Export audit logs
  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams(queryParams);
      exportParams.delete("page");
      exportParams.delete("pageSize");
      exportParams.set("format", "csv");
      
      const response = await fetch(`/api/admin/audits/export?${exportParams}`, {
        credentials: 'include'
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

  // Get action badge color
  const getActionBadgeColor = (action: AuditAction): string => {
    const actionColors: Record<string, string> = {
      "CREATE": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      "UPDATE": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      "DELETE": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      "LOGIN": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      "LOGOUT": "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
      "VIEW": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      "ASSIGN": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    };
    return actionColors[action] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and track all system activities and user actions
          </p>
        </div>
        <Button 
          onClick={handleExport}
          variant="outline"
          data-testid="button-export-audits"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-audit-search"
              />
            </div>
            <Button onClick={handleSearch} data-testid="button-search-audits">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={filters.from || ""}
                onChange={(e) => handleFilterChange("from", e.target.value)}
                data-testid="input-filter-from-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={filters.to || ""}
                onChange={(e) => handleFilterChange("to", e.target.value)}
                data-testid="input-filter-to-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) => handleFilterChange("action", value === "all" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-filter-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {AUDIT_ACTIONS.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select
                value={filters.entityType || "all"}
                onValueChange={(value) => handleFilterChange("entityType", value === "all" ? undefined : value)}
              >
                <SelectTrigger data-testid="select-filter-entity-type">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
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
              <label className="text-sm font-medium">Actor ID</label>
              <Input
                placeholder="User ID"
                value={filters.actorId || ""}
                onChange={(e) => handleFilterChange("actorId", e.target.value)}
                data-testid="input-filter-actor-id"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity ID</label>
              <Input
                placeholder="Entity ID"
                value={filters.entityId || ""}
                onChange={(e) => handleFilterChange("entityId", e.target.value)}
                data-testid="input-filter-entity-id"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Success</label>
              <Select
                value={filters.success === undefined ? "all" : String(filters.success)}
                onValueChange={(value) => handleFilterChange("success", value === "all" ? undefined : value === "true")}
              >
                <SelectTrigger data-testid="select-filter-success">
                  <SelectValue placeholder="All results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="true">Success only</SelectItem>
                  <SelectItem value="false">Failures only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Audit Results
              {data && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({data.total.toLocaleString()} total entries)
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-audits"
            >
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
          ) : data && data.items.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-32">Correlation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((log) => {
                    const EntityIcon = getEntityIcon(log.entityType);
                    const isExpanded = expandedRows[log.id];
                    
                    return (
                      <>
                        <TableRow 
                          key={log.id}
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
                                {log.actorEmail || "System"}
                              </div>
                              {log.actorId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {log.actorId}
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
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
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
                          <TableRow>
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 bg-muted/20">
                                <Tabs defaultValue="details" className="w-full">
                                  <TabsList>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    {log.before && <TabsTrigger value="before">Before</TabsTrigger>}
                                    {log.after && <TabsTrigger value="after">After</TabsTrigger>}
                                    {log.requestMeta && <TabsTrigger value="request">Request</TabsTrigger>}
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
                                  
                                  {log.before && (
                                    <TabsContent value="before" className="mt-4">
                                      <ScrollArea className="h-64 w-full border rounded p-2">
                                        <pre className="text-xs">
                                          {JSON.stringify(log.before, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </TabsContent>
                                  )}
                                  
                                  {log.after && (
                                    <TabsContent value="after" className="mt-4">
                                      <ScrollArea className="h-64 w-full border rounded p-2">
                                        <pre className="text-xs">
                                          {JSON.stringify(log.after, null, 2)}
                                        </pre>
                                      </ScrollArea>
                                    </TabsContent>
                                  )}
                                  
                                  {log.requestMeta && (
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
                      </>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, data.total)} of {data.total} entries
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
                    Page {page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= data.totalPages}
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