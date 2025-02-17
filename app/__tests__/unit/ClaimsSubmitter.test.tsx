/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClaimsSubmitter } from '@/app/ingestion/components/claims-submitter';
import { act } from 'react';

// Mock the papaparse module
jest.mock('papaparse', () => ({
  parse: jest.fn()
}));

describe('ClaimsSubmitter', () => {
  const mockProps = {
    csvData: [
      ['header1', 'header2'],
      ['data1', 'data2'],
      ['data3', 'data4']
    ],
    mappingId: 1,
    onSuccess: jest.fn(),
    onError: jest.fn()
  };

  // Mock fetch globally
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful mapping data fetch
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/mappings/1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            mappings: [
              { csvColumn: 'header1', dbColumn: 'db_column1' },
              { csvColumn: 'header2', dbColumn: 'db_column2' }
            ]
          })
        });
      }
      if (url.includes('/api/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('renders the component with initial state', async () => {
    await act(async () => {
      render(<ClaimsSubmitter {...mockProps} />);
    });
    
    expect(screen.getByLabelText(/Ingestion Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a name for this ingestion/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Claims/i })).toBeInTheDocument();
  });

  it('updates ingestion name when input changes', async () => {
    await act(async () => {
      render(<ClaimsSubmitter {...mockProps} />);
    });
    
    const input = screen.getByLabelText(/Ingestion Name/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test Ingestion' } });
    });
    
    expect(input).toHaveValue('Test Ingestion');
  });

  describe('validation and submission', () => {
    it('shows error when submitting without ingestion name', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} />);
      });
      
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      expect(mockProps.onError).toHaveBeenCalledWith('Please enter a name for this ingestion');
    });

    it('shows error when ingestion name is too short', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} />);
      });
      
      const input = screen.getByLabelText(/Ingestion Name/i);
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'ab' } });
        fireEvent.click(submitButton);
      });
      
      expect(mockProps.onError).toHaveBeenCalledWith('Ingestion name must be at least 3 characters');
    });

    it('shows error when submitting without mapping ID', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} mappingId={null} />);
      });
      
      const input = screen.getByLabelText(/Ingestion Name/i);
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Ingestion' } });
        fireEvent.click(submitButton);
      });
      
      expect(mockProps.onError).toHaveBeenCalledWith('Please select a mapping configuration before submitting');
    });

    it('shows error when submitting without CSV data', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} csvData={[]} />);
      });
      
      const input = screen.getByLabelText(/Ingestion Name/i);
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Ingestion' } });
        fireEvent.click(submitButton);
      });
      
      expect(mockProps.onError).toHaveBeenCalledWith('No data to submit');
    });
  });

  describe('successful submission', () => {
    beforeEach(() => {
      // Mock successful batch submission
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/mappings/1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              mappings: [
                { csvColumn: 'header1', dbColumn: 'db_column1' },
                { csvColumn: 'header2', dbColumn: 'db_column2' }
              ]
            })
          });
        }
        if (url.includes('/api/ingested-data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ parent_ingestion_id: 1 })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
    });

    it('handles successful submission', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} />);
      });

      const input = screen.getByLabelText(/Ingestion Name/i);
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });

      // Wait for initial data loading
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Enter ingestion name and submit
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Ingestion' } });
        fireEvent.click(submitButton);
      });

      // Wait for submission to complete
      await waitFor(() => {
        expect(mockProps.onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Mock failed submission
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/mappings/1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              mappings: [
                { csvColumn: 'header1', dbColumn: 'db_column1' },
                { csvColumn: 'header2', dbColumn: 'db_column2' }
              ]
            })
          });
        }
        if (url.includes('/api/ingested-data')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to submit batch 1' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
    });

    it('handles submission failure', async () => {
      await act(async () => {
        render(<ClaimsSubmitter {...mockProps} />);
      });

      const input = screen.getByLabelText(/Ingestion Name/i);
      const submitButton = screen.getByRole('button', { name: /Submit Claims/i });

      // Wait for initial data loading
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Enter ingestion name and submit
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test Ingestion' } });
        fireEvent.click(submitButton);
      });

      // Wait for error to be called
      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith('Failed to submit batch 1');
      });
    });
  });
}); 