import { TableHead } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUpDown, ArrowUp, ArrowDown, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type SortDirection = "asc" | "desc" | null

interface SortableTableHeaderProps {
  children: React.ReactNode
  column: string
  currentSortColumn?: string | null
  currentSortDirection?: SortDirection
  onSort: (column: string) => void
  className?: string
  align?: "left" | "center" | "right"
  infoTooltip?: string
}

export function SortableTableHeader({
  children,
  column,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className,
  align = "left",
  infoTooltip
}: SortableTableHeaderProps) {
  const isActive = currentSortColumn === column
  
  const getSortIcon = () => {
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
    }
    
    if (currentSortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 flex-shrink-0" />
    }
    
    if (currentSortDirection === "desc") {
      return <ArrowDown className="h-4 w-4 flex-shrink-0" />
    }
    
    return <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
  }

  const alignmentClasses = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right"
  }

  return (
    <TableHead className={cn("p-0", className)}>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto flex items-center gap-1 font-medium hover-elevate px-2",
            alignmentClasses[align],
            isActive && "text-primary"
          )}
          onClick={() => onSort(column)}
          data-testid={`sort-header-${column}`}
        >
          <span className="whitespace-nowrap">{children}</span>
          {getSortIcon()}
        </Button>
        {infoTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs z-50">
              {infoTooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TableHead>
  )
}