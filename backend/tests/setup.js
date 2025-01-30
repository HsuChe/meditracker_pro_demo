require('dotenv').config({ path: '.env.test' });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD || " ", // Default to space if not set
    port: process.env.DB_PORT
});

// Custom console reporter
const customReporter = {
    success(testName) {
        console.log('\x1b[32m%s\x1b[0m', `✓ ${testName}`); // Green text
    },
    failure(testName, error) {
        console.log('\x1b[31m%s\x1b[0m', `✗ ${testName}`); // Red text
        console.log('  Error:', error.message);
    }
};

beforeAll(async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('\x1b[34m%s\x1b[0m', '🔌 Database connected successfully'); // Blue text
    } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
});

afterAll(async () => {
    await pool.end();
});

module.exports = { pool, customReporter }; 