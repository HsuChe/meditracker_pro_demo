const pool = require('./db.config');

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        // Create claims_dummy table if it doesn't exist
        await client.query(`
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

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { initializeDatabase }; 