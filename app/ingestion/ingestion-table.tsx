"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/ui/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search } from "lucide-react"
import { addDays } from "date-fns"

interface IngestedData {
  ingested_data_id: number;
  name: string;
  type: string;
  ingestion_date: string;
  mapping: {
    csvColumn: string;
    dbColumn: string;
  }[];
  activity_status: 'active' | 'deleted';
  processing_status: 'processing' | 'completed' | 'failed';
  record_count: number;
  file_size_bytes: number;
  ingestion_duration_ms: number;
  current_record_count: number;
  total_size_bytes: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface SearchFilters {
  name: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

interface IngestionTableProps {
  refreshTrigger?: number;
}

export function IngestionTable({ refreshTrigger = 0 }: IngestionTableProps) {
  const [ingestedData, setIngestedData] = useState<IngestedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalRecords: 0,
    pageSize: 50
  });
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    name: "",
    dateRange: {
      from: undefined,
      to: undefined
    }
  });

  const fetchIngestedData = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        pageSize: pagination.pageSize.toString()
      });

      if (searchFilters.name) {
        params.append('name', searchFilters.name);
      }
      if (searchFilters.dateRange.from) {
        params.append('fromDate', searchFilters.dateRange.from.toISOString());
      }
      if (searchFilters.dateRange.to) {
        params.append('toDate', searchFilters.dateRange.to.toISOString());
      }

      const response = await fetch(
        `http://localhost:5000/api/ingested-data?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setIngestedData(data.records);
        setPagination(prev => ({
          ...prev,
          totalPages: data.pagination.totalPages,
          totalRecords: data.pagination.totalRecords
        }));
      } else {
        // Add error details
        const errorData = await response.text();
        console.error('Server response not OK:', response.status, errorData);
      }
    } catch (error) {
      // More detailed error logging
      console.error('Error fetching ingested data:', {
        message: error.message,
        stack: error.stack,
        error
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngestedData();
  }, [pagination.currentPage, pagination.pageSize, refreshTrigger, searchFilters]);

  const handleView = useCallback(async (id: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/ingested-data/${id}`);
      if (response.ok) {
        const metadata = await response.json();
        // Show metadata in a modal or new page
        console.log(metadata);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this ingestion and its associated claims?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/ingested-data/${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Refresh the table data
          fetchIngestedData();
        } else {
          throw new Error('Failed to delete ingestion');
        }
      } catch (error) {
        console.error('Error deleting ingestion:', error);
        alert('Error deleting ingestion');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete ALL ingestion records and their associated claims? This cannot be undone.')) {
      try {
        const response = await fetch('http://localhost:5000/api/ingested-data/clear-all', {
          method: 'DELETE'
        });
        
        if (response.ok) {
          fetchIngestedData();
        } else {
          throw new Error('Failed to clear ingestion data');
        }
      } catch (error) {
        console.error('Error clearing ingestion data:', error);
        alert('Error clearing ingestion data');
      }
    }
  };

  // Add status indicators and progress info
  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Ingested Data</h2>
        <Button 
          variant="destructive" 
          onClick={handleClearAll}
        >
          Clear All
        </Button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchFilters.name}
                onChange={(e) => setSearchFilters(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-[300px]">
            <DatePickerWithRange
              date={searchFilters.dateRange}
              onDateChange={(newDate) => setSearchFilters(prev => ({
                ...prev,
                dateRange: newDate
              }))}
            />
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Total Records: {pagination.totalRecords.toLocaleString()}
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingestedData.map((data) => (
                <TableRow key={data.ingested_data_id}>
                  <TableCell>{data.name}</TableCell>
                  <TableCell>{data.type}</TableCell>
                  <TableCell>
                    {new Date(data.ingestion_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {data.record_count.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {formatSize(data.file_size_bytes)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge 
                      activity_status={data.activity_status} 
                      processing_status={data.processing_status} 
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleView(data.ingested_data_id)}
                      >
                        Details
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(data.ingested_data_id)}
                        disabled={data.processing_status === 'processing'}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords)}{' '}
              of {pagination.totalRecords.toLocaleString()} records
            </div>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setPagination(prev => ({ ...prev, currentPage: page }))}
            />
          </div>
        </>
      )}
    </div>
  );
} 