/// <reference types="@testing-library/jest-dom" />
/// <reference types="jest" />
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MappingManager } from '@/app/ingestion/components/mapping-manager';
import { SelectContent, SelectItem } from '@/components/ui/select';

interface Mapping {
  csvColumn: string;
  dbColumn: string;
}

// Mock the Select component
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div className="select-wrapper">
      <select 
        value={value} 
        onChange={(e) => onValueChange?.(e.target.value)}
        aria-label={value === undefined ? "Select saved mapping" : "Select database column"}
      >
        <option value="">{value === undefined ? "Select a saved mapping" : "Select database column"}</option>
        {React.Children.toArray(children).map(child => {
          if (React.isValidElement(child) && child.type === SelectContent) {
            return React.Children.toArray(child.props.children).map(item => {
              if (React.isValidElement(item) && item.type === SelectItem) {
                return <option key={item.props.value} value={item.props.value}>{item.props.children}</option>;
              }
              return null;
            });
          }
          return null;
        })}
      </select>
    </div>
  ),
  SelectTrigger: ({ children, id }: any) => null,
  SelectValue: ({ placeholder }: any) => null,
  SelectContent: ({ children }: any) => children,
  SelectItem: ({ children, value }: any) => children,
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.alert
const mockAlert = jest.fn();
global.alert = mockAlert;

describe('MappingManager', () => {
  const mockSavedMappings = [
    {
      id: 1,
      name: 'Test Mapping 1',
      mappings: [
        { csvColumn: 'name', dbColumn: 'patient_name' },
        { csvColumn: 'age', dbColumn: 'patient_age' }
      ],
      is_in_use: false,
      created_at: '2024-01-01',
      last_used: null
    }
  ];

  const mockProps = {
    csvColumns: ['name', 'age'],
    dbColumns: ['patient_name', 'patient_email', 'patient_age'],
    currentMappings: [
      { csvColumn: 'name', dbColumn: '' },
      { csvColumn: 'age', dbColumn: '' }
    ],
    onMappingChange: jest.fn(),
    onMappingSelect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSavedMappings)
        });
      }
      if (url.includes('/api/db-columns')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProps.dbColumns)
        });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders the component with initial state', async () => {
    render(<MappingManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Load Saved Mapping')).toBeInTheDocument();
      expect(screen.getByText('Save Current Mapping')).toBeInTheDocument();
      expect(screen.getByText('CSV Column')).toBeInTheDocument();
      expect(screen.getByText('Database Column')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
    });
  });

  it('handles saving new mapping', async () => {
    render(<MappingManager {...mockProps} />);
    
    // Set mapping name
    const input = screen.getByPlaceholderText('Enter mapping name');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'New Mapping' } });
    });
    
    // Click save button
    const saveButton = screen.getByRole('button', { name: 'Save' });
    await act(async () => {
      fireEvent.click(saveButton);
      // Wait for the next tick to allow the fetch call to be made
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify the fetch call
    const fetchCalls = mockFetch.mock.calls;
    expect(fetchCalls.length).toBe(3); // Two for initial load (mappings & columns), one for save
    const [url, options] = fetchCalls[2]; // The last call should be the save
    expect(url).toBe('http://localhost:5000/api/mappings');
    expect(JSON.parse(options.body)).toEqual({
      name: 'New Mapping',
      mappings: mockProps.currentMappings
    });
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('handles loading a saved mapping', async () => {
    render(<MappingManager {...mockProps} />);
    
    // Wait for saved mappings to load
    await waitFor(() => {
      expect(screen.getByText('Test Mapping 1')).toBeInTheDocument();
    });

    // Find and change the saved mappings select
    const select = screen.getByLabelText('Select saved mapping');
    await act(async () => {
      fireEvent.change(select, { target: { value: '1' } });
    });

    // Wait for the state to update
    await waitFor(() => {
      expect(mockProps.onMappingChange).toHaveBeenCalledWith(mockSavedMappings[0].mappings);
      expect(mockProps.onMappingSelect).toHaveBeenCalledWith(1);
    }, { timeout: 2000 });
  });

  it('handles database column selection', async () => {
    render(<MappingManager {...mockProps} />);
    
    // Find all database column selects
    const selects = screen.getAllByLabelText('Select database column');
    expect(selects).toHaveLength(2); // Should only find database column selects now
    
    // The selects are ordered alphabetically by CSV column: 'age', 'name'
    const ageSelect = selects[0]; // First row is 'age'
    await act(async () => {
      fireEvent.change(ageSelect, { target: { value: 'patient_age' } });
    });
    
    // The currentMappings array maintains its original order (not sorted)
    const expectedMappings = [
      { csvColumn: 'name', dbColumn: '' },
      { csvColumn: 'age', dbColumn: 'patient_age' }
    ];
    
    await waitFor(() => {
      expect(mockProps.onMappingChange).toHaveBeenCalledWith(expectedMappings);
    });
  });

  it('displays current mappings in the table', async () => {
    await act(async () => {
      render(<MappingManager {...mockProps} />);
    });

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getAllByText('patient_name')[0]).toBeInTheDocument();
    expect(screen.getAllByText('patient_age')[0]).toBeInTheDocument();
  });

  it('loads saved mappings from the server', async () => {
    await act(async () => {
      render(<MappingManager {...mockProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Mapping 1')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5000/api/mappings');
  });

  it('handles error states gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock failed responses
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch')));

    await act(async () => {
      render(<MappingManager {...mockProps} />);
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching saved mappings:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('sorts mappings alphabetically by CSV column', async () => {
    const unsortedMappings = [
      { csvColumn: 'zip', dbColumn: 'patient_zip' },
      { csvColumn: 'age', dbColumn: 'patient_age' },
      { csvColumn: 'name', dbColumn: 'patient_name' }
    ];

    await act(async () => {
      render(
        <MappingManager
          {...mockProps}
          currentMappings={unsortedMappings}
        />
      );
    });

    const csvColumns = screen.getAllByRole('row').slice(1) // Skip header row
      .map(row => row.firstChild?.textContent);

    expect(csvColumns).toEqual(['age', 'name', 'zip']);
  });
}); 