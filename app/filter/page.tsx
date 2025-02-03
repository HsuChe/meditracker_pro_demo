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

interface FilterKey {
  id: string
  conditions: string[]
  children: FilterKey[]
}

interface SavedFilter {
  name: string
  keyColumns: string[]
  filterKeys: FilterKey[]
}

interface ClaimData {
  [key: string]: any
}

// Update ClaimsResponse interface to match exact API response
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

export default function FilterPage() {
  const [filterName, setFilterName] = useState("")
  const [keyColumns, setKeyColumns] = useState<string[]>([])
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{ id: "root", conditions: ["condition1"], children: [] }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string | null>(null)
  
  // New states for claims data
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pagination, setPagination] = useState<ClaimsResponse['pagination']>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0
  })

  // Add new state variables for statistics
  const [statistics, setStatistics] = useState<ClaimsResponse['statistics'] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Fetch claims data
  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `http://localhost:5000/api/filters/claims?page=${page}&limit=${pageSize}${
            selectedSavedFilter ? `&filterId=${selectedSavedFilter}` : ''
          }`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch claims data');
        }

        const data: ClaimsResponse = await response.json();
        if (data.claims && data.claims.length > 0) {
          setClaims(data.claims);
          setColumns(Object.keys(data.claims[0]));
          setStatistics(data.statistics);
          setPagination(data.pagination);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClaims();
  }, [page, pageSize, selectedSavedFilter]);

  const addCondition = (keyId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return { ...key, conditions: [...key.conditions, `condition${key.conditions.length + 1}`] }
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
              { id: `group${key.children.length + 1}`, conditions: ["condition1"], children: [] },
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
          {key.conditions.map((conditionId) => (
            <FilterCondition
              key={conditionId}
              id={conditionId}
              onRemove={(id) => removeCondition(key.id, id)}
              isChild={level > 0}
            />
          ))}
        </SortableContext>
      </DndContext>
      {key.children.map((childKey) => renderFilterKey(childKey, level + 1))}
    </div>
  )

  const applyFilter = () => {
    console.log("Applying filter:", { filterName, keyColumns, filterKeys })
  }

  const resetFilter = () => {
    setFilterName("")
    setKeyColumns([])
    setFilterKeys([{ id: "root", conditions: ["condition1"], children: [] }])
    setSelectedSavedFilter(null)
  }

  const saveFilter = () => {
    if (filterName) {
      const newSavedFilter: SavedFilter = {
        name: filterName,
        keyColumns,
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
      setKeyColumns(filter.keyColumns)
      setFilterKeys(filter.filterKeys)
      setSelectedSavedFilter(filterName)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Filter Management</h1>

      <div className="mb-8">
        <Label htmlFor="saved-filters">Saved Filters</Label>
        <Select value={selectedSavedFilter || undefined} onValueChange={loadSavedFilter}>
          <SelectTrigger id="saved-filters" className="bg-background text-foreground">
            <SelectValue placeholder="Select a saved filter" />
          </SelectTrigger>
          <SelectContent>
            {savedFilters.map((filter) => (
              <SelectItem key={filter.name} value={filter.name}>
                {filter.name}
              </SelectItem>
            ))}
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

        <Label htmlFor="key-columns">Key Columns</Label>
        <Select value={keyColumns[0]} onValueChange={(value) => setKeyColumns([value])}>
          <SelectTrigger id="key-columns" className="bg-background text-foreground">
            <SelectValue placeholder="Select key columns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="column1">Column 1</SelectItem>
            <SelectItem value="column2">Column 2</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Dataset Statistics Section */}
      {statistics && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Dataset Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Unique Claims</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {statistics.uniqueClaimIds.toLocaleString()}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Date Range</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {new Date(statistics.dateRange.min).toLocaleDateString()} - {new Date(statistics.dateRange.max).toLocaleDateString()}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Total Allowed Amount</div>
              <div className="text-lg md:text-xl font-bold truncate">
                ${statistics.totalAllowedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Total Records</div>
              <div className="text-lg md:text-xl font-bold truncate">
                {statistics.totalRecords.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section with Updated Pagination */}
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
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
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
                      <TableHead key={column} className="text-foreground">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim, index) => (
                    <TableRow key={index} className="border-b border-border">
                      {columns.map((column) => (
                        <TableCell key={column} className="text-foreground">
                          {claim[column]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={pagination.page === pagination.pages}
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

