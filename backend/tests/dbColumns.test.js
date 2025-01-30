const request = require('supertest');
const app = require('../server');
const pool = require('../config/db.config');

describe('DB Columns API Tests', () => {
    // Clean up before tests
    beforeAll(async () => {
        // Ensure the claims_dummy table exists and has the expected structure
        await pool.query(`
            CREATE TABLE IF NOT EXISTS claims_dummy (
                claim_merged_id SERIAL PRIMARY KEY,
                claim_id VARCHAR(255),
                patient_id INTEGER,
                date_of_birth DATE,
                gender VARCHAR(50),
                provider_id INTEGER,
                facility_id INTEGER,
                diagnosis_code VARCHAR(255),
                procedure_code VARCHAR(255),
                admission_date DATE,
                discharge_date DATE,
                revenue_code VARCHAR(255),
                modifiers VARCHAR(255),
                claim_type VARCHAR(255),
                total_charges DECIMAL(15,2),
                allowed_amount DECIMAL(15,2)
            );
        `);
    });

    // Clean up after tests
    afterAll(async () => {
        await pool.end();
    });

    describe('GET /api/db-columns', () => {
        test('should return all columns from claims_dummy table', async () => {
            const response = await request(app)
                .get('/api/db-columns');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBeTruthy();
            
            // Check for expected columns
            const expectedColumns = [
                'claim_merged_id',
                'claim_id',
                'patient_id',
                'date_of_birth',
                'gender',
                'provider_id',
                'facility_id',
                'diagnosis_code',
                'procedure_code',
                'admission_date',
                'discharge_date',
                'revenue_code',
                'modifiers',
                'claim_type',
                'total_charges',
                'allowed_amount'
            ];

            expectedColumns.forEach(column => {
                expect(response.body).toContain(column);
            });
        });

        test('should handle database errors gracefully', async () => {
            // Temporarily break the database connection
            const originalQuery = pool.query;
            pool.query = jest.fn().mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/db-columns');

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('details');

            // Restore the original query function
            pool.query = originalQuery;
        });
    });
}); 