const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('Filter History Tests', () => {
    let testFilterId;

    beforeAll(async () => {
        try {
            // Create a test filter
            const createResponse = await request(app)
                .post('/api/filters')
                .send({
                    name: `History Test Filter ${Date.now()}`,
                    description: 'Test filter for history',
                    conditions: [{
                        column: 'allowed_amount',
                        operator: 'greaterThan',
                        value: '0'
                    }]
                });

            testFilterId = createResponse.body.filter_id;
            
            // Execute filter to create history
            await request(app)
                .post(`/api/filters/${testFilterId}/execute`);

            customReporter.success('Test filter created and executed');
        } catch (error) {
            customReporter.failure('Test setup failed', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            if (testFilterId) {
                await pool.query('DELETE FROM filter_results_history WHERE filter_id = $1', [testFilterId]);
                await pool.query('DELETE FROM saved_filters WHERE filter_id = $1', [testFilterId]);
            }
            customReporter.success('Test cleanup completed');
        } catch (error) {
            customReporter.failure('Test cleanup failed', error);
            throw error;
        }
    });

    describe('GET /api/filters/:filter_id/history', () => {
        it('should return filter execution history', async () => {
            try {
                const response = await request(app)
                    .get(`/api/filters/${testFilterId}/history`);

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeGreaterThan(0);

                const historyEntry = response.body[0];
                expect(historyEntry).toHaveProperty('execution_time_ms');
                expect(historyEntry).toHaveProperty('results_count');
                expect(historyEntry).toHaveProperty('run_timestamp');

                customReporter.success('Filter history retrieved successfully');
            } catch (error) {
                customReporter.failure('Filter history test failed', error);
                throw error;
            }
        });

        it('should handle non-existent filter ID', async () => {
            try {
                const response = await request(app)
                    .get('/api/filters/999999/history');

                expect(response.status).toBe(404);
                expect(response.body).toHaveProperty('error');

                customReporter.success('Non-existent filter handled correctly');
            } catch (error) {
                customReporter.failure('Non-existent filter test failed', error);
                throw error;
            }
        });
    });

    describe('GET /api/filters/history/recent', () => {
        it('should return recent executions across all filters', async () => {
            try {
                const response = await request(app)
                    .get('/api/filters/history/recent')
                    .query({ limit: 5 });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeLessThanOrEqual(5);

                if (response.body.length > 0) {
                    const recentExecution = response.body[0];
                    expect(recentExecution).toHaveProperty('filter_id');
                    expect(recentExecution).toHaveProperty('execution_time_ms');
                    expect(recentExecution).toHaveProperty('run_timestamp');
                }

                customReporter.success('Recent history retrieved successfully');
            } catch (error) {
                customReporter.failure('Recent history test failed', error);
                throw error;
            }
        });
    });
}); 