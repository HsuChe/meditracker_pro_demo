-- Add place_of_service column to claims_dummy table
ALTER TABLE claims_dummy
ADD COLUMN place_of_service integer;

-- Add constraint to ensure values are between 1 and 99
ALTER TABLE claims_dummy
ADD CONSTRAINT check_place_of_service_range 
CHECK (place_of_service >= 1 AND place_of_service <= 99);

-- Add index for the new column for better query performance
CREATE INDEX idx_claims_dummy_place_of_service ON claims_dummy(place_of_service);

-- Add comment to describe the column
COMMENT ON COLUMN claims_dummy.place_of_service IS 'Integer code (1-99) indicating where the service was provided'; 