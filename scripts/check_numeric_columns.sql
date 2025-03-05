-- Script to identify all columns that should be numeric but are stored as strings
-- This helps identify schema drift between migration definitions and actual database state

-- Check all potentially numeric columns in claims_dummy table
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM 
    information_schema.columns 
WHERE 
    table_name = 'claims_dummy' 
    AND column_name IN (
        'total_charges', 
        'allowed_amount', 
        'amount_paid', 
        'balance_due', 
        'lab_service_charge', 
        'line_charges',
        'units_days',
        'place_of_service',
        'provider_id',
        'facility_id',
        'patient_id'
    )
ORDER BY 
    column_name;

-- Check how these columns are defined in the migration script
-- (This is for manual comparison with the actual database state)
-- You should compare these results with your migration script definitions