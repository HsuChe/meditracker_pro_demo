import { useState, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Check, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { cn } from "@/lib/utils"
import { type FilterCondition } from "../types"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { operatorNeedsInput, operatorNeedsSecondInput } from '../utils'
import React from "react"

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
  const [useLUT, setUseLUT] = useState(false)
  const [date, setDate] = useState<Date>()
  const [dateRange, setDateRange] = useState<DateRange>()
  const [diagnosisCodes, setDiagnosisCodes] = useState<DiagnosisCodeResponse['data']>({})
  
  const selectedColumn = availableColumns.find(col => col.name === condition.column)
  const isStringType = selectedColumn?.dataType === 'string'
  const isDateType = selectedColumn?.dataType === 'date'
  const isNumberType = selectedColumn?.dataType === 'number'
  const showValueInput = condition.operator && operatorNeedsInput(condition.operator)
  const showSecondValueInput = condition.operator && operatorNeedsSecondInput(condition.operator)

  // Add a ref to track if we've already fetched the codes
  const hasFetchedRef = React.useRef(false);

  useEffect(() => {
    if (useLUT && condition.column === 'diagnosis_code') {
      onChange({ operator: 'in_list' });
    }
  }, [useLUT, condition.column]);

  useEffect(() => {
    const fetchDiagnosisCodes = async () => {
      try {
        // Only fetch if we haven't already fetched for these IDs
        if (hasFetchedRef.current) return;
        
        console.log('Fetching diagnosis codes with IDs:', ingestedIds);
        const response = await fetch('http://localhost:5000/api/filters/diagnosis-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ingestedIds
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Received diagnosis codes:', result.data);
          setDiagnosisCodes(result.data);
          hasFetchedRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching diagnosis codes:', error);
      }
    };

    if (useLUT && condition.column === 'diagnosis_code' && ingestedIds.length > 0) {
      fetchDiagnosisCodes();
    }
  }, [useLUT, condition.column, ingestedIds]);

  // Reset the fetch flag if ingestedIds change
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [ingestedIds]);

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
    console.log('Selected LUT name:', name);
    console.log('Available diagnosis codes:', diagnosisCodes);
    
    if (diagnosisCodes[name]) {
      const selectedCodes = diagnosisCodes[name].diagnosis_codes;
      console.log('Selected diagnosis codes:', selectedCodes);
      
      // Update both the operator and values in a single onChange call
      onChange({ 
        operator: 'in_list',
        value: selectedCodes.join(','),
        lutValue: name // Add this to maintain the selected name in the dropdown
      });
    } else {
      console.log('No diagnosis codes found for name:', name);
    }
  };

  const renderDateInput = () => {
    if (showSecondValueInput) {
      return (
        <DatePickerWithRange
          date={dateRange}
          onDateChange={(range) => {
            setDateRange(range)
            onChange({ 
              value: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
              secondValue: range?.to ? format(range.to, 'yyyy-MM-dd') : null
            })
          }}
        />
      )
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
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
              setDate(newDate || undefined)
              onChange({ value: newDate ? format(newDate, 'yyyy-MM-dd') : null })
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    )
  }

  const renderNumberInput = () => {
    if (showSecondValueInput) {
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
            value={condition.secondValue || ''}
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
        <SelectTrigger className="w-[200px]">
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
            <Select
              value={condition.lutValue || ""}
              onValueChange={handleLUTNameSelect}
            >
              <SelectTrigger>
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
            onCheckedChange={setUseLUT}
          />
          <Label htmlFor={`use-lut-${id}`} className="text-sm text-muted-foreground whitespace-nowrap">
            Use LUT
          </Label>
        </div>
      )}

      <Button variant="ghost" size="icon" onClick={() => onRemove(id)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
} 