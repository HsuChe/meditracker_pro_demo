-- Alter gender column to handle full gender strings
ALTER TABLE claims_dummy
ALTER COLUMN gender TYPE VARCHAR(10);

-- Add comment to describe the column
COMMENT ON COLUMN claims_dummy.gender IS 'Gender of the patient (e.g., Male, Female)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_claims_dummy_gender ON claims_dummy(gender); 