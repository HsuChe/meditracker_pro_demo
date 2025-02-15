const request = require('supertest');
const app = require('../../../server');
const { testClaims } = require('../../fixtures/testData');

describe('Ingestion API Integration Tests', () => {
  beforeEach(async () => {
    // Clear the ingested_data table before each test
    await global.testPool.query('TRUNCATE TABLE ingested_data CASCADE');
  });

  describe('POST /api/ingestion', () => {
    test('should successfully ingest valid claims data', async () => {
      const response = await request(app)
        .post('/api/ingestion')
        .send({ claims: testClaims })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.inserted_count).toBe(testClaims.length);
    });

    test('should handle duplicate claim IDs', async () => {
      // First ingestion
      await request(app)
        .post('/api/ingestion')
        .send({ claims: testClaims });

      // Second ingestion with same data
      const response = await request(app)
        .post('/api/ingestion')
        .send({ claims: testClaims })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('duplicate');
    });

    test('should validate required fields', async () => {
      const invalidClaim = {
        // Missing required fields
        patient_name: 'John Doe',
        amount: 1000.50
      };

      const response = await request(app)
        .post('/api/ingestion')
        .send({ claims: [invalidClaim] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/ingestion', () => {
    beforeEach(async () => {
      // Insert test data
      await request(app)
        .post('/api/ingestion')
        .send({ claims: testClaims });
    });

    test('should retrieve all ingested claims', async () => {
      const response = await request(app)
        .get('/api/ingestion')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(testClaims.length);
      expect(response.body.data[0]).toHaveProperty('claim_id');
      expect(response.body.data[0]).toHaveProperty('patient_name');
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/ingestion')
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(testClaims.length);
    });

    test('should support sorting', async () => {
      const response = await request(app)
        .get('/api/ingestion')
        .query({ sort_by: 'amount', sort_order: 'desc' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const amounts = response.body.data.map(claim => claim.amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    });
  });
}); 