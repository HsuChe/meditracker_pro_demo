/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IngestionTable } from '@/app/ingestion/components/ingestion-table';
import { act } from 'react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('IngestionTable', () => {
  const mockIngestedData = {
    records: [
      {
        ingested_data_id: 1,
        name: 'Test Ingestion 1',
        type: 'claims',
        ingestion_date: '2024-02-15T00:00:00.000Z',
        record_count: 1000,
        file_size_bytes: 1024 * 1024, // 1MB
        activity_status: 'active' as const,
        processing_status: 'completed' as const,
        batch_number: 1,
        total_batches: 2
      },
      {
        ingested_data_id: 2,
        name: 'Test Ingestion 1',
        type: 'claims',
        ingestion_date: '2024-02-15T00:00:00.000Z',
        record_count: 1000,
        file_size_bytes: 1024 * 1024,
        activity_status: 'active' as const,
        processing_status: 'completed' as const,
        batch_number: 2,
        total_batches: 2
      }
    ],
    pagination: {
      totalRecords: 2,
      totalPages: 1,
      currentPage: 1
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for successful data fetch
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/ingested-data')) {
        if (url.includes('/clear-all')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        if (url.includes('/1') && url.includes('DELETE')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockIngestedData)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders the component with initial state', async () => {
    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    expect(screen.getByText('Ingested Data')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear All/i })).toBeInTheDocument();
  });

  it('displays ingested data in grouped format', async () => {
    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
    });

    expect(screen.getByText('2,000')).toBeInTheDocument(); // Total records
    expect(screen.getByText('2.00 MB')).toBeInTheDocument(); // Total size
  });

  it('handles group expansion correctly', async () => {
    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
    });

    // Click to expand group
    const groupRow = screen.getByText('Test Ingestion 1').closest('tr');
    if (groupRow) {
      fireEvent.click(groupRow);
    }

    // Check if batch details are visible
    expect(screen.getByText('Batch 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Batch 2 of 2')).toBeInTheDocument();
  });

  it('filters data by name', async () => {
    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    const searchInput = screen.getByPlaceholderText('Search by name...');

    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...mockIngestedData,
          records: mockIngestedData.records.filter(r => r.name.includes('Test Ingestion'))
        })
      })
    );

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Test Ingestion' } });
    });

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toMatch(/name=(Test\+Ingestion|Test%20Ingestion)/);
    });
  });

  it('handles delete operations', async () => {
    const mockConfirm = jest.fn(() => true);
    window.confirm = mockConfirm;

    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
    });

    // Expand the group to reveal batch deletion buttons
    const groupRow = screen.getByText('Test Ingestion 1').closest('tr');
    if (groupRow) {
      fireEvent.click(groupRow);
    }

    // Wait for the batch row to appear that contains the batch delete button
    const batchDeleteButtons = await screen.findAllByTestId('batch-delete-button');
    const batchDeleteButton = batchDeleteButtons[0];

    // Setup mock for deletion call
    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    );

    await act(async () => {
      fireEvent.click(batchDeleteButton);
    });

    expect(mockConfirm).toHaveBeenCalled();

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const deleteCall = calls.find(call => 
        call[0].includes('/api/ingested-data/1') && 
        call[1]?.method === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
    });
  });

  it('handles clear all operation', async () => {
    const mockConfirm = jest.fn(() => true);
    window.confirm = mockConfirm;

    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    );

    const clearAllButton = screen.getByRole('button', { name: /Clear All/i });
    await act(async () => {
      fireEvent.click(clearAllButton);
    });

    expect(mockConfirm).toHaveBeenCalled();

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const clearCall = calls.find(call => 
        call[0].includes('/api/ingested-data/clear-all') && 
        call[1]?.method === 'DELETE'
      );
      expect(clearCall).toBeTruthy();
    });
  });

  it('handles pagination', async () => {
    // Set up mock responses for initial load and page 2
    mockFetch
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...mockIngestedData,
          pagination: { 
            totalRecords: 4,
            totalPages: 2,
            currentPage: 1
          }
        })
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...mockIngestedData,
          pagination: { 
            totalRecords: 4,
            totalPages: 2,
            currentPage: 2
          }
        })
      }));

    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    // Wait for initial data load
    await waitFor(() => {
      expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
    });

    // Click next page
    const nextPageButton = screen.getByRole('button', { name: /next/i });
    await act(async () => {
      fireEvent.click(nextPageButton);
    });

    // Verify the page change request
    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const pageCall = calls.find(call => 
        call[0].includes('page=2') && 
        call[0].includes('type=claims')
      );
      expect(pageCall).toBeTruthy();
    });
  });

  it('handles error states gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Mock a failed response
    mockFetch.mockImplementationOnce(() => 
      Promise.reject(new Error('Failed to fetch data'))
    );

    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    // Wait for error to be logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', expect.any(Error));
    });

    // Clean up spies
    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('formats file sizes correctly', async () => {
    const customData = {
      ...mockIngestedData,
      records: [
        {
          ...mockIngestedData.records[0],
          file_size_bytes: 1500 // Should show as "1.46 KB"
        }
      ]
    };

    mockFetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(customData)
      })
    );

    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    await waitFor(() => {
      expect(screen.getByText('1.46 KB')).toBeInTheDocument();
    });
  });

  it('handles date range filtering', async () => {
    await act(async () => {
      render(<IngestionTable activeTab="csv" />);
    });

    // Find the date range picker button
    expect(screen.getByText('Filter by date range')).toBeInTheDocument();
  });

  /* NEW TESTS FOR DELETE OPERATIONS */
  describe('Delete Operations', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      window.confirm = jest.fn(() => true);
    });

    test('should perform "Clear All" operation', async () => {
      mockFetch.mockClear();
      // Chain responses: 1. initial render, 2. deletion, 3. refresh
      mockFetch
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // initial render
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})  // deletion response
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // refresh response
          })
        );

      await act(async () => {
        render(<IngestionTable activeTab="csv" />);
      });

      // Initial render should show data
      await waitFor(() => {
        expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
      });

      const clearAllButton = screen.getByRole('button', { name: /Clear All/i });

      await act(async () => {
        fireEvent.click(clearAllButton);
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete ALL ingestion records'));

      const calls = mockFetch.mock.calls;
      const clearCall = calls.find(call => call[0].includes('/api/ingested-data/clear-all') && call[1]?.method === 'DELETE');
      expect(clearCall).toBeTruthy();
    });

    test('should perform "Delete All" (group deletion) operation', async () => {
      mockFetch.mockClear();
      // Chain responses: 1. initial render, 2. deletion, 3. refresh
      mockFetch
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // initial render
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})  // deletion response
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // refresh response
          })
        );

      await act(async () => {
        render(<IngestionTable activeTab="csv" />);
      });

      // Wait for the group row to appear
      await waitFor(() => {
        expect(screen.getByText('Test Ingestion 1')).toBeInTheDocument();
      });

      const deleteAllButton = screen.getByRole('button', { name: /Delete All/i });
      await act(async () => {
        fireEvent.click(deleteAllButton);
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete all batches'));
      const calls = mockFetch.mock.calls;
      const groupDeleteCall = calls.find(call => call[0].includes('/api/ingested-data/name/') && call[1]?.method === 'DELETE');
      expect(groupDeleteCall).toBeTruthy();
      expect(groupDeleteCall[0]).toContain(encodeURIComponent('Test Ingestion 1'));
    });

    test('should perform batch specific "Delete" operation', async () => {
      mockFetch.mockClear();
      // Chain responses: 1. initial render, 2. deletion, 3. refresh
      mockFetch
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // initial render
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})  // deletion response
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIngestedData)  // refresh response
          })
        );

      await act(async () => {
        render(<IngestionTable activeTab="csv" />);
      });

      // Expand the group to reveal batch rows
      const groupRow = screen.getByText('Test Ingestion 1').closest('tr');
      if (groupRow) {
        fireEvent.click(groupRow);
      }

      await waitFor(() => {
        expect(screen.getByText(/Batch 1 of 2/i)).toBeInTheDocument();
      });

      // Find the batch-specific delete button (with text exactly 'Delete')
      const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i });
      await act(async () => {
        fireEvent.click(deleteButtons[0]);
      });

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('delete this ingestion'));
      const calls = mockFetch.mock.calls;
      const batchDeleteCall = calls.find(call => 
        call[0].includes('/api/ingested-data/') && 
        call[1]?.method === 'DELETE' && 
        !call[0].includes('/name/')
      );
      expect(batchDeleteCall).toBeTruthy();
    });
  });
}); 