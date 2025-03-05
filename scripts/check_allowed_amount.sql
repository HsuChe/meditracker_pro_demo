-- 1. Check the data type of the allowed_amount column in the database
SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns 
WHERE table_name = 'claims_dummy' AND column_name = 'allowed_amount';

-- 2. Check for non-numeric values in allowed_amount
SELECT claim_id, allowed_amount 
FROM claims_dummy 
WHERE allowed_amount IS NOT NULL 
  AND allowed_amount::text ~ '[^0-9\.]'
LIMIT 20;

-- 3. Check the distribution of data types in allowed_amount
SELECT 
  CASE 
    WHEN allowed_amount IS NULL THEN 'NULL'
    WHEN allowed_amount::text ~ '^[0-9]+(\.[0-9]+)?$' THEN 'NUMERIC'
    ELSE 'NON-NUMERIC' 
  END as value_type,
  COUNT(*) as count
FROM claims_dummy
GROUP BY value_type;

-- 4. Sample of allowed_amount values to inspect
SELECT claim_id, allowed_amount, pg_typeof(allowed_amount) as actual_type
FROM claims_dummy
LIMIT 20;

-- 5. Check for values that might cause COALESCE type issues
SELECT 
  claim_id, 
  allowed_amount,
  pg_typeof(allowed_amount) as type
FROM claims_dummy
WHERE pg_typeof(allowed_amount)::text != 'numeric'
LIMIT 20;

-- 6. Check if casting to numeric works for all rows
SELECT COUNT(*) as problematic_rows
FROM claims_dummy
WHERE allowed_amount IS NOT NULL 
  AND allowed_amount::numeric IS NULL; 