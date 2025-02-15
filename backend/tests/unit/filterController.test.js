const { jest } = require('@jest/globals');
const pool = require('../../config/db.config');
const filterController = require('../../controllers/filterController');

// Mock the database pool
jest.mock('../../config/db.config', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

describe('Filter Controller Unit Tests', () => {
  let mockClient;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Create a mock client with query method
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    // Setup pool connect to return our mock client
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('buildWhereClauses', () => {
    const testCases = [
      {
        name: 'equals operator',
        conditions: [{
          column: 'claim_id',
          operator: 'equals',
          value: '12345'
        }],
        expectedClauses: ['claim_id::text = $1::text'],
        expectedParams: ['12345']
      },
      {
        name: 'contains operator',
        conditions: [{
          column: 'diagnosis_code',
          operator: 'contains',
          value: 'ABC'
        }],
        expectedClauses: ['diagnosis_code::text ILIKE \'%\' || $1::text || \'%\''],
        expectedParams: ['ABC']
      },
      {
        name: 'between_date operator',
        conditions: [{
          column: 'admission_date',
          operator: 'between_date',
          value: '2024-01-01',
          secondValue: {
            operator: 'less_than',
            value: 30,
            unit: 'day'
          }
        }],
        expectedClauses: [
          'admission_date::timestamp BETWEEN ($1::timestamp - interval \'30 days\') AND $1::timestamp'
        ],
        expectedParams: ['2024-01-01']
      },
      {
        name: 'multiple conditions',
        conditions: [
          {
            column: 'claim_id',
            operator: 'equals',
            value: '12345'
          },
          {
            column: 'allowed_amount',
            operator: 'greater_than',
            value: 1000
          }
        ],
        expectedClauses: [
          'claim_id::text = $1::text',
          'allowed_amount::numeric > $2::numeric'
        ],
        expectedParams: ['12345', 1000]
      }
    ];

    testCases.forEach(({ name, conditions, expectedClauses, expectedParams }) => {
      test(name, () => {
        const { clauses, params } = filterController.buildWhereClauses(conditions);
        expect(clauses).toEqual(expectedClauses);
        expect(params).toEqual(expectedParams);
      });
    });
  });

  describe('buildFilterQuery', () => {
    test('builds correct query with conditions', () => {
      const conditions = [{
        column: 'claim_id',
        operator: 'equals',
        value: '12345'
      }];

      const { query, params } = filterController.buildFilterQuery(conditions);
      
      expect(query).toContain('SELECT');
      expect(query).toContain('claim_id');
      expect(query).toContain('WHERE');
      expect(params).toEqual(['12345']);
    });

    test('builds query without conditions', () => {
      const { query, params } = filterController.buildFilterQuery([]);
      
      expect(query).toContain('SELECT');
      expect(query).toContain('claim_id');
      expect(query).not.toContain('WHERE');
      expect(params).toEqual([]);
    });
  });

  describe('calculateStatistics', () => {
    test('calculates correct statistics from claims data', async () => {
      const mockClaims = [
        {
          claim_id: '12345',
          grouped_data: [
            {
              admission_date: '2024-01-01',
              allowed_amount: 1000
            },
            {
              admission_date: '2024-01-02',
              allowed_amount: 2000
            }
          ]
        },
        {
          claim_id: '67890',
          grouped_data: [
            {
              admission_date: '2024-01-03',
              allowed_amount: 3000
            }
          ]
        }
      ];

      const stats = await filterController.calculateStatistics(mockClaims);

      expect(stats).toEqual({
        uniqueClaimIds: 2,
        totalRecords: 3,
        dateRange: {
          min: '2024-01-01T00:00:00.000Z',
          max: '2024-01-03T00:00:00.000Z'
        },
        totalAllowedAmount: 6000
      });
    });

    test('handles empty claims array', async () => {
      const stats = await filterController.calculateStatistics([]);

      expect(stats).toEqual({
        uniqueClaimIds: 0,
        totalRecords: 0,
        dateRange: {
          min: null,
          max: null
        },
        totalAllowedAmount: 0
      });
    });

    test('handles invalid dates and amounts', async () => {
      const mockClaims = [
        {
          claim_id: '12345',
          grouped_data: [
            {
              admission_date: 'invalid-date',
              allowed_amount: 'not-a-number'
            },
            {
              admission_date: '2024-01-01',
              allowed_amount: 1000
            }
          ]
        }
      ];

      const stats = await filterController.calculateStatistics(mockClaims);

      expect(stats).toEqual({
        uniqueClaimIds: 1,
        totalRecords: 2,
        dateRange: {
          min: '2024-01-01T00:00:00.000Z',
          max: '2024-01-01T00:00:00.000Z'
        },
        totalAllowedAmount: 1000
      });
    });
  });

  describe('buildOptimizedCombinedQuery', () => {
    test('builds optimized query with base query and conditions', () => {
      const baseQuery = 'SELECT * FROM claims WHERE claim_id = $1';
      const conditions = [{
        column: 'allowed_amount',
        operator: 'greater_than',
        value: 1000
      }];
      const limit = 10;
      const offset = 0;

      const query = filterController.buildOptimizedCombinedQuery(baseQuery, conditions, limit, offset);

      expect(query).toContain('WITH base_stats AS');
      expect(query).toContain('paginated_claims AS');
      expect(query).toContain('LIMIT 10');
      expect(query).toContain('OFFSET 0');
      expect(query).toContain('json_build_object');
      expect(query).toContain('uniqueClaimIds');
      expect(query).toContain('totalRecords');
      expect(query).toContain('dateRange');
    });
  });
}); 