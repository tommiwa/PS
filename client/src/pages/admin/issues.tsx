import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { format } from "date-fns"
import { AlertCircle, Clock, CheckCircle2, ListTodo, Loader2, RefreshCw } from "lucide-react"

type IssueStatus = "backlog" | "todo" | "in_progress" | "completed"
type IssuePriority = "low" | "medium" | "high" | "urgent"

interface Issue {
  id: number
  title: string
  description: string
  priority: IssuePriority
  status: IssueStatus
  reportedBy: string
  reporterName: string | null
  reporterEmail: string | null
  createdAt: string
  updatedAt: string
}

const statusConfig: Record<IssueStatus, { label: string; color: string; icon: React.ReactNode }> = {
  backlog: { label: "Backlog", color: "bg-gray-100 text-gray-800", icon: <Clock className="h-3 w-3" /> },
  todo: { label: "To Do", color: "bg-blue-100 text-blue-800", icon: <ListTodo className="h-3 w-3" /> },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-800", icon: <RefreshCw className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
}

const priorityConfig: Record<IssuePriority, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-700" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  high: { label: "High", color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
}

export default function AdminIssuesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const { toast } = useToast()

  const { data: issues = [], isLoading, refetch } = useQuery<Issue[]>({
    queryKey: ["/api/admin/issues", statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (priorityFilter !== "all") params.append("priority", priorityFilter)
      const response = await fetch(`/api/admin/issues?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch issues")
      return response.json()
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: IssueStatus }) => {
      const response = await apiRequest(`/api/admin/issues/${id}`, { method: "PATCH", body: { status } })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/issues"] })
      toast({
        title: "Status Updated",
        description: "Issue status has been updated successfully.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update",
        description: error.message || "Could not update issue status.",
        variant: "destructive",
      })
    },
  })

  const handleStatusChange = (issueId: number, newStatus: IssueStatus) => {
    updateStatusMutation.mutate({ id: issueId, status: newStatus })
  }

  const openIssuesCount = issues.filter(i => i.status !== "completed").length
  const urgentCount = issues.filter(i => i.priority === "urgent" && i.status !== "completed").length

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-primary" />
            Reported Issues
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and track issues reported by users
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{openIssuesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Urgent Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>All Issues</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No issues found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{issue.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {issue.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{issue.reporterName || "Unknown"}</div>
                          {issue.reporterEmail && (
                            <a 
                              href={`mailto:${issue.reporterEmail}`}
                              className="text-xs text-muted-foreground hover:text-primary"
                            >
                              {issue.reporterEmail}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={priorityConfig[issue.priority].color}
                        >
                          {priorityConfig[issue.priority].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${statusConfig[issue.status].color} flex items-center gap-1 w-fit`}
                        >
                          {statusConfig[issue.status].icon}
                          {statusConfig[issue.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(issue.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select 
                          value={issue.status} 
                          onValueChange={(value) => handleStatusChange(issue.id, value as IssueStatus)}
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-[130px]">
                            {updateStatusMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="backlog">Backlog</SelectItem>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
