# Numeric Type Issues Fix

## Problem Description

We've identified a critical data type inconsistency in our database. Several columns that should be numeric types (`DECIMAL`, `NUMERIC`, `INTEGER`) are actually stored as `character varying` (strings) in the database. This causes type mismatch errors when using functions like `COALESCE` in SQL queries.

The most immediate issue was with the `allowed_amount` column, which triggered a PostgreSQL error:
```
ERROR: COALESCE types character varying and integer cannot be matched
```

## Root Cause Analysis

The issue stems from two main problems:

1. **Schema Drift**: The actual database schema has "drifted" from what was defined in our migration scripts. While our migration scripts correctly define columns like `allowed_amount` as `DECIMAL(10,2)`, the actual database stores them as `character varying`.

2. **Data Ingestion Process**: The `ingestedDataController.js` file doesn't enforce data types when inserting data into the database. The PostgreSQL driver (node-postgres) treats all values as strings by default unless explicitly told otherwise.

This is a classic ETL (Extract, Transform, Load) issue where numeric data is being stored as strings in the database.

## Fix Scripts

We've created several scripts to address these issues:

### 1. `check_numeric_columns.sql`

This SQL script:
- Identifies all columns that should be numeric but might be stored as strings
- Helps identify schema drift between migration definitions and actual database state

Run with:
```
psql -U your_username -d your_database -f scripts/check_numeric_columns.sql
```

### 2. `fix_all_numeric_columns.sql`

This SQL script:
- Converts all numeric columns from `character varying` to their proper numeric types
- Adds check constraints to ensure data integrity
- Provides detailed logging of all changes made

Run with:
```
psql -U your_username -d your_database -f scripts/fix_all_numeric_columns.sql
```

### 3. `fix_ingestion_process.js`

This Node.js script:
- Patches the `ingestedDataController.js` file to properly handle numeric types during data insertion
- Fixes the `validateAndTransformValue` function to ensure it returns proper numeric types
- Checks for any COALESCE issues in other controllers

Run with:
```
node scripts/fix_ingestion_process.js
```

### 4. `fix_coalesce_query.js`

This Node.js script:
- Modifies the `buildOptimizedCombinedQuery` function in `queryBuilderController.js`
- Adds a `::numeric` cast to `allowed_amount` in the `COALESCE` function
- Checks for other potential `COALESCE` issues with numeric fields

Run with:
```
node scripts/fix_coalesce_query.js
```

## Affected Columns

The following columns are affected by this issue:

### Decimal/Numeric Columns:
- `total_charges`
- `allowed_amount`
- `amount_paid`
- `balance_due`
- `lab_service_charge`
- `line_charges`

### Integer Columns:
- `units_days`
- `place_of_service`
- `provider_id`
- `facility_id`
- `patient_id`

## Preventative Measures

To prevent similar issues in the future:

1. **Explicit Type Handling**: Always explicitly handle data types when inserting data into the database. Don't rely on the database driver to infer types.

2. **Database Constraints**: Add check constraints to ensure data integrity.

3. **Data Validation**: Implement thorough data validation in the ETL process.

4. **Type Casting in Queries**: Always use explicit type casting in SQL queries when combining different data types.

5. **Schema Validation**: Regularly validate that the actual database schema matches what's defined in migration scripts.

6. **Data Quality Checks**: Implement automated tests to verify data types in the database.

## Implementation Plan

1. Run `check_numeric_columns.sql` to identify all affected columns
2. Run `fix_all_numeric_columns.sql` to fix the database schema
3. Run `fix_ingestion_process.js` to fix the data ingestion process
4. Run `fix_coalesce_query.js` to fix any COALESCE issues in queries
5. Test the application to ensure all issues are resolved

## Verification

After running the fix scripts, you can verify the fix with:

```sql
-- Check column types
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
        'balance_due', 'lab_service_charge', 'line_charges'
    );

-- Test a query with COALESCE
SELECT SUM(COALESCE(allowed_amount, 0)) FROM claims_dummy;
```

The query should now run without type mismatch errors. 