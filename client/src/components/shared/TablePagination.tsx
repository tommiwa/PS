import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"

interface TablePaginationProps {
  totalCount: number
  pageSize: number
  pageIndex: number
  onPageSizeChange: (size: number) => void
  onPageIndexChange: (index: number) => void
  pageSizeOptions?: number[]
}

export function TablePagination({ 
  totalCount, 
  pageSize, 
  pageIndex, 
  onPageSizeChange, 
  onPageIndexChange,
  pageSizeOptions = [10, 25, 50, 100]
}: TablePaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = pageIndex * pageSize + 1;
  const endIndex = Math.min((pageIndex + 1) * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (pageIndex < 3) {
        for (let i = 0; i < 3; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages - 1);
      } else if (pageIndex > totalPages - 4) {
        pages.push(0);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i < totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(0);
        pages.push('ellipsis');
        pages.push(pageIndex - 1);
        pages.push(pageIndex);
        pages.push(pageIndex + 1);
        pages.push('ellipsis');
        pages.push(totalPages - 1);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2 py-4" data-testid="table-pagination">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" data-testid="pagination-info">
          {totalCount === 0 ? (
            "No results"
          ) : (
            `Showing ${startIndex}-${endIndex} of ${totalCount}`
          )}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map(option => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => pageIndex > 0 && onPageIndexChange(pageIndex - 1)}
                className={pageIndex === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                data-testid="pagination-previous"
              />
            </PaginationItem>
            
            {getPageNumbers().map((page, idx) => (
              page === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => onPageIndexChange(page)}
                    isActive={pageIndex === page}
                    className="cursor-pointer"
                    data-testid={`pagination-page-${page}`}
                  >
                    {page + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            ))}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => pageIndex < totalPages - 1 && onPageIndexChange(pageIndex + 1)}
                className={pageIndex >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                data-testid="pagination-next"
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
