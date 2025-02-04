"use client"

import React from "react"
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
import { X, CornerDownRight, List as ListIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

// Add export to the FilterCondition interface
export interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string | string[] | null;
  secondValue?: string;
  isListValue?: boolean;
}

interface FilterKey {
  id: string;
  keyType: 'main' | 'sub' | null;  // null for regular conditions
  keyColumn?: string;  // The column this key groups by (e.g., 'claim_number' or 'line_id')
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

// Add this interface for the API response
interface ColumnTypeResponse {
  success: boolean;
  data: Array<{
    column: string;
    type: DataType;
  }>;
}

interface FilterConditionProps {
  id: string;
  condition: FilterCondition;
  onRemove: (id: string) => void;
  onChange: (updates: Partial<FilterCondition>) => void;
  isChild: boolean;
  availableColumns: ColumnInfo[];
  operators?: string[];
  renderValueInput?: () => React.ReactNode;
}

// Add these type definitions at the top with other interfaces
type DataType = 'string' | 'number' | 'date' | 'boolean';

interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: DataType;
}

// Update OPERATORS_BY_TYPE to match backend expectations
const OPERATORS_BY_TYPE: Record<DataType, string[]> = {
  string: ['equals', 'contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null'],
  number: ['equals', 'greater_than', 'less_than', 'between', 'is_null', 'is_not_null'],
  date: [
    'equals', 
    'before', 
    'after', 
    'between', 
    'is_null', 
    'is_not_null',
    'days_from_today',
    'business_days_from_today'
  ],
  boolean: ['equals', 'is_null', 'is_not_null']
};

// Add this utility function at the top of the file, after the imports
const formatColumnName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Add this interface to match the backend's expected condition format
interface BackendFilterCondition {
  column: string;
  operator: string;
  value: string | number | null;
  secondValue?: string | number;
}

// Add this helper function at the top of the file
const parseDelimitedInput = (input: string): string[] => {
  // Try different delimiters
  const delimiters = [',', ';', '|', '\t'];
  for (const delimiter of delimiters) {
    if (input.includes(delimiter)) {
      return input
        .split(delimiter)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
  }
  // If no delimiter found, return as single item
  return [input.trim()];
};

// Create a helper function to handle condition checking
const checkCondition = (value: any, filterValue: any, operator: string, secondValue?: any) => {
  switch (operator) {
    case 'equals':
      return typeof value === 'string' && typeof filterValue === 'string'
        ? value.toLowerCase() === filterValue.toLowerCase()
        : value === filterValue;
    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case 'is_null':
      return value === null || value === undefined;
    case 'is_not_null':
      return value !== null && value !== undefined;
    case 'greater_than':
      return Number(value) > Number(filterValue);
    case 'less_than':
      return Number(value) < Number(filterValue);
    case 'between':
      return Number(value) >= Number(filterValue) && 
             Number(value) <= Number(secondValue);
    case 'before':
      return new Date(value) < new Date(filterValue);
    case 'after':
      return new Date(value) > new Date(filterValue);
    case 'days_from_today':
    case 'business_days_from_today': {
      const days = parseInt(filterValue as string);
      if (isNaN(days)) return true;
      
      const isBusinessDays = operator === 'business_days_from_today';
      const { start, end } = calculateDateRange(days, isBusinessDays);
      const recordDate = new Date(value);
      return recordDate >= start && recordDate < end;
    }
    default:
      return true;
  }
};

// Update the groupDataByClaimId function to properly handle duplicates
const groupDataByClaimId = (data: ClaimData[]): ClaimData[] => {
  // First, group all records by claim_id
  const groupedData = data.reduce((acc, record) => {
    const claimId = record.claim_id;
    if (!acc[claimId]) {
      acc[claimId] = [];
    }
    acc[claimId].push(record);
    return acc;
  }, {} as Record<string, ClaimData[]>);

  // Then transform each group into our desired format
  return Object.entries(groupedData)
    .map(([claimId, records]) => {
      // Sort records to ensure consistent ordering
      const sortedRecords = records.sort((a, b) => {
        // You can add custom sorting logic here if needed
        // For example, sort by date or line number
        return a.line_id?.localeCompare(b.line_id || '') || 0;
      });

      // Use first record as main record and rest as grouped_data
      const [mainRecord, ...otherRecords] = sortedRecords;
      return {
        ...mainRecord,
        grouped_data: otherRecords
      };
    })
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));
};

