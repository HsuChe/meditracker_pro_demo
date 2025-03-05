-- Add discharge_code column to claims_dummy table
ALTER TABLE claims_dummy
ADD COLUMN discharge_code VARCHAR(50);

-- Add index for discharge_code
CREATE INDEX idx_claims_discharge_code ON claims_dummy(discharge_code);

-- Add comment for documentation
COMMENT ON COLUMN claims_dummy.discharge_code IS 'Discharge code for the claim'; 