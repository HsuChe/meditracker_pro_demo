import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { ClaimData } from "../types"
import { useClaimsStore } from '../stores/claims-store';
import { TablePagination } from './table-pagination';

interface ClaimsTableProps {
    data: ClaimData[];
    columns: string[];
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalRecords: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

export const ClaimsTable: React.FC<ClaimsTableProps> = ({ 
    data: tableData,
    columns, 
    currentPage, 
    totalPages, 
    pageSize, 
    totalRecords, 
    onPageChange, 
    onPageSizeChange 
}) => {
    const { 
        getCurrentPageData, 
        currentPage: storeCurrentPage, 
        pageSize: storePageSize, 
        metadata,
        setCurrentPage,
        setPageSize
    } = useClaimsStore();

    return (
        <div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border">
                            {metadata?.columns.map((column) => (
                                <TableHead key={column} className="text-foreground">
                                    {column}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tableData.map((row, index) => (
                            <TableRow key={row.claim_merged_id || index} className="border-b border-border">
                                {metadata?.columns.map((column) => (
                                    <TableCell key={column} className="text-foreground">
                                        {row[column]?.toString() || '-'}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {tableData.length === 0 && (
                    <div className="text-center p-4 text-muted-foreground">
                        No results found
                    </div>
                )}
            </div>

            {metadata && (
                <TablePagination
                    currentPage={currentPage}
                    totalPages={metadata.totalPages}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            )}
        </div>
    )
} 