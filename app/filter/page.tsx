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
import { X, CornerDownRight, List as ListIcon, ChevronLeft, ChevronRight } from "lucide-react"
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

// Update the filterClientData function
const filterClientData = (data: ClaimData[], conditions: BackendFilterCondition[]): ClaimData[] => {
  return data.filter(record => {
    return conditions.every(condition => {
      const value = record[condition.column];
      const filterValue = condition.value;

      switch (condition.operator) {
        case 'equals':
          // Make string equals case-insensitive
          return typeof value === 'string' && typeof filterValue === 'string'
            ? value.toLowerCase() === filterValue.toLowerCase()
            : value === filterValue;
        case 'contains':
          // Contains is already case-insensitive
          return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        case 'starts_with':
          // Starts with is already case-insensitive
          return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
        case 'ends_with':
          // Ends with is already case-insensitive
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
                 Number(value) <= Number(condition.secondValue);
        case 'before':
          return new Date(value) < new Date(filterValue);
        case 'after':
          return new Date(value) > new Date(filterValue);
        default:
          return true;
      }
    });
  });
};

// Add helper function to calculate statistics
const calculateStatistics = (filteredData: ClaimData[]) => {
  return {
    uniqueClaimIds: new Set(filteredData.map(record => record.claim_id)).size,
    dateRange: {
      min: filteredData.reduce((min, record) => {
        const date = new Date(record.admission_date);
        return !min || date < min ? date : min;
      }, null as Date | null)?.toISOString(),
      max: filteredData.reduce((max, record) => {
        const date = new Date(record.admission_date);
        return !max || date > max ? date : max;
      }, null as Date | null)?.toISOString()
    },
    totalAllowedAmount: filteredData.reduce((sum, record) => 
      sum + (Number(record.allowed_amount) || 0), 0),
    totalRecords: filteredData.length
  };
};

