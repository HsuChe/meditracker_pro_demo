const request = require('supertest');
const app = require('../../../server');
const { testClaims, testFilters } = require('../../fixtures/testData');

describe('Filter API Integration Tests', () => {
  beforeEach(async () => {
    // Clear relevant tables before each test
    await global.testPool.query('TRUNCATE TABLE saved_filters CASCADE');
    await global.testPool.query('TRUNCATE TABLE ingested_data CASCADE');
    
    // Insert test claims data
    await request(app)
      .post('/api/ingestion')
      .send({ claims: testClaims });
  });

  describe('POST /api/filters', () => {
    test('should apply filter conditions correctly', async () => {
      const response = await request(app)
        .post('/api/filters')
        .send({
          conditions: [
            {
              column: 'amount',
              operator: 'greater_than',
              value: '1500'
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].amount).toBeGreaterThan(1500);
    });

    test('should handle multiple filter conditions', async () => {
      const response = await request(app)
        .post('/api/filters')
        .send({
          conditions: [
            {
              column: 'amount',
              operator: 'greater_than',
              value: '1000'
            },
            {
              column: 'status',
              operator: 'equals',
              value: 'pending'
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.every(item => 
        item.amount > 1000 && item.status === 'pending'
      )).toBe(true);
    });

    test('should handle invalid filter conditions gracefully', async () => {
      const response = await request(app)
        .post('/api/filters')
        .send({
          conditions: [
            {
              column: 'invalid_column',
              operator: 'equals',
              value: 'test'
            }
          ]
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/filters/saved', () => {
    test('should save filter successfully', async () => {
      const response = await request(app)
        .post('/api/filters/saved')
        .send(testFilters[0])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(testFilters[0].name);
    });

    test('should prevent duplicate filter names', async () => {
      // First save
      await request(app)
        .post('/api/filters/saved')
        .send(testFilters[0]);

      // Try to save with same name
      const response = await request(app)
        .post('/api/filters/saved')
        .send(testFilters[0])
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /api/filters/saved', () => {
    beforeEach(async () => {
      // Save test filters
      for (const filter of testFilters) {
        await request(app)
          .post('/api/filters/saved')
          .send(filter);
      }
    });

    test('should retrieve all saved filters', async () => {
      const response = await request(app)
        .get('/api/filters/saved')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(testFilters.length);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('conditions');
    });
  });

  describe('DELETE /api/filters/saved/:id', () => {
    let savedFilterId;

    beforeEach(async () => {
      // Save a filter and store its ID
      const response = await request(app)
        .post('/api/filters/saved')
        .send(testFilters[0]);
      savedFilterId = response.body.data.id;
    });

    test('should delete saved filter successfully', async () => {
      const response = await request(app)
        .delete(`/api/filters/saved/${savedFilterId}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const getResponse = await request(app)
        .get('/api/filters/saved');
      expect(getResponse.body.data.find(f => f.id === savedFilterId)).toBeUndefined();
    });

    test('should handle non-existent filter ID', async () => {
      const response = await request(app)
        .delete('/api/filters/saved/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
}); 