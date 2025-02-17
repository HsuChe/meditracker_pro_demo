-- Patient Information
ALTER TABLE claims_dummy
ADD COLUMN patient_policy_number VARCHAR(50),
ADD COLUMN patient_name_first VARCHAR(100),
ADD COLUMN patient_name_last VARCHAR(100),
ADD COLUMN patient_address_state CHAR(2),
ADD COLUMN patient_account_number VARCHAR(50),
ADD COLUMN employment_status BOOLEAN,

-- Insurance Information
ADD COLUMN insurance_plan VARCHAR(100),
ADD COLUMN secondary_insurance BOOLEAN,
ADD COLUMN accept_assignment BOOLEAN,

-- Accident Information
ADD COLUMN accident_type VARCHAR(10) CHECK (accident_type IN ('auto', 'other', 'na')),

-- Provider Information
ADD COLUMN referring_provider_npi VARCHAR(10),
ADD COLUMN rendering_provider_npi VARCHAR(10),
ADD COLUMN tax_id VARCHAR(20),

-- Service Facility Information
ADD COLUMN service_facilities_state CHAR(2),
ADD COLUMN service_facilities_npi VARCHAR(10),

-- Billing Provider Information
ADD COLUMN billing_provider_phone VARCHAR(20),
ADD COLUMN billing_provider_npi VARCHAR(10),

-- Laboratory Information
ADD COLUMN outside_lab BOOLEAN,
ADD COLUMN lab_service_charge DECIMAL(10,2),

-- Diagnosis Information
ADD COLUMN diagnosis_code_2 VARCHAR(10),
ADD COLUMN diagnosis_code_3 VARCHAR(10),
ADD COLUMN diagnosis_code_4 VARCHAR(10),
ADD COLUMN diagnosis_code_5 VARCHAR(10),
ADD COLUMN diagnosis_code_6 VARCHAR(10),
ADD COLUMN diagnosis_code_7 VARCHAR(10),
ADD COLUMN diagnosis_code_8 VARCHAR(10),
ADD COLUMN diagnosis_code_9 VARCHAR(10),
ADD COLUMN diagnosis_code_10 VARCHAR(10),
ADD COLUMN diagnosis_code_11 VARCHAR(10),
ADD COLUMN diagnosis_code_12 VARCHAR(10),
ADD COLUMN diagnosis_pointers VARCHAR(50),

-- Authorization Information
ADD COLUMN prior_auth_number BOOLEAN,

-- Service Information
ADD COLUMN date_of_service TIMESTAMP,
ADD COLUMN emg_indicator INTEGER CHECK (emg_indicator = 1 OR emg_indicator IS NULL),
ADD COLUMN units_days INTEGER,

-- Financial Information
ADD COLUMN line_charges DECIMAL(10,2),
ADD COLUMN amount_paid DECIMAL(10,2),
ADD COLUMN balance_due DECIMAL(10,2),

-- Bill Information
ADD COLUMN type_of_bill VARCHAR(3) CHECK (type_of_bill >= '110' AND type_of_bill <= '859'),
ADD COLUMN type_of_admission_visit INTEGER CHECK (type_of_admission_visit BETWEEN 1 AND 9),
ADD COLUMN source_of_admission VARCHAR(1) CHECK (source_of_admission ~ '^[1-9A-F]$'),

-- Condition Codes (1-10)
ADD COLUMN condition_code_1 INTEGER CHECK (condition_code_1 BETWEEN 1 AND 99),
ADD COLUMN condition_code_2 INTEGER CHECK (condition_code_2 BETWEEN 1 AND 99),
ADD COLUMN condition_code_3 INTEGER CHECK (condition_code_3 BETWEEN 1 AND 99),
ADD COLUMN condition_code_4 INTEGER CHECK (condition_code_4 BETWEEN 1 AND 99),
ADD COLUMN condition_code_5 INTEGER CHECK (condition_code_5 BETWEEN 1 AND 99),
ADD COLUMN condition_code_6 INTEGER CHECK (condition_code_6 BETWEEN 1 AND 99),
ADD COLUMN condition_code_7 INTEGER CHECK (condition_code_7 BETWEEN 1 AND 99),
ADD COLUMN condition_code_8 INTEGER CHECK (condition_code_8 BETWEEN 1 AND 99),
ADD COLUMN condition_code_9 INTEGER CHECK (condition_code_9 BETWEEN 1 AND 99),
ADD COLUMN condition_code_10 INTEGER CHECK (condition_code_10 BETWEEN 1 AND 99),

-- Occurrence Codes (1-4)
ADD COLUMN occurrence_code_1 INTEGER CHECK (occurrence_code_1 BETWEEN 1 AND 99),
ADD COLUMN occurrence_code_2 INTEGER CHECK (occurrence_code_2 BETWEEN 1 AND 99),
ADD COLUMN occurrence_code_3 INTEGER CHECK (occurrence_code_3 BETWEEN 1 AND 99),
ADD COLUMN occurrence_code_4 INTEGER CHECK (occurrence_code_4 BETWEEN 1 AND 99);

-- Add indexes for commonly queried fields
CREATE INDEX idx_claims_patient_policy ON claims_dummy(patient_policy_number);
CREATE INDEX idx_claims_patient_name ON claims_dummy(patient_name_last, patient_name_first);
CREATE INDEX idx_claims_patient_state ON claims_dummy(patient_address_state);
CREATE INDEX idx_claims_date_of_service ON claims_dummy(date_of_service);
CREATE INDEX idx_claims_provider_npi ON claims_dummy(rendering_provider_npi);
CREATE INDEX idx_claims_type_of_bill ON claims_dummy(type_of_bill);
CREATE INDEX idx_claims_diagnosis_codes ON claims_dummy(diagnosis_code_2, diagnosis_code_3, diagnosis_code_4);

-- Add comments for documentation
COMMENT ON COLUMN claims_dummy.patient_address_state IS 'Two-letter state code';
COMMENT ON COLUMN claims_dummy.type_of_bill IS 'Three-digit code between 110 and 859';
COMMENT ON COLUMN claims_dummy.type_of_admission_visit IS 'Single digit code (1-9)';
COMMENT ON COLUMN claims_dummy.source_of_admission IS 'Single character code (1-9 or A-F)';
COMMENT ON COLUMN claims_dummy.emg_indicator IS 'Emergency indicator (1 or NULL)';
COMMENT ON COLUMN claims_dummy.accident_type IS 'Type of accident (auto/other/na)'; 