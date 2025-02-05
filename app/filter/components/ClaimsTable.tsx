import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { ClaimData, ColumnInfo, Statistics } from '../types';

interface ClaimsTableProps {
  claims: ClaimData[];
  columns: ColumnInfo[];
  page: number;
  pageSize: number;
  statistics: Statistics | null;
  expandedRows: Set<string>;
  isLoading: boolean;
  error: string | null;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onToggleRowExpansion: (claimId: string) => void;
}

const ClaimsTable: React.FC<ClaimsTableProps> = ({
  claims,
  columns,
  page,
  pageSize,
  statistics,
  expandedRows,
  isLoading,
  error,
  onPageChange,
  onPageSizeChange,
  onToggleRowExpansion,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!claims.length) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted">
        <p className="text-muted-foreground">No claims found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {claims.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, statistics?.uniqueClaimIds || 0)} of {statistics?.uniqueClaimIds || 0} unique claims
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Claims per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 75, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              {columns.map((column) => (
                <TableHead key={column.name}>{column.displayName}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((claim, pageIndex) => {
              const isExpanded = expandedRows.has(claim.claim_id);
              const groupedData = Array.isArray(claim.grouped_data) ? claim.grouped_data : [];
              const firstLineItem = groupedData[0];
              const hasGroupedData = groupedData.length > 1;
              
              return (
                <React.Fragment key={`${claim.claim_id}-${pageIndex}`}>
                  <TableRow>
                    <TableCell>
                      {hasGroupedData && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onToggleRowExpansion(claim.claim_id)}
                          className="h-6 w-6"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.name}>
                        {column.name === 'claim_id' 
                          ? claim.claim_id 
                          : firstLineItem?.[column.name]?.toString() || '-'}
                      </TableCell>
                    ))}
                  </TableRow>

                  {isExpanded && 
                   hasGroupedData && 
                   groupedData.slice(1).map((lineItem, subIndex) => (
                    <TableRow 
                      key={`${claim.claim_id}-${pageIndex}-sub-${subIndex}`}
                      className="bg-muted/50"
                    >
                      <TableCell>
                        <div className="w-6" />
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell key={column.name} className="text-sm">
                          {column.name === 'claim_id' 
                            ? claim.claim_id 
                            : lineItem?.[column.name]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Page {page} of {Math.ceil((statistics?.uniqueClaimIds || 0) / pageSize)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page * pageSize >= (statistics?.uniqueClaimIds || 0)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClaimsTable;