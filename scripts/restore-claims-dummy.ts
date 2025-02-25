import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({
  path: path.resolve(process.cwd(), '.env.test')
});

const sslConfig = {
  sslmode: 'require',
  ssl: true
};

async function restoreClaimsDummy() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE
  });

  try {
    await client.connect();
    console.log(`Connected to ${process.env.POSTGRES_DATABASE} database at ${process.env.POSTGRES_HOST}`);

    // Drop existing table if it exists
    await client.query('DROP TABLE IF EXISTS claims_dummy CASCADE;');
    console.log('Dropped existing claims_dummy table if it existed');

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
        occurrence_code_4 INTEGER CHECK (occurrence_code_4 BETWEEN 1 AND 99),
        discharge_code VARCHAR(10)
      );
    `);
    console.log('Created claims_dummy table with all columns and constraints');

    // Add indexes
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
    await client.query('CREATE INDEX idx_claims_discharge_code ON claims_dummy(discharge_code);');
    console.log('Created all indexes');

    // Add foreign key constraint for ingestion_id if ingested_data table exists
    try {
      await client.query(`
        ALTER TABLE claims_dummy 
        ADD CONSTRAINT claims_dummy_ingestion_id_fkey 
        FOREIGN KEY (ingestion_id) 
        REFERENCES ingested_data(ingested_data_id);
      `);
      console.log('Added foreign key constraint for ingestion_id');
    } catch (error) {
      console.warn('Could not add foreign key constraint - ingested_data table might not exist');
    }

    // Add column comments for documentation
    await client.query("COMMENT ON COLUMN claims_dummy.patient_address_state IS 'Two-letter state code';");
    await client.query("COMMENT ON COLUMN claims_dummy.type_of_bill IS 'Three-digit code between 110 and 859';");
    await client.query("COMMENT ON COLUMN claims_dummy.type_of_admission_visit IS 'Single digit code (1-9)';");
    await client.query("COMMENT ON COLUMN claims_dummy.source_of_admission IS 'Single character code (1-9 or A-F)';");
    await client.query("COMMENT ON COLUMN claims_dummy.emg_indicator IS 'Emergency indicator (1 or NULL)';");
    await client.query("COMMENT ON COLUMN claims_dummy.accident_type IS 'Type of accident (auto/other/na)';");
    console.log('Added column comments');

    console.log('Successfully restored claims_dummy table with complete schema');

  } catch (error) {
    console.error('Error restoring claims_dummy table:', error);
    throw error;
  } finally {
    await client.end();
  }
}

restoreClaimsDummy().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 