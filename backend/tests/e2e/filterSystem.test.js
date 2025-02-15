const request = require('supertest');
const app = require('../../app');
const pool = require('../../config/db.config');

describe('Filter System E2E Tests', () => {
  let testFilterId;
  let testClaimId;

  beforeAll(async () => {
    // Set up test data
    await pool.query('DELETE FROM saved_filters WHERE name LIKE \'e2e_test_%\'');
    
    // Insert test claim data
    const claimResult = await pool.query(`
      INSERT INTO ${process.env.CLAIMS_TABLE || 'claims_dummy'} 
      (claim_id, diagnosis_code, allowed_amount, admission_date)
      VALUES 
      ('E2E_TEST_CLAIM', 'TEST123', 5000, '2024-01-01')
      RETURNING id
    `);
    testClaimId = claimResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM saved_filters WHERE name LIKE \'e2e_test_%\'');
    await pool.query(`
      DELETE FROM ${process.env.CLAIMS_TABLE || 'claims_dummy'} 
      WHERE claim_id = 'E2E_TEST_CLAIM'
    `);
  });

  describe('Complete Filter Workflow', () => {
    test('creates, executes, and manages filters end-to-end', async () => {
      // Step 1: Get available columns and their data types
      const dataTypesResponse = await request(app)
        .get('/api/filters/data-types')
        .expect(200);

      expect(dataTypesResponse.body.success).toBe(true);
      expect(dataTypesResponse.body.data).toBeInstanceOf(Array);

      // Step 2: Create a new filter
      const newFilter = {
        name: 'e2e_test_filter',
        description: 'E2E test filter',
        conditions: [
          {
            key: 'Claim Id',
            column: 'diagnosis_code',
            operator: 'equals',
            value: 'TEST123'
          }
        ],
        is_favorite: true,
        created_by: 'e2e_test'
      };

      const createResponse = await request(app)
        .post('/api/filters')
        .send(newFilter)
        .expect(201);

      expect(createResponse.body).toHaveProperty('filter_id');
      testFilterId = createResponse.body.filter_id;

      // Step 3: Execute the filter
      const executeResponse = await request(app)
        .post('/api/filters/execute')
        .send({ conditions: newFilter.conditions })
        .expect(200);

      expect(executeResponse.body).toHaveProperty('claims');
      expect(executeResponse.body.claims.length).toBeGreaterThan(0);
      expect(executeResponse.body.claims[0].diagnosis_code).toBe('TEST123');

      // Step 4: Verify filter appears in saved filters list
      const listResponse = await request(app)
        .get('/api/filters')
        .query({ search: 'e2e_test_' })
        .expect(200);

      expect(listResponse.body.filters.length).toBeGreaterThan(0);
      const savedFilter = listResponse.body.filters.find(f => f.name === 'e2e_test_filter');
      expect(savedFilter).toBeDefined();
      expect(savedFilter.is_favorite).toBe(true);

      // Step 5: Test filter with complex conditions
      const complexFilter = {
        name: 'e2e_test_complex_filter',
        description: 'Complex E2E test filter',
        conditions: [
          {
            key: 'Claim Id',
            column: 'diagnosis_code',
            operator: 'equals',
            value: 'TEST123'
          },
          {
            key: 'Claim Id',
            column: 'allowed_amount',
            operator: 'greater_than',
            value: '1000'
          },
          {
            key: 'Claim Id',
            column: 'admission_date',
            operator: 'between_date',
            value: '2024-01-01',
            secondValue: {
              operator: 'less_than',
              value: 30,
              unit: 'day'
            }
          }
        ]
      };

      const complexCreateResponse = await request(app)
        .post('/api/filters')
        .send(complexFilter)
        .expect(201);

      const complexExecuteResponse = await request(app)
        .post('/api/filters/execute')
        .send({ conditions: complexFilter.conditions })
        .expect(200);

      expect(complexExecuteResponse.body.claims.length).toBeGreaterThan(0);
      expect(complexExecuteResponse.body.statistics).toBeDefined();

      // Step 6: Delete filters
      await request(app)
        .delete(`/api/filters/${newFilter.name}`)
        .expect(200);

      await request(app)
        .delete(`/api/filters/${complexFilter.name}`)
        .expect(200);

      // Verify deletion
      const finalListResponse = await request(app)
        .get('/api/filters')
        .query({ search: 'e2e_test_' })
        .expect(200);

      expect(finalListResponse.body.filters.length).toBe(0);
    });

    test('handles LUT-based filtering workflow', async () => {
      // Step 1: Get available LUT data
      const ingestedDataQuery = await pool.query(
        "SELECT ingested_data_id FROM ingested_data WHERE type = 'lut' LIMIT 1"
      );

      if (ingestedDataQuery.rows.length > 0) {
        const ingestedId = ingestedDataQuery.rows[0].ingested_data_id;

        // Step 2: Get diagnosis codes for the LUT
        const diagnosisResponse = await request(app)
          .post('/api/filters/diagnosis-codes')
          .send({ ingestedIds: [ingestedId] })
          .expect(200);

        expect(diagnosisResponse.body.success).toBe(true);
        expect(diagnosisResponse.body.data).toBeDefined();

        // Get the first diagnosis code from the response
        const lutName = Object.keys(diagnosisResponse.body.data)[0];
        const diagnosisCodes = diagnosisResponse.body.data[lutName].diagnosis_codes;

        if (diagnosisCodes.length > 0) {
          // Step 3: Create a filter using LUT values
          const lutFilter = {
            name: 'e2e_test_lut_filter',
            description: 'E2E test LUT filter',
            conditions: [
              {
                key: 'Claim Id',
                column: 'diagnosis_code',
                operator: 'in_list',
                value: diagnosisCodes.join(','),
                lutValue: lutName
              }
            ]
          };

          // Create and execute the LUT filter
          await request(app)
            .post('/api/filters')
            .send(lutFilter)
            .expect(201);

          const lutExecuteResponse = await request(app)
            .post('/api/filters/execute')
            .send({ conditions: lutFilter.conditions })
            .expect(200);

          expect(lutExecuteResponse.body).toHaveProperty('claims');
          expect(lutExecuteResponse.body).toHaveProperty('statistics');

          // Clean up
          await request(app)
            .delete(`/api/filters/${lutFilter.name}`)
            .expect(200);
        }
      }
    });
  });
}); 