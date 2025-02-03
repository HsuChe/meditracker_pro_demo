"use client"

import { useState, useEffect } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FilterCondition } from "@/components/filter-condition"
import { X, CornerDownRight } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string | null;
  secondValue?: string;
}

interface FilterKey {
  id: string;
  conditions: FilterCondition[];
  children: FilterKey[];
}

interface SavedFilter {
  name: string
  keyColumns: string[]
  filterKeys: FilterKey[]
}

interface ClaimData {
  [key: string]: any
}

// Add new interface for the API response
interface ClaimsResponse {
  claims: ClaimData[];
  statistics: {
    totalRecords: number;
    uniqueClaimIds: number;
    totalAllowedAmount: number;
    dateRange: {
      min: string;
      max: string;
    };
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface FilterConditionProps {
  id: string;
  condition: FilterCondition;
  onRemove: (id: string) => void;
  onChange: (updates: Partial<FilterCondition>) => void;
  isChild: boolean;
  availableColumns: ColumnInfo[];
  operators?: string[];
}

// Add these type definitions at the top with other interfaces
type DataType = 'string' | 'number' | 'date' | 'boolean';

interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: DataType;
}

// Add this operator mapping
const OPERATORS_BY_TYPE: Record<DataType, string[]> = {
  string: ['equals', 'contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null'],
  number: ['equals', 'greater_than', 'less_than', 'between', 'is_null', 'is_not_null'],
  date: ['equals', 'before', 'after', 'between', 'is_null', 'is_not_null'],
  boolean: ['equals', 'is_null', 'is_not_null']
};

// Add this utility function at the top of the file, after the imports
const formatColumnName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function FilterPage() {
  // Basic state
  const [filterName, setFilterName] = useState("")
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{
    id: "root",
    conditions: [{
      id: "condition1",
      column: "",
      operator: "equals",
      value: null
    }],
    children: []
  }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string | null>(null)
  
  // Data and loading states
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Pagination states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)

