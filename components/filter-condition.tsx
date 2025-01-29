import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface FilterConditionProps {
  id: string
  onRemove: (id: string) => void
  isChild?: boolean
}

export function FilterCondition({ id, onRemove, isChild = false }: FilterConditionProps) {
  const [useLUT, setUseLUT] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2">
      <div {...attributes} {...listeners}>
        <GripVertical className="cursor-move text-muted-foreground" />
      </div>
      <Select>
        <SelectTrigger className="w-[200px] bg-background text-foreground">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="column1">Column 1</SelectItem>
          <SelectItem value="column2">Column 2</SelectItem>
          <SelectItem value="column3">Column 3</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-[200px] bg-background text-foreground">
          <SelectValue placeholder="Select condition" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">Equals</SelectItem>
          <SelectItem value="contains">Contains</SelectItem>
          <SelectItem value="greater_than">Greater Than</SelectItem>
          <SelectItem value="less_than">Less Than</SelectItem>
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

