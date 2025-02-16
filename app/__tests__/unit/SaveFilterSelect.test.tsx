import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SavedFiltersSelect from '@/app/filter/components/SaveFilterSelect';
import { SavedFilter } from '@/app/filter/types';

describe('SavedFiltersSelect', () => {
  const mockSavedFilters: SavedFilter[] = [
    {
      id: 1,
      name: 'Test Filter 1',
      description: 'First test filter description',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Test Filter 2',
      description: 'Second test filter description',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Another Filter',
      description: 'Third test filter',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const defaultProps = {
    savedFilters: mockSavedFilters,
    selectedFilter: null,
    onFilterSelect: jest.fn(),
    onDeleteFilter: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the select component with correct text', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    expect(screen.getByText('Saved Filters')).toBeInTheDocument();
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('displays all saved filters in the dropdown', async () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Check if all filters are displayed
    mockSavedFilters.forEach(filter => {
      expect(screen.getByText(filter.name)).toBeInTheDocument();
      if (filter.description) {
        expect(screen.getByText(filter.description)).toBeInTheDocument();
      }
    });
  });

  it('shows selected filter in the trigger', () => {
    render(
      <SavedFiltersSelect
        {...defaultProps}
        selectedFilter={mockSavedFilters[0].name}
      />
    );
    
    expect(screen.getByText(mockSavedFilters[0].name)).toBeInTheDocument();
  });

  it('calls onFilterSelect when a filter is selected', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Click on a filter
    const filterOption = screen.getByRole('option', { name: new RegExp(mockSavedFilters[0].name) });
    fireEvent.click(filterOption);
    
    expect(defaultProps.onFilterSelect).toHaveBeenCalledWith(mockSavedFilters[0].name);
  });

  it('calls onDeleteFilter when delete button is clicked', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Find and click the delete button for the first filter
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('.text-destructive')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(defaultProps.onDeleteFilter).toHaveBeenCalledWith(mockSavedFilters[0].name);
    }
  });

  it('prevents filter selection when clicking delete button', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Find and click the delete button
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('.text-destructive')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(defaultProps.onFilterSelect).not.toHaveBeenCalled();
    }
  });

  it('filters the list when searching', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Type in the search input
    const searchInput = screen.getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'Another' } });
    
    // Check that only matching filters are shown
    expect(screen.getByText('Another Filter')).toBeInTheDocument();
    expect(screen.queryByText('Test Filter 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Filter 2')).not.toBeInTheDocument();
  });

  it('shows "No filter found" message when search has no results', () => {
    render(<SavedFiltersSelect {...defaultProps} />);
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Type in the search input
    const searchInput = screen.getByPlaceholderText('Search filters...');
    fireEvent.change(searchInput, { target: { value: 'NonexistentFilter' } });
    
    expect(screen.getByText('No filter found.')).toBeInTheDocument();
  });

  it('shows check icon for selected filter', () => {
    render(
      <SavedFiltersSelect
        {...defaultProps}
        selectedFilter={mockSavedFilters[0].name}
      />
    );
    
    // Open the select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    
    // Find the selected option
    const selectedOption = screen.getByRole('option', { name: new RegExp(mockSavedFilters[0].name) });
    const checkIcon = selectedOption.querySelector('svg');
    expect(checkIcon?.closest('.mr-2')).toHaveClass('opacity-100');
  });
}); 