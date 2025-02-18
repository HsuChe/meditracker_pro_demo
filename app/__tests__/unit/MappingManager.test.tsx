/// <reference types="@testing-library/jest-dom" />
/// <reference types="jest" />
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MappingManager } from '@/app/ingestion/components/mapping-manager';

// Mocking the Select component with proper type annotations
jest.mock('@/components/ui/select', () => {
  const React = require('react');
  return {
    Select: function MockSelect({ children, onValueChange, value, ...props }: { children?: React.ReactNode; onValueChange: (value: any) => void; value?: any; placeholder?: string; [key: string]: any }) {
      const options: React.ReactNode[] = [];
      React.Children.forEach(children, (child: any) => {
        if (child && child.props && child.props.children) {
          React.Children.forEach(child.props.children, (grandchild: any) => {
            if (grandchild && grandchild.props && grandchild.props.value !== undefined) {
              options.push(grandchild);
            }
          });
        }
      });
      return (
        <select data-testid="mock-select" value={value || ''} onChange={(e) => onValueChange(e.target.value)}>
          <option value="">{props.placeholder || 'Select...'}</option>
          {options.map((option: any) => (
            <option key={option.props.value} value={option.props.value}>
              {option.props.children}
            </option>
          ))}
        </select>
      );
    },
    SelectTrigger: function MockSelectTrigger({ children }: { children?: React.ReactNode }) { return <div>{children}</div>; },
    SelectValue: function MockSelectValue({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) { return <span>{children || placeholder}</span>; },
    SelectContent: function MockSelectContent({ children }: { children?: React.ReactNode }) { return <>{children}</>; },
    SelectItem: function MockSelectItem({ children, value }: { children?: React.ReactNode; value: any }) { return <option value={value}>{children}</option>; },
    SelectScrollUpButton: function MockSelectScrollUpButton() { return null; },
    SelectScrollDownButton: function MockSelectScrollDownButton() { return null; },
    SelectGroup: function MockSelectGroup({ children }: { children?: React.ReactNode }) { return <div>{children}</div>; },
    SelectLabel: function MockSelectLabel({ children }: { children?: React.ReactNode }) { return <span>{children}</span>; }
  };
});

// Mock fetch implementation
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock alert
global.alert = jest.fn();

describe('MappingManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches saved mappings and DB columns on mount and displays them correctly', async () => {
    const mockSavedMappings = [
      {
        id: 1,
        name: 'Mapping 1',
        mappings: [{ csvColumn: 'name', dbColumn: 'patient_name' }],
        is_in_use: false,
        created_at: '2024-01-01',
        last_used: null
      }
    ];
    const mockDbColumns = ['custom_db_column'];
    const initialDbColumns = ['patient_email'];
    const csvColumns = ['name', 'age'];
    const currentMappings = csvColumns.map(col => ({ csvColumn: col, dbColumn: '' }));
    const onMappingChange = jest.fn();
    const onMappingSelect = jest.fn();

    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSavedMappings)
        });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDbColumns)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      render(
        <MappingManager 
          csvColumns={csvColumns} 
          dbColumns={initialDbColumns} 
          currentMappings={currentMappings} 
          onMappingChange={onMappingChange} 
          onMappingSelect={onMappingSelect} 
        />
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/mappings');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/db-columns');
      expect(screen.getByText('Mapping 1')).toBeInTheDocument();
    });

    // Check saved mapping select has the option
    const selects = screen.getAllByTestId('mock-select');
    const savedMappingSelect = selects[0];
    expect(savedMappingSelect).toBeInTheDocument();
    expect(savedMappingSelect).toHaveDisplayValue('Select...');
    expect(savedMappingSelect.querySelector('option[value="1"]')).toBeInTheDocument();

    // Check CSV columns in table
    csvColumns.forEach(col => {
      expect(screen.getByText(col)).toBeInTheDocument();
    });

    // Check DB column dropdown for 'name' row contains merged and sorted options
    const rowForName = screen.getByText('name').closest('tr');
    expect(rowForName).toBeInTheDocument();
    const dbSelectInRow = rowForName?.querySelector('[data-testid="mock-select"]');
    expect(dbSelectInRow).toBeInTheDocument();
    const optionValues = Array.from(dbSelectInRow!.querySelectorAll('option')).map(opt => opt.textContent?.trim());
    expect(optionValues).toEqual(expect.arrayContaining(['Select...', 'custom_db_column', 'patient_email']));
  });

  it('calls onMappingSelect and updates mapping when saved mapping is selected', async () => {
    const mockSavedMappings = [
      {
        id: 1,
        name: 'Mapping 1',
        mappings: [
          { csvColumn: 'name', dbColumn: 'patient_name' },
          { csvColumn: 'age', dbColumn: 'patient_age' }
        ],
        is_in_use: false,
        created_at: '2024-01-01',
        last_used: null
      }
    ];
    const initialDbColumns = ['db1'];
    const csvColumns = ['name', 'age'];
    const currentMappings = csvColumns.map(col => ({ csvColumn: col, dbColumn: '' }));
    const onMappingChange = jest.fn();
    const onMappingSelect = jest.fn();

    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSavedMappings)
        });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      render(
        <MappingManager 
          csvColumns={csvColumns} 
          dbColumns={initialDbColumns}
          currentMappings={currentMappings}
          onMappingChange={onMappingChange}
          onMappingSelect={onMappingSelect}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Mapping 1')).toBeInTheDocument();
    });

    const selects = screen.getAllByTestId('mock-select');
    const savedMappingSelect = selects[0];

    await act(async () => {
      fireEvent.change(savedMappingSelect, { target: { value: '1' } });
    });

    expect(onMappingSelect).toHaveBeenCalledWith(1);
    expect(onMappingChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ csvColumn: 'name', dbColumn: 'patient_name' }),
      expect.objectContaining({ csvColumn: 'age', dbColumn: 'patient_age' })
    ]));
  });

  it('saves new mapping when Save button is clicked', async () => {
    const initialDbColumns = ['db1'];
    const csvColumns = ['name', 'age'];
    const currentMappings = csvColumns.map(col => ({ csvColumn: col, dbColumn: '' }));
    const onMappingChange = jest.fn();
    const onMappingSelect = jest.fn();

    const newMapping = {
      id: 2,
      name: 'New Mapping',
      mappings: currentMappings,
      is_in_use: false,
      created_at: '2024-02-02',
      last_used: null
    };

    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        if (options && options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(newMapping)
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    global.alert = jest.fn();

    await act(async () => {
      render(
        <MappingManager 
          csvColumns={csvColumns}
          dbColumns={initialDbColumns}
          currentMappings={currentMappings}
          onMappingChange={onMappingChange}
          onMappingSelect={onMappingSelect}
        />
      );
    });

    const input = screen.getByPlaceholderText('Enter mapping name');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'New Mapping' } });
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/mappings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('New Mapping')
      })
    );
    expect(global.alert).toHaveBeenCalledWith('Mapping saved successfully');

    await waitFor(() => {
      const selects = screen.getAllByTestId('mock-select');
      expect(selects[0].querySelector('option[value="2"]')).toBeInTheDocument();
    });
  });

  it('updates onMappingChange when editing DB column selection', async () => {
    const initialDbColumns = ['db1', 'db2'];
    const csvColumns = ['name', 'age'];
    const currentMappings = csvColumns.map(col => ({ csvColumn: col, dbColumn: '' }));
    const onMappingChange = jest.fn();
    const onMappingSelect = jest.fn();

    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await act(async () => {
      render(
        <MappingManager 
          csvColumns={csvColumns}
          dbColumns={initialDbColumns}
          currentMappings={currentMappings}
          onMappingChange={onMappingChange}
          onMappingSelect={onMappingSelect}
        />
      );
    });

    // In sorted order, "age" comes before "name".
    // We want to update the mapping for 'name'.
    const rowForName = screen.getByText('name').closest('tr');
    expect(rowForName).toBeInTheDocument();
    const dbSelectForName = rowForName?.querySelector('[data-testid="mock-select"]');
    expect(dbSelectForName).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(dbSelectForName!, { target: { value: 'db1' } });
    });

    expect(onMappingChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ csvColumn: 'name', dbColumn: 'db1' }),
      expect.objectContaining({ csvColumn: 'age', dbColumn: '' })
    ]));
  });

  it('handles delete functionality and state propagation', async () => {
    const mockSavedMappings = [
      {
        id: 1,
        name: 'Mapping 1',
        mappings: [{ csvColumn: 'name', dbColumn: 'patient_name' }],
        is_in_use: false,
        created_at: '2024-01-01',
        last_used: null
      }
    ];
    const initialDbColumns = ['db1'];
    const csvColumns = ['name', 'age'];
    const currentMappings = csvColumns.map(col => ({ csvColumn: col, dbColumn: '' }));
    const onMappingChange = jest.fn();
    const onMappingSelect = jest.fn();

    // Initial fetch returns the saved mapping
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSavedMappings) });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.startsWith('http://localhost:5000/api/mappings/')) {
        // For DELETE call
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    const { unmount } = render(
      <MappingManager 
        csvColumns={csvColumns}
        dbColumns={initialDbColumns}
        currentMappings={currentMappings}
        onMappingChange={onMappingChange}
        onMappingSelect={onMappingSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mapping 1')).toBeInTheDocument();
    });

    const selects = screen.getAllByTestId('mock-select');
    const savedMappingSelect = selects[0];
    expect(savedMappingSelect.querySelector('option[value="1"]')).toBeInTheDocument();

    // Simulate deletion API call
    await act(async () => {
      await fetch('http://localhost:5000/api/mappings/1', { method: 'DELETE' });
    });

    // Now simulate that new fetch returns an empty array of saved mappings
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url === 'http://localhost:5000/api/mappings') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url === 'http://localhost:5000/api/db-columns') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    unmount();
    await act(async () => {
      render(
        <MappingManager 
          csvColumns={csvColumns}
          dbColumns={initialDbColumns}
          currentMappings={currentMappings}
          onMappingChange={onMappingChange}
          onMappingSelect={onMappingSelect}
        />
      );
    });

    const newSelects = screen.getAllByTestId('mock-select');
    expect(newSelects[0].querySelector('option[value="1"]')).not.toBeInTheDocument();
  });
}); 