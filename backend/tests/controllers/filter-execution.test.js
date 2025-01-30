const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('Filter Execution API', () => {
    describe('POST /api/filters/execute', () => {
        it('should execute filter with conditions', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters/execute')
                    .send({
                        conditions: [{
                            column: 'allowed_amount',
                            operator: 'greaterThan',
                            value: '0'
                        }]
                    });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('records');
                expect(Array.isArray(response.body.records)).toBe(true);

                customReporter.success('Filter executed successfully');
            } catch (error) {
                customReporter.failure('Filter execution test failed', error);
                throw error;
            }
        }, 30000);

        it('should handle invalid conditions', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters/execute')
                    .send({
                        conditions: [{
                            column: 'invalid_column',
                            operator: 'invalid_operator',
                            value: 'test'
                        }]
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
                customReporter.success('Invalid conditions handled correctly');
            } catch (error) {
                customReporter.failure('Invalid conditions test failed', error);
                throw error;
            }
        });
    });
}); 