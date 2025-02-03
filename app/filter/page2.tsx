"use client"

import { useState, useCallback, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterCondition } from "@/components/filter-condition"
import { X, CornerDownRight, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { MetadataDisplay } from "./components/metadata-display"
import { ClaimsTable } from "./components/claims-table"
import { calculateMetadata } from "./utils/metadata"
import { useClaimsStore } from './stores/claims-store'
import { ChevronLeftIcon } from "@heroicons/react/24/outline"

// Types based on our backend implementation
interface FilterCondition {
  id: string
  column: string
  operator: string
  value: string
  secondValue?: string
}

interface FilterKey {
  id: string
  conditions: FilterCondition[]
  children: FilterKey[]
}

interface SavedFilter {
  filter_id: number
  name: string
  description?: string
  conditions: FilterCondition[]
  claims_ids: number[]
  last_run?: string
  run_count: number
}

interface FilterResults {
  results: any[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
  execution_time_ms: number
}

interface ClaimData {
  claim_merged_id: number
  claim_id: string
  patient_id: number
  date_of_birth: string
  gender: string | null
  provider_id: number
  facility_id: number
  diagnosis_code: string
  procedure_code: string
  admission_date: string | null
  discharge_date: string | null
  revenue_code: string | null
  modifiers: string | null
  claim_type: string | null
  total_charges: number
  allowed_amount: number
  [key: string]: any // For flexibility with dynamic columns
}

interface TableMetadata {
  totalRecords: number
  currentPage: number
  totalPages: number
  pageSize: number
  totalAmount: number
  averageAmount: number
  uniquePatients: number
  columns: string[]
  dateRange: {
    start: string
    end: string
  }
}

// Add this type for pagination props
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface FilterConditionProps {
  key: string;
  id: string;
  column: string;
  operator: string;
  value: string;
  secondValue?: string;
  onRemove: (id: string) => void;
  onUpdate: (updates: { column?: string; operator?: string; value?: string; secondValue?: string }) => void;
  isChild: boolean;
}

interface ClaimsTableProps {
  data: ClaimData[];
  columns: string[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newSize: number) => void;
}

// Update the TablePagination component
const TablePagination: React.FC<PaginationProps & { pageSize: number; onPageSizeChange: (size: number) => void }> = 
  ({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }) => {
  
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
          {/* Previous Button */}
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

          {/* Page Numbers */}
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                return page === 1 || 
                       page === totalPages || 
                       Math.abs(page - currentPage) <= 1
              })
              .map((page, index, array) => {
                // Show ellipsis
                if (index > 0 && page - array[index - 1] > 1) {
                  return (
                    <div key={`ellipsis-${page}`} className="px-2 py-1">
                      <span className="text-muted-foreground">...</span>
                    </div>
                  );
                }
                
                // Page number button
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

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">Next page</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function FilterPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [filterName, setFilterName] = useState("")
  const [description, setDescription] = useState("")
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{ id: "root", conditions: [], children: [] }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedFilter, setSelectedFilter] = useState<SavedFilter | null>(null)
  const [results, setResults] = useState<FilterResults | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [claimsData, setClaimsData] = useState<ClaimData[]>([])
  const [tableColumns, setTableColumns] = useState<string[]>([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [metadata, setMetadata] = useState<TableMetadata | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { fetchAllClaims, isLoading: claimsLoading } = useClaimsStore()

  // Update the fetchClaimsData function
  const fetchClaimsData = useCallback(async (page: number = 1, limit: number = pageSize) => {
    setIsLoadingResults(true);
    try {
        // Get total count for pagination
        const countResponse = await fetch('http://localhost:5000/api/claims/count');
        const { total } = await countResponse.json();

        // Get total metadata
        const metadataResponse = await fetch('http://localhost:5000/api/claims/metadata');
        const metadataStats = await metadataResponse.json();

        // Get paginated data
        const response = await fetch(`http://localhost:5000/api/claims?page=${page}&limit=${limit}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Update claims data
        setClaimsData(data);

        // Set metadata combining pagination info with total stats
        setMetadata({
            totalRecords: total,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            pageSize: limit,
            totalAmount: metadataStats.totalAmount,
            averageAmount: metadataStats.averageAmount,
            uniquePatients: metadataStats.uniquePatients,
            columns: Object.keys(data[0]),
            dateRange: {
                start: '',
                end: ''
            }
        });

        // Update columns if we have data
        if (data?.length > 0) {
            const columns = Object.keys(data[0]);
            setTableColumns(columns);
            setColumns(columns);
        }
    } catch (error) {
        console.error('Error fetching claims data:', error);
        toast({
            title: "Error",
            description: "Failed to fetch claims data",
            variant: "destructive",
        });
    } finally {
        setIsLoadingResults(false);
    }
  }, [pageSize, toast]);

  // Update useEffect to use the memoized function
  useEffect(() => {
    fetchClaimsData(currentPage, pageSize)
  }, [fetchClaimsData, currentPage, pageSize])

  // Update the columns fetch useEffect
  useEffect(() => {
    const fetchColumns = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/db-columns');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Validate the response structure
            if (!data || !data.success || !Array.isArray(data.columns)) {
                console.error('Invalid columns response:', data);
                throw new Error('Invalid response structure from server');
            }
            
            setColumns(data.columns);
        } catch (error) {
            console.error('Error fetching columns:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to fetch available columns",
                variant: "destructive",
            });
        }
    };
    fetchColumns();
  }, [toast]);

  // Update saved filters fetch useEffect
  useEffect(() => {
    const fetchSavedFilters = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/filters/saved')
        const data = await response.json()
        setSavedFilters(data.filters)
      } catch (error) {
        console.error('Error fetching saved filters:', error)
        toast({
          title: "Error",
          description: "Failed to fetch saved filters",
          variant: "destructive",
        })
      }
    }
    fetchSavedFilters()
  }, [toast])

  useEffect(() => {
    fetchAllClaims();
  }, [fetchAllClaims]);

  const addCondition = (keyId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return {
            ...key,
            conditions: [
              ...key.conditions,
              {
                id: `condition${key.conditions.length + 1}`,
                column: "",
                operator: "",
                value: "",
              },
            ],
          }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

  const updateCondition = (keyId: string, conditionId: string, updates: { 
    column?: string; 
    operator?: string; 
    value?: string; 
    secondValue?: string; 
  }) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return {
            ...key,
            conditions: key.conditions.map((condition) =>
              condition.id === conditionId ? { ...condition, ...updates } : condition
            ),
          }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

  const removeCondition = (keyId: string, conditionId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return { ...key, conditions: key.conditions.filter((condition) => condition.id !== conditionId) }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

  const addKey = (parentId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === parentId) {
          return {
            ...key,
            children: [
              ...key.children,
              { id: `group${key.children.length + 1}`, conditions: [], children: [] },
            ],
          }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

  const removeKey = (keyId: string) => {
    setFilterKeys((keys) => {
      const removeKeyFromChildren = (children: FilterKey[]): FilterKey[] => {
        return children
          .filter((child) => child.id !== keyId)
          .map((child) => ({
            ...child,
            children: removeKeyFromChildren(child.children),
          }))
      }
      return keys
        .filter((key) => key.id !== keyId)
        .map((key) => ({
          ...key,
          children: removeKeyFromChildren(key.children),
        }))
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setFilterKeys((keys) => {
        const updateKey = (key: FilterKey): FilterKey => {
          const oldIndex = key.conditions.findIndex((c) => c.id === active.id)
          const newIndex = key.conditions.findIndex((c) => c.id === over?.id)
          if (oldIndex !== -1 && newIndex !== -1) {
            return {
              ...key,
              conditions: arrayMove(key.conditions, oldIndex, newIndex),
            }
          }
          return { ...key, children: key.children.map(updateKey) }
        }
        return keys.map(updateKey)
      })
    }
  }

  const renderFilterKey = (key: FilterKey, level = 0) => (
    <div key={key.id} className={`ml-${level * 4}`}>
      <div className="flex items-center gap-2 mb-2">
        {level > 0 && (
          <div className="flex items-center">
            <CornerDownRight className="h-4 w-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium text-muted-foreground">Subgroup {key.id.replace("group", "")}</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => addCondition(key.id)}>
          Add Condition
        </Button>
        <Button variant="outline" size="sm" onClick={() => addKey(key.id)}>
          Add Subgroup
        </Button>
        {key.id !== "root" && (
          <Button variant="ghost" size="icon" onClick={() => removeKey(key.id)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={key.conditions} strategy={verticalListSortingStrategy}>
          {key.conditions.map((condition) => (
            <FilterCondition
              key={condition.id}
              id={condition.id}
              column={condition.column}
              operator={condition.operator}
              value={condition.value}
              secondValue={condition.secondValue}
              onRemove={(id) => removeCondition(key.id, id)}
              onUpdate={(updates: { column?: string; operator?: string; value?: string; secondValue?: string }) => 
                updateCondition(key.id, condition.id, updates)}
              isChild={level > 0}
            />
          ))}
        </SortableContext>
      </DndContext>
      {key.children.map((childKey) => renderFilterKey(childKey, level + 1))}
    </div>
  )

  const applyFilter = async () => {
    setIsLoadingResults(true);
    try {
        // Get all conditions from the filter keys
        const allConditions = filterKeys.flatMap(key => key.conditions)
            .filter(condition => condition.column && condition.operator); // Only include complete conditions

        // Execute filter with conditions
        const response = await fetch(`http://localhost:5000/api/filters/execute`, {  // Remove query params from URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                conditions: allConditions,
                page: currentPage,
                limit: pageSize
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Update state with filtered results
        if (data.records) {  // Check if records exist in response
            setClaimsData(data.records);
            setMetadata(data.metadata);

            if (data.records.length > 0) {
                const columns = Object.keys(data.records[0]);
                setTableColumns(columns);
            }
        } else {
            // Handle empty results
            setClaimsData([]);
            setMetadata({
                totalRecords: 0,
                currentPage: 1,
                totalPages: 0,
                pageSize: pageSize
            });
        }

    } catch (error) {
        console.error('Error applying filter:', error);
        toast({
            title: "Error",
            description: "Failed to apply filter",
            variant: "destructive",
        });
    } finally {
        setIsLoadingResults(false);
    }
  };

  const resetFilter = async () => {
    setFilterName("");
    setFilterKeys([{ id: "root", conditions: [], children: [] }]);
    setSelectedFilter(null);
    
    // Execute filter with no conditions to get all records
    await applyFilter();
  };

  const saveFilter = () => {
    if (filterName) {
      const newSavedFilter: SavedFilter = {
        filter_id: 0, // This should be replaced with actual implementation
        name: filterName,
        description,
        conditions: filterKeys.flatMap((key) => key.conditions),
        claims_ids: [], // This should be replaced with actual implementation
        run_count: 0, // This should be replaced with actual implementation
      }
      setSavedFilters([...savedFilters, newSavedFilter])
      alert(`Filter "${filterName}" has been saved.`)
    } else {
      alert("Please enter a filter name before saving.")
    }
  }

  const loadSavedFilter = (filterName: string) => {
    if (filterName === 'no-filters') return;
    
    const filter = savedFilters?.find((f) => f.name === filterName);
    if (filter) {
      setFilterName(filter.name);
      setDescription(filter.description || "");
      setFilterKeys(filter.conditions.map((c) => ({
        id: c.id,
        conditions: [c],
        children: [],
      })));
      setSelectedFilter(filter);
    }
  }

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    fetchClaimsData(page, pageSize);
  }, [pageSize, fetchClaimsData]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
    fetchClaimsData(1, newSize);
  }, [fetchClaimsData]);

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Filter Management</h1>

      <div className="mb-8">
        <Label htmlFor="saved-filters">Saved Filters</Label>
        <Select value={selectedFilter?.name || undefined} onValueChange={loadSavedFilter}>
          <SelectTrigger id="saved-filters" className="bg-background text-foreground">
            <SelectValue placeholder="Select a saved filter" />
          </SelectTrigger>
          <SelectContent>
            {savedFilters?.length > 0 ? (
              savedFilters.map((filter) => (
                <SelectItem key={filter.name} value={filter.name}>
                  {filter.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-filters" disabled>
                No saved filters
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        <Label htmlFor="filter-name">Filter Name</Label>
        <Input
          id="filter-name"
          placeholder="Enter filter name"
          className="mb-4 bg-background text-foreground"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />

        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="Enter filter description"
          className="bg-background text-foreground"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Filter Conditions</h2>
        {filterKeys.map((key) => renderFilterKey(key))}
      </div>

      <div className="flex gap-4 mb-8">
        <Button onClick={applyFilter}>Apply Filter</Button>
        <Button variant="outline" onClick={resetFilter}>
          Reset Filter
        </Button>
        <Button variant="secondary" onClick={saveFilter}>
          Save Filter
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Results</h2>
        
        {/* Metadata Cards */}
        {metadata && (
          <MetadataDisplay metadata={metadata} />
        )}

        {/* Results section */}
        {isLoadingResults ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <ClaimsTable
                data={claimsData}
                columns={tableColumns}
                currentPage={currentPage}
                totalPages={metadata?.totalPages || 0}
                pageSize={pageSize}
                totalRecords={metadata?.totalRecords || 0}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

