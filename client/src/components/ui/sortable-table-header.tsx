import { TableHead } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
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
}

export function SortableTableHeader({
  children,
  column,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className,
  align = "left"
}: SortableTableHeaderProps) {
  const isActive = currentSortColumn === column
  
  const getSortIcon = () => {
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    
    if (currentSortDirection === "asc") {
      return <ArrowUp className="h-4 w-4" />
    }
    
    if (currentSortDirection === "desc") {
      return <ArrowDown className="h-4 w-4" />
    }
    
    return <ArrowUpDown className="h-4 w-4" />
  }

  const alignmentClasses = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right"
  }

  return (
    <TableHead className={cn("p-0", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-auto w-full flex items-center gap-2 font-medium hover-elevate",
          alignmentClasses[align],
          isActive && "text-primary"
        )}
        onClick={() => onSort(column)}
        data-testid={`sort-header-${column}`}
      >
        <span>{children}</span>
        {getSortIcon()}
      </Button>
    </TableHead>
  )
}