const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db.config');

describe('Filter Controller Integration Tests', () => {
  let testFilterId;
  
  beforeAll(async () => {
    // Clear test data and set up test database
    await pool.query('DELETE FROM saved_filters WHERE name LIKE \'test_%\'');
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM saved_filters WHERE name LIKE \'test_%\'');
  });

  describe('POST /api/filters', () => {
    test('creates a new filter successfully', async () => {
      const testFilter = {
        name: 'test_filter_1',
        description: 'Test filter description',
        conditions: [
          {
            key: 'Claim Id',
            column: 'claim_id',
            operator: 'equals',
            value: '12345'
          }
        ],
        is_favorite: false,
        created_by: 'test_user'
      };

      const response = await request(app)
        .post('/api/filters')
        .send(testFilter)
        .expect(201);

      expect(response.body).toHaveProperty('filter_id');
      expect(response.body.name).toBe(testFilter.name);
      expect(response.body.description).toBe(testFilter.description);
      
      testFilterId = response.body.filter_id;
    });

    test('rejects duplicate filter names', async () => {
      const duplicateFilter = {
        name: 'test_filter_1',
        description: 'Duplicate filter',
        conditions: []
      };

      await request(app)
        .post('/api/filters')
        .send(duplicateFilter)
        .expect(400);
    });
  });

  describe('GET /api/filters', () => {
    test('retrieves saved filters with pagination', async () => {
      const response = await request(app)
        .get('/api/filters')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('filters');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.filters)).toBe(true);
    });

    test('searches filters by name', async () => {
      const response = await request(app)
        .get('/api/filters')
        .query({ search: 'test_' })
        .expect(200);

      expect(response.body.filters.length).toBeGreaterThan(0);
      expect(response.body.filters[0].name).toContain('test_');
    });
  });

  describe('POST /api/filters/execute', () => {
    test('executes filter conditions successfully', async () => {
      const filterConditions = {
        conditions: [
          {
            key: 'Claim Id',
            column: 'claim_id',
            operator: 'equals',
            value: '12345'
          }
        ]
      };

      const response = await request(app)
        .post('/api/filters/execute')
        .send(filterConditions)
        .expect(200);

      expect(response.body).toHaveProperty('claims');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('pagination');
    });

    test('handles invalid filter conditions gracefully', async () => {
      const invalidConditions = {
        conditions: [
          {
            key: 'Claim Id',
            column: 'invalid_column',
            operator: 'invalid_operator',
            value: '12345'
          }
        ]
      };

      await request(app)
        .post('/api/filters/execute')
        .send(invalidConditions)
        .expect(500);
    });
  });

  describe('GET /api/filters/data-types', () => {
    test('retrieves column data types', async () => {
      const response = await request(app)
        .get('/api/filters/data-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('column');
      expect(response.body.data[0]).toHaveProperty('type');
    });
  });

  describe('POST /api/filters/diagnosis-codes', () => {
    test('retrieves diagnosis codes for given ingested IDs', async () => {
      // First, get some valid ingested IDs from the database
      const ingestedDataQuery = await pool.query(
        "SELECT ingested_data_id FROM ingested_data WHERE type = 'lut' LIMIT 2"
      );

      if (ingestedDataQuery.rows.length > 0) {
        const ingestedIds = ingestedDataQuery.rows.map(row => row.ingested_data_id);

        const response = await request(app)
          .post('/api/filters/diagnosis-codes')
          .send({ ingestedIds })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    });

    test('handles empty ingested IDs array', async () => {
      await request(app)
        .post('/api/filters/diagnosis-codes')
        .send({ ingestedIds: [] })
        .expect(400);
    });
  });

  describe('DELETE /api/filters/:name', () => {
    test('deletes a filter successfully', async () => {
      await request(app)
        .delete('/api/filters/test_filter_1')
        .expect(200);

      // Verify filter was deleted
      const response = await request(app)
        .get('/api/filters')
        .query({ search: 'test_filter_1' });

      expect(response.body.filters.find(f => f.name === 'test_filter_1')).toBeUndefined();
    });

    test('returns 404 for non-existent filter', async () => {
      await request(app)
        .delete('/api/filters/non_existent_filter')
        .expect(404);
    });
  });
}); 