export default function FilterPage() {
  // All state hooks first
  const [filterName, setFilterName] = useState("")
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{
    id: "root",
    keyType: null,
    conditions: [],
    children: [{
      id: "group1",
      keyType: 'main',
      keyColumn: 'claim_id',
      conditions: [{
        id: "condition1",
        column: "",
        operator: "equals",
        value: null
      }],
      children: []
    }]
  }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string | null>(null)
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [statistics, setStatistics] = useState<{
    uniqueClaimIds: number;
    dateRange: { min: string; max: string } | null;
    totalAllowedAmount: number;
    totalRecords: number;
  } | null>(null)
  const [isYearOpen, setIsYearOpen] = useState(false)
  const [isMonthOpen, setIsMonthOpen] = useState(false)
  const [cachedClaims, setCachedClaims] = useState<ClaimData[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Move sensors hook here, before any conditional returns
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // All useEffect hooks next
  useEffect(() => {
    if (cachedClaims.length > 0) {
      console.log('Cached Claims Size:', cachedClaims.length);
      console.log('Memory usage estimation:', 
        Math.round((JSON.stringify(cachedClaims).length * 2) / 1024 / 1024) + 'MB');
    }
  }, [cachedClaims]);

  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        // Log the request for debugging
        console.log('Fetching initial data from:', 'http://localhost:5000/api/filters/claims');
        
        const [claimsResponse, columnTypesResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/filters/claims?page=1&limit=${pageSize}`),
          fetch('http://localhost:5000/api/filters/claimsDtype')
        ]);

        if (!claimsResponse.ok) {
          throw new Error('Failed to fetch claims data');
        }
        if (!columnTypesResponse.ok) {
          throw new Error('Failed to fetch column types');
        }

        const claimsData: ClaimsResponse = await claimsResponse.json();
        console.log('Received claims data:', claimsData); // Debug log

        const columnTypes: ColumnTypeResponse = await columnTypesResponse.json();

        if (claimsData.claims && claimsData.claims.length > 0 && isMounted) {
          setClaims(claimsData.claims);
          setTotalRecords(claimsData.pagination.total);
          setStatistics({
            uniqueClaimIds: claimsData.statistics.uniqueClaimIds,
            dateRange: {
              min: claimsData.statistics.dateRange.min,
              max: claimsData.statistics.dateRange.max,
            },
            totalAllowedAmount: claimsData.statistics.totalAllowedAmount,
            totalRecords: claimsData.statistics.totalRecords,
          });

          // Set up columns
          const columnInfo: ColumnInfo[] = columnTypes.data
            .map(({ column, type }) => ({
              name: column,
              displayName: formatColumnName(column),
              dataType: type
            }))
            .sort((a, b) => {
              if (a.name === 'claim_id') return -1;
              if (b.name === 'claim_id') return 1;
              if (a.name === 'line_id') return -1;
              if (b.name === 'line_id') return 1;
              return a.displayName.localeCompare(b.displayName);
            });

          setColumns(columnInfo);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Error during initialization:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Then the conditional return
  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Add function to infer data type
  const inferDataType = (value: any): DataType => {
    if (value instanceof Date) return 'date'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    return 'string'
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
          // Don't remove if it's the last condition
          if (key.conditions.length <= 1) {
            return key;
          }
          return {
            ...key,
            conditions: key.conditions.filter((condition) => condition.id !== conditionId)
          };
        }
        return {
          ...key,
          children: key.children.map(updateKey)
        };
      };
      return keys.map(updateKey);
    });
  };

  const addKey = (parentId: string, keyType: 'main' | 'sub' = 'sub') => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === parentId) {
          return {
            ...key,
            children: [
              ...key.children,
              { 
                id: `group${key.children.length + 1}`, 
                keyType,
                // Default to 'claim_id' for main keys
                keyColumn: keyType === 'main' ? 'claim_id' : "",
                conditions: [{ 
                  id: "condition1", 
                  column: "", 
                  operator: "equals", 
                  value: null 
                }], 
                children: [] 
              },
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
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        // Find if this key contains both conditions
        const activeIndex = key.conditions.findIndex((c) => c.id === active.id);
        const overIndex = key.conditions.findIndex((c) => c.id === over.id);

        if (activeIndex !== -1 && overIndex !== -1) {
          // Both conditions are in this key, perform the swap
          const newConditions = [...key.conditions];
          const [movedCondition] = newConditions.splice(activeIndex, 1);
          newConditions.splice(overIndex, 0, movedCondition);
          return { ...key, conditions: newConditions };
        }

        // If not found in this key, check children
        return { ...key, children: key.children.map(updateKey) };
      };

      return keys.map(updateKey);
    });
  };

  const handleConditionChange = (keyId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return {
            ...key,
            conditions: key.conditions.map((condition) => {
              if (condition.id === conditionId) {
                const updatedCondition = { ...condition, ...updates };
                
                // Get column info for type checking
                const columnInfo = columns.find(col => col.name === updatedCondition.column);
                if (columnInfo) {
                  // Convert value based on column type
                  if (columnInfo.dataType === 'number' && typeof updatedCondition.value === 'string') {
                    updatedCondition.value = parseFloat(updatedCondition.value) || null;
                  } else if (columnInfo.dataType === 'boolean' && typeof updatedCondition.value === 'string') {
                    updatedCondition.value = updatedCondition.value.toLowerCase() === 'true';
                  }
                }
                
                return updatedCondition;
              }
              return condition;
            })
          };
        }
        return { ...key, children: key.children.map(updateKey) };
      };
      return keys.map(updateKey);
    });
  };

  const renderFilterKey = (key: FilterKey, level = 0) => (
    <div key={key.id} className={`ml-${level * 4}`}>
      <div className="flex items-center gap-2 mb-2">
        {level > 0 && (
          <div className="flex items-center gap-2">
            <CornerDownRight className="h-4 w-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium text-muted-foreground">
              {key.keyType === 'main' ? 'Main Key' : 'Sub Key'} {key.id.replace("group", "")}
            </span>
            {key.keyType === 'main' && (
              <span className="text-sm text-muted-foreground">
                (Claim ID)
              </span>
            )}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => addCondition(key.id)}>
          Add Condition
        </Button>
        {level === 0 && key.children.length === 0 && (
          <Button variant="outline" size="sm" onClick={() => addKey(key.id, 'main')}>
            Add Main Key
          </Button>
        )}
        {level > 0 && key.keyType === 'main' && (
          <Button variant="outline" size="sm" onClick={() => addKey(key.id, 'sub')}>
            Add Sub Key
          </Button>
        )}
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
    const selectedColumn = columns.find(col => col.name === condition.column);
    const operators = selectedColumn ? OPERATORS_BY_TYPE[selectedColumn.dataType] : [];

    const renderValueInput = () => {
      if (!selectedColumn) return null;

      const isDateType = selectedColumn.dataType === 'date';
      const isStringType = selectedColumn.dataType === 'string';
      const isBetweenOperator = condition.operator === 'between';
      const isDaysFromToday = condition.operator === 'days_from_today' || condition.operator === 'business_days_from_today';

      if (isStringType) {
        return (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter value or paste delimited values (comma, tab, semicolon, bar)"
                className="flex-1"
                value={condition.isListValue ? '' : (condition.value || '')}
                onChange={(e) => {
                  if (!condition.isListValue) {
                    handleConditionChange(keyId, condition.id, { value: e.target.value });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    e.preventDefault();
                    const inputValue = e.currentTarget.value;
                    const values = parseDelimitedInput(inputValue);
                    
                    // If multiple values detected or already in list mode
                    if (values.length > 1 || condition.isListValue) {
                      const currentValues = Array.isArray(condition.value) ? condition.value : [];
                      const updatedValues = [...currentValues, ...values];
                      handleConditionChange(keyId, condition.id, { 
                        isListValue: true,
                        value: updatedValues 
                      });
                    } else {
                      // Single value, keep in normal mode
                      handleConditionChange(keyId, condition.id, { 
                        value: values[0] 
                      });
                    }
                    e.currentTarget.value = '';
                  }
                }}
                onPaste={(e) => {
                  // Don't prevent default to allow the paste to show in input
                  const pastedText = e.clipboardData.getData('text');
                  
                  // If not in list mode, show the pasted text in the input
                  if (!condition.isListValue) {
                    handleConditionChange(keyId, condition.id, { 
                      value: pastedText 
                    });
                  } else {
                    // If already in list mode, append the values
                    const values = parseDelimitedInput(pastedText);
                    const currentValues = Array.isArray(condition.value) ? condition.value : [];
                    const updatedValues = [...currentValues, ...values];
                    handleConditionChange(keyId, condition.id, { 
                      isListValue: true,
                      value: updatedValues 
                    });
                  }
                }}
              />
              {condition.isListValue && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    handleConditionChange(keyId, condition.id, { 
                      isListValue: false,
                      value: null 
                    });
                  }}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {condition.isListValue && Array.isArray(condition.value) && condition.value.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {condition.value.map((val, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md"
                  >
                    <span className="text-sm">{val}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => {
                        const newValues = condition.value.filter((_, i) => i !== index);
                        handleConditionChange(keyId, condition.id, { 
                          value: newValues.length > 0 ? newValues : null,
                          isListValue: newValues.length > 0
                        });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (isDateType) {
        if (isDaysFromToday) {
          return (
            <div className="flex gap-2 items-center w-full">
              <Input
                type="number"
                value={condition.value || ''}
                onChange={(e) => {
                  const days = parseInt(e.target.value);
                  if (!isNaN(days)) {
                    const isBusinessDays = condition.operator === 'business_days_from_today';
                    const { start, end } = calculateDateRange(days, isBusinessDays);
                    handleConditionChange(keyId, condition.id, { 
                      value: days.toString(),
                      secondValue: start.toISOString() // Store the calculated date
                    });
                  }
                }}
                placeholder="Enter number of days..."
                className="flex-1"
              />
              {condition.secondValue && (
                <span className="text-sm text-muted-foreground">
                  ({new Date(condition.secondValue).toLocaleDateString()})
                </span>
              )}
            </div>
          );
        }

        return (
          <div className="flex gap-2 items-center w-full">
            <div className="flex-1">
              <DatePicker
                selected={condition.value ? new Date(condition.value) : null}
                onChange={(date: Date) => {
                  handleConditionChange(keyId, condition.id, { value: date?.toISOString() });
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors"
                placeholderText="Select date..."
                dateFormat="yyyy-MM-dd"
              />
            </div>
            {isBetweenOperator && (
              <>
                <span className="text-sm text-muted-foreground shrink-0">and</span>
                <div className="flex-1">
                  <DatePicker
                    selected={condition.secondValue ? new Date(condition.secondValue) : null}
                    onChange={(date: Date) => {
                      handleConditionChange(keyId, condition.id, { secondValue: date?.toISOString() });
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors"
                    placeholderText="Select end date..."
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
              </>
            )}
          </div>
        );
      }

      if (isBetweenOperator) {
        return (
          <div className="flex gap-2 items-center">
            <Input
              type={selectedColumn.dataType === 'number' ? 'number' : 'text'}
              value={condition.value || ''}
              onChange={(e) => handleConditionChange(keyId, condition.id, { value: e.target.value })}
              placeholder="Start value..."
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">and</span>
            <Input
              type={selectedColumn.dataType === 'number' ? 'number' : 'text'}
              value={condition.secondValue || ''}
              onChange={(e) => handleConditionChange(keyId, condition.id, { secondValue: e.target.value })}
              placeholder="End value..."
              className="flex-1"
            />
          </div>
        );
      }

      // Default input for other types
      return (
        <Input
          type={selectedColumn.dataType === 'number' ? 'number' : 'text'}
          value={condition.value || ''}
          onChange={(e) => handleConditionChange(keyId, condition.id, { value: e.target.value })}
          placeholder="Enter value..."
        />
      );
    };

    return (
      <FilterCondition
        key={condition.id}
        id={condition.id}
        condition={condition}
        onRemove={(id) => removeCondition(keyId, id)}
        onChange={(updates) => {
          // If column is being changed, reset operator and value
          if (updates.column && updates.column !== condition.column) {
            const newColumn = columns.find(col => col.name === updates.column);
            if (newColumn) {
              updates.operator = OPERATORS_BY_TYPE[newColumn.dataType][0];
              updates.value = null;
              updates.secondValue = null; // Also reset secondValue
            }
          }
          // If operator is being changed to/from between, reset values
          if (updates.operator && updates.operator !== condition.operator) {
            if (updates.operator === 'between' || condition.operator === 'between') {
              updates.value = null;
              updates.secondValue = null;
            }
          }
          handleConditionChange(keyId, condition.id, updates);
        }}
        isChild={false}
        availableColumns={columns}
        operators={operators}
        renderValueInput={renderValueInput}
      />
    );
  };

  // Add filterClientData inside the component
  const filterClientData = (data: ClaimData[], conditions: BackendFilterCondition[], keyColumn?: string): ClaimData[] => {
    if (!keyColumn) {
      return data.filter(record => {
        return conditions.every(condition => {
          const value = record[condition.column];
          return checkCondition(value, condition.value, condition.operator, condition.secondValue);
        });
      });
    }

    // Group records by key column
    const groupedData = data.reduce((acc, record) => {
      const keyValue = record[keyColumn];
      if (!acc[keyValue]) {
        acc[keyValue] = [];
      }
      acc[keyValue].push(record);
      return acc;
    }, {} as Record<string, ClaimData[]>);

    // Filter groups that match all conditions
    const filteredGroups = Object.entries(groupedData).filter(([_, groupRecords]) => {
      return conditions.every(condition => {
        return groupRecords.some(record => {
          const value = record[condition.column];
          return checkCondition(value, condition.value, condition.operator, condition.secondValue);
        });
      });
    });

    // Return first record of each group with grouped data attached
    return filteredGroups.map(([_, records]) => ({
      ...records[0],
      grouped_data: records.slice(1)
    }));
  };

  // Update the applyFilter function for client-side pagination
  const applyFilter = async () => {
    try {
      setIsLoading(true);

      // Get all conditions and convert them to backend format
      const getAllConditions = (key: FilterKey): BackendFilterCondition[] => {
        const conditions = key.conditions.map(condition => ({
          column: condition.column,
          operator: condition.operator,
          value: condition.value,
          secondValue: condition.secondValue
        }));

        const childConditions = key.children.flatMap(getAllConditions);
        return [...conditions, ...childConditions];
      };

      // Prepare filter payload
      const filterPayload = {
        conditions: getAllConditions(filterKeys[0]),
        mainKey: filterKeys[0].children[0]?.keyColumn,
        page,
        limit: pageSize
      };

      // Send filter request to backend
      const response = await fetch('http://localhost:5000/api/filters/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filterPayload)
      });

      if (!response.ok) {
        throw new Error('Failed to apply filters');
      }

      const data: ClaimsResponse = await response.json();
      const groupedClaims = groupDataByClaimId(data.claims);
      setClaims(groupedClaims);
      setTotalRecords(data.pagination.total);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: {
          min: data.statistics.dateRange.min,
          max: data.statistics.dateRange.max,
        },
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });

    } catch (error) {
      console.error('Error applying filter:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply filter');
    } finally {
      setIsLoading(false);
    }
  };

  // Update handlePageChange function
  const handlePageChange = async (newPage: number) => {
    try {
      setIsLoading(true);
      
      // Request the new page of data
      const response = await fetch(
        `http://localhost:5000/api/filters/claims?page=${newPage}&limit=${pageSize}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch page');
      }

      const data: ClaimsResponse = await response.json();
      
      // Debug log
      console.log('Page change data received:', data);

      if (data.claims && data.claims.length > 0) {
        // Directly set the claims data - it's already in the correct structure
        setClaims(data.claims);
        setPage(newPage);
        setTotalRecords(data.pagination.total);
        
        // Update statistics if they're included in the response
        if (data.statistics) {
          setStatistics({
            uniqueClaimIds: data.statistics.uniqueClaimIds,
            dateRange: {
              min: data.statistics.dateRange.min,
              max: data.statistics.dateRange.max,
            },
            totalAllowedAmount: data.statistics.totalAllowedAmount,
            totalRecords: data.statistics.totalRecords,
          });
        }
      }
    } catch (error) {
      console.error('Error changing page:', error);
      setError(error instanceof Error ? error.message : 'Failed to change page');
    } finally {
      setIsLoading(false);
    }
  };

  // Update handlePageSizeChange function similarly
  const handlePageSizeChange = async (newSize: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/filters/claims?page=1&limit=${newSize}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to update page size');
      }

      const data: ClaimsResponse = await response.json();
      
      if (data.claims && data.claims.length > 0) {
        setClaims(data.claims);
        setPageSize(newSize);
        setPage(1);
        setTotalRecords(data.pagination.total);
        
        if (data.statistics) {
          setStatistics({
            uniqueClaimIds: data.statistics.uniqueClaimIds,
            dateRange: {
              min: data.statistics.dateRange.min,
              max: data.statistics.dateRange.max,
            },
            totalAllowedAmount: data.statistics.totalAllowedAmount,
            totalRecords: data.statistics.totalRecords,
          });
        }
      }
    } catch (error) {
      console.error('Error changing page size:', error);
      setError(error instanceof Error ? error.message : 'Failed to change page size');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilter = () => {
    setFilterName("")
    setFilterKeys([{ 
      id: "root", 
      keyType: null,
      conditions: [],
      children: [{
        id: "group1",
        keyType: 'main',
        keyColumn: 'claim_id',
        conditions: [{ 
          id: "condition1", 
          column: "", 
          operator: "equals", 
          value: null 
        }],
        children: []
      }]
    }])
    setSelectedSavedFilter(null)

    // Reset pagination
    setPage(1)
    
    // Reset display data to first page of cached data
    const initialPageData = cachedClaims.slice(0, pageSize)
    setClaims(initialPageData)
    setTotalRecords(cachedClaims.length)

    // Reset statistics to original cached data
    const originalStats = calculateStatistics(cachedClaims)
    setStatistics({
      uniqueClaimIds: originalStats.uniqueClaimIds,
      dateRange: {
        min: originalStats.dateRange.min || '',
        max: originalStats.dateRange.max || '',
      },
      totalAllowedAmount: originalStats.totalAllowedAmount,
      totalRecords: originalStats.totalRecords,
    })
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

  const toggleRowExpansion = (claimId: string) => {
    setExpandedRows(current => {
      const newSet = new Set(current);
      if (newSet.has(claimId)) {
        newSet.delete(claimId);
      } else {
        newSet.add(claimId);
      }
      return newSet;
    });
  };

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
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {claims.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, statistics?.uniqueClaimIds || 0)} of {statistics?.uniqueClaimIds || 0} unique claims
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Claims per page:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => handlePageSizeChange(parseInt(value))}
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
                    // Add check for grouped_data existence and first item
                    const firstLineItem = claim.grouped_data?.[0];
                    const hasGroupedData = claim.grouped_data && claim.grouped_data.length > 1;
                    
                    return (
                      <React.Fragment key={`${claim.claim_id}-${pageIndex}`}>
                        {/* Main row - showing first line item */}
                        <TableRow>
                          <TableCell>
                            {hasGroupedData && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRowExpansion(claim.claim_id)}
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

                        {/* Additional line items when expanded */}
                        {isExpanded && 
                         hasGroupedData && 
                         claim.grouped_data?.slice(1).map((lineItem, subIndex) => (
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
                  onClick={() => {
                    handlePageChange(Math.max(1, page - 1));
                  }}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handlePageChange(page + 1);
                  }}
                  disabled={page * pageSize >= (statistics?.uniqueClaimIds || 0)}
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

