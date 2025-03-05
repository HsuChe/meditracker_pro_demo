-- Comprehensive fix for all numeric columns in claims_dummy table
-- This script converts any numeric columns that are stored as strings to their proper numeric types

-- Begin transaction
BEGIN;

-- Function to fix a column's data type
CREATE OR REPLACE FUNCTION fix_column_type(
    p_table_name TEXT,
    p_column_name TEXT,
    p_target_type TEXT,
    p_precision INT DEFAULT NULL,
    p_scale INT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_current_type TEXT;
    v_temp_column TEXT;
    v_target_type_full TEXT;
    v_sql TEXT;
BEGIN
    -- Get current column type
    EXECUTE format('
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = %L AND column_name = %L',
        p_table_name, p_column_name
    ) INTO v_current_type;
    
    -- Set full target type with precision and scale if provided
    IF p_precision IS NOT NULL AND p_scale IS NOT NULL THEN
        v_target_type_full := format('%s(%s,%s)', p_target_type, p_precision, p_scale);
    ELSE
        v_target_type_full := p_target_type;
    END IF;
    
    RAISE NOTICE 'Checking column %.%: current type = %, target type = %', 
        p_table_name, p_column_name, v_current_type, v_target_type_full;
    
    -- Only proceed if current type is different from target type
    IF v_current_type != p_target_type THEN
        RAISE NOTICE 'Converting column %.% from % to %', 
            p_table_name, p_column_name, v_current_type, v_target_type_full;
        
        -- Create a temporary column name
        v_temp_column := p_column_name || '_numeric';
        
        -- Add temporary column with correct type
        EXECUTE format('
            ALTER TABLE %I ADD COLUMN %I %s',
            p_table_name, v_temp_column, v_target_type_full
        );
        
        -- Convert data to the correct type
        v_sql := format('
            UPDATE %I
            SET %I = 
              CASE 
                WHEN %I IS NULL THEN NULL
                WHEN %I = '''' THEN NULL
                WHEN %I ~ ''^[0-9]+(\.[0-9]+)?$'' THEN %I::%s
                ELSE NULL
              END',
            p_table_name, v_temp_column, p_column_name, p_column_name, 
            p_column_name, p_column_name, v_target_type_full
        );
        
        EXECUTE v_sql;
        
        -- Drop the original column and rename the new one
        EXECUTE format('
            ALTER TABLE %I DROP COLUMN %I;
            ALTER TABLE %I RENAME COLUMN %I TO %I',
            p_table_name, p_column_name,
            p_table_name, v_temp_column, p_column_name
        );
        
        RAISE NOTICE 'Column %.% successfully converted to %', 
            p_table_name, p_column_name, v_target_type_full;
    ELSE
        RAISE NOTICE 'Column %.% is already type %, no change needed', 
            p_table_name, p_column_name, v_target_type_full;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fix all numeric columns in claims_dummy table
SELECT fix_column_type('claims_dummy', 'total_charges', 'numeric', 10, 2);
SELECT fix_column_type('claims_dummy', 'allowed_amount', 'numeric', 10, 2);
SELECT fix_column_type('claims_dummy', 'amount_paid', 'numeric', 10, 2);
SELECT fix_column_type('claims_dummy', 'balance_due', 'numeric', 10, 2);
SELECT fix_column_type('claims_dummy', 'lab_service_charge', 'numeric', 10, 2);
SELECT fix_column_type('claims_dummy', 'line_charges', 'numeric', 10, 2);

-- Fix integer columns
SELECT fix_column_type('claims_dummy', 'units_days', 'integer');
SELECT fix_column_type('claims_dummy', 'place_of_service', 'integer');
SELECT fix_column_type('claims_dummy', 'provider_id', 'integer');
SELECT fix_column_type('claims_dummy', 'facility_id', 'integer');
SELECT fix_column_type('claims_dummy', 'patient_id', 'integer');

-- Add check constraints to ensure data integrity
DO $$
DECLARE
    col_name TEXT;
BEGIN
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'claims_dummy' 
        AND data_type = 'numeric'
        AND column_name IN (
            'total_charges', 'allowed_amount', 'amount_paid', 
            'balance_due', 'lab_service_charge', 'line_charges'
        )
    LOOP
        -- Check if constraint already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = col_name || '_numeric_check'
        ) THEN
            EXECUTE format('
                ALTER TABLE claims_dummy 
                ADD CONSTRAINT %I_numeric_check 
                CHECK (%I IS NULL OR %I::text ~ ''^[0-9]+(\.[0-9]+)?$'')',
                col_name, col_name, col_name
            );
            RAISE NOTICE 'Added check constraint for column %', col_name;
        ELSE
            RAISE NOTICE 'Check constraint for column % already exists', col_name;
        END IF;
    END LOOP;
END $$;

-- Drop the function as it's no longer needed
DROP FUNCTION fix_column_type(TEXT, TEXT, TEXT, INT, INT);

-- Verify the changes
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM 
    information_schema.columns 
WHERE 
    table_name = 'claims_dummy' 
    AND column_name IN (
        'total_charges', 'allowed_amount', 'amount_paid', 
        'balance_due', 'lab_service_charge', 'line_charges',
        'units_days', 'place_of_service', 'provider_id',
        'facility_id', 'patient_id'
    )
ORDER BY 
    column_name;

-- Commit transaction
COMMIT; 