import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

interface FilterConditionProps {
  id: string
  condition: FilterCondition
  onRemove: (id: string) => void
  onChange: (updates: Partial<FilterCondition>) => void
  isChild?: boolean
  availableColumns: ColumnInfo[]
  operators?: string[]
}

export function FilterCondition({
  id,
  condition,
  onRemove,
  onChange,
  isChild = false,
  availableColumns,
  operators = []
}: FilterConditionProps) {
  const [useLUT, setUseLUT] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(condition.column)
  const [search, setSearch] = useState("")

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2">
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
            {value
              ? availableColumns.find((column) => column.name === value)?.displayName
              : "Select column..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput 
              placeholder="Search column..." 
              className="h-9"
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
                    onSelect={(currentValue) => {
                      setValue(currentValue)
                      onChange({ column: currentValue })
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === column.name ? "opacity-100" : "opacity-0"
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
        <SelectTrigger className="w-[200px] bg-background text-foreground">
          <SelectValue placeholder="Select operator" />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[200px]">
          {operators.map((operator) => (
            <SelectItem 
              key={operator} 
              value={operator}
              className="px-2 py-1.5 cursor-pointer hover:bg-accent text-sm"
            >
              {operator}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {useLUT ? (
        <Select>
          <SelectTrigger className="w-[200px] bg-background text-foreground">
            <SelectValue placeholder="Select LUT value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lut1">LUT Value 1</SelectItem>
            <SelectItem value="lut2">LUT Value 2</SelectItem>
            <SelectItem value="lut3">LUT Value 3</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input placeholder="Enter value" className="w-[200px] bg-background text-foreground" />
      )}
      <div className="flex items-center space-x-2">
        <Switch id={`use-lut-${id}`} checked={useLUT} onCheckedChange={setUseLUT} />
        <Label htmlFor={`use-lut-${id}`} className="text-foreground">
          Use LUT
        </Label>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onRemove(id)}>
        <X className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