  // Statistics state
  const [statistics, setStatistics] = useState<{
    uniqueClaimIds: number;
    dateRange: { min: string; max: string } | null;
    totalAllowedAmount: number;
    totalRecords: number;
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Add function to infer data type
  const inferDataType = (value: any): DataType => {
    if (value instanceof Date) return 'date'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    return 'string'
  }

  // Modify the initialization effect
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        setIsLoading(true)
        console.log("Fetching data from API..."); // Debug log
        const response = await fetch(
          `http://localhost:5000/api/filters/claims?page=${page}&limit=${pageSize}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch claims data')
        }

        const data: ClaimsResponse = await response.json()
        
        if (data.claims && data.claims.length > 0 && isMounted) {
          setClaims(data.claims)
          
          // Create column info with data types and formatted names
          const columnInfo: ColumnInfo[] = Object.entries(data.claims[0])
            .map(([name, value]) => ({
              name, // Keep original name for data access
              displayName: formatColumnName(name), // Add formatted name for display
              dataType: inferDataType(value)
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
          
          console.log("Setting columns:", columnInfo); // More specific log
          setColumns(columnInfo)
          setTotalRecords(data.pagination.total)
          setStatistics({
            uniqueClaimIds: data.statistics.uniqueClaimIds,
            dateRange: {
              min: data.statistics.dateRange.min,
              max: data.statistics.dateRange.max,
            },
            totalAllowedAmount: data.statistics.totalAllowedAmount,
            totalRecords: data.statistics.totalRecords,
          })

          setIsInitialized(true)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeData()

    return () => {
      isMounted = false;
    }
  }, []) // Empty dependency array for initial load only

  // Only render content after initialization
  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

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
                operator: "equals",
                value: null
              }
            ]
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
          return { ...key, conditions: key.conditions.filter((id) => id !== conditionId) }
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
              { id: `group${key.children.length + 1}`, conditions: [{ id: "condition1", column: "", operator: "equals", value: null }], children: [] },
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
          const oldIndex = key.conditions.indexOf(active.id as string)
          const newIndex = key.conditions.indexOf(over?.id as string)
          if (oldIndex !== -1 && newIndex !== -1) {
            return { ...key, conditions: arrayMove(key.conditions, oldIndex, newIndex) }
          }
          return { ...key, children: key.children.map(updateKey) }
        }
        return keys.map(updateKey)
      })
    }
  }

  const handleConditionChange = (keyId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return {
            ...key,
            conditions: key.conditions.map((condition) =>
              condition.id === conditionId
                ? { ...condition, ...updates }
                : condition
            )
          }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

  const renderFilterKey = (key: FilterKey, level = 0) => (
    <div key={key.id} className={`ml-${level * 4}`}>
      <div className="flex items-center gap-2 mb-2">
        {level > 0 && (
          <div className="flex items-center">
            <CornerDownRight className="h-4 w-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium text-muted-foreground">
              Subgroup {key.id.replace("group", "")}
            </span>
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
        <SortableContext items={key.conditions.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {key.conditions.map((condition) => renderFilterCondition(condition, key.id))}
        </SortableContext>
      </DndContext>
      {key.children.map((childKey) => renderFilterKey(childKey, level + 1))}
    </div>
  )

  const renderFilterCondition = (condition: FilterCondition, keyId: string) => {
    const selectedColumn = columns.find(col => col.name === condition.column)
    const operators = selectedColumn ? OPERATORS_BY_TYPE[selectedColumn.dataType] : []

    return (
      <FilterCondition
        key={condition.id}
        id={condition.id}
        condition={condition}
        onRemove={(id) => removeCondition(keyId, id)}
        onChange={(updates) => handleConditionChange(keyId, condition.id, updates)}
        isChild={false}
        availableColumns={columns}
        operators={operators}
      />
    )
  }

  const applyFilter = () => {
    const getKeyColumns = (key: FilterKey): string[] => {
      const keyColumn = key.conditions[0]?.column || '';
      const childrenKeys = key.children.flatMap(getKeyColumns);
      return keyColumn ? [keyColumn, ...childrenKeys] : childrenKeys;
    };

    const keyColumns = getKeyColumns(filterKeys[0]);
    console.log("Applying filter:", { filterName, keyColumns, filterKeys })
  }

  const resetFilter = () => {
    setFilterName("")
    setFilterKeys([{ 
      id: "root", 
      conditions: [{ id: "condition1", column: "", operator: "equals", value: null }], 
      children: [] 
    }])
    setSelectedSavedFilter(null)
  }

  const saveFilter = () => {
    if (filterName) {
      const newSavedFilter: SavedFilter = {
        name: filterName,
        keyColumns: [],
        filterKeys,
      }
      setSavedFilters([...savedFilters, newSavedFilter])
      alert(`Filter "${filterName}" has been saved.`)
    } else {
      alert("Please enter a filter name before saving.")
    }
  }

  const loadSavedFilter = (filterName: string) => {
    const filter = savedFilters.find((f) => f.name === filterName)
    if (filter) {
      setFilterName(filter.name)
      setFilterKeys(filter.filterKeys)
      setSelectedSavedFilter(filterName)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Filter Management</h1>

      <div className="mb-8">
        <Label htmlFor="saved-filters">Saved Filters</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedSavedFilter || "Select a saved filter..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search filters..." className="h-9" />
              <CommandEmpty>No filter found.</CommandEmpty>
              <CommandGroup>
                {savedFilters.map((filter) => (
                  <CommandItem
                    key={filter.name}
                    value={filter.name}
                    onSelect={(value) => {
                      loadSavedFilter(value)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSavedFilter === filter.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {filter.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
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

      {/* Add Statistics Section */}
      {statistics && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Dataset Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Unique Claims</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {(statistics.uniqueClaimIds || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Date Range</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {statistics.dateRange ? (
                  <>
                    {new Date(statistics.dateRange.min).toLocaleDateString()} - {new Date(statistics.dateRange.max).toLocaleDateString()}
                  </>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Total Allowed Amount</div>
              <div className="text-lg md:text-xl font-bold truncate">
                ${(statistics.totalAllowedAmount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Total Records</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {(statistics.totalRecords || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modified Results Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Results</h2>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4">{error}</div>
        ) : !claims.length ? (
          <div className="text-center p-8 border rounded-lg bg-muted">
            <p className="text-muted-foreground">No claims found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * pageSize + 1, totalRecords)} to{' '}
                {Math.min(page * pageSize, totalRecords)} of {totalRecords} records
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value))
                    setPage(1) // Reset to first page when changing page size
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue>{pageSize}</SelectValue>
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
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    {columns.map((column) => (
                      <TableHead key={column.name} className="text-foreground">
                        {column.displayName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim, index) => (
                    <TableRow key={index} className="border-b border-border">
                      {columns.map((column) => (
                        <TableCell key={column.name} className="text-foreground">
                          {claim[column.name]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(totalRecords / pageSize)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalRecords}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

