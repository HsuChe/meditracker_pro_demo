const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('Claims API Endpoints', () => {
    describe('GET /api/claims', () => {
        it('should return paginated claims', async () => {
            try {
                const response = await request(app)
                    .get('/api/claims')
                    .query({ limit: 10, offset: 0 });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeLessThanOrEqual(10);

                if (response.body.length > 0) {
                    const claim = response.body[0];
                    expect(claim).toHaveProperty('claim_merged_id');
                    expect(claim).toHaveProperty('claim_id');
                }

                customReporter.success('Claims pagination works');
            } catch (error) {
                customReporter.failure('Claims pagination test failed', error);
                throw error;
            }
        }, 30000);

        it('should handle pagination parameters', async () => {
            try {
                const response = await request(app)
                    .get('/api/claims')
                    .query({ limit: 5, offset: 5 });

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
                expect(response.body.length).toBeLessThanOrEqual(5);

                customReporter.success('Claims pagination parameters work');
            } catch (error) {
                customReporter.failure('Claims pagination parameters test failed', error);
                throw error;
            }
        }, 30000);
    });

    describe('GET /api/claims/metadata', () => {
        it('should return valid metadata', async () => {
            try {
                const response = await request(app)
                    .get('/api/claims/metadata');

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('totalAmount');
                expect(response.body).toHaveProperty('averageAmount');
                expect(response.body).toHaveProperty('uniquePatients');
                expect(response.body.totalAmount).toBeGreaterThan(0);

                customReporter.success('Claims metadata retrieved successfully');
            } catch (error) {
                customReporter.failure('Claims metadata test failed', error);
                throw error;
            }
        }, 30000);
    });

    describe('GET /api/claims/count', () => {
        it('should return total count', async () => {
            try {
                const response = await request(app)
                    .get('/api/claims/count');

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('total');
                expect(typeof response.body.total).toBe('number');
                expect(response.body.total).toBeGreaterThan(0);

                customReporter.success('Claims count retrieved successfully');
            } catch (error) {
                customReporter.failure('Claims count test failed', error);
                throw error;
            }
        }, 30000);
    });
}, 60000); 