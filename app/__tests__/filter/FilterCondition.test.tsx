import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import mock implementations first
import {
  buttonMock,
  inputMock,
  labelMock,
  switchMock,
  popoverMock,
  selectMockFactory,
  cmdkMockFactory,
  calendarMock,
  dateRangePickerMock
} from '../setup/ui-mocks';

// Use doMock instead of mock to ensure proper initialization order
jest.doMock('../../../components/ui/button', () => buttonMock);
jest.doMock('../../../components/ui/input', () => inputMock);
jest.doMock('../../../components/ui/label', () => labelMock);
jest.doMock('../../../components/ui/switch', () => switchMock);
jest.doMock('@radix-ui/react-popover', () => popoverMock);
jest.doMock('@radix-ui/react-select', () => selectMockFactory());
jest.doMock('cmdk', () => cmdkMockFactory());
jest.doMock('../../../components/ui/calendar', () => calendarMock);
jest.doMock('../../../components/ui/date-range-picker', () => dateRangePickerMock);

// Now import the component and types after mocks are set up
import { FilterCondition } from '../../filter/components/FilterCondition';
import { ColumnInfo, Operator } from '../../types/filter';

const mockOnChange = jest.fn();
const mockOnRemove = jest.fn();

const defaultProps = {
  id: 'test-condition',
  condition: {
    id: 'test-condition',
    column: 'admission_date',
    operator: 'between_date' as Operator,
    value: 'today',
    secondValue: {
      operator: 'less_than' as const,
      value: 6,
      unit: 'day' as const
    }
  },
  onRemove: mockOnRemove,
  onChange: mockOnChange,
  isChild: false,
  availableColumns: [
    {
      name: 'admission_date',
      displayName: 'Admission Date',
      dataType: 'date' as const
    }
  ],
  operators: ['between_date', 'equals', 'before', 'after'] as Operator[],
  lutNames: [],
  ingestedIds: []
};

describe('FilterCondition Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with date comparison options', () => {
    render(<FilterCondition {...defaultProps} />);
    
    // Check if the component renders
    expect(screen.getByTestId('filter-condition')).toBeInTheDocument();
    
    // Check if the column name is displayed
    expect(screen.getByTestId('column-select')).toHaveTextContent('Admission Date');
    
    // Check if the operator is displayed
    expect(screen.getByTestId('operator-select')).toHaveTextContent(/between date/i);
  });

  it('handles operator changes', () => {
    render(<FilterCondition {...defaultProps} />);
    
    // Find and click the operator select
    const operatorSelect = screen.getByTestId('operator-select');
    fireEvent.click(operatorSelect);
    
    // Find and click the "equals" option
    const equalsOption = screen.getByText('equals');
    fireEvent.click(equalsOption);
    
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      operator: 'equals'
    }));
  });

  it('handles value input changes', () => {
    render(<FilterCondition {...defaultProps} />);
    
    // Find the value input and change its value
    const valueInput = screen.getByPlaceholderText('Value');
    fireEvent.change(valueInput, { target: { value: '10' } });
    
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secondValue: expect.objectContaining({
        value: 10
      })
    }));
  });

  it('handles remove condition', () => {
    render(<FilterCondition {...defaultProps} />);
    
    // Find and click the remove button
    const removeButton = screen.getByTestId('remove-condition');
    fireEvent.click(removeButton);
    
    expect(mockOnRemove).toHaveBeenCalledWith('test-condition');
  });
}); 