import 'dotenv/config';
import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment-specific variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

// Common SSL configuration for Neon
const sslConfig = {
  sslmode: 'require',
  ssl: true
};

async function createDatabase() {
  // Connect to default neondb database first
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'ep-frosty-bush-a5vlnqz9-pooler.us-east-2.aws.neon.tech',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'neondb_owner',
    password: process.env.POSTGRES_PASSWORD || 'npg_UlA3uXVIYQy2',
    database: 'neondb', // Connect to default neondb database first
    ...sslConfig
  });

  try {
    await client.connect();
    console.log('Connected to default neondb database');

    // Create claims_db_dummy if it doesn't exist
    try {
      await client.query('CREATE DATABASE claims_db_dummy');
      console.log('Created claims_db_dummy database');
    } catch (err: any) {
      if (err.code === '42P04') {
        console.log('Database claims_db_dummy already exists');
      } else {
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

async function migrate() {
  try {
    // First create the database
    await createDatabase();

    // Now connect to claims_db_dummy using the unpooled host for DDL operations
    const client = new Client({
      host: process.env.PGHOST_UNPOOLED || 'ep-frosty-bush-a5vlnqz9.us-east-2.aws.neon.tech',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'neondb_owner',
      password: process.env.POSTGRES_PASSWORD || 'npg_UlA3uXVIYQy2',
      database: 'claims_db_dummy',
      ...sslConfig
    });

    await client.connect();
    console.log('Connected to claims_db_dummy database');

    console.log(`Running migrations for ${process.env.NODE_ENV} environment...`);

    // Drop existing tables in correct order
    console.log('Dropping existing tables...');
    await client.query('DROP TABLE IF EXISTS filter_results CASCADE;');
    await client.query('DROP TABLE IF EXISTS filters CASCADE;');
    await client.query('DROP TABLE IF EXISTS filter_groups CASCADE;');
    await client.query('DROP TABLE IF EXISTS ingested_data CASCADE;');
    await client.query('DROP TABLE IF EXISTS lut_entries CASCADE;');
    await client.query('DROP TABLE IF EXISTS saved_mappings CASCADE;');
    await client.query('DROP TABLE IF EXISTS claims_dummy CASCADE;');

    // Create claims_dummy table with all fields and constraints
    await client.query(`
      CREATE TABLE claims_dummy (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(8) NOT NULL,
        line_id VARCHAR(50),
        patient_id INTEGER,
        date_of_birth DATE,
        gender VARCHAR(10),
        provider_id INTEGER,
        facility_id INTEGER,
        diagnosis_code VARCHAR(10),
        procedure_code VARCHAR(10),
        admission_date DATE,
        discharge_date DATE,
        revenue_code VARCHAR(10),
        modifiers VARCHAR(10),
        claim_type VARCHAR(20),
        total_charges DECIMAL(10,2),
        allowed_amount DECIMAL(10,2),
        claim_merged_id INTEGER,
        ingestion_id INTEGER,
        place_of_service INTEGER CHECK (place_of_service BETWEEN 1 AND 99),
        patient_policy_number VARCHAR(50),
        patient_name_first VARCHAR(100),
        patient_name_last VARCHAR(100),
        patient_address_state CHAR(2),
        patient_account_number VARCHAR(50),
        employment_status BOOLEAN,
        insurance_plan VARCHAR(100),
        secondary_insurance BOOLEAN,
        accept_assignment BOOLEAN,
        accident_type VARCHAR(10) CHECK (accident_type IN ('auto', 'other', 'na')),
        referring_provider_npi VARCHAR(10),
        rendering_provider_npi VARCHAR(10),
        tax_id VARCHAR(20),
        service_facilities_state CHAR(2),
        service_facilities_npi VARCHAR(10),
        billing_provider_phone VARCHAR(20),
        billing_provider_npi VARCHAR(10),
        outside_lab BOOLEAN,
        lab_service_charge DECIMAL(10,2),
        diagnosis_code_2 VARCHAR(10),
        diagnosis_code_3 VARCHAR(10),
        diagnosis_code_4 VARCHAR(10),
        diagnosis_code_5 VARCHAR(10),
        diagnosis_code_6 VARCHAR(10),
        diagnosis_code_7 VARCHAR(10),
        diagnosis_code_8 VARCHAR(10),
        diagnosis_code_9 VARCHAR(10),
        diagnosis_code_10 VARCHAR(10),
        diagnosis_code_11 VARCHAR(10),
        diagnosis_code_12 VARCHAR(10),
        diagnosis_pointers VARCHAR(50),
        prior_auth_number BOOLEAN,
        date_of_service TIMESTAMP,
        emg_indicator INTEGER CHECK (emg_indicator = 1 OR emg_indicator IS NULL),
        units_days INTEGER,
        line_charges DECIMAL(10,2),
        amount_paid DECIMAL(10,2),
        balance_due DECIMAL(10,2),
        type_of_bill VARCHAR(3) CHECK (type_of_bill >= '110' AND type_of_bill <= '859'),
        type_of_admission_visit INTEGER CHECK (type_of_admission_visit BETWEEN 1 AND 9),
        source_of_admission VARCHAR(1) CHECK (source_of_admission ~ '^[1-9A-F]$'),
        condition_code_1 INTEGER CHECK (condition_code_1 BETWEEN 1 AND 99),
        condition_code_2 INTEGER CHECK (condition_code_2 BETWEEN 1 AND 99),
        condition_code_3 INTEGER CHECK (condition_code_3 BETWEEN 1 AND 99),
        condition_code_4 INTEGER CHECK (condition_code_4 BETWEEN 1 AND 99),
        condition_code_5 INTEGER CHECK (condition_code_5 BETWEEN 1 AND 99),
        condition_code_6 INTEGER CHECK (condition_code_6 BETWEEN 1 AND 99),
        condition_code_7 INTEGER CHECK (condition_code_7 BETWEEN 1 AND 99),
        condition_code_8 INTEGER CHECK (condition_code_8 BETWEEN 1 AND 99),
        condition_code_9 INTEGER CHECK (condition_code_9 BETWEEN 1 AND 99),
        condition_code_10 INTEGER CHECK (condition_code_10 BETWEEN 1 AND 99),
        occurrence_code_1 INTEGER CHECK (occurrence_code_1 BETWEEN 1 AND 99),
        occurrence_code_2 INTEGER CHECK (occurrence_code_2 BETWEEN 1 AND 99),
        occurrence_code_3 INTEGER CHECK (occurrence_code_3 BETWEEN 1 AND 99),
        occurrence_code_4 INTEGER CHECK (occurrence_code_4 BETWEEN 1 AND 99)
      );
    `);
    console.log('Created claims_dummy table');

    // Add indexes for claims_dummy table
    await client.query('CREATE INDEX idx_claims_claim_id ON claims_dummy(claim_id);');
    await client.query('CREATE INDEX idx_claims_patient_id ON claims_dummy(patient_id);');
    await client.query('CREATE INDEX idx_claims_diagnosis ON claims_dummy(diagnosis_code);');
    await client.query('CREATE INDEX idx_claims_patient_policy ON claims_dummy(patient_policy_number);');
    await client.query('CREATE INDEX idx_claims_patient_name ON claims_dummy(patient_name_last, patient_name_first);');
    await client.query('CREATE INDEX idx_claims_patient_state ON claims_dummy(patient_address_state);');
    await client.query('CREATE INDEX idx_claims_date_of_service ON claims_dummy(date_of_service);');
    await client.query('CREATE INDEX idx_claims_provider_npi ON claims_dummy(rendering_provider_npi);');
    await client.query('CREATE INDEX idx_claims_type_of_bill ON claims_dummy(type_of_bill);');
    await client.query('CREATE INDEX idx_claims_diagnosis_codes ON claims_dummy(diagnosis_code_2, diagnosis_code_3, diagnosis_code_4);');
    console.log('Created indexes for claims_dummy table');

    // Add comments for documentation
    await client.query("COMMENT ON COLUMN claims_dummy.patient_address_state IS 'Two-letter state code';");
    await client.query("COMMENT ON COLUMN claims_dummy.type_of_bill IS 'Three-digit code between 110 and 859';");
    await client.query("COMMENT ON COLUMN claims_dummy.type_of_admission_visit IS 'Single digit code (1-9)';");
    await client.query("COMMENT ON COLUMN claims_dummy.source_of_admission IS 'Single character code (1-9 or A-F)';");
    await client.query("COMMENT ON COLUMN claims_dummy.emg_indicator IS 'Emergency indicator (1 or NULL)';");
    await client.query("COMMENT ON COLUMN claims_dummy.accident_type IS 'Type of accident (auto/other/na)';");
    console.log('Added column comments');

    // Create saved_mappings table with unique constraint
    await client.query(`
      CREATE TABLE saved_mappings (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mappings JSONB NOT NULL,
        is_in_use BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT saved_mappings_name_key UNIQUE (name)
      );
    `);
    console.log('Created saved_mappings table');

    // Create filter_groups table with unique constraint
    await client.query(`
      CREATE TABLE filter_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT filter_groups_name_key UNIQUE (name)
      );
    `);
    console.log('Created filter_groups table');

    // Create filters table
    await client.query(`
      CREATE TABLE filters (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES filter_groups(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filter_type VARCHAR(50) NOT NULL,
        conditions JSONB NOT NULL,
        execution_order INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created filters table');

    // Create ingested_data table
    await client.query(`
      CREATE TABLE ingested_data (
        ingested_data_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        record_count INTEGER NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        mapping_id INTEGER REFERENCES saved_mappings(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created ingested_data table');

    // Create lut_entries table with unique constraint
    await client.query(`
      CREATE TABLE lut_entries (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        entry_key VARCHAR(255) NOT NULL,
        entry_value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT lut_entries_table_key_key UNIQUE (table_name, entry_key)
      );
    `);
    console.log('Created lut_entries table');

    // Create filter_results table
    await client.query(`
      CREATE TABLE filter_results (
        id SERIAL PRIMARY KEY,
        filter_id INTEGER REFERENCES filters(id),
        ingested_data_id INTEGER REFERENCES ingested_data(ingested_data_id),
        result_count INTEGER NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created filter_results table');

    // Add foreign key constraints
    await client.query('ALTER TABLE claims_dummy ADD CONSTRAINT claims_dummy_ingestion_id_fkey FOREIGN KEY (ingestion_id) REFERENCES ingested_data(ingested_data_id);');
    console.log('Added foreign key constraints');

    await client.end();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();