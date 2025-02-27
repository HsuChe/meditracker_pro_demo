-- Check recent ingestions
SELECT 
    ingested_data_id,
    name,
    type,
    record_count,
    ingestion_date,
    processing_status,
    activity_status,
    batch_number,
    total_batches,
    parent_ingestion_id
FROM 
    ingested_data
ORDER BY 
    ingestion_date DESC
LIMIT 10;

-- Check if claims are being inserted
SELECT 
    COUNT(*) as total_claims,
    MIN(ingestion_id) as min_ingestion_id,
    MAX(ingestion_id) as max_ingestion_id,
    MIN(allowed_amount) as min_allowed_amount,
    MAX(allowed_amount) as max_allowed_amount,
    pg_typeof(allowed_amount) as allowed_amount_type
FROM 
    claims_dummy;

-- Check the most recent claims
SELECT 
    id,
    claim_id,
    line_id,
    allowed_amount,
    total_charges,
    ingestion_id,
    pg_typeof(allowed_amount) as allowed_amount_type,
    pg_typeof(total_charges) as total_charges_type
FROM 
    claims_dummy
ORDER BY 
    id DESC
LIMIT 5; 