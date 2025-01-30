"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { StatusBadge } from "@/components/ui/status-badge"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { Search, ChevronDown, ChevronRight } from "lucide-react"
import { addDays } from "date-fns"

interface IngestedData {
  ingested_data_id: number;
  name: string;
  type: string;
  ingestion_date: string;
  record_count: number;
  file_size_bytes: number;
  activity_status: 'active' | 'deleted';
  processing_status: 'processing' | 'completed' | 'failed';
  batch_number?: number;
  total_batches?: number;
}

interface GroupedIngestedData {
  name: string;
  batches: IngestedData[];
  totalRecords: number;
  totalSize: number;
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
  activeTab: 'csv' | 'lut';
}

export function IngestionTable({ refreshTrigger = 0, activeTab }: IngestionTableProps) {
  const [ingestedData, setIngestedData] = useState<GroupedIngestedData[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const fetchIngestedData = async () => {
    setLoading(true);
    try {
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

      const endpoint = activeTab === 'csv' 
        ? `http://localhost:5000/api/ingested-data?${params.toString()}`
        : `http://localhost:5000/api/luts?${params.toString()}`;

      const response = await fetch(endpoint);

      if (response.ok) {
        const data = await response.json();
        
        // Group the data by ingestion name
        const groupedData = data.records.reduce((acc: GroupedIngestedData[], item: IngestedData) => {
          const existingGroup = acc.find(group => group.name === item.name);
          
          if (existingGroup) {
            existingGroup.batches.push(item);
            existingGroup.totalRecords += item.record_count;
            existingGroup.totalSize += item.file_size_bytes;
          } else {
            acc.push({
              name: item.name,
              batches: [item],
              totalRecords: item.record_count,
              totalSize: item.file_size_bytes
            });
          }
          return acc;
        }, []);

        setIngestedData(groupedData);
        setPagination(prev => ({
          ...prev,
          totalRecords: data.pagination.totalRecords,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngestedData();
  }, [pagination.currentPage, pagination.pageSize, refreshTrigger, searchFilters, activeTab]);

  const handleView = useCallback(async (id: number, type: string) => {
    try {
      const endpoint = type === 'LUT' 
        ? `http://localhost:5000/api/luts/${id}`
        : `http://localhost:5000/api/ingested-data/${id}`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        // Show metadata and entries in a modal
        console.log(data);
        // TODO: Implement modal to show details
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  }, []);

  const handleDelete = async (id: number, type: string) => {
    const message = type === 'LUT' 
      ? 'Are you sure you want to delete this LUT and all its entries?'
      : 'Are you sure you want to delete this ingestion and its associated claims?';

    if (confirm(message)) {
      try {
        const endpoint = type === 'LUT'
          ? `http://localhost:5000/api/luts/${id}`
          : `http://localhost:5000/api/ingested-data/${id}`;

        const response = await fetch(endpoint, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          fetchIngestedData();
        } else {
          throw new Error(`Failed to delete ${type.toLowerCase()}`);
        }
      } catch (error) {
        console.error(`Error deleting ${type.toLowerCase()}:`, error);
        alert(`Error deleting ${type.toLowerCase()}`);
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
                dateRange: {
                  from: newDate?.from,
                  to: newDate?.to
                }
              }))}
            />
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        Total Records: {(pagination.totalRecords || 0).toLocaleString()}
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
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total Records</TableHead>
                <TableHead>Total Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingestedData.map((group) => (
                <>
                  <TableRow 
                    key={group.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleGroup(group.name)}
                  >
                    <TableCell>
                      {expandedGroups.has(group.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.batches[0].type}</TableCell>
                    <TableCell>
                      {new Date(group.batches[0].ingestion_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{group.totalRecords.toLocaleString()}</TableCell>
                    <TableCell>{formatSize(group.totalSize)}</TableCell>
                    <TableCell>
                      <StatusBadge 
                        activity_status={group.batches[0].activity_status}
                        processing_status={group.batches[0].processing_status}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(group.batches[0].ingested_data_id, group.batches[0].type);
                        }}
                      >
                        Delete All
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedGroups.has(group.name) && group.batches.map((batch) => (
                    <TableRow key={batch.ingested_data_id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="pl-8">
                        Batch {batch.batch_number} of {batch.total_batches}
                      </TableCell>
                      <TableCell>{batch.type}</TableCell>
                      <TableCell>
                        {new Date(batch.ingestion_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{batch.record_count.toLocaleString()}</TableCell>
                      <TableCell>{formatSize(batch.file_size_bytes)}</TableCell>
                      <TableCell>
                        <StatusBadge 
                          activity_status={batch.activity_status}
                          processing_status={batch.processing_status}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleView(batch.ingested_data_id, batch.type)}
                          >
                            Details
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(batch.ingested_data_id, batch.type)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords || 0)}{' '}
              of {(pagination.totalRecords || 0).toLocaleString()} records
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