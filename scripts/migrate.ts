import 'dotenv/config';
import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import path from 'path';

// Load environment-specific variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

async function migrate() {
  try {
    console.log(`Running migrations for ${process.env.NODE_ENV} environment...`);

    // Drop existing tables in correct order
    console.log('Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS filter_results CASCADE;`;
    await sql`DROP TABLE IF EXISTS filters CASCADE;`;
    await sql`DROP TABLE IF EXISTS filter_groups CASCADE;`;
    await sql`DROP TABLE IF EXISTS ingested_data CASCADE;`;
    await sql`DROP TABLE IF EXISTS lut_entries CASCADE;`;
    await sql`DROP TABLE IF EXISTS saved_mappings CASCADE;`;
    await sql`DROP TABLE IF EXISTS claims_dummy CASCADE;`;

    // Create claims_dummy table
    await sql`
      CREATE TABLE claims_dummy (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(255) NOT NULL,
        patient_id INTEGER,
        date_of_birth DATE,
        gender VARCHAR(50),
        provider_id INTEGER,
        facility_id INTEGER,
        diagnosis_code VARCHAR(50),
        procedure_code VARCHAR(50),
        admission_date DATE,
        discharge_date DATE,
        revenue_code VARCHAR(50),
        modifiers VARCHAR(50),
        claim_type VARCHAR(50),
        total_charges VARCHAR(50),
        allowed_amount VARCHAR(50),
        claim_merged_id INTEGER,
        line_id VARCHAR(50),
        ingestion_id INTEGER,
        place_of_service INTEGER,
        patient_policy_number VARCHAR(255),
        patient_name_first VARCHAR(255),
        patient_name_last VARCHAR(255),
        patient_address_state VARCHAR(2),
        patient_account_number VARCHAR(255),
        employment_status BOOLEAN,
        insurance_plan VARCHAR(255),
        secondary_insurance BOOLEAN,
        accept_assignment BOOLEAN,
        accident_type VARCHAR(50),
        referring_provider_npi VARCHAR(255),
        rendering_provider_npi VARCHAR(255),
        tax_id VARCHAR(255),
        service_facilities_state VARCHAR(2),
        service_facilities_npi VARCHAR(255),
        billing_provider_phone VARCHAR(255),
        billing_provider_npi VARCHAR(255),
        outside_lab BOOLEAN,
        lab_service_charge VARCHAR(50),
        diagnosis_code_2 VARCHAR(50),
        diagnosis_code_3 VARCHAR(50),
        diagnosis_code_4 VARCHAR(50),
        diagnosis_code_5 VARCHAR(50),
        diagnosis_code_6 VARCHAR(50),
        diagnosis_code_7 VARCHAR(50),
        diagnosis_code_8 VARCHAR(50),
        diagnosis_code_9 VARCHAR(50),
        diagnosis_code_10 VARCHAR(50),
        diagnosis_code_11 VARCHAR(50),
        diagnosis_code_12 VARCHAR(50),
        diagnosis_pointers VARCHAR(50),
        prior_auth_number VARCHAR(255),
        date_of_service TIMESTAMP,
        emg_indicator VARCHAR(50),
        units_days VARCHAR(50),
        line_charges VARCHAR(50),
        amount_paid VARCHAR(50),
        balance_due VARCHAR(50),
        type_of_bill VARCHAR(50),
        type_of_admission_visit VARCHAR(50),
        source_of_admission VARCHAR(50),
        condition_code_1 VARCHAR(50),
        condition_code_2 VARCHAR(50),
        condition_code_3 VARCHAR(50),
        condition_code_4 VARCHAR(50),
        condition_code_5 VARCHAR(50),
        condition_code_6 VARCHAR(50),
        condition_code_7 VARCHAR(50),
        condition_code_8 VARCHAR(50),
        condition_code_9 VARCHAR(50),
        condition_code_10 VARCHAR(50),
        occurrence_code_1 VARCHAR(50),
        occurrence_code_2 VARCHAR(50),
        occurrence_code_3 VARCHAR(50),
        occurrence_code_4 VARCHAR(50)
      );
    `;
    console.log('Created claims_dummy table');

    // Create saved_mappings table with unique constraint
    await sql`
      CREATE TABLE saved_mappings (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mappings JSONB NOT NULL,
        is_in_use BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT saved_mappings_name_key UNIQUE (name)
      );
    `;
    console.log('Created saved_mappings table');

    // Create filter_groups table with unique constraint
    await sql`
      CREATE TABLE filter_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT filter_groups_name_key UNIQUE (name)
      );
    `;
    console.log('Created filter_groups table');

    // Create filters table
    await sql`
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
    `;
    console.log('Created filters table');

    // Create ingested_data table
    await sql`
      CREATE TABLE ingested_data (
        ingested_data_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        record_count INTEGER NOT NULL,
        file_size_bytes BIGINT NOT NULL,
        mapping_id INTEGER REFERENCES saved_mappings(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Created ingested_data table');

    // Create lut_entries table with unique constraint
    await sql`
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
    `;
    console.log('Created lut_entries table');

    // Create filter_results table
    await sql`
      CREATE TABLE filter_results (
        id SERIAL PRIMARY KEY,
        filter_id INTEGER REFERENCES filters(id),
        ingested_data_id INTEGER REFERENCES ingested_data(ingested_data_id),
        result_count INTEGER NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Created filter_results table');

    // Create indexes
    await sql`CREATE INDEX idx_claims_claim_id ON claims_dummy(claim_id);`;
    await sql`CREATE INDEX idx_claims_patient_id ON claims_dummy(patient_id);`;
    await sql`CREATE INDEX idx_claims_diagnosis ON claims_dummy(diagnosis_code);`;
    await sql`CREATE INDEX idx_ingestion_mapping ON ingested_data(mapping_id);`;
    await sql`CREATE INDEX idx_filter_group ON filters(group_id);`;
    console.log('Created indexes');

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();