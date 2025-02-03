import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { type FilterCondition } from "../page"

interface ColumnInfo {
  name: string;
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
}

export function FilterCondition({
  id,
  condition,
  onRemove,
  onChange,
  isChild,
  availableColumns,
  operators = []
}: FilterConditionProps) {
  // ... rest of the component
} 