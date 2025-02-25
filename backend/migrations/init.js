const { Pool } = require('pg');
require('dotenv').config();

// Log connection details (excluding sensitive info)
console.log('Migration Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  hasDBUrl: !!process.env.DATABASE_URL,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  },
  connectionTimeoutMillis: 10000, // 10 second timeout
});

// Add pool error handler
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection before running migrations
async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('Testing database connection...');
    const result = await client.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (err) {
    console.error('Database connection test failed:', {
      error: err.message,
      code: err.code,
      detail: err.detail
    });
    throw err;
  } finally {
    client.release();
  }
}

const migrations = [
  // Create claims_dummy table
  `CREATE TABLE IF NOT EXISTS claims_dummy (
    id SERIAL PRIMARY KEY,
    claim_id VARCHAR(50),
    line_id VARCHAR(50),
    patient_id VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(10),
    provider_id VARCHAR(50),
    facility_id VARCHAR(50),
    diagnosis_code VARCHAR(50),
    procedure_code VARCHAR(50),
    admission_date DATE,
    discharge_date DATE,
    revenue_code VARCHAR(50),
    modifiers VARCHAR(50),
    claim_type VARCHAR(50),
    total_charges DECIMAL,
    allowed_amount DECIMAL,
    ingestion_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_claim_line UNIQUE (claim_id, line_id)
  )`,

  // Create ingested_data table
  `CREATE TABLE IF NOT EXISTS ingested_data (
    ingested_data_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    mapping JSONB,
    record_count INTEGER,
    file_size_bytes BIGINT,
    ingestion_duration_ms INTEGER,
    activity_status VARCHAR(20) DEFAULT 'active',
    processing_status VARCHAR(20) DEFAULT 'completed',
    ingestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    batch_number INTEGER,
    total_batches INTEGER,
    parent_ingestion_id INTEGER REFERENCES ingested_data(ingested_data_id),
    CONSTRAINT valid_activity_status CHECK (activity_status IN ('active', 'deleted')),
    CONSTRAINT valid_processing_status CHECK (processing_status IN ('processing', 'completed', 'failed'))
  )`,

  // Create deleted_claims_log table
  `CREATE TABLE IF NOT EXISTS deleted_claims_log (
    log_id SERIAL PRIMARY KEY,
    claim_dummy_id INTEGER NOT NULL,
    claim_id VARCHAR(50),
    line_id VARCHAR(50),
    ingestion_id INTEGER,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_by VARCHAR(50),
    deletion_reason VARCHAR(255),
    record_data JSONB
  )`,

  // Create basic indexes first
  `CREATE INDEX IF NOT EXISTS idx_claims_claim_id ON claims_dummy(claim_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_ingestion_id ON claims_dummy(ingestion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_claim_line ON claims_dummy(claim_id, line_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_claims_ingestion ON deleted_claims_log(ingestion_id)`,

  // Create index on ingestion_date after table is created
  `DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ingested_data' AND column_name = 'ingestion_date'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_ingested_data_date ON ingested_data(ingestion_date DESC);
    END IF;
  END $$;`
];

async function runMigrations() {
  console.log('Starting migrations...');
  let client;
  
  try {
    // Test connection first
    await testConnection();
    
    client = await pool.connect();
    console.log('Connected to database, beginning transaction...');
    
    await client.query('BEGIN');

    for (const migration of migrations) {
      try {
        await client.query(migration);
        console.log('Successfully executed:', migration.split('\n')[0]);
      } catch (err) {
        console.error('Error executing migration:', {
          error: err.message,
          code: err.code,
          detail: err.detail,
          hint: err.hint,
          query: migration.split('\n')[0]
        });
        throw err;
      }
    }

    await client.query('COMMIT');
    console.log('All migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', {
      error: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    if (client) {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migrations with better error handling
runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 