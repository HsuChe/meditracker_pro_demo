// Script to fix the COALESCE type mismatch error
require('dotenv').config({ path: '.env.production' });
const fs = require('fs');
const path = require('path');

console.log('Starting fix for COALESCE type mismatch error...');

// Path to the queryBuilderController.js file
const controllerPath = path.join(__dirname, '..', 'backend', 'controllers', 'queryBuilderController.js');

// Read the file
console.log(`Reading file: ${controllerPath}`);
let fileContent = fs.readFileSync(controllerPath, 'utf8');

// Find the buildOptimizedCombinedQuery function
const functionRegex = /const buildOptimizedCombinedQuery = \(baseQuery, conditions, limit, offset\) => \{[\s\S]*?return optimizedQuery;\n\};/;
const functionMatch = fileContent.match(functionRegex);

if (!functionMatch) {
  console.error('Could not find the buildOptimizedCombinedQuery function in the file.');
  process.exit(1);
}

// The original function content
const originalFunction = functionMatch[0];
console.log('Found the buildOptimizedCombinedQuery function.');

// Create the fixed function
const fixedFunction = `const buildOptimizedCombinedQuery = (baseQuery, conditions, limit, offset) => {
    console.log('Building optimized combined query with conditions:', JSON.stringify(conditions));
    const whereConditions = extractWhereConditions(baseQuery);
    console.log('Extracted WHERE conditions:', whereConditions);

    const optimizedQuery = \`
        WITH base_stats AS (
            SELECT 
                COUNT(DISTINCT claim_id) as unique_claims,
                COUNT(*) as total_records,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date,
                SUM(COALESCE(allowed_amount::numeric, 0)) as total_amount
            FROM \${CLAIMS_TABLE}
            WHERE \${whereConditions}
        ),
        paginated_claims AS (
            \${baseQuery}
            LIMIT \${limit} 
            OFFSET \${offset}
        )
        SELECT 
            json_build_object(
                'uniqueClaimIds', (SELECT unique_claims FROM base_stats),
                'totalRecords', (SELECT total_records FROM base_stats),
                'dateRange', json_build_object(
                    'min', (SELECT min_date::text FROM base_stats),
                    'max', (SELECT max_date::text FROM base_stats)
                ),
                'totalAllowedAmount', (SELECT total_amount FROM base_stats)
            ) as statistics,
            COALESCE(
                (SELECT jsonb_agg(t) FROM paginated_claims t),
                '[]'::jsonb
            ) as claims
    \`;

    console.log('Generated optimized query:', optimizedQuery);
    return optimizedQuery;
};`;

// Replace the original function with the fixed one
const fixedContent = fileContent.replace(originalFunction, fixedFunction);

// Write the fixed content back to the file
console.log('Writing fixed content back to the file...');
fs.writeFileSync(controllerPath, fixedContent, 'utf8');

console.log('Fix applied successfully!');
console.log('The key change was adding ::numeric to allowed_amount in the COALESCE function to ensure consistent types.');
console.log('This forces PostgreSQL to convert allowed_amount to a numeric type before using it in COALESCE.');

// Create a backup of the original file
const backupPath = `${controllerPath}.bak`;
console.log(`Creating backup of original file at: ${backupPath}`);
fs.writeFileSync(backupPath, fileContent, 'utf8');

console.log('Done!'); 