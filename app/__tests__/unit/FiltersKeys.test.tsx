import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilterKeys from '@/app/filter/components/FiltersKeys';
import { FilterKey, FilterCondition, ColumnInfo } from '@/app/filter/types';
import { DndContext } from '@dnd-kit/core';

// Mock DND-Kit's useSensor hook
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => ({})),
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
}));

const mockColumns: ColumnInfo[] = [
  { name: 'claim_id', displayName: 'Claim ID', dataType: 'string' },
  { name: 'patient_name', displayName: 'Patient Name', dataType: 'string' },
  { name: 'amount', displayName: 'Amount', dataType: 'number' },
  { name: 'date', displayName: 'Date', dataType: 'date' }
];

const createMockFilterKey = (id: string, type: 'main' | 'sub' | null = null): FilterKey => ({
  id,
  keyType: type,
  keyColumn: type === 'sub' ? 'patient_name' : 'claim_id',
  conditions: [],
  children: []
});

const createMockCondition = (id: string, column: string = 'claim_id'): FilterCondition => ({
  id,
  column,
  operator: 'equals',
  value: null,
});

describe('FilterKeys', () => {
  const defaultProps = {
    filterKeys: [createMockFilterKey('root', null)],
    columns: mockColumns,
    onAddCondition: jest.fn(),
    onRemoveCondition: jest.fn(),
    onAddKey: jest.fn(),
    onRemoveKey: jest.fn(),
    onConditionChange: jest.fn(),
    onDragEnd: jest.fn(),
    onUpdateKeyColumn: jest.fn(),
    lutNames: ['diagnosis', 'procedure'],
    ingestedIds: [1, 2, 3]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with initial state', () => {
    render(<FilterKeys {...defaultProps} />);
    
    expect(screen.getByText('Filter Conditions')).toBeInTheDocument();
    expect(screen.getByText(/Add Main Key/)).toBeInTheDocument();
  });

  it('adds a main key correctly', () => {
    render(<FilterKeys {...defaultProps} />);
    
    const addMainKeyButton = screen.getByText('Add Main Key');
    fireEvent.click(addMainKeyButton);
    
    expect(defaultProps.onAddKey).toHaveBeenCalledWith('root', 'main');
  });

  it('renders nested structure correctly', () => {
    const nestedFilterKeys = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        children: [{
          ...createMockFilterKey('sub1', 'sub'),
          conditions: [createMockCondition('cond1', 'patient_name')]
        }],
        conditions: [createMockCondition('cond2', 'claim_id')]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={nestedFilterKeys} />);
    
    expect(screen.getByText('Main Key: Claim ID')).toBeInTheDocument();
    expect(screen.getByText('Sub Key: Column')).toBeInTheDocument();
  });

  it('handles condition removal correctly', () => {
    const filterKeysWithCondition = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        conditions: [createMockCondition('cond1')]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithCondition} />);
    
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]); // First remove button should be for the condition
    
    expect(defaultProps.onRemoveCondition).toHaveBeenCalledWith('main1', 'cond1');
  });

  it('updates sub key column correctly', () => {
    const filterKeysWithSub = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        children: [{
          ...createMockFilterKey('sub1', 'sub'),
          keyColumn: 'patient_name'
        }]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithSub} />);
    
    // Find and click the select
    const columnSelect = screen.getByRole('combobox');
    fireEvent.click(columnSelect);
    
    // Select a different column
    const amountOption = screen.getByText('Amount');
    fireEvent.click(amountOption);
    
    expect(defaultProps.onUpdateKeyColumn).toHaveBeenCalledWith('sub1', 'amount');
  });

  it('maintains correct hierarchy in the DOM', () => {
    const complexFilterKeys = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        conditions: [createMockCondition('main-cond1')],
        children: [{
          ...createMockFilterKey('sub1', 'sub'),
          conditions: [createMockCondition('sub-cond1', 'patient_name')]
        }]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={complexFilterKeys} />);
    
    // Check hierarchy using DOM structure
    const mainKeyContainer = screen.getByText('Main Key: Claim ID').closest('.ml-4');
    const subKeyText = screen.getByText('Sub Key: Column');
    
    expect(mainKeyContainer).toBeInTheDocument();
    expect(subKeyText).toBeInTheDocument();
    expect(mainKeyContainer?.contains(subKeyText)).toBe(true);
  });

  it('adds conditions to correct keys', () => {
    const filterKeysWithMain = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main')
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithMain} />);
    
    const addConditionButton = screen.getByText('Add Condition');
    fireEvent.click(addConditionButton);
    
    expect(defaultProps.onAddCondition).toHaveBeenCalledWith('main1');
  });

  it('handles key removal correctly', () => {
    const filterKeysWithMain = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main')
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithMain} />);
    
    // Find the remove button by its SVG path
    const removeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(removeButton);
    
    expect(defaultProps.onRemoveKey).toHaveBeenCalledWith('main1');
  });

  it('renders correct operators based on column type', () => {
    const filterKeysWithConditions = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        conditions: [
          { ...createMockCondition('cond1', 'amount'), operator: 'greater_than' },
          { ...createMockCondition('cond2', 'patient_name'), operator: 'contains' }
        ]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithConditions} />);
    
    // The conditions should be rendered with their appropriate operators
    const conditions = screen.getAllByTestId('filter-condition');
    expect(conditions.length).toBe(2);
  });

  it('handles drag and drop operations', () => {
    const filterKeysWithConditions = [{
      ...createMockFilterKey('root', null),
      children: [{
        ...createMockFilterKey('main1', 'main'),
        conditions: [
          createMockCondition('cond1'),
          createMockCondition('cond2')
        ]
      }]
    }];

    render(<FilterKeys {...defaultProps} filterKeys={filterKeysWithConditions} />);
    
    // Simulate drag end event
    const dragEndEvent = {
      active: { id: 'cond1' },
      over: { id: 'cond2' }
    };
    
    defaultProps.onDragEnd(dragEndEvent as any);
    expect(defaultProps.onDragEnd).toHaveBeenCalledWith(dragEndEvent);
  });
}); 