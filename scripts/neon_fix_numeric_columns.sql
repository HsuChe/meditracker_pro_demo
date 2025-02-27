-- Fix for numeric columns in claims_dummy table
-- This script converts any numeric columns that are stored as strings to their proper numeric types
-- Simplified version for direct execution on Neon

-- Begin transaction
BEGIN;

-- Fix allowed_amount column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'allowed_amount';
    
    RAISE NOTICE 'Current type of allowed_amount: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting allowed_amount from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN allowed_amount_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET allowed_amount_numeric = 
          CASE 
            WHEN allowed_amount IS NULL THEN NULL
            WHEN allowed_amount = '' THEN NULL
            WHEN allowed_amount ~ '^[0-9]+(\.[0-9]+)?$' THEN allowed_amount::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN allowed_amount;
        ALTER TABLE claims_dummy RENAME COLUMN allowed_amount_numeric TO allowed_amount;
        
        RAISE NOTICE 'Column allowed_amount successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column allowed_amount is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix total_charges column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'total_charges';
    
    RAISE NOTICE 'Current type of total_charges: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting total_charges from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN total_charges_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET total_charges_numeric = 
          CASE 
            WHEN total_charges IS NULL THEN NULL
            WHEN total_charges = '' THEN NULL
            WHEN total_charges ~ '^[0-9]+(\.[0-9]+)?$' THEN total_charges::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN total_charges;
        ALTER TABLE claims_dummy RENAME COLUMN total_charges_numeric TO total_charges;
        
        RAISE NOTICE 'Column total_charges successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column total_charges is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix amount_paid column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'amount_paid';
    
    RAISE NOTICE 'Current type of amount_paid: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting amount_paid from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN amount_paid_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET amount_paid_numeric = 
          CASE 
            WHEN amount_paid IS NULL THEN NULL
            WHEN amount_paid = '' THEN NULL
            WHEN amount_paid ~ '^[0-9]+(\.[0-9]+)?$' THEN amount_paid::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN amount_paid;
        ALTER TABLE claims_dummy RENAME COLUMN amount_paid_numeric TO amount_paid;
        
        RAISE NOTICE 'Column amount_paid successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column amount_paid is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix balance_due column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'balance_due';
    
    RAISE NOTICE 'Current type of balance_due: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting balance_due from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN balance_due_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET balance_due_numeric = 
          CASE 
            WHEN balance_due IS NULL THEN NULL
            WHEN balance_due = '' THEN NULL
            WHEN balance_due ~ '^[0-9]+(\.[0-9]+)?$' THEN balance_due::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN balance_due;
        ALTER TABLE claims_dummy RENAME COLUMN balance_due_numeric TO balance_due;
        
        RAISE NOTICE 'Column balance_due successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column balance_due is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix lab_service_charge column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'lab_service_charge';
    
    RAISE NOTICE 'Current type of lab_service_charge: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting lab_service_charge from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN lab_service_charge_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET lab_service_charge_numeric = 
          CASE 
            WHEN lab_service_charge IS NULL THEN NULL
            WHEN lab_service_charge = '' THEN NULL
            WHEN lab_service_charge ~ '^[0-9]+(\.[0-9]+)?$' THEN lab_service_charge::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN lab_service_charge;
        ALTER TABLE claims_dummy RENAME COLUMN lab_service_charge_numeric TO lab_service_charge;
        
        RAISE NOTICE 'Column lab_service_charge successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column lab_service_charge is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix line_charges column
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'line_charges';
    
    RAISE NOTICE 'Current type of line_charges: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting line_charges from character varying to DECIMAL(10,2)';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN line_charges_numeric DECIMAL(10,2);
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET line_charges_numeric = 
          CASE 
            WHEN line_charges IS NULL THEN NULL
            WHEN line_charges = '' THEN NULL
            WHEN line_charges ~ '^[0-9]+(\.[0-9]+)?$' THEN line_charges::DECIMAL(10,2)
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN line_charges;
        ALTER TABLE claims_dummy RENAME COLUMN line_charges_numeric TO line_charges;
        
        RAISE NOTICE 'Column line_charges successfully converted to DECIMAL(10,2)';
    ELSE
        RAISE NOTICE 'Column line_charges is already type %, no change needed', v_current_type;
    END IF;
END $$;

-- Fix units_days column (convert to integer)
DO $$
DECLARE
    v_current_type TEXT;
BEGIN
    -- Get current column type
    SELECT data_type INTO v_current_type
    FROM information_schema.columns 
    WHERE table_name = 'claims_dummy' AND column_name = 'units_days';
    
    RAISE NOTICE 'Current type of units_days: %', v_current_type;
    
    -- Only proceed if current type is character varying
    IF v_current_type = 'character varying' THEN
        RAISE NOTICE 'Converting units_days from character varying to INTEGER';
        
        -- Add temporary column with correct type
        ALTER TABLE claims_dummy ADD COLUMN units_days_numeric INTEGER;
        
        -- Convert data to the correct type
        UPDATE claims_dummy
        SET units_days_numeric = 
          CASE 
            WHEN units_days IS NULL THEN NULL
            WHEN units_days = '' THEN NULL
            WHEN units_days ~ '^[0-9]+$' THEN units_days::INTEGER
            ELSE NULL
          END;
        
        -- Drop the original column and rename the new one
        ALTER TABLE claims_dummy DROP COLUMN units_days;
        ALTER TABLE claims_dummy RENAME COLUMN units_days_numeric TO units_days;
        
        RAISE NOTICE 'Column units_days successfully converted to INTEGER';
    ELSE
        RAISE NOTICE 'Column units_days is already type %, no change needed', v_current_type;
    END IF;
END $$;

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
        'units_days'
    )
ORDER BY 
    column_name;

-- Commit transaction
COMMIT; 