// Add months array
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

  // Add state to manage dropdowns
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);

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
        setIsLoading(true);
        
        // Fetch both claims data and column types in parallel
        const [claimsResponse, columnTypesResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/filters/claims?page=${page}&limit=${pageSize}`),
          fetch('http://localhost:5000/api/filters/claimsDtype')
        ]);

        if (!claimsResponse.ok) {
          throw new Error('Failed to fetch claims data');
        }
        if (!columnTypesResponse.ok) {
          throw new Error('Failed to fetch column types');
        }

        const claimsData: ClaimsResponse = await claimsResponse.json();
        const columnTypes: ColumnTypeResponse = await columnTypesResponse.json();

        console.log('Column Types:', columnTypes); // Add this console.log

        if (claimsData.claims && claimsData.claims.length > 0 && isMounted) {
          setClaims(claimsData.claims);

          // Use the column types from the API instead of inferring
          const columnInfo: ColumnInfo[] = columnTypes.data
            .map(({ column, type }) => ({
              name: column,
              displayName: formatColumnName(column),
              dataType: type
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

          setColumns(columnInfo);
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

          setIsInitialized(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error during initialization:', err); // Add this console.log
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
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
    const selectedColumn = columns.find(col => col.name === condition.column);
    const operators = selectedColumn ? OPERATORS_BY_TYPE[selectedColumn.dataType] : [];

    const renderValueInput = () => {
      if (!selectedColumn) return null;

      const isDateType = selectedColumn.dataType === 'date';
      const isStringType = selectedColumn.dataType === 'string';
      const isBetweenOperator = condition.operator === 'between';
      const currentValues = Array.isArray(condition.value) ? condition.value : [];

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
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                yearDropdownItemNumber={20}
                scrollableYearDropdown
                popperContainer={({ children }) => (
                  <div className="datepicker-popper-container">{children}</div>
                )}
                renderCustomHeader={({
                  date,
                  changeYear,
                  changeMonth,
                  decreaseMonth,
                  increaseMonth,
                  prevMonthButtonDisabled,
                  nextMonthButtonDisabled,
                }) => (
                  <div className="flex items-center justify-between px-2 py-2">
                    <button
                      onClick={decreaseMonth}
                      disabled={prevMonthButtonDisabled}
                      type="button"
                      className="p-1 hover:bg-accent rounded-sm disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex gap-2">
                      <Select
                        value={date.getFullYear().toString()}
                        onValueChange={(value) => {
                          changeYear(Number(value));
                          setIsYearOpen(false);
                        }}
                        open={isYearOpen}
                        onOpenChange={(open) => {
                          setIsYearOpen(open);
                          if (open) setIsMonthOpen(false);
                        }}
                      >
                        <SelectTrigger className="w-[7rem] h-8 text-muted-foreground">
                          <SelectValue>{date.getFullYear()}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 20 }, (_, i) => date.getFullYear() - 10 + i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={months[date.getMonth()]}
                        onValueChange={(value) => {
                          changeMonth(months.indexOf(value));
                          setIsMonthOpen(false);
                        }}
                        open={isMonthOpen}
                        onOpenChange={(open) => {
                          setIsMonthOpen(open);
                          if (open) setIsYearOpen(false);
                        }}
                      >
                        <SelectTrigger className="w-[8rem] h-8 text-muted-foreground">
                          <SelectValue>{months[date.getMonth()]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month} value={month}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      onClick={increaseMonth}
                      disabled={nextMonthButtonDisabled}
                      type="button"
                      className="p-1 hover:bg-accent rounded-sm disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
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
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    yearDropdownItemNumber={20}
                    scrollableYearDropdown
                    popperContainer={({ children }) => (
                      <div className="datepicker-popper-container">{children}</div>
                    )}
                    renderCustomHeader={({
                      date,
                      changeYear,
                      changeMonth,
                      decreaseMonth,
                      increaseMonth,
                      prevMonthButtonDisabled,
                      nextMonthButtonDisabled,
                    }) => (
                      <div className="flex items-center justify-between px-2 py-2">
                        <button
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          type="button"
                          className="p-1 hover:bg-accent rounded-sm disabled:opacity-50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="flex gap-2">
                          <Select
                            value={date.getFullYear().toString()}
                            onValueChange={(value) => changeYear(Number(value))}
                          >
                            <SelectTrigger className="w-[7rem] h-8 text-muted-foreground">
                              <SelectValue>{date.getFullYear()}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 20 }, (_, i) => date.getFullYear() - 10 + i).map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={months[date.getMonth()]}
                            onValueChange={(value) => changeMonth(months.indexOf(value))}
                          >
                            <SelectTrigger className="w-[8rem] h-8 text-muted-foreground">
                              <SelectValue>{months[date.getMonth()]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month} value={month}>
                                  {month}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <button
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          type="button"
                          className="p-1 hover:bg-accent rounded-sm disabled:opacity-50"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
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

  // Update the applyFilter function
  const applyFilter = async () => {
    const getAllConditions = (key: FilterKey): BackendFilterCondition[] => {
      const conditions = key.conditions.map(condition => {
        const columnInfo = columns.find(col => col.name === condition.column);
        let value = condition.value;
        let secondValue = condition.secondValue;

        // Convert values based on column type
        if (columnInfo) {
          switch (columnInfo.dataType) {
            case 'number':
              value = typeof value === 'string' ? parseFloat(value) : value;
              secondValue = typeof secondValue === 'string' ? parseFloat(secondValue) : secondValue;
              break;
            case 'date':
              value = value ? new Date(value).toISOString() : value;
              secondValue = secondValue ? new Date(secondValue).toISOString() : secondValue;
              break;
            case 'string':
              // If it's a list value, keep it as an array
              if (condition.isListValue && Array.isArray(value)) {
                // value remains as array
              } else {
                value = value?.toString() || null;
              }
              break;
          }
        }

        return {
          column: condition.column,
          operator: condition.operator,
          value,
          secondValue
        };
      });

      const childConditions = key.children.flatMap(getAllConditions);
      return [...conditions, ...childConditions];
    };

    try {
      setIsLoading(true);

      // Filter the existing data
      const filteredData = filterClientData(claims, getAllConditions(filterKeys[0]));
      
      // Calculate pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      // Calculate new statistics
      const newStats = calculateStatistics(filteredData);

      // Update the UI
      setClaims(paginatedData);
      setTotalRecords(filteredData.length);
      setStatistics({
        uniqueClaimIds: newStats.uniqueClaimIds,
        dateRange: {
          min: newStats.dateRange.min || '',
          max: newStats.dateRange.max || '',
        },
        totalAllowedAmount: newStats.totalAllowedAmount,
        totalRecords: newStats.totalRecords,
      });

    } catch (error) {
      console.error('Error applying filter:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply filter');
    } finally {
      setIsLoading(false);
    }
  };

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

