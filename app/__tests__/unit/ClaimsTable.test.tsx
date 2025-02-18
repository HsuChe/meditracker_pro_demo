import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClaimsTable from '@/app/filter/components/ClaimsTable';
import { ClaimData, ColumnInfo, Statistics } from '@/app/filter/types';

// Mock data
const mockColumns: ColumnInfo[] = [
  { name: 'claim_id', displayName: 'Claim ID', dataType: 'string', column: 'claim_id' },
  { name: 'patient_name', displayName: 'Patient Name', dataType: 'string', column: 'patient_name' },
  { name: 'amount', displayName: 'Amount', dataType: 'number', column: 'amount' }
];

const mockClaims: ClaimData[] = [
  {
    claim_id: 'CLM001',
    line_id: '1',
    grouped_data: [
      { claim_id: 'CLM001', line_id: '1-1', patient_name: 'John Doe', amount: '100.00' },
      { claim_id: 'CLM001', line_id: '1-2', patient_name: 'John Doe', amount: '50.00' }
    ]
  },
  {
    claim_id: 'CLM002',
    line_id: '2',
    grouped_data: [
      { claim_id: 'CLM002', line_id: '2-1', patient_name: 'Jane Smith', amount: '75.00' }
    ]
  }
];

const mockStatistics: Statistics = {
  uniqueClaimIds: 2,
  dateRange: { min: '2024-01-01', max: '2024-02-01' },
  totalAllowedAmount: 225.00,
  totalRecords: 3
};

const defaultProps = {
  claims: mockClaims,
  columns: mockColumns,
  page: 1,
  pageSize: 10,
  statistics: mockStatistics,
  expandedRows: new Set<string>(),
  isLoading: false,
  error: null,
  onPageChange: jest.fn(),
  onPageSizeChange: jest.fn(),
  onToggleRowExpansion: jest.fn()
};

describe('ClaimsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the table with correct headers', () => {
    render(<ClaimsTable {...defaultProps} />);
    
    mockColumns.forEach(column => {
      expect(screen.getByText(column.displayName)).toBeInTheDocument();
    });
  });

  it('displays loading spinner when isLoading is true', () => {
    render(<ClaimsTable {...defaultProps} isLoading={true} />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('displays error message when error is present', () => {
    const errorMessage = 'Failed to load claims';
    render(<ClaimsTable {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('displays "No claims found" message when claims array is empty', () => {
    render(<ClaimsTable {...defaultProps} claims={[]} />);
    
    expect(screen.getByText('No claims found')).toBeInTheDocument();
  });

  it('renders correct number of rows based on claims data', () => {
    render(<ClaimsTable {...defaultProps} />);
    
    // Initial rows (not expanded)
    const rows = screen.getAllByRole('row');
    // +1 for header row
    expect(rows.length).toBe(mockClaims.length + 1);
  });

  it('expands row when expansion button is clicked', () => {
    render(<ClaimsTable {...defaultProps} />);
    
    const expandButtons = screen.getAllByTestId('expand-row-button');
    fireEvent.click(expandButtons[0]);
    
    expect(defaultProps.onToggleRowExpansion).toHaveBeenCalledWith('CLM001');
  });

  it('shows expanded rows when expandedRows includes claim_id', () => {
    const expandedRows = new Set(['CLM001']);
    render(<ClaimsTable {...defaultProps} expandedRows={expandedRows} />);
    
    // Header + 2 main rows + 1 expanded sub-row for CLM001
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(4);
  });

  it('handles pagination correctly', () => {
    const onPageChange = jest.fn();
    render(<ClaimsTable {...defaultProps} onPageChange={onPageChange} statistics={{ ...mockStatistics, uniqueClaimIds: 20 }} />);
    
    const nextButton = screen.getByTestId('next-page-button');
    fireEvent.click(nextButton);
    
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('handles page size changes correctly', () => {
    const onPageSizeChange = jest.fn();
    render(<ClaimsTable {...defaultProps} onPageSizeChange={onPageSizeChange} />);
    
    // Find the Select trigger button
    const pageSizeButton = screen.getByRole('combobox');
    fireEvent.click(pageSizeButton);
    
    // Find and click the option
    const option25 = screen.getByText('25');
    fireEvent.click(option25);
    
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('displays correct pagination information', () => {
    render(<ClaimsTable {...defaultProps} />);
    
    expect(screen.getByText(/Showing 1 to 2 of 2 unique claims/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it('disables pagination buttons appropriately', () => {
    render(<ClaimsTable {...defaultProps} />);
    
    const prevButton = screen.getByTestId('prev-page-button');
    const nextButton = screen.getByTestId('next-page-button');
    
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled(); // Because we only have 2 items with pageSize 10
  });
}); 