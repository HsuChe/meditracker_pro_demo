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

-- Create claims_dummy table
CREATE TABLE claims_dummy (
    claim_id character varying(8) NOT NULL,
    patient_id integer,
    date_of_birth date,
    gender character varying(10),
    provider_id integer,
    facility_id integer,
    diagnosis_code character varying(10),
    procedure_code character varying(10),
    admission_date date,
    discharge_date date,
    revenue_code character varying(10),
    modifiers character varying(10),
    claim_type character varying(20),
    total_charges numeric,
    allowed_amount numeric,
    claim_merged_id integer DEFAULT nextval('claims_dummy_id_seq'::regclass) NOT NULL,
    id integer DEFAULT nextval('claims_dummy_id_seq1'::regclass) NOT NULL,
    line_id character varying(50),
    ingestion_id integer,
    PRIMARY KEY (id)
);

-- Create lut_entries table
CREATE TABLE lut_entries (
    entry_id integer DEFAULT nextval('lut_entries_entry_id_seq'::regclass) NOT NULL,
    ingestion_id integer,
    value text NOT NULL,
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

-- lut_entries indexes
CREATE INDEX idx_lut_entries_ingestion_id ON lut_entries(ingestion_id);
CREATE INDEX idx_lut_entries_value ON lut_entries(value);
CREATE INDEX idx_lut_entries_value_lower ON lut_entries(LOWER(value)); 