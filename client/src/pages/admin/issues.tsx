import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { format } from "date-fns"
import { AlertCircle, Clock, CheckCircle2, ListTodo, Loader2, RefreshCw, History, Trash2 } from "lucide-react"

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
  const [activeTab, setActiveTab] = useState<string>("active")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const { toast } = useToast()

  const { data: allIssues = [], isLoading, refetch } = useQuery<Issue[]>({
    queryKey: ["/api/admin/issues"],
    queryFn: async () => {
      const response = await fetch("/api/admin/issues")
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

  const deleteIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/issues/${id}`, { method: "DELETE" })
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/issues"] })
      toast({
        title: "Issue Deleted",
        description: "The issue has been removed.",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete",
        description: error.message || "Could not delete issue.",
        variant: "destructive",
      })
    },
  })

  const handleStatusChange = (issueId: number, newStatus: IssueStatus) => {
    updateStatusMutation.mutate({ id: issueId, status: newStatus })
  }

  const handleDelete = (issueId: number) => {
    if (confirm("Are you sure you want to delete this issue?")) {
      deleteIssueMutation.mutate(issueId)
    }
  }

  const activeIssues = allIssues.filter(i => i.status !== "completed")
  const completedIssues = allIssues.filter(i => i.status === "completed")
  const urgentCount = activeIssues.filter(i => i.priority === "urgent").length

  const getFilteredIssues = (issues: Issue[]) => {
    if (priorityFilter === "all") return issues
    return issues.filter(i => i.priority === priorityFilter)
  }

  const renderIssuesTable = (issues: Issue[], isHistory: boolean = false) => {
    const filteredIssues = getFilteredIssues(issues)
    
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )
    }
    
    if (filteredIssues.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{isHistory ? "No completed issues yet." : "No active issues found."}</p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{isHistory ? "Completed" : "Created"}</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIssues.map((issue) => (
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
                  {format(new Date(isHistory ? issue.updatedAt : issue.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
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
                    {!isHistory && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(issue.id)}
                        disabled={deleteIssueMutation.isPending}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {deleteIssueMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

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
            <div className="text-2xl font-bold">{allIssues.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{activeIssues.length}</div>
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4" />
                    Active
                    {activeIssues.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {activeIssues.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    History
                    {completedIssues.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {completedIssues.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
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
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="active" className="mt-0">
              {renderIssuesTable(activeIssues, false)}
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              {renderIssuesTable(completedIssues, true)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
