-- Recreate core tables with proper relationships
-- Drop tables in correct order
DROP TABLE IF EXISTS lut_entries CASCADE;
DROP TABLE IF EXISTS claims_dummy CASCADE;
DROP TABLE IF EXISTS saved_mappings CASCADE;
DROP TABLE IF EXISTS ingested_data CASCADE;

-- Create sequences first
CREATE SEQUENCE IF NOT EXISTS ingested_data_ingested_data_id_seq;
CREATE SEQUENCE IF NOT EXISTS saved_mappings_id_seq;
CREATE SEQUENCE IF NOT EXISTS claims_dummy_id_seq;
CREATE SEQUENCE IF NOT EXISTS claims_dummy_id_seq1;
CREATE SEQUENCE IF NOT EXISTS lut_entries_entry_id_seq;

-- Create ingested_data table
CREATE TABLE ingested_data (
    ingested_data_id INTEGER DEFAULT nextval('ingested_data_ingested_data_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    ingestion_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    activity_status character varying(20) DEFAULT 'active'::character varying,
    record_count integer,
    file_size_bytes bigint,
    ingestion_duration_ms integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    claim_ids text[],
    processing_status character varying(20) DEFAULT 'completed'::character varying,
    mapping_id integer,
    batch_number integer,
    total_batches integer,
    parent_ingestion_id integer,
    PRIMARY KEY (ingested_data_id)
);

-- Create saved_mappings table
CREATE TABLE saved_mappings (
    id INTEGER DEFAULT nextval('saved_mappings_id_seq'::regclass) NOT NULL,
    name character varying(255) NOT NULL,
    mappings jsonb NOT NULL,
    is_in_use boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp without time zone,
    PRIMARY KEY (id)
);

-- Create claims_dummy table with all fields from dummy data generator
CREATE TABLE claims_dummy (
    id INTEGER DEFAULT nextval('claims_dummy_id_seq1'::regclass) NOT NULL,
    claim_merged_id INTEGER DEFAULT nextval('claims_dummy_id_seq'::regclass) NOT NULL,
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
    ingestion_id INTEGER,
    
    -- Additional fields from dummy data generator
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
    
    -- Additional diagnosis codes
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
    
    -- Service and billing information
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
    
    -- Condition and occurrence codes
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
    discharge_code VARCHAR(10),
    
    PRIMARY KEY (id)
);

-- Create lut_entries table
CREATE TABLE lut_entries (
    entry_id INTEGER DEFAULT nextval('lut_entries_entry_id_seq'::regclass) NOT NULL,
    ingestion_id INTEGER,
    value TEXT NOT NULL,
    PRIMARY KEY (entry_id)
);

-- Add foreign key constraints
ALTER TABLE ingested_data 
    ADD CONSTRAINT ingested_data_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES saved_mappings(id),
    ADD CONSTRAINT ingested_data_parent_ingestion_id_fkey FOREIGN KEY (parent_ingestion_id) REFERENCES ingested_data(ingested_data_id);

ALTER TABLE claims_dummy
    ADD CONSTRAINT claims_dummy_ingestion_id_fkey FOREIGN KEY (ingestion_id) REFERENCES ingested_data(ingested_data_id);

ALTER TABLE lut_entries
    ADD CONSTRAINT lut_entries_ingestion_id_fkey FOREIGN KEY (ingestion_id) REFERENCES ingested_data(ingested_data_id);

-- Add indexes for performance optimization

-- ingested_data indexes
CREATE INDEX idx_ingested_data_type ON ingested_data(type);
CREATE INDEX idx_ingested_data_created_at ON ingested_data(created_at);
CREATE INDEX idx_ingested_data_mapping_id ON ingested_data(mapping_id);
CREATE INDEX idx_ingested_data_parent_id ON ingested_data(parent_ingestion_id);
CREATE INDEX idx_ingested_data_processing_status ON ingested_data(processing_status);

-- saved_mappings indexes
CREATE INDEX idx_saved_mappings_name ON saved_mappings(name);
CREATE INDEX idx_saved_mappings_is_in_use ON saved_mappings(is_in_use);
CREATE INDEX idx_saved_mappings_last_used ON saved_mappings(last_used);

-- claims_dummy indexes
CREATE INDEX idx_claims_dummy_claim_id ON claims_dummy(claim_id);
CREATE INDEX idx_claims_dummy_patient_id ON claims_dummy(patient_id);
CREATE INDEX idx_claims_dummy_ingestion_id ON claims_dummy(ingestion_id);
CREATE INDEX idx_claims_dummy_admission_date ON claims_dummy(admission_date);
CREATE INDEX idx_claims_dummy_discharge_date ON claims_dummy(discharge_date);
CREATE INDEX idx_claims_dummy_diagnosis_code ON claims_dummy(diagnosis_code);
CREATE INDEX idx_claims_dummy_diagnosis_code_lower ON claims_dummy(LOWER(diagnosis_code));
CREATE INDEX idx_claims_dummy_procedure_code ON claims_dummy(procedure_code);
CREATE INDEX idx_claims_dummy_patient_name ON claims_dummy(patient_name_last, patient_name_first);
CREATE INDEX idx_claims_dummy_patient_policy ON claims_dummy(patient_policy_number);
CREATE INDEX idx_claims_dummy_patient_state ON claims_dummy(patient_address_state);
CREATE INDEX idx_claims_dummy_date_of_service ON claims_dummy(date_of_service);
CREATE INDEX idx_claims_dummy_provider_npi ON claims_dummy(rendering_provider_npi);
CREATE INDEX idx_claims_dummy_type_of_bill ON claims_dummy(type_of_bill);
CREATE INDEX idx_claims_dummy_diagnosis_codes ON claims_dummy(diagnosis_code_2, diagnosis_code_3, diagnosis_code_4);
CREATE INDEX idx_claims_dummy_discharge_code ON claims_dummy(discharge_code);

-- lut_entries indexes
CREATE INDEX idx_lut_entries_ingestion_id ON lut_entries(ingestion_id);
CREATE INDEX idx_lut_entries_value ON lut_entries(value);
CREATE INDEX idx_lut_entries_value_lower ON lut_entries(LOWER(value));

-- Add column comments for documentation
COMMENT ON COLUMN claims_dummy.patient_address_state IS 'Two-letter state code';
COMMENT ON COLUMN claims_dummy.type_of_bill IS 'Three-digit code between 110 and 859';
COMMENT ON COLUMN claims_dummy.type_of_admission_visit IS 'Single digit code (1-9)';
COMMENT ON COLUMN claims_dummy.source_of_admission IS 'Single character code (1-9 or A-F)';
COMMENT ON COLUMN claims_dummy.emg_indicator IS 'Emergency indicator (1 or NULL)';
COMMENT ON COLUMN claims_dummy.accident_type IS 'Type of accident (auto/other/na)';
COMMENT ON COLUMN claims_dummy.condition_code_1 IS 'Condition code between 1 and 99';
COMMENT ON COLUMN claims_dummy.occurrence_code_1 IS 'Occurrence code between 1 and 99'; 