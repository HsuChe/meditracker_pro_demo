CREATE TABLE IF NOT EXISTS claims_dummy (
    claim_merged_id SERIAL PRIMARY KEY,
    claim_id VARCHAR(255),
    patient_id INTEGER,
    date_of_birth DATE,
    gender VARCHAR(1),
    provider_id INTEGER,
    facility_id INTEGER,
    diagnosis_code VARCHAR(50),
    procedure_code VARCHAR(50),
    admission_date DATE,
    discharge_date DATE,
    revenue_code VARCHAR(50),
    modifiers VARCHAR(50),
    claim_type VARCHAR(50),
    total_charges DECIMAL(10,2),
    allowed_amount DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS saved_filters (
    filter_id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    conditions JSONB,
    claims_ids JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS filter_results_history (
    history_id SERIAL PRIMARY KEY,
    filter_id INTEGER REFERENCES saved_filters(filter_id),
    run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    results_count INTEGER,
    conditions_snapshot JSONB
); 