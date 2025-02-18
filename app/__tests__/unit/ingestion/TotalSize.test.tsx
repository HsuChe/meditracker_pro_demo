import { render, screen, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { IngestionTable } from '@/app/ingestion/components/ingestion-table'
import { ClaimsSubmitter } from '@/app/ingestion/components/claims-submitter'

// Mock fetch for API calls
global.fetch = jest.fn()

describe('Total Size Calculation', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  describe('IngestionTable Component', () => {
    const mockIngestedData = {
      records: [
        {
          ingested_data_id: 1,
          name: "Test Ingestion 1",
          type: "claims",
          ingestion_date: "2024-02-18T00:00:00.000Z",
          record_count: 100,
          file_size_bytes: 1024, // 1KB
          activity_status: 'active',
          processing_status: 'completed',
          batch_number: 1,
          total_batches: 2
        },
        {
          ingested_data_id: 2,
          name: "Test Ingestion 1",
          type: "claims",
          ingestion_date: "2024-02-18T00:00:00.000Z",
          record_count: 100,
          file_size_bytes: 2048, // 2KB
          activity_status: 'active',
          processing_status: 'completed',
          batch_number: 2,
          total_batches: 2
        }
      ],
      pagination: {
        totalRecords: 2,
        totalPages: 1
      }
    }

    it('should correctly aggregate total size from multiple batches', async () => {
      // Mock the fetch response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIngestedData
      })

      await act(async () => {
        render(<IngestionTable activeTab="csv" />)
      })

      // Wait for the data to be loaded and formatted
      const totalSizeCell = await screen.findByText('3.00 KB')
      expect(totalSizeCell).toBeInTheDocument()
    })

    it('should handle undefined file sizes gracefully', async () => {
      const dataWithUndefinedSize = {
        ...mockIngestedData,
        records: [
          {
            ...mockIngestedData.records[0],
            file_size_bytes: undefined
          },
          {
            ...mockIngestedData.records[1],
            file_size_bytes: 1024
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => dataWithUndefinedSize
      })

      await act(async () => {
        render(<IngestionTable activeTab="csv" />)
      })

      // Should show 1 KB (ignoring undefined value)
      const totalSizeCell = await screen.findByText('1.00 KB')
      expect(totalSizeCell).toBeInTheDocument()
    })
  })

  describe('ClaimsSubmitter Component', () => {
    it('should calculate correct file size for a batch', async () => {
      const mockCsvData = [
        ['column1', 'column2'],
        ['value1', 'value2'],
        ['value3', 'value4']
      ]

      const mockMappingData = {
        mappings: [
          { csvColumn: 'column1', dbColumn: 'db_column1' },
          { csvColumn: 'column2', dbColumn: 'db_column2' }
        ]
      }

      let capturedPayload: any = null;

      // Mock fetch responses
      ;(global.fetch as jest.Mock)
        .mockImplementation(async (url, options) => {
          if (url === 'http://localhost:5000/api/mappings/1') {
            return {
              ok: true,
              json: async () => mockMappingData
            }
          } else if (url === 'http://localhost:5000/api/ingested-data') {
            capturedPayload = JSON.parse(options.body);
            return {
              ok: true,
              json: async () => ({ parent_ingestion_id: 1 })
            }
          } else {
            return {
              ok: true,
              json: async () => []
            }
          }
        })

      const onSuccess = jest.fn()
      const onError = jest.fn()

      await act(async () => {
        render(
          <ClaimsSubmitter
            csvData={mockCsvData}
            mappingId={1}
            onSuccess={onSuccess}
            onError={onError}
          />
        )
      })

      // Find and fill the ingestion name input
      const nameInput = screen.getByPlaceholderText('Enter a name for this ingestion')
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test Ingestion' } })
      })
      
      // Find and click submit button
      const submitButton = screen.getByText('Submit Claims')
      await act(async () => {
        fireEvent.click(submitButton)
      })

      // Wait for all state updates to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Verify that the batch payload was sent with a valid file size
      expect(capturedPayload).toBeTruthy()
      expect(capturedPayload.file_size_bytes).toBeGreaterThan(0)
      expect(onError).not.toHaveBeenCalled()
    })

    it('should handle empty batch with zero file size', async () => {
      const mockCsvData = [
        ['column1', 'column2']
        // No data rows
      ]

      const mockMappingData = {
        mappings: [
          { csvColumn: 'column1', dbColumn: 'db_column1' },
          { csvColumn: 'column2', dbColumn: 'db_column2' }
        ]
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMappingData
        })

      const onSuccess = jest.fn()
      const onError = jest.fn()

      await act(async () => {
        render(
          <ClaimsSubmitter
            csvData={mockCsvData}
            mappingId={1}
            onSuccess={onSuccess}
            onError={onError}
          />
        )
      })

      // Find and fill the ingestion name input
      const nameInput = screen.getByPlaceholderText('Enter a name for this ingestion')
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test Ingestion' } })
      })
      
      // Find and click submit button
      const submitButton = screen.getByText('Submit Claims')
      await act(async () => {
        fireEvent.click(submitButton)
      })

      // Verify that onError was called for no data
      expect(onError).toHaveBeenCalledWith('No data to submit')
    })
  })
}) 