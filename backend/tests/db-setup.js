const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const setupTestDb = async () => {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    try {
        // Drop existing tables if they exist
        await pool.query(`
            DROP TABLE IF EXISTS claims_dummy CASCADE;
            DROP TABLE IF EXISTS saved_filters CASCADE;
            DROP TABLE IF EXISTS filter_results_history CASCADE;
        `);

        // Read and execute schema
        const schemaSQL = await fs.readFile(
            path.join(__dirname, '../db/schema.sql'), 
            'utf8'
        );
        await pool.query(schemaSQL);

        // Insert test data
        const testData = [
            {
                claim_merged_id: 1,
                claim_id: 'TEST001',
                patient_id: 1001,
                date_of_birth: '1990-01-01',
                gender: 'M',
                provider_id: 2001,
                facility_id: 3001,
                diagnosis_code: 'D001',
                procedure_code: 'P001',
                admission_date: '2023-01-01',
                discharge_date: '2023-01-05',
                revenue_code: 'R001',
                modifiers: null,
                claim_type: 'inpatient',
                total_charges: 1000.00,
                allowed_amount: 800.00
            },
            // Add more test records
            {
                claim_merged_id: 2,
                claim_id: 'TEST002',
                patient_id: 1002,
                date_of_birth: '1985-05-15',
                gender: 'F',
                provider_id: 2002,
                facility_id: 3002,
                diagnosis_code: 'D002',
                procedure_code: 'P002',
                admission_date: '2023-02-01',
                discharge_date: '2023-02-03',
                revenue_code: 'R002',
                modifiers: null,
                claim_type: 'outpatient',
                total_charges: 2000.00,
                allowed_amount: 1500.00
            }
        ];

        for (const record of testData) {
            await pool.query(
                `INSERT INTO claims_dummy 
                 (${Object.keys(record).join(', ')}) 
                 VALUES (${Object.keys(record).map((_, i) => `$${i + 1}`).join(', ')})`,
                Object.values(record)
            );
        }

        return pool;
    } catch (error) {
        console.error('Error setting up test database:', error);
        throw error;
    }
};

module.exports = { setupTestDb }; 