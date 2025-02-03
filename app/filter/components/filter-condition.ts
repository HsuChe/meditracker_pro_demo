// Add at the top of the file
interface ColumnInfo {
    name: string;
    dataType: 'string' | 'number' | 'date' | 'boolean';
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
    return (
      <div className="flex items-center gap-2 p-2">
        <Select
          value={condition.column}
          onValueChange={(value) => onChange({ column: value })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((column) => (
              <SelectItem key={column.name} value={column.name}>
                {column.name} ({column.dataType})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
  
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
                {operator}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
  
        {/* Rest of your component */}
      </div>
    )
  }