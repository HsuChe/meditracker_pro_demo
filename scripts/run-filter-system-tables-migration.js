// Load environment variables from .env.production file
require('dotenv').config({ path: '.env.production' });
const fs = require('fs');
const path = require('path');
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

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database successfully');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'backend', 'migrations', 'filter_system_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running filter system tables migration...');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Check if the saved_filters table already exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'saved_filters'
      );
    `;
    
    const tableExists = await client.query(checkTableQuery);
    
    if (tableExists.rows[0].exists) {
      console.log('The saved_filters table already exists. Checking structure...');
      
      // Check if the table has all required columns
      const checkColumnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'saved_filters';
      `;
      
      const columns = await client.query(checkColumnsQuery);
      const columnNames = columns.rows.map(row => row.column_name);
      
      console.log('Existing columns:', columnNames);
      
      // Check for missing columns
      const requiredColumns = [
        'filter_id', 'name', 'description', 'conditions', 
        'claims_ids', 'created_by', 'created_at', 'last_updated'
      ];
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('Missing columns:', missingColumns);
        console.log('Adding missing columns...');
        
        // Add missing columns
        for (const column of missingColumns) {
          let dataType;
          switch (column) {
            case 'filter_id':
              dataType = 'SERIAL PRIMARY KEY';
              break;
            case 'name':
              dataType = 'VARCHAR(255) NOT NULL';
              break;
            case 'description':
              dataType = 'TEXT';
              break;
            case 'conditions':
            case 'claims_ids':
              dataType = 'JSONB';
              break;
            case 'created_by':
              dataType = 'VARCHAR(100)';
              break;
            case 'created_at':
            case 'last_updated':
              dataType = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
              break;
            default:
              dataType = 'TEXT';
          }
          
          try {
            await client.query(`ALTER TABLE saved_filters ADD COLUMN IF NOT EXISTS ${column} ${dataType};`);
            console.log(`Added column ${column}`);
          } catch (err) {
            console.error(`Error adding column ${column}:`, err.message);
          }
        }
      } else {
        console.log('All required columns exist.');
      }
    } else {
      console.log('The saved_filters table does not exist. Creating from migration...');
      
      // Execute the migration SQL
      await client.query(migrationSQL);
      console.log('Migration executed successfully');
    }
    
    // Check if filter_results_history table exists
    const checkHistoryTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'filter_results_history'
      );
    `;
    
    const historyTableExists = await client.query(checkHistoryTableQuery);
    
    if (!historyTableExists.rows[0].exists) {
      console.log('Creating filter_results_history table...');
      
      const createHistoryTableSQL = `
        CREATE TABLE filter_results_history (
          history_id SERIAL PRIMARY KEY,
          filter_id INTEGER REFERENCES saved_filters(filter_id),
          run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INTEGER,
          results_count INTEGER,
          conditions_snapshot JSONB
        );
      `;
      
      await client.query(createHistoryTableSQL);
      console.log('Created filter_results_history table');
    } else {
      console.log('filter_results_history table already exists');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running migration:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
console.log('Running filter system tables migration on production database');
runMigration(); 