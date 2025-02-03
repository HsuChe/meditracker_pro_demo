import { useState, useEffect } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { type FilterCondition } from "@/app/filter/page"

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
}

export function FilterCondition({
  id,
  condition,
  onRemove,
  onChange,
  isChild,
  availableColumns,
  operators = [],
  renderValueInput
}: FilterConditionProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [useLUT, setUseLUT] = useState(false)
  
  const selectedColumn = availableColumns.find(col => col.name === condition.column)
  const isStringType = selectedColumn?.dataType === 'string'

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

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-2 mb-2 p-2 border rounded-lg bg-card"
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
            className="w-[200px] justify-between"
          >
            {condition.column
              ? selectedColumn?.displayName
              : "Select column..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
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

      {condition.column && condition.operator && (
        <div className="flex-1">
          {useLUT && isStringType ? (
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select LUT value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lut1">LUT Value 1</SelectItem>
                <SelectItem value="lut2">LUT Value 2</SelectItem>
                <SelectItem value="lut3">LUT Value 3</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            renderValueInput ? renderValueInput() : (
              <Input
                value={condition.value || ''}
                onChange={(e) => onChange({ value: e.target.value })}
                placeholder="Enter value..."
              />
            )
          )}
        </div>
      )}

      {isStringType && condition.column && condition.operator && (
        <div className="flex items-center space-x-2">
          <Switch
            id={`use-lut-${id}`}
            checked={useLUT}
            onCheckedChange={setUseLUT}
          />
          <Label htmlFor={`use-lut-${id}`} className="text-sm text-muted-foreground">
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

