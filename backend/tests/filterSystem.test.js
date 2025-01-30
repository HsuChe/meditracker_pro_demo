const request = require('supertest');
const app = require('../server'); // Make sure your server.js exports the app
const pool = require('../config/db.config');

describe('Filter System Tests', () => {
    let testFilterId;

    // Test data
    const testFilter = {
        name: "Test Filter",
        description: "Test filter description",
        conditions: [
            {
                column: "total_charges",
                operator: "greaterThan",
                value: "1000",
                secondValue: null
            },
            {
                column: "claim_type",
                operator: "equals",
                value: "inpatient",
                secondValue: null
            }
        ]
    };

    // Clean up before tests
    beforeAll(async () => {
        await pool.query("DELETE FROM filter_results_history");
        await pool.query("DELETE FROM saved_filters");  // Delete all filters to ensure clean state
    });

    // Test saving a new filter
    test('POST /api/filters - Save new filter', async () => {
        const response = await request(app)
            .post('/api/filters')
            .send(testFilter);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('filter_id');
        expect(response.body.name).toBe(testFilter.name);
        expect(response.body.matched_claims_count).toBeGreaterThanOrEqual(0);

        testFilterId = response.body.filter_id;
    });

    // Test getting all filters
    test('GET /api/filters - Get all filters', async () => {
        const response = await request(app)
            .get('/api/filters')
            .query({ page: 1, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('filters');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.filters)).toBeTruthy();
    });

    // Test executing a filter
    test('POST /api/filters/:filter_id/execute - Execute filter', async () => {
        const response = await request(app)
            .post(`/api/filters/${testFilterId}/execute`)
            .query({ page: 1, limit: 50 });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body).toHaveProperty('execution_time_ms');
        expect(Array.isArray(response.body.results)).toBeTruthy();
    });

    // Test different filter conditions
    test('Test various filter conditions', async () => {
        const testCases = [
            {
                name: "String Contains Filter Test",
                description: "Test string contains operator",
                conditions: [{
                    column: "diagnosis_code",
                    operator: "contains",
                    value: "123",
                    secondValue: null
                }]
            },
            {
                name: "Date Range Filter Test",
                description: "Test date between operator",
                conditions: [{
                    column: "admission_date",
                    operator: "between",
                    value: "2023-01-01",
                    secondValue: "2023-12-31"
                }]
            },
            {
                name: "Multiple Conditions Filter Test",
                description: "Test multiple conditions",
                conditions: [
                    {
                        column: "total_charges",
                        operator: "greaterThan",
                        value: "1000",
                        secondValue: null
                    },
                    {
                        column: "claim_type",
                        operator: "isNotNull",
                        value: null,
                        secondValue: null
                    }
                ]
            }
        ];

        for (const testCase of testCases) {
            console.log('Testing case:', testCase.name);
            const response = await request(app)
                .post('/api/filters')
                .send(testCase);

            if (response.status !== 201) {
                console.log('Failed test case:', JSON.stringify(testCase, null, 2));
                console.log('Response:', JSON.stringify(response.body, null, 2));
                console.log('Status:', response.status);
            }

            try {
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('filter_id');
                expect(response.body.name).toBe(testCase.name);
            } catch (error) {
                console.error('Test assertion failed:', error.message);
                console.error('Test case:', JSON.stringify(testCase, null, 2));
                console.error('Response:', JSON.stringify(response.body, null, 2));
                throw error;
            }
        }
    }, 10000);

    // Test updating claims_ids
    test('PUT /api/filters/:filter_id/claims - Update claims_ids', async () => {
        const response = await request(app)
            .put(`/api/filters/${testFilterId}/claims`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('updated_claims_count');
        expect(response.body).toHaveProperty('filter_id');
    });

    // Test error handling
    describe('Error Handling', () => {
        test('Duplicate filter name', async () => {
            const response = await request(app)
                .post('/api/filters')
                .send(testFilter);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('Invalid filter ID', async () => {
            const response = await request(app)
                .post('/api/filters/999999/execute')
                .query({ page: 1, limit: 50 });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });

        test('Invalid operator', async () => {
            const response = await request(app)
                .post('/api/filters')
                .send({
                    name: "Invalid Operator Test",
                    conditions: [{
                        column: "total_charges",
                        operator: "invalidOperator",
                        value: "1000",
                        secondValue: null
                    }]
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    // Clean up after tests
    afterAll(async () => {
        await pool.query("DELETE FROM filter_results_history");
        await pool.query("DELETE FROM saved_filters");
        await pool.end();
    });
}); 