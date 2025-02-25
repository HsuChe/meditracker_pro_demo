"use client"

import { useState, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Check, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { cn } from "@/lib/utils"
import { type FilterCondition, type BetweenDateValue } from "../types"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { operatorNeedsInput, operatorNeedsSecondInput } from '../utils'
import React from "react"
import { currentConfig } from '@/app/config'

interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

interface DiagnosisCodeData {
  diagnosis_codes: string[];
  ingested_data_id: number;
}

interface DiagnosisCodeResponse {
  success: boolean;
  data: {
    [key: string]: DiagnosisCodeData;
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
  renderValueInput?: () => React.ReactNode;
  lutNames: string[];
  ingestedIds?: number[];
}

const getApiUrl = () => currentConfig.apiUrl;

export function FilterCondition({
  id,
  condition,
  onRemove,
  onChange,
  isChild,
  availableColumns,
  operators = [],
  renderValueInput,
  lutNames,
  ingestedIds = []
}: FilterConditionProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [useLUT, setUseLUT] = useState(!!condition.lutValue)
  const [date, setDate] = useState<Date>()
  const [dateRange, setDateRange] = useState<DateRange>()
  const [diagnosisCodes, setDiagnosisCodes] = useState<DiagnosisCodeResponse['data']>({})
  const [selectedLUT, setSelectedLUT] = useState(condition.lutValue || "")
  
  const selectedColumn = availableColumns.find(col => col.name === condition.column)
  const isStringType = selectedColumn?.dataType === 'string'
  const isDateType = selectedColumn?.dataType === 'date'
  const isNumberType = selectedColumn?.dataType === 'number'
  const showValueInput = condition.operator && operatorNeedsInput(condition.operator)
  const showSecondValueInput = condition.operator && operatorNeedsSecondInput(condition.operator)

  // Add a ref to track if we've already fetched the codes
  const hasFetchedRef = React.useRef(false);

  useEffect(() => {
    const fetchDiagnosisCodes = async () => {
      try {
        // Validate ingestedIds
        if (!Array.isArray(ingestedIds) || ingestedIds.length === 0) {
          console.log('No ingested IDs available, skipping diagnosis codes fetch');
          return;
        }

        // Check if we've already fetched for these IDs
        if (hasFetchedRef.current) {
          console.log('Already fetched diagnosis codes for these IDs');
          return;
        }
        
        console.log('Fetching diagnosis codes for IDs:', ingestedIds);
        
        const response = await fetch(`${getApiUrl()}/api/filters/diagnosis-codes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ingestedIds: ingestedIds.filter(id => typeof id === 'number')
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch diagnosis codes:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          return;
        }

        const result = await response.json();
        if (result.success && result.data) {
          setDiagnosisCodes(result.data);
          hasFetchedRef.current = true;
        } else {
          console.error('Invalid response format:', result);
        }
      } catch (error) {
        console.error('Error fetching diagnosis codes:', error);
      }
    };

    if (useLUT && condition.column === 'diagnosis_code') {
      fetchDiagnosisCodes();
    }
  }, [useLUT, condition.column, ingestedIds]);

  // Reset the fetch flag if ingestedIds change
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [ingestedIds]);

  useEffect(() => {
    if (condition.lutValue !== selectedLUT) {
      setSelectedLUT(condition.lutValue || "");
    }
  }, [condition.lutValue]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (!isStringType && useLUT) {
      setUseLUT(false)
    }
  }, [condition.column, isStringType])

  const handleLUTNameSelect = (name: string) => {
    if (diagnosisCodes[name]) {
      setUseLUT(true);
      setSelectedLUT(name);
      const selectedCodes = diagnosisCodes[name].diagnosis_codes;
      onChange({ 
        operator: 'in_list',
        value: selectedCodes.join(','),
        lutValue: name
      });
    } else {
      console.log('No diagnosis codes found for name:', name);
    }
  };

  const renderDateInput = () => {
    if (condition.operator === 'is_null' || condition.operator === 'is_not_null') {
      return null;
    }

    if (condition.operator === 'between_date') {
      const betweenValue = (condition.secondValue as BetweenDateValue) || {
        operator: 'greater_than',
        value: 0,
        unit: 'day'
      };

      // Filter for date columns only
      const dateColumns = availableColumns.filter(col => 
        col.dataType === 'date' && col.name !== condition.column
      );

      // Get display value for the select
      const getDisplayValue = () => {
        if (!condition.value) return '';
        if (condition.value === 'today') return 'Today';
        const column = dateColumns.find(col => col.name === condition.value);
        return column ? column.displayName : '';
      };

      return (
        <div className="flex items-center gap-2">
          <Select
            value={String(condition.value || '')}
            onValueChange={(value) => {
              // When selecting a comparison column or Today, initialize the secondValue if it doesn't exist
              if (!condition.secondValue) {
                onChange({
                  value,
                  secondValue: {
                    operator: 'greater_than',
                    value: 0,
                    unit: 'day'
                  }
                });
              } else {
                onChange({ value });
              }
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                {getDisplayValue()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectSeparator className="my-1" />
              {dateColumns.map(column => (
                <SelectItem key={column.name} value={column.name}>
                  {column.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={betweenValue.operator}
            onValueChange={(value: BetweenDateValue['operator']) => onChange({ 
              secondValue: { 
                ...betweenValue, 
                operator: value 
              } 
            })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="greater_than">Greater Than</SelectItem>
              <SelectItem value="less_than">Less Than</SelectItem>
              <SelectItem value="equals">Equals</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Value"
            className="w-[100px]"
            value={betweenValue.value || ''}
            onChange={(e) => onChange({ 
              secondValue: { 
                ...betweenValue, 
                value: parseFloat(e.target.value) 
              } 
            })}
          />
          <Select
            value={betweenValue.unit}
            onValueChange={(value: BetweenDateValue['unit']) => onChange({ 
              secondValue: { 
                ...betweenValue, 
                unit: value 
              } 
            })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Years</SelectItem>
              <SelectItem value="month">Months</SelectItem>
              <SelectItem value="week">Weeks</SelectItem>
              <SelectItem value="day">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              setDate(newDate)
              onChange({ value: newDate?.toISOString() })
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }

  const renderNumberInput = () => {
    if (showSecondValueInput && condition.operator !== 'between_date') {
      return (
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={condition.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Min value..."
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            value={typeof condition.secondValue === 'string' || typeof condition.secondValue === 'number' ? condition.secondValue : ''}
            onChange={(e) => onChange({ secondValue: e.target.value })}
            placeholder="Max value..."
            className="flex-1"
          />
        </div>
      )
    }

    return (
      <Input
        type="number"
        value={condition.value || ''}
        onChange={(e) => onChange({ value: e.target.value })}
        placeholder="Enter value..."
      />
    )
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-2 mb-2 p-2 border rounded-lg bg-card w-full"
      data-testid="filter-condition"
    >
      <div {...attributes} {...listeners}>
        <GripVertical className="cursor-move text-muted-foreground" />
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[250px] justify-between"
            data-testid="column-select"
          >
            {condition.column
              ? selectedColumn?.displayName
              : "Select column..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandInput 
              placeholder="Search column..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No column found.</CommandEmpty>
            <CommandGroup>
              {availableColumns
                .filter(column => 
                  column.displayName.toLowerCase().includes(search.toLowerCase())
                )
                .map((column) => (
                  <CommandItem
                    key={column.name}
                    value={column.name}
                    onSelect={(value) => {
                      onChange({ column: value })
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        condition.column === column.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {column.displayName}
                  </CommandItem>
                ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Select
        value={condition.operator}
        onValueChange={(value) => onChange({ operator: value })}
      >
        <SelectTrigger className="w-[200px]" data-testid="operator-select">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent>
          {(useLUT && condition.column === 'diagnosis_code' 
            ? ['in_list', 'not_in_list'] 
            : operators).map((operator) => (
            <SelectItem key={operator} value={operator}>
              {operator.replace(/_/g, ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {condition.column && condition.operator && showValueInput && (
        <div className="flex-1">
          {useLUT ? (
            <>
              <Select
                value={selectedLUT}
                onValueChange={handleLUTNameSelect}
              >
                <SelectTrigger data-testid="lut-select">
                  <SelectValue placeholder="Select LUT value" />
                </SelectTrigger>
                <SelectContent>
                  {lutNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              {isDateType ? (
                renderDateInput()
              ) : isNumberType ? (
                renderNumberInput()
              ) : (
                <Input
                  placeholder="Enter value"
                  value={condition.value || ""}
                  onChange={(e) => onChange({ value: e.target.value })}
                  data-testid="value-input"
                />
              )}
            </>
          )}
        </div>
      )}

      {isStringType && condition.column && condition.operator && showValueInput && (
        <div className="flex items-center space-x-2 min-w-[150px]">
          <Switch
            id={`use-lut-${id}`}
            checked={useLUT}
            onCheckedChange={(checked) => {
              setUseLUT(checked);
              if (condition.column === 'diagnosis_code') {
                if (checked) {
                  onChange({ operator: 'in_list' });
                } else {
                  onChange({ operator: 'equals', lutValue: '', value: '' });
                }
              }
            }}
            data-testid="use-lut-switch"
          />
          <Label htmlFor={`use-lut-${id}`} className="text-sm text-muted-foreground whitespace-nowrap">
            Use LUT
          </Label>
        </div>
      )}

      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => onRemove(id)} 
        aria-label="Remove condition"
        data-testid="remove-condition"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
} 