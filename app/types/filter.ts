export type DataType = 'string' | 'number' | 'boolean' | 'date';
export type TimeUnit = 'day' | 'week' | 'month' | 'year';
export type Operator = 'equals' | 'between_date' | 'before' | 'after' | 'less_than' | 'greater_than';

export interface ColumnInfo {
  name: string;
  displayName: string;
  dataType: DataType;
}

export interface SecondValue {
  operator: 'less_than' | 'greater_than';
  value: number;
  unit: TimeUnit;
}

export interface FilterCondition {
  id: string;
  column: string;
  operator: Operator;
  value: string | number | boolean | Date;
  secondValue?: SecondValue;
}

export interface FilterConditionProps {
  id: string;
  condition: FilterCondition;
  onRemove: (id: string) => void;
  onChange: (condition: FilterCondition) => void;
  isChild: boolean;
  availableColumns: ColumnInfo[];
  operators: Operator[];
  lutNames: string[];
  ingestedIds: string[];
} 