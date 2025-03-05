// Run the discharge_code migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'production'}`)
});

// Configure SSL for production (Neon DB requires SSL)
const sslConfig = {
  rejectUnauthorized: true,
  require: true
};

// Use DATABASE_URL if available
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    }
  : {
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      ssl: sslConfig
    };

const pool = new Pool(poolConfig);

async function runMigration() {
  console.log('Starting discharge_code migration...');
  const client = await pool.connect();
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../backend/migrations/add_discharge_code.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Run the migration
    await client.query(migrationSQL);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 