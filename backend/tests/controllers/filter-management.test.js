const request = require('supertest');
const app = require('../../server');
const { pool } = require('../setup');

describe('Filter Management API', () => {
    beforeEach(async () => {
        // Clean up before each test
        await pool.query('DELETE FROM filter_results_history');
        await pool.query('DELETE FROM saved_filters');
    });

    describe('POST /api/filters', () => {
        it('should create a new filter', async () => {
            const testFilter = {
                name: `Test Filter ${Date.now()}`,
                description: 'Test filter description',
                conditions: [{
                    column: 'allowed_amount',
                    operator: 'greaterThan',
                    value: '0'
                }]
            };

            const response = await request(app)
                .post('/api/filters')
                .send(testFilter);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('filter_id');
            expect(response.body.name).toBe(testFilter.name);
        });

        it('should handle duplicate filter names', async () => {
            const testFilter = {
                name: `Duplicate Filter ${Date.now()}`,
                description: 'Test filter description',
                conditions: []
            };

            // Create first filter
            await request(app)
                .post('/api/filters')
                .send(testFilter);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/filters')
                .send(testFilter);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toMatch(/already exists/i);
        });
    });

    describe('GET /api/filters', () => {
        it('should return saved filters', async () => {
            const response = await request(app)
                .get('/api/filters')
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('filters');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.filters)).toBe(true);
        });
    });
}); 