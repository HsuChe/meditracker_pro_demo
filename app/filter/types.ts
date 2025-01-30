export interface ClaimData {
    claim_merged_id: number;
    claim_id: string;
    patient_id: number;
    date_of_birth: string;
    gender: string | null;
    provider_id: number;
    facility_id: number;
    diagnosis_code: string;
    procedure_code: string;
    admission_date: string | null;
    discharge_date: string | null;
    revenue_code: string | null;
    modifiers: string | null;
    claim_type: string | null;
    total_charges: number;
    allowed_amount: number;
    [key: string]: any; // For flexibility with dynamic columns
}

export interface FilterCondition {
    id: string;
    column: string;
    operator: string;
    value: string;
    secondValue?: string;
}

export interface FilterKey {
    id: string;
    conditions: FilterCondition[];
    children: FilterKey[];
}

export interface SavedFilter {
    filter_id: number;
    name: string;
    description?: string;
    conditions: FilterCondition[];
    claims_ids: number[];
    last_run?: string;
    run_count: number;
}

export interface FilterResults {
    results: any[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
    execution_time_ms: number;
}

export interface TableMetadata {
    totalRecords: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalAmount: number;
    averageAmount: number;
    uniquePatients: number;
    columns: string[];
    dateRange: {
        start: string;
        end: string;
    }
}

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
} 