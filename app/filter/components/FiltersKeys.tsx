import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, CornerDownRight } from "lucide-react";
import { FilterCondition as FilterConditionComponent } from "./FilterCondition";
import { FilterKey, FilterCondition, ColumnInfo } from '../types';
import { OPERATORS_BY_TYPE } from '../utils';

interface FilterKeysProps {
  filterKeys: FilterKey[];
  columns: ColumnInfo[];
  onAddCondition: (keyId: string) => void;
  onRemoveCondition: (keyId: string, conditionId: string) => void;
  onAddKey: (parentId: string, keyType: 'main' | 'sub') => void;
  onRemoveKey: (keyId: string) => void;
  onConditionChange: (keyId: string, conditionId: string, updates: Partial<FilterCondition>) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onUpdateKeyColumn: (keyId: string, column: string) => void;
  lutNames: string[];
}

const FilterKeys: React.FC<FilterKeysProps> = ({
  filterKeys,
  columns,
  onAddCondition,
  onRemoveCondition,
  onAddKey,
  onRemoveKey,
  onConditionChange,
  onDragEnd,
  onUpdateKeyColumn,
  lutNames
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const renderFilterCondition = (condition: FilterCondition, keyId: string) => {
    const selectedColumn = columns.find(col => col.name === condition.column);
    
    return (
      <FilterConditionComponent
        key={condition.id}
        id={condition.id}
        condition={condition}
        onRemove={(id) => onRemoveCondition(keyId, id)}
        onChange={(updates) => onConditionChange(keyId, condition.id, updates)}
        isChild={false}
        availableColumns={columns}
        operators={selectedColumn?.dataType ? OPERATORS_BY_TYPE[selectedColumn.dataType] : []}
        lutNames={lutNames}
      />
    );
  };

  const renderFilterKey = (key: FilterKey, level = 0) => (
    <div key={key.id} className={`ml-${level * 4}`}>
      <div className="flex items-center gap-2 mb-2">
        {key.id !== "root" && (
          <div className="flex items-center gap-2">
            {(level > 0 || key.keyType === 'sub') && (
              <CornerDownRight className="h-4 w-4 text-muted-foreground mr-2" />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {key.keyType === 'main' ? 'Main Key: Claim ID' : 'Sub Key: Column'} 
            </span>
            {key.keyType === 'sub' && (
              <Select
                value={key.keyColumn}
                onValueChange={(value) => onUpdateKeyColumn(key.id, value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select column">
                    {columns.find(col => col.name === key.keyColumn)?.displayName || 'Select column'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        
        {key.id !== "root" && (
          <Button variant="outline" size="sm" onClick={() => onAddCondition(key.id)}>
            Add Condition
          </Button>
        )}
        
        {level === 0 && key.children.length === 0 && (
          <Button variant="outline" size="sm" onClick={() => onAddKey(key.id, 'main')}>
            Add Main Key
          </Button>
        )}
        
        {level > 0 && key.keyType === 'main' && (
          <Button variant="outline" size="sm" onClick={() => onAddKey(key.id, 'sub')}>
            Add Sub Key
          </Button>
        )}
        
        {key.id !== "root" && (
          <Button variant="ghost" size="icon" onClick={() => onRemoveKey(key.id)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className={`${key.keyType === 'sub' ? 'ml-6' : ''}`}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={key.conditions.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {key.conditions.map((condition) => renderFilterCondition(condition, key.id))}
          </SortableContext>
        </DndContext>
      </div>
      {key.children.map((childKey) => renderFilterKey(childKey, level + 1))}
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Filter Conditions</h2>
      {filterKeys.map((key) => renderFilterKey(key))}
    </div>
  );
};

export default FilterKeys;