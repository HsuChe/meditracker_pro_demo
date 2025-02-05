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

interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
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
  lutNames
}: FilterConditionProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [useLUT, setUseLUT] = useState(false)
  const [date, setDate] = useState<Date>()
  const [dateRange, setDateRange] = useState<DateRange>()
  
  const selectedColumn = availableColumns.find(col => col.name === condition.column)
  const isStringType = selectedColumn?.dataType === 'string'
  const isDateType = selectedColumn?.dataType === 'date'
  const isNumberType = selectedColumn?.dataType === 'number'
  const showValueInput = condition.operator && operatorNeedsInput(condition.operator)
  const showSecondValueInput = condition.operator && operatorNeedsSecondInput(condition.operator)

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
          {operators.map((operator) => (
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
              value={condition.value?.toString() || ""}
              onValueChange={(value) => onChange({ value })}
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
                <Input
                  type="number"
                  value={condition.value || ""}
                  onChange={(e) => onChange({ value: e.target.value })}
                />
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