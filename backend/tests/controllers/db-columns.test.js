const request = require('supertest');
const app = require('../../server');
const { pool, customReporter } = require('../setup');

describe('DB Columns API', () => {
    describe('GET /api/db-columns', () => {
        it('should return all columns from claims_dummy table', async () => {
            const response = await request(app)
                .get('/api/db-columns');

            try {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('columns');
                const columns = response.body.columns;
                
                // Check essential columns exist
                const requiredColumns = ['claim_id', 'patient_id', 'allowed_amount'];
                requiredColumns.forEach(colName => {
                    const found = columns.some(col => col.column_name === colName);
                    expect(found).toBe(true);
                });

                customReporter.success('DB columns retrieved successfully');
            } catch (error) {
                customReporter.failure('DB columns test failed', error);
                throw error;
            }
        });

        it('should include data types for columns', async () => {
            const response = await request(app)
                .get('/api/db-columns');

            expect(response.status).toBe(200);
            const column = response.body.columns[0];
            expect(column).toHaveProperty('column_name');
            expect(column).toHaveProperty('data_type');
            expect(column).toHaveProperty('is_nullable');
        });
    });
}); 