import { ClaimData, TableMetadata } from "../types"

export function calculateMetadata(data: ClaimData[], totalRecords: number, currentPage: number, pageSize: number): TableMetadata {
    // Calculate totals from current data
    const totalAmount = data.reduce((sum, claim) => 
        sum + (claim.allowed_amount || 0), 0);

    // Calculate average from current data
    const averageAmount = data.length > 0 ? totalAmount / data.length : 0;

    // Get unique patients from current data
    const uniquePatients = new Set(
        data.filter(claim => claim.patient_id != null)
            .map(claim => claim.patient_id)
    ).size;

    return {
        totalRecords,
        currentPage,
        totalPages: Math.ceil(totalRecords / pageSize),
        pageSize,
        totalAmount,
        averageAmount,
        uniquePatients,
        dateRange: {
            start: '',
            end: ''
        }
    };
} 