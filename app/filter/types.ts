export interface ClaimRecord {
  id: string;
  line_id?: string;
  claim_id: string;
  admission_date?: string;
  allowed_amount?: number;
  [key: string]: any;
}

export interface ClaimData extends ClaimRecord {
  claim_id: string;
  grouped_data: ClaimRecord[];
}

export interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string | number | null;
  secondValue?: string | number | null;
  lutValue?: string;
}

export interface FilterKey {
  id: string;
  keyType: 'main' | 'sub' | null;
  keyColumn: string;
  conditions: FilterCondition[];
  children: FilterKey[];
}

export interface SavedFilter {
  id: number;
  name: string;
  description: string;
  keyColumns: string[];
  filterKeys: FilterKey[];
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
  value: string | number | readonly string[] | null;
  secondValue?: string | number | null;
}

export type DataType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnInfo {
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