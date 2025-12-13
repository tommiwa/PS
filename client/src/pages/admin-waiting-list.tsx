import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/hooks/use-confirm"
import { useTableSort } from "@/hooks/use-table-sort"
import { useCardsVisibility } from "@/hooks/use-cards-visibility"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SortableTableHeader } from "@/components/ui/sortable-table-header"
import { EnhancedFilters, type FilterConfig, type FilterValues } from "@/components/ui/enhanced-filters"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TablePagination } from "@/components/shared/TablePagination"
import { 
  Users, Clock, ArrowRight, RefreshCw, Trash2, Download, FileText,
  Eye, EyeOff, AlertTriangle, Timer, Target
} from "lucide-react"
import type { WaitingList, ParkingSpotWithUser, SpotType, SpotTypeTable } from "@shared/schema"
import { quickExportWaitingListPDF, quickExportWaitingListExcel } from "@/utils/export-utils"

export default function AdminWaitingList() {
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const [waitingListSearchTerm, setWaitingListSearchTerm] = useState("")
  const [waitingListFilterValues, setWaitingListFilterValues] = useState<FilterValues>({})
  const [selectedWaitingListItem, setSelectedWaitingListItem] = useState<WaitingList | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedSpotForAssign, setSelectedSpotForAssign] = useState<ParkingSpotWithUser | null>(null)
  
  const [waitingListPageIndex, setWaitingListPageIndex] = useState(0)
  const [waitingListPageSize, setWaitingListPageSize] = useState(25)
  
  const { cardsVisible, toggleCards } = useCardsVisibility("waiting-list-management")
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] }),
      ])
      toast({
        title: "Refreshed",
        description: "Waiting list data has been refreshed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const { data: allWaitingList, isLoading: isLoadingWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list"],
  })

  const { data: activeWaitingList } = useQuery<WaitingList[]>({
    queryKey: ["/api/waiting-list/active"],
  })

  const { data: unallocatedSpots = [] } = useQuery<ParkingSpotWithUser[]>({
    queryKey: ["/api/admin/unallocated-spots"],
  })

  const { data: spotTypes = [] } = useQuery<SpotTypeTable[]>({
    queryKey: ["/api/spot-types"],
  })

  const waitingListMetrics = {
    total: allWaitingList?.length || 0,
    active: activeWaitingList?.length || 0,
    assigned: allWaitingList?.filter(entry => entry.status === "assigned").length || 0,
    highPriority: activeWaitingList?.filter(entry => entry.priority === 1).length || 0,
    mediumPriority: activeWaitingList?.filter(entry => entry.priority === 2).length || 0,
    lowPriority: activeWaitingList?.filter(entry => entry.priority === 3).length || 0,
    averageWaitTime: activeWaitingList && activeWaitingList.length > 0 
      ? Math.round(activeWaitingList.reduce((sum, entry) => {
          const daysSinceEnrollment = Math.floor((Date.now() - new Date(entry.enrolledDate).getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysSinceEnrollment;
        }, 0) / activeWaitingList.length)
      : 0
  }

  const assignFromWaitingListMutation = useMutation({
    mutationFn: async ({ userId, spotId }: { userId: string; spotId: string }) => {
      return await apiRequest(`/api/admin/assign-spot`, {
        method: "POST",
        body: { userId, spotId },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] })
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unallocated-spots"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-spots"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      toast({
        title: "Success",
        description: "Spot assigned successfully from waiting list.",
        variant: "success",
      })
      setShowAssignDialog(false)
      setSelectedWaitingListItem(null)
      setSelectedSpotForAssign(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign spot.",
        variant: "error",
      })
    },
  })

  const removeFromWaitingListMutation = useMutation({
    mutationFn: async ({ waitingListId, userId }: { waitingListId: string; userId: string }) => {
      return await apiRequest(`/api/waiting-list/${waitingListId}`, {
        method: "DELETE",
      })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list"] })
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/active"] })
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-list/user", variables.userId] })
      toast({
        title: "Success",
        description: "User removed from waiting list successfully.",
        variant: "success",
      })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user from waiting list.",
        variant: "error",
      })
    },
  })

  const filteredWaitingListEnhanced = allWaitingList?.filter(item => {
    if (waitingListSearchTerm.trim()) {
      const searchLower = waitingListSearchTerm.toLowerCase()
      const matchesSearch = item.userName?.toLowerCase().includes(searchLower) ||
                           item.userEmail?.toLowerCase().includes(searchLower) ||
                           item.reason?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    
    if (waitingListFilterValues.priority && waitingListFilterValues.priority !== "all") {
      if (item.priority?.toString() !== waitingListFilterValues.priority) return false
    }
    
    if (waitingListFilterValues.preferredSpotType && waitingListFilterValues.preferredSpotType !== "all") {
      const preferredSpotTypeName = item.preferredSpotTypeId 
        ? spotTypes.find(st => st.id === item.preferredSpotTypeId)?.name 
        : null
      if (preferredSpotTypeName !== waitingListFilterValues.preferredSpotType) return false
    }
    
    if (waitingListFilterValues.status && waitingListFilterValues.status !== "all") {
      if (item.status !== waitingListFilterValues.status) return false
    } else {
      if (item.status === "assigned") return false
    }
    
    return true
  }) || []

  const { sortState: waitingListSortState, sortedData: sortedWaitingList, handleSort: handleWaitingListSort } = useTableSort(
    filteredWaitingListEnhanced,
    "enrolledDate",
    "desc"
  )

  const paginatedWaitingList = useMemo(() => {
    const startIndex = waitingListPageIndex * waitingListPageSize
    const endIndex = startIndex + waitingListPageSize
    return sortedWaitingList.slice(startIndex, endIndex)
  }, [sortedWaitingList, waitingListPageIndex, waitingListPageSize])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedWaitingList.length / waitingListPageSize) - 1)
    if (waitingListPageIndex > maxPage) {
      setWaitingListPageIndex(maxPage)
    }
  }, [sortedWaitingList.length, waitingListPageSize, waitingListPageIndex])

  useEffect(() => {
    setWaitingListPageIndex(0)
  }, [waitingListSearchTerm, waitingListFilterValues])

  const waitingListFilterConfigs: FilterConfig[] = [
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { value: "1", label: "High Priority" },
        { value: "2", label: "Medium Priority" },
        { value: "3", label: "Low Priority" }
      ]
    },
    {
      key: "preferredSpotType",
      label: "Preferred Spot Type",
      type: "select",
      options: [
        { value: "regular", label: "Regular" },
        { value: "electric", label: "EV" },
        { value: "tesla_ev", label: "Tesla Charger" },
        { value: "accessible", label: "Accessible" },
        { value: "reserved", label: "Reserved" }
      ]
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "assigned", label: "Assigned" },
        { value: "cancelled", label: "Cancelled" }
      ]
    }
  ]

  const handleWaitingListFilterChange = (key: string, value: string | undefined) => {
    setWaitingListFilterValues(prev => ({
      ...prev,
      [key]: value
    }))
  }
  
  const handleClearWaitingListFilters = () => {
    setWaitingListSearchTerm("")
    setWaitingListFilterValues({})
  }

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100" data-testid={`badge-priority-high`}>High Priority</Badge>
      case 2:
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" data-testid={`badge-priority-medium`}>Medium Priority</Badge>
      case 3:
        return <Badge variant="outline" data-testid={`badge-priority-low`}>Low Priority</Badge>
      default:
        return <Badge variant="outline" data-testid={`badge-priority-unknown`}>Unknown</Badge>
    }
  }

  const getSpotTypeBadge = (spotType: SpotType | string | null | undefined) => {
    if (!spotType) {
      return <Badge variant="secondary" data-testid="badge-spot-type-unknown">Unknown</Badge>
    }
    
    const badgeConfigs: Record<string, { className: string; label: string }> = {
      regular: { className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", label: "Regular" },
      "Regular": { className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100", label: "Regular" },
      electric: { className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", label: "EV Charging" },
      "EV Chargers": { className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100", label: "EV Chargers" },
      tesla_ev: { className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", label: "Tesla Charger" },
      "Tesla Chargers": { className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100", label: "Tesla Chargers" },
      accessible: { className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", label: "Accessible" },
      "Accessible": { className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100", label: "Accessible" },
      reserved: { className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", label: "Reserved" },
      "Reserved": { className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100", label: "Reserved" }
    }
    
    const config = badgeConfigs[spotType] || badgeConfigs.regular
    return (
      <Badge variant="secondary" className={config.className} data-testid={`badge-spot-type-${spotType}`}>
        {config.label}
      </Badge>
    )
  }

  const handleAssignFromWaitingList = (waitingListItem: WaitingList) => {
    setSelectedWaitingListItem(waitingListItem)
    setShowAssignDialog(true)
  }

  const handleRemoveFromWaitingList = async (waitingListItem: WaitingList) => {
    const confirmed = await confirm({
      title: "Remove from Waiting List",
      description: `Are you sure you want to remove ${waitingListItem.userName} from the waiting list?`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive"
    })
    
    if (confirmed) {
      removeFromWaitingListMutation.mutate({ 
        waitingListId: waitingListItem.id, 
        userId: waitingListItem.userId 
      })
    }
  }

  const handleConfirmAssign = () => {
    if (selectedWaitingListItem && selectedSpotForAssign) {
      assignFromWaitingListMutation.mutate({
        userId: selectedWaitingListItem.userId,
        spotId: selectedSpotForAssign.id
      })
    }
  }

  const availableBciSpots = unallocatedSpots.filter(spot => spot.isBciManaged)

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-waiting-list">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waiting List Management</h1>
          <p className="text-muted-foreground">
            Manage parking spot waiting list and assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                size="icon"
                onClick={toggleCards}
                data-testid="button-toggle-cards"
                aria-label={cardsVisible ? "Hide dashboard cards" : "Show dashboard cards"}
              >
                {cardsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {cardsVisible ? "Hide dashboard cards" : "Show dashboard cards"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                data-testid="button-refresh-data"
                aria-label="Refresh waiting list data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh waiting list data
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {cardsVisible && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-active-waiting">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
              <div className="rounded-full border-2 border-orange-400 p-2">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-waiting">
                {waitingListMetrics.active}
              </div>
              <p className="text-xs text-orange-600">Pending assignment</p>
            </CardContent>
          </Card>

          <Card data-testid="card-high-priority">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <div className="rounded-full border-2 border-red-400 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-high-priority">
                {waitingListMetrics.highPriority}
              </div>
              <p className="text-xs text-red-600">Urgent requests</p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-wait-time">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <div className="rounded-full border-2 border-blue-400 p-2">
                <Timer className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avg-wait">
                {waitingListMetrics.averageWaitTime}
              </div>
              <p className="text-xs text-blue-600">Days average</p>
            </CardContent>
          </Card>

          <Card data-testid="card-assigned-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
              <div className="rounded-full border-2 border-green-400 p-2">
                <Target className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-assigned">
                {waitingListMetrics.assigned}
              </div>
              <p className="text-xs text-green-600">Successfully assigned</p>
            </CardContent>
          </Card>
        </div>
      )}

      <EnhancedFilters
        searchValue={waitingListSearchTerm}
        onSearchChange={setWaitingListSearchTerm}
        filterConfigs={waitingListFilterConfigs}
        filterValues={waitingListFilterValues}
        onFilterChange={handleWaitingListFilterChange}
        onClearFilters={handleClearWaitingListFilters}
        searchPlaceholder="Search waiting list by name, email, or reason..."
        className="hover-elevate"
      />

      <Card data-testid="card-waiting-list">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Waiting List ({sortedWaitingList.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm"
                variant="outline" 
                disabled={sortedWaitingList.length === 0}
                onClick={() => {
                  const success = quickExportWaitingListPDF(sortedWaitingList, 'Waiting List Report', (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: "Export Failed",
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: "Export Successful",
                      description: "PDF report has been downloaded successfully"
                    })
                  }
                }}
                data-testid="button-export-waiting-list-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button 
                size="sm"
                variant="outline" 
                disabled={sortedWaitingList.length === 0}
                onClick={() => {
                  const success = quickExportWaitingListExcel(sortedWaitingList, 'Waiting List Report', (errorMessage) => {
                    toast({
                      variant: "destructive",
                      title: "Export Failed",
                      description: errorMessage
                    })
                  })
                  if (success) {
                    toast({
                      title: "Export Successful",
                      description: "Excel report has been downloaded successfully"
                    })
                  }
                }}
                data-testid="button-export-waiting-list-excel"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingWaitingList ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedWaitingList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-waiting">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No waiting list entries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-waiting-list">
                <TableHeader>
                  <TableRow>
                    <SortableTableHeader
                      column="userName"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      User
                    </SortableTableHeader>
                    <SortableTableHeader
                      column="priority"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      Priority
                    </SortableTableHeader>
                    <SortableTableHeader
                      column="preferredSpotType"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      Preferred Type
                    </SortableTableHeader>
                    <SortableTableHeader
                      column="status"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      Status
                    </SortableTableHeader>
                    <SortableTableHeader
                      column="enrolledDate"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      Enrolled Date
                    </SortableTableHeader>
                    <TableHead>Waiting Days</TableHead>
                    <SortableTableHeader
                      column="reason"
                      currentSortColumn={waitingListSortState.column}
                      currentSortDirection={waitingListSortState.direction}
                      onSort={handleWaitingListSort}
                    >
                      Reason
                    </SortableTableHeader>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWaitingList.map((item) => {
                    const waitingDays = Math.floor((Date.now() - new Date(item.enrolledDate).getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <TableRow key={item.id} data-testid={`row-waiting-${item.id}`}>
                        <TableCell data-testid={`text-waiting-user-${item.id}`}>
                          <div>
                            <div className="font-medium">{item.userName}</div>
                            <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-waiting-priority-${item.id}`}>
                          {getPriorityBadge(item.priority)}
                        </TableCell>
                        <TableCell data-testid={`text-waiting-type-${item.id}`}>
                          {item.preferredSpotTypeId ? getSpotTypeBadge(spotTypes.find(st => st.id === item.preferredSpotTypeId)?.name) : <Badge variant="outline">Any</Badge>}
                        </TableCell>
                        <TableCell data-testid={`text-waiting-status-${item.id}`}>
                          <Badge 
                            variant="secondary"
                            className={
                              item.status === "active" ? "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" :
                              item.status === "assigned" ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" :
                              "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            }
                          >
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-waiting-enrolled-${item.id}`}>
                          {new Date(item.enrolledDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell data-testid={`text-waiting-days-${item.id}`}>
                          <Badge variant="outline">{waitingDays} days</Badge>
                        </TableCell>
                        <TableCell data-testid={`text-waiting-reason-${item.id}`}>
                          {item.reason && item.reason.trim() ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="max-w-[200px] truncate block cursor-help">
                                  {item.reason}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p>{item.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {item.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAssignFromWaitingList(item)}
                                data-testid={`button-assign-waiting-${item.id}`}
                                title="Assign Spot"
                              >
                                <ArrowRight className="h-4 w-4 mr-1" />
                                Assign
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFromWaitingList(item)}
                              data-testid={`button-remove-waiting-${item.id}`}
                              title="Remove from Waiting List"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <TablePagination
                totalCount={sortedWaitingList.length}
                pageSize={waitingListPageSize}
                pageIndex={waitingListPageIndex}
                onPageSizeChange={(size) => {
                  setWaitingListPageSize(size)
                  setWaitingListPageIndex(0)
                }}
                onPageIndexChange={setWaitingListPageIndex}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-assign-spot">
          <DialogHeader>
            <DialogTitle>Assign Spot from Waiting List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedWaitingListItem && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedWaitingListItem.userName}</p>
                <p className="text-sm text-muted-foreground">{selectedWaitingListItem.userEmail}</p>
                <p className="text-sm mt-1">Priority: {getPriorityBadge(selectedWaitingListItem.priority)}</p>
                {selectedWaitingListItem.preferredSpotTypeId && (
                  <p className="text-sm">Preferred: {getSpotTypeBadge(spotTypes.find(st => st.id === selectedWaitingListItem.preferredSpotTypeId)?.name)}</p>
                )}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Select Available Spot</label>
              <Select
                value={selectedSpotForAssign?.id || ""}
                onValueChange={(value) => {
                  const spot = availableBciSpots.find(s => s.id === value)
                  setSelectedSpotForAssign(spot || null)
                }}
              >
                <SelectTrigger data-testid="select-assign-spot">
                  <SelectValue placeholder="Select a spot to assign" />
                </SelectTrigger>
                <SelectContent>
                  {availableBciSpots.length === 0 ? (
                    <SelectItem value="none" disabled>No available spots</SelectItem>
                  ) : (
                    availableBciSpots.map(spot => (
                      <SelectItem key={spot.id} value={spot.id}>
                        {spot.spotNumber} - {spot.locationName} ({spot.spotTypeName})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedSpotForAssign && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="font-medium text-green-700 dark:text-green-300">Selected Spot Details</p>
                <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                  <div>Spot: {selectedSpotForAssign.spotNumber}</div>
                  <div>Location: {selectedSpotForAssign.locationName}</div>
                  <div>Type: {getSpotTypeBadge(selectedSpotForAssign.spotTypeName)}</div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleConfirmAssign}
                disabled={!selectedSpotForAssign || assignFromWaitingListMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-assign"
              >
                {assignFromWaitingListMutation.isPending ? "Assigning..." : "Assign Spot"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false)
                  setSelectedWaitingListItem(null)
                  setSelectedSpotForAssign(null)
                }}
                className="flex-1"
                data-testid="button-cancel-assign"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
