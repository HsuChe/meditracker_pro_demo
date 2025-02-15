import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import mock implementations first
import {
  buttonMock,
  selectMockFactory,
  tableMock
} from '../setup/ui-mocks';

// Mock all components before importing the tested component
jest.mock('../../../components/ui/button', () => buttonMock);
jest.mock('../../../components/ui/select', () => selectMockFactory());
jest.mock('../../../components/ui/table', () => tableMock);

// Import the component after mocks
import ClaimsTable from '../../filter/components/ClaimsTable';
import { ClaimData, ColumnInfo, Statistics } from '../../filter/types';

const mockColumns: ColumnInfo[] = [
  { name: 'claim_id', displayName: 'Claim ID', dataType: 'string' },
  { name: 'admission_date', displayName: 'Admission Date', dataType: 'date' },
  { name: 'allowed_amount', displayName: 'Allowed Amount', dataType: 'number' }
];

const mockClaims: ClaimData[] = [
  {
    id: 'CLAIM001',
    claim_id: 'CLAIM001',
    grouped_data: [
      {
        id: 'CLAIM001-1',
        claim_id: 'CLAIM001',
        admission_date: '2024-02-14',
        allowed_amount: 1000
      },
      {
        id: 'CLAIM001-2',
        claim_id: 'CLAIM001',
        admission_date: '2024-02-15',
        allowed_amount: 2000
      }
    ]
  },
  {
    id: 'CLAIM002',
    claim_id: 'CLAIM002',
    grouped_data: [
      {
        id: 'CLAIM002-1',
        claim_id: 'CLAIM002',
        admission_date: '2024-02-16',
        allowed_amount: 3000
      }
    ]
  }
];

const mockStatistics: Statistics = {
  uniqueClaimIds: 2,
  totalRecords: 3,
  dateRange: {
    min: '2024-02-14',
    max: '2024-02-16'
  },
  totalAllowedAmount: 6000
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

describe('ClaimsTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders claims data correctly', () => {
    render(<ClaimsTable {...defaultProps} />);

    // Check if claims are rendered
    expect(screen.getByText('CLAIM001')).toBeInTheDocument();
    expect(screen.getByText('CLAIM002')).toBeInTheDocument();
    
    // Check if column headers are rendered
    expect(screen.getByText('Claim ID')).toBeInTheDocument();
    expect(screen.getByText('Admission Date')).toBeInTheDocument();
    expect(screen.getByText('Allowed Amount')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ClaimsTable {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const error = 'Failed to load claims';
    render(<ClaimsTable {...defaultProps} error={error} />);
    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it('shows empty state when no claims', () => {
    render(<ClaimsTable {...defaultProps} claims={[]} />);
    expect(screen.getByText('No claims found')).toBeInTheDocument();
  });

  it('handles row expansion', () => {
    const expandedRows = new Set(['CLAIM001']);
    render(<ClaimsTable {...defaultProps} expandedRows={expandedRows} />);

    // Find and click expansion button for CLAIM001
    const expansionButton = screen.getByTestId('expand-row-button');
    fireEvent.click(expansionButton);

    expect(defaultProps.onToggleRowExpansion).toHaveBeenCalledWith('CLAIM001');
  });

  it('handles page size changes', () => {
    render(<ClaimsTable {...defaultProps} />);

    // Find and change page size select
    const select = screen.getByTestId('select');
    fireEvent.change(select, { target: { value: '25' } });

    expect(defaultProps.onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('handles pagination', () => {
    const totalRecords = 30;
    render(<ClaimsTable 
      {...defaultProps} 
      statistics={{ ...mockStatistics, uniqueClaimIds: totalRecords }}
    />);

    const nextButton = screen.getByTestId('next-page-button');
    const prevButton = screen.getByTestId('prev-page-button');

    fireEvent.click(nextButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(prevButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables pagination buttons appropriately', () => {
    // Test first page
    const totalRecords = 30;
    render(<ClaimsTable 
      {...defaultProps} 
      statistics={{ ...mockStatistics, uniqueClaimIds: totalRecords }}
    />);
    
    const prevButton = screen.getByTestId('prev-page-button');
    const nextButton = screen.getByTestId('next-page-button');

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Test last page
    render(
      <ClaimsTable 
        {...defaultProps} 
        page={3}
        pageSize={10} 
        statistics={{ ...mockStatistics, uniqueClaimIds: 30 }} 
      />
    );

    const lastPageNextButton = screen.getByTestId('next-page-button');
    expect(lastPageNextButton).toBeDisabled();
  });

  it('shows correct pagination information', () => {
    render(<ClaimsTable {...defaultProps} />);
    expect(screen.getByText(/Showing 1 to 2 of 2 unique claims/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it('expands rows and shows grouped data', () => {
    const expandedRows = new Set(['CLAIM001']);
    render(<ClaimsTable {...defaultProps} expandedRows={expandedRows} />);

    // Check if grouped data is shown for expanded row
    expect(screen.getByText('2024-02-15')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
  });
}); 