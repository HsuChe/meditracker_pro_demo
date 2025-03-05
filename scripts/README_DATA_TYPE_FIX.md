# Data Type Issue Fix: allowed_amount

## Problem Description

We've identified a data type inconsistency in the `claims_dummy` table. The `allowed_amount` column is defined as `DECIMAL(10,2)` in the schema, but is actually stored as `character varying` in the database. This causes type mismatch errors when using functions like `COALESCE` in SQL queries.

Specifically, the error occurs in the `buildOptimizedCombinedQuery` function in `queryBuilderController.js` when trying to use `SUM(COALESCE(allowed_amount, 0))`. PostgreSQL cannot automatically reconcile the different types (character varying and integer).

## Root Cause

The issue stems from the data ingestion process in `ingestedDataController.js`. While the code correctly validates and transforms values based on their expected data types, it doesn't enforce these types when inserting data into the database. The PostgreSQL driver (node-postgres) treats all values as strings by default unless explicitly told otherwise.

This is an ETL (Extract, Transform, Load) issue where numeric data is being stored as strings in the database.

## Fix Scripts

We've created three scripts to address this issue:

### 1. `fix_allowed_amount_type.js`

This Node.js script:
- Alters the `claims_dummy` table to ensure `allowed_amount` is `DECIMAL(10,2)`
- Updates existing data to convert string values to numeric
- Patches the `ingestedDataController.js` file to properly handle numeric types during data ingestion

Run with:
```
node scripts/fix_allowed_amount_type.js
```

### 2. `fix_allowed_amount_type.sql`

This SQL script:
- Converts the `allowed_amount` column from `character varying` to `DECIMAL(10,2)`
- Checks for other numeric columns that might be stored as strings
- Adds a check constraint to ensure `allowed_amount` is always numeric

Run with:
```
psql -U your_username -d your_database -f scripts/fix_allowed_amount_type.sql
```

### 3. `fix_coalesce_query.js`

This Node.js script:
- Modifies the `buildOptimizedCombinedQuery` function in `queryBuilderController.js`
- Adds a `::numeric` cast to `allowed_amount` in the `COALESCE` function
- Checks for other potential `COALESCE` issues with numeric fields

Run with:
```
node scripts/fix_coalesce_query.js
```

## Preventative Measures

To prevent similar issues in the future:

1. **Explicit Type Casting**: Always use explicit type casting in SQL queries when combining different data types.

2. **Database Constraints**: Add check constraints to ensure data integrity.

3. **Data Validation**: Implement thorough data validation in the ETL process.

4. **Type Enforcement**: Ensure the database driver correctly enforces data types during insertion.

5. **Data Quality Checks**: Regularly audit the database for type inconsistencies.

## Potential Other Issues

The same issue might affect other numeric columns in the `claims_dummy` table:
- `total_charges`
- `amount_paid`
- `balance_due`
- `lab_service_charge`
- `line_charges`

The `fix_allowed_amount_type.sql` script checks for these columns and reports if they are also stored as strings.

## Verification

After running the fix scripts, you can verify the fix with:

```sql
-- Check column type
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns 
WHERE table_name = 'claims_dummy' AND column_name = 'allowed_amount';

-- Test a query with COALESCE
SELECT SUM(COALESCE(allowed_amount, 0)) FROM claims_dummy;
```

The query should now run without type mismatch errors. 