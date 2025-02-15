const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db.config');

describe('Filter API Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database
    await pool.query(`
      INSERT INTO ${process.env.CLAIMS_TABLE || 'claims_dummy'} 
      (claim_id, admission_date, allowed_amount)
      VALUES 
      ('TEST001', '2025-02-14', 1000),
      ('TEST002', '2025-02-08', 2000),
      ('TEST003', '2025-01-01', 3000)
    `);
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query(`
      DELETE FROM ${process.env.CLAIMS_TABLE || 'claims_dummy'}
      WHERE claim_id LIKE 'TEST%'
    `);
  });

  describe('POST /api/filters/claims', () => {
    it('should filter claims less than 6 days from today', async () => {
      const response = await request(app)
        .post('/api/filters/claims')
        .send({
          conditions: [{
            key: 'Claim Id',
            column: 'admission_date',
            operator: 'between_date',
            value: 'today',
            secondValue: {
              operator: 'less_than',
              value: 6,
              unit: 'day'
            }
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.claims).toHaveLength(1);
      expect(response.body.claims[0].claim_id).toBe('TEST001');
    });

    it('should filter claims greater than 6 days from today', async () => {
      const response = await request(app)
        .post('/api/filters/claims')
        .send({
          conditions: [{
            key: 'Claim Id',
            column: 'admission_date',
            operator: 'between_date',
            value: 'today',
            secondValue: {
              operator: 'greater_than',
              value: 6,
              unit: 'day'
            }
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.claims).toHaveLength(2);
      expect(response.body.claims.map(c => c.claim_id)).toContain('TEST002');
      expect(response.body.claims.map(c => c.claim_id)).toContain('TEST003');
    });

    it('should handle different time units', async () => {
      const units = ['day', 'week', 'month', 'year'];
      for (const unit of units) {
        const response = await request(app)
          .post('/api/filters/claims')
          .send({
            conditions: [{
              key: 'Claim Id',
              column: 'admission_date',
              operator: 'between_date',
              value: 'today',
              secondValue: {
                operator: 'less_than',
                value: 1,
                unit
              }
            }]
          });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.claims)).toBe(true);
      }
    });

    it('should prevent future dates in results', async () => {
      // Insert a future date
      await pool.query(`
        INSERT INTO ${process.env.CLAIMS_TABLE || 'claims_dummy'}
        (claim_id, admission_date, allowed_amount)
        VALUES ('TEST_FUTURE', '2025-12-31', 4000)
      `);

      const response = await request(app)
        .post('/api/filters/claims')
        .send({
          conditions: [{
            key: 'Claim Id',
            column: 'admission_date',
            operator: 'between_date',
            value: 'today',
            secondValue: {
              operator: 'less_than',
              value: 365,
              unit: 'day'
            }
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.claims.map(c => c.claim_id)).not.toContain('TEST_FUTURE');

      // Clean up
      await pool.query(`
        DELETE FROM ${process.env.CLAIMS_TABLE || 'claims_dummy'}
        WHERE claim_id = 'TEST_FUTURE'
      `);
    });
  });
}); 