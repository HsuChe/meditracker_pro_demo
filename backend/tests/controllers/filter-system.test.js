const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('Filter System Tests', () => {
    let testFilterId;

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

    afterEach(async () => {
        if (testFilterId) {
            await pool.query('DELETE FROM filter_results_history WHERE filter_id = $1', [testFilterId]);
            await pool.query('DELETE FROM saved_filters WHERE filter_id = $1', [testFilterId]);
        }
    });

    describe('Filter Creation and Management', () => {
        it('should create and execute a filter', async () => {
            try {
                // Create filter
                const createResponse = await request(app)
                    .post('/api/filters')
                    .send({
                        name: `Test Filter ${Date.now()}`,
                        description: 'Test filter',
                        conditions: [{
                            column: 'allowed_amount',
                            operator: 'greaterThan',
                            value: '0'
                        }]
                    });

                expect(createResponse.status).toBe(201);
                testFilterId = createResponse.body.filter_id;
                customReporter.success('Filter created successfully');

                // Execute filter
                const executeResponse = await request(app)
                    .post(`/api/filters/${testFilterId}/execute`);

                expect(executeResponse.status).toBe(200);
                expect(executeResponse.body).toHaveProperty('records');
                expect(executeResponse.body).toHaveProperty('metadata');
                customReporter.success('Filter executed successfully');
            } catch (error) {
                customReporter.failure('Filter creation/execution test failed', error);
                throw error;
            }
        }, 30000);

        it('should handle various operators', async () => {
            try {
                const operators = [
                    {
                        operator: 'equals',
                        column: 'claim_type',
                        value: 'inpatient'
                    },
                    {
                        operator: 'greaterThan',
                        column: 'allowed_amount',
                        value: '1000'
                    },
                    {
                        operator: 'contains',
                        column: 'diagnosis_code',
                        value: 'E'
                    }
                ];

                for (const testOp of operators) {
                    const response = await request(app)
                        .post('/api/filters')
                        .send({
                            name: `Operator Test ${Date.now()}-${testOp.operator}`,
                            description: `Testing ${testOp.operator} operator`,
                            conditions: [testOp]
                        });

                    expect(response.status).toBe(201);
                    expect(response.body).toHaveProperty('filter_id');
                    customReporter.success(`Operator ${testOp.operator} tested successfully`);
                }
            } catch (error) {
                customReporter.failure('Operator test failed', error);
                throw error;
            }
        }, 30000);

        it('should handle invalid conditions gracefully', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters')
                    .send({
                        name: `Invalid Test ${Date.now()}`,
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

    describe('Error Handling', () => {
        it('should handle missing required fields', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters')
                    .send({
                        name: '', // Empty name
                        conditions: []
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
                customReporter.success('Missing fields handled correctly');
            } catch (error) {
                customReporter.failure('Missing fields test failed', error);
                throw error;
            }
        });

        it('should handle invalid operator', async () => {
            try {
                const response = await request(app)
                    .post('/api/filters')
                    .send({
                        name: `Invalid Op Test ${Date.now()}`,
                        conditions: [{
                            column: 'allowed_amount',
                            operator: 'invalidOp',
                            value: '0'
                        }]
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
                customReporter.success('Invalid operator handled correctly');
            } catch (error) {
                customReporter.failure('Invalid operator test failed', error);
                throw error;
            }
        });

        it('should handle duplicate filter names', async () => {
            try {
                const testName = `Duplicate Test ${Date.now()}`;
                
                // Create first filter
                await request(app)
                    .post('/api/filters')
                    .send({
                        name: testName,
                        conditions: []
                    });

                // Try to create duplicate
                const response = await request(app)
                    .post('/api/filters')
                    .send({
                        name: testName,
                        conditions: []
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
                customReporter.success('Duplicate name handled correctly');
            } catch (error) {
                customReporter.failure('Duplicate name test failed', error);
                throw error;
            }
        });
    });
}, 60000); 