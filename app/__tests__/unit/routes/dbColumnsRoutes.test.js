const request = require('supertest');
const express = require('express');
const router = require('../../../../backend/routes/dbColumnsRoutes');
const pool = require('../../../../backend/config/db.config');

// Mock the database pool
jest.mock('../../../../backend/config/db.config');

const app = express();
app.use('/', router);

describe('Database Columns Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /', () => {
        it('should get all column names from claims_dummy table', async () => {
            const mockColumns = [
                { column_name: 'patient_name' },
                { column_name: 'diagnosis_code' },
                { column_name: 'amount' }
            ];

            pool.query.mockResolvedValue({
                rows: mockColumns
            });

            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockColumns.map(col => col.column_name));
            // Verify the SQL query contains the essential parts
            const queryCall = pool.query.mock.calls[0][0];
            expect(queryCall).toContain('SELECT column_name');
            expect(queryCall).toContain("WHERE table_name = 'claims_dummy'");
            expect(queryCall).toContain("AND column_name NOT IN ('id', 'ingestion_id', 'created_at', 'updated_at')");
        });

        it('should handle database errors', async () => {
            const mockError = new Error('Database connection failed');
            pool.query.mockRejectedValue(mockError);

            const response = await request(app).get('/');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to fetch database columns' });
        });

        it('should exclude specified system columns', async () => {
            const mockColumns = [
                { column_name: 'patient_name' },
                { column_name: 'diagnosis_code' }
            ];

            pool.query.mockResolvedValue({
                rows: mockColumns
            });

            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(['patient_name', 'diagnosis_code']);
            // The system columns should be excluded by the SQL query itself
            const queryCall = pool.query.mock.calls[0][0];
            expect(queryCall).toContain("AND column_name NOT IN ('id', 'ingestion_id', 'created_at', 'updated_at')");
        });
    });
}); 