const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

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

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_claims_claim_id ON claims_dummy(claim_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_ingestion_id ON claims_dummy(ingestion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_claims_claim_line ON claims_dummy(claim_id, line_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ingested_data_date ON ingested_data(ingestion_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_claims_ingestion ON deleted_claims_log(ingestion_id)`
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const migration of migrations) {
      try {
        await client.query(migration);
        console.log('Successfully executed:', migration.split('\n')[0]);
      } catch (err) {
        console.error('Error executing migration:', err);
        throw err;
      }
    }

    await client.query('COMMIT');
    console.log('All migrations completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations(); 