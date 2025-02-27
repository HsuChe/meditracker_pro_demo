// Load environment variables from .env.production file
require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

// Create a connection pool
let poolConfig;

// Use the POSTGRES_URL from .env.production
if (process.env.POSTGRES_URL) {
  poolConfig = {
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  };
} else {
  // Use individual connection parameters
  poolConfig = {
    host: process.env.POSTGRES_HOST || process.env.PGHOST,
    port: process.env.POSTGRES_PORT || process.env.PGPORT || 5432,
    database: process.env.POSTGRES_DATABASE || process.env.PGDATABASE,
    user: process.env.POSTGRES_USER || process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  };
}

console.log('Connection config:', {
  ...poolConfig,
  password: poolConfig.password ? '****' : undefined,
  connectionString: poolConfig.connectionString ? poolConfig.connectionString.replace(/:[^:]*@/, ':****@') : undefined
});

const pool = new Pool(poolConfig);

async function testDatabaseCompatibility() {
  const client = await pool.connect();
  try {
    console.log('Connected to database successfully');
    console.log('Testing database compatibility...');
    
    // Test 1: Check PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('PostgreSQL Version:', versionResult.rows[0].version);
    
    // Test 2: Test JSONB functions
    try {
      const jsonbResult = await client.query(`
        SELECT jsonb_agg(to_jsonb(t)) as test_jsonb 
        FROM (SELECT 1 as id, 'test' as name) t
      `);
      console.log('JSONB functions test: PASSED');
    } catch (error) {
      console.error('JSONB functions test: FAILED');
      console.error(error.message);
    }
    
    // Test 3: Test date/time functions used in between_date operator
    try {
      const dateResult = await client.query(`
        SELECT 
          EXTRACT(YEAR FROM AGE(CURRENT_TIMESTAMP, '2020-01-01'::timestamp)) as years,
          EXTRACT(MONTH FROM AGE(CURRENT_TIMESTAMP, '2020-01-01'::timestamp)) as months,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - '2020-01-01'::timestamp))/(86400*7) as weeks,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - '2020-01-01'::timestamp))/86400 as days
      `);
      console.log('Date/time functions test: PASSED');
      console.log('Sample results:', dateResult.rows[0]);
    } catch (error) {
      console.error('Date/time functions test: FAILED');
      console.error(error.message);
    }
    
    // Test 4: Test the claims_dummy table structure
    try {
      const tableResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'claims_dummy'
      `);
      console.log('Table structure test: PASSED');
      console.log('Columns in claims_dummy table:');
      tableResult.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
      });
      
      // Check specifically for discharge_code column
      const dischargeCodeExists = tableResult.rows.some(row => 
        row.column_name === 'discharge_code'
      );
      console.log(`discharge_code column exists: ${dischargeCodeExists ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.error('Table structure test: FAILED');
      console.error(error.message);
    }
    
    // Test 5: Test a simple query with the between_date operator logic
    try {
      const testQuery = `
        WITH test_data AS (
          SELECT 
            '2023-01-01'::timestamp as test_date,
            'today' as reference
        )
        SELECT 
          test_date,
          CURRENT_TIMESTAMP as current_time,
          ABS(EXTRACT(MONTH FROM AGE(CURRENT_TIMESTAMP, test_date)) + 
              12 * EXTRACT(YEAR FROM AGE(CURRENT_TIMESTAMP, test_date))) as months_diff
        FROM test_data
        WHERE ABS(EXTRACT(MONTH FROM AGE(CURRENT_TIMESTAMP, test_date)) + 
                 12 * EXTRACT(YEAR FROM AGE(CURRENT_TIMESTAMP, test_date))) > 6
      `;
      const betweenDateResult = await client.query(testQuery);
      console.log('between_date operator logic test: PASSED');
      console.log('Sample results:', betweenDateResult.rows[0]);
    } catch (error) {
      console.error('between_date operator logic test: FAILED');
      console.error(error.message);
    }
    
  } catch (error) {
    console.error('Error connecting to database:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the tests
console.log('Testing with production database configuration');
testDatabaseCompatibility(); 