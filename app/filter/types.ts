export interface ClaimRecord {
  id: string;
  line_id?: string;
  claim_id: string;
  admission_date?: string;
  allowed_amount?: number;
  [key: string]: any;
}

export interface ClaimData {
  claim_id: string;
  line_id: string;
  admission_date?: string;
  allowed_amount?: number;
  grouped_data?: any[];
}

export interface FilterCondition {
  id: string;
  key: string;
  column: string;
  operator: string;
  value: any;
  secondValue?: any;
  lutValue?: string;
}

export interface BetweenDateValue {
  operator: 'greater_than' | 'less_than' | 'equals';
  value: number;
  unit: 'year' | 'month' | 'week' | 'day';
}

export interface FilterKey {
  id: string;
  key: string;
  label: string;
  type: string;
  keyType: 'main' | 'sub' | null;
  keyColumn: string;
  conditions: FilterCondition[];
  children: FilterKey[];
}

export interface SavedFilter {
  filter_id: number;
  name: string;
  description: string;
  conditions: FilterCondition[];
  claims_ids: string[];
  is_favorite: boolean;
  created_by: string;
  last_updated: string;
  run_count?: number;
  last_run?: string;
}

export interface ClaimsResponse {
  claims: ClaimData[];
  statistics: {
    totalRecords: number;
    uniqueClaimIds: number;
    totalAllowedAmount: number;
    dateRange: {
      min: string;
      max: string;
    };
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ColumnTypeResponse {
  success: boolean;
  data: Array<{
    column: string;
    type: DataType;
  }>;
}

export interface BackendFilterCondition {
  key: string;
  column: string;
  operator: string;
  value: string | number | null;
  secondValue?: BetweenDateValue | string | number | null;
}

export type DataType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnInfo {
  column: string;
  name: string;
  displayName: string;
  dataType: DataType;
}

export interface Statistics {
  uniqueClaimIds: number;
  dateRange: { min: string; max: string } | null;
  totalAllowedAmount: number;
  totalRecords: number;
}