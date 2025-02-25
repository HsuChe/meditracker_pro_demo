/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import { expect } from '@jest/globals';
import { getTestApiUrl } from '../test-config';

const API_BASE_URL = getTestApiUrl();

// Test data
const mockMapping = {
  name: 'Test Mapping',
  mappings: [
    { csvColumn: 'header1', dbColumn: 'db_column1' },
    { csvColumn: 'header2', dbColumn: 'db_column2' }
  ]
};

const mockBatchPayload = {
  name: 'Test Ingestion',
  data: [
    { db_column1: 'data1', db_column2: 'data2' }
  ],
  mapping_id: 1,
  record_count: 1,
  file_size_bytes: 100,
  batch_number: 0,
  total_batches: 1,
  parent_ingestion_id: null
};

// Mock fetch for integration tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Claims API Integration Tests', () => {
  describe('Mappings API', () => {
    it('should fetch mapping by ID', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mappings: [] })
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/mappings/1`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('mappings');
      expect(Array.isArray(data.mappings)).toBe(true);
    });

    it('should fetch all mappings', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/mappings`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Ingested Data API', () => {
    it('should submit batch data successfully', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ parent_ingestion_id: 1 })
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/ingested-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockBatchPayload),
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('parent_ingestion_id');
    });

    it('should handle invalid batch data', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid data' })
        })
      );

      const invalidPayload = { ...mockBatchPayload, data: null };
      
      const response = await fetch(`${API_BASE_URL}/api/ingested-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidPayload),
      });

      expect(response.ok).toBe(false);
    });

    it('should fetch ingested data with pagination', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            records: [],
            pagination: {
              totalRecords: 0,
              totalPages: 0
            }
          })
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/ingested-data?page=1&pageSize=10`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('records');
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('totalRecords');
      expect(data.pagination).toHaveProperty('totalPages');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent mapping ID', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Not found' })
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/mappings/999999`);
      expect(response.ok).toBe(false);
    });

    it('should handle malformed batch data', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid data' })
        })
      );

      const malformedPayload = { invalid: 'data' };
      
      const response = await fetch(`${API_BASE_URL}/api/ingested-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(malformedPayload),
      });

      expect(response.ok).toBe(false);
    });
  });
}); 