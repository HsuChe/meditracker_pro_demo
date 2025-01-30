const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('Saved Filters API', () => {
    beforeEach(async () => {
        try {
            await pool.query('DELETE FROM filter_results_history');
            await pool.query('DELETE FROM saved_filters');
            customReporter.success('Test environment cleaned');
        } catch (error) {
            customReporter.failure('Failed to clean test environment', error);
            throw error;
        }
    });

    describe('POST /api/filters/save', () => {
        it('should save a new filter', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters/save')
                    .send({
                        name: `Test Filter ${Date.now()}`,
                        description: 'Test Description',
                        conditions: [{
                            column: 'allowed_amount',
                            operator: 'greaterThan',
                            value: '0'
                        }]
                    });

                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('filter_id');
                customReporter.success('Filter saved successfully');
            } catch (error) {
                customReporter.failure('Filter save test failed', error);
                throw error;
            }
        });
    });

    describe('GET /api/filters', () => {
        it('should return saved filters', async () => {
            try {
                const response = await request(app)
                    .get('/api/filters');

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                customReporter.success('Filters retrieved successfully');
            } catch (error) {
                customReporter.failure('Get filters test failed', error);
                throw error;
            }
        });
    });

    describe('GET /api/filters/:filter_id', () => {
        let testFilterId;

        beforeAll(async () => {
            // Create a test filter
            const createResponse = await request(app)
                .post('/api/filters/save')
                .send({
                    name: `Test Filter ${Date.now()}`,
                    description: 'Test filter',
                    conditions: []
                });
            testFilterId = createResponse.body.filter_id;
        });

        it('should return filter by ID', async () => {
            try {
                const response = await request(app)
                    .get(`/api/filters/${testFilterId}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('filter_id');
                expect(response.body).toHaveProperty('name');
                customReporter.success('Filter retrieved by ID successfully');
            } catch (error) {
                customReporter.failure('Get filter by ID test failed', error);
                throw error;
            }
        });
    });
}); 