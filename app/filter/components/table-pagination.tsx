import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { PaginationProps } from "../types"

export function TablePagination({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    pageSize, 
    onPageSizeChange 
}: PaginationProps) {
    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => onPageSizeChange(parseInt(value))}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={size.toString()}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="h-8 w-8 p-0"
                    >
                        <span className="sr-only">Previous page</span>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                                return page === 1 || 
                                       page === totalPages || 
                                       Math.abs(page - currentPage) <= 1
                            })
                            .map((page, index, array) => {
                                if (index > 0 && page - array[index - 1] > 1) {
                                    return (
                                        <div key={`ellipsis-${page}`} className="px-2 py-1">
                                            <span className="text-muted-foreground">...</span>
                                        </div>
                                    );
                                }
                                
                                return (
                                    <Button
                                        key={page}
                                        variant={page === currentPage ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => onPageChange(page)}
                                        className={`h-8 w-8 p-0 ${
                                            page === currentPage 
                                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                : 'hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                    >
                                        <span className="sr-only">Page {page}</span>
                                        {page}
                                    </Button>
                                );
                            })}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="h-8 w-8 p-0"
                    >
                        <span className="sr-only">Next page</span>
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
} 