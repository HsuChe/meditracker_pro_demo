// filterController.js
const pool = require('../config/db.config');
const { getAllClaims } = require('../routes/claimRoutes');
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';
const { buildFilterQuery, buildIdQuery, buildOptimizedCombinedQuery } = require('./queryBuilderController');
const { getClaims } = require('./claimsController');

// Update VALID_OPERATORS to include between_date
const VALID_OPERATORS = new Set([
    'equals', 'contains', 'starts_with', 'ends_with', 
    'is_null', 'is_not_null', 'greater_than', 'less_than',
    'between', 'before', 'after', 'in_list', 'not_in_list',
    'between_date'
]);

// Helper function to extract WHERE conditions from a query
const extractWhereConditions = (query) => {
    const whereMatch = query.match(/WHERE\s+(.*?)(?=(?:ORDER BY|GROUP BY|LIMIT|$))/is);
    return whereMatch ? whereMatch[1].trim() : 'TRUE';
};

// Add this helper function at the top level, before any other functions
const buildWhereClauses = (conditions) => {
    console.log('\n=== Building Where Clauses ===');
    console.log('Input conditions:', JSON.stringify(conditions, null, 2));
    
    const clauses = [];
    const params = [];

    if (!conditions || !Array.isArray(conditions)) {
        console.log('No conditions provided or invalid format');
        return { clauses, params };
    }

    conditions.forEach(condition => {
        const { column, operator, value, secondValue } = condition;
        console.log('\nProcessing condition:', { column, operator, value, secondValue });
        
        // Skip if value is null/undefined (unless it's is_null/is_not_null operator)
        if (value === null && !['is_null', 'is_not_null', 'between', 'between_date'].includes(operator)) {
            console.log('Skipping condition due to null value');
            return;
        }

        // Don't add parameter for is_null/is_not_null operators
        if (!['is_null', 'is_not_null'].includes(operator)) {
            // Helper function to determine type casting
            const getTypeCasting = (val) => {
                if (!isNaN(val) && typeof val !== 'boolean') {
                    return 'numeric';
                }
                if (operator === 'before' || operator === 'after' || operator === 'between' || operator === 'between_date') {
                    return 'timestamp';
                }
                return 'text';
            };

            switch(operator) {
                case 'equals':
                    params.push(value);
                    const valueType = getTypeCasting(value);
                    clauses.push(`${column}::${valueType} = $${params.length}::${valueType}`);
                    break;
                case 'contains':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE '%' || $${params.length}::text || '%'`);
                    break;
                case 'starts_with':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE $${params.length}::text || '%'`);
                    break;
                case 'ends_with':
                    params.push(value);
                    clauses.push(`${column}::text ILIKE '%' || $${params.length}::text`);
                    break;
                case 'in_list':
                    const inListValues = String(value).split(/[,;\t|]/).map(v => v.trim()).filter(v => v.length > 0);
                    params.push(inListValues);
                    clauses.push(`LOWER(${column}::text) = ANY(SELECT LOWER(UNNEST($${params.length}::text[])))`);
                    break;
                case 'not_in_list':
                    const notInListValues = String(value).split(/[,;\t|]/).map(v => v.trim()).filter(v => v.length > 0);
                    params.push(notInListValues);
                    clauses.push(`LOWER(${column}::text) NOT IN (SELECT LOWER(UNNEST($${params.length}::text[])))`);
                    break;
                case 'greater_than':
                    params.push(value);
                    const gtType = getTypeCasting(value);
                    clauses.push(`${column}::${gtType} > $${params.length}::${gtType}`);
                    break;
                case 'less_than':
                    params.push(value);
                    const ltType = getTypeCasting(value);
                    clauses.push(`${column}::${ltType} < $${params.length}::${ltType}`);
                    break;
                case 'before':
                    params.push(value);
                    clauses.push(`${column}::date < $${params.length}::date`);
                    break;
                case 'after':
                    params.push(value);
                    clauses.push(`${column}::date > $${params.length}::date`);
                    break;
                case 'between':
                    if (value !== null && secondValue !== null) {
                        params.push(value, secondValue);
                        const betweenType = getTypeCasting(value);
                        clauses.push(`${column}::${betweenType} BETWEEN $${params.length - 1}::${betweenType} AND $${params.length}::${betweenType}`);
                    }
                    break;
                case 'between_date':
                    console.log('\n=== Processing between_date operator ===');
                    console.log('Column:', column);
                    console.log('Value:', value);
                    console.log('Second Value:', secondValue);
                    
                    if (value && secondValue?.unit && secondValue?.value !== undefined) {
                        const { operator: compareOp, value: compareValue, unit } = secondValue;

                        // Handle the reference date - it could be 'today' or a column name
                        let referenceDate;
                        if (value === 'today') {
                            referenceDate = 'CURRENT_TIMESTAMP';
                        } else if (value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                            // If value is a valid column name, use it directly
                            referenceDate = value;
                        } else {
                            // If it's a specific date value, add it as a parameter
                            params.push(value);
                            referenceDate = `$${params.length}::timestamp`;
                        }

                        try {
                            // Build the appropriate interval calculation based on the unit
                            let intervalCalc;
                            switch (unit) {
                                case 'year':
                                    intervalCalc = `ABS(EXTRACT(YEAR FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)))`;
                                    break;
                                case 'month':
                                    intervalCalc = `ABS(EXTRACT(MONTH FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)) + 12 * EXTRACT(YEAR FROM AGE(${referenceDate}::timestamp, ${column}::timestamp)))`;
                                    break;
                                case 'week':
                                    intervalCalc = `ABS(EXTRACT(EPOCH FROM (${referenceDate}::timestamp - ${column}::timestamp))/(86400*7))`;
                                    break;
                                case 'day':
                                    intervalCalc = `ABS(EXTRACT(EPOCH FROM (${referenceDate}::timestamp - ${column}::timestamp))/86400)`;
                                    break;
                                default:
                                    throw new Error(`Unsupported time unit: ${unit}`);
                            }
                            
                            // Build the comparison clause
                            let clause;
                            switch (compareOp) {
                                case 'greater_than':
                                    clause = `${intervalCalc} > ${compareValue}`;
                                    break;
                                case 'less_than':
                                    clause = `${intervalCalc} < ${compareValue}`;
                                    break;
                                case 'equals':
                                    // For exact matches, we'll use a small range to account for fractional differences
                                    if (unit === 'week' || unit === 'day') {
                                        clause = `${intervalCalc} >= ${compareValue} AND ${intervalCalc} < ${compareValue + 1}`;
                                    } else {
                                        clause = `${intervalCalc} = ${compareValue}`;
                                    }
                                    break;
                                default:
                                    clause = 'TRUE';
                            }
                            
                            // Add debug logging
                            console.log('Debug Query:', `
                                SELECT 
                                    ${column} as check_column, 
                                    ${referenceDate} as reference_date,
                                    ${intervalCalc} as time_diff,
                                    CASE 
                                        WHEN ${intervalCalc} < ${compareValue} THEN 'YES'
                                        ELSE 'NO'
                                    END as meets_criteria
                                FROM ${CLAIMS_TABLE}
                                WHERE ${column} IS NOT NULL 
                                AND ${referenceDate} IS NOT NULL
                                LIMIT 5;
                            `);
                            
                            console.log('Generated SQL clause:', clause);
                            console.log('Parameters:', params);
                            clauses.push(clause);
                        } catch (error) {
                            console.error('Error processing between_date operator:', error);
                            console.error('Falling back to simpler date comparison');
                            
                            // Fallback to a simpler date comparison
                            if (compareOp === 'greater_than') {
                                // For "greater than X months/years/etc", use a simple date comparison
                                // Calculate a date in the past based on the unit and value
                                let fallbackClause;
                                if (unit === 'year') {
                                    fallbackClause = `${column}::date < (${referenceDate}::date - INTERVAL '${compareValue} years')`;
                                } else if (unit === 'month') {
                                    fallbackClause = `${column}::date < (${referenceDate}::date - INTERVAL '${compareValue} months')`;
                                } else if (unit === 'week') {
                                    fallbackClause = `${column}::date < (${referenceDate}::date - INTERVAL '${compareValue * 7} days')`;
                                } else if (unit === 'day') {
                                    fallbackClause = `${column}::date < (${referenceDate}::date - INTERVAL '${compareValue} days')`;
                                } else {
                                    fallbackClause = 'TRUE';
                                }
                                console.log('Fallback clause:', fallbackClause);
                                clauses.push(fallbackClause);
                            } else if (compareOp === 'less_than') {
                                // For "less than X months/years/etc"
                                let fallbackClause;
                                if (unit === 'year') {
                                    fallbackClause = `${column}::date > (${referenceDate}::date - INTERVAL '${compareValue} years')`;
                                } else if (unit === 'month') {
                                    fallbackClause = `${column}::date > (${referenceDate}::date - INTERVAL '${compareValue} months')`;
                                } else if (unit === 'week') {
                                    fallbackClause = `${column}::date > (${referenceDate}::date - INTERVAL '${compareValue * 7} days')`;
                                } else if (unit === 'day') {
                                    fallbackClause = `${column}::date > (${referenceDate}::date - INTERVAL '${compareValue} days')`;
                                } else {
                                    fallbackClause = 'TRUE';
                                }
                                console.log('Fallback clause:', fallbackClause);
                                clauses.push(fallbackClause);
                            } else {
                                // Default fallback
                                clauses.push('TRUE');
                            }
                        }

                    } else {
                        console.log('Missing required parameters for between_date operator');
                    }
                    break;
            }
        } else {
            // Handle is_null and is_not_null without parameters
            if (operator === 'is_null') {
                clauses.push(`${column} IS NULL`);
            } else {
                clauses.push(`${column} IS NOT NULL`);
            }
        }
    });

    console.log('\n=== Final Where Clause Components ===');
    console.log('Clauses:', clauses);
    console.log('Parameters:', params);
    
    return { clauses, params };
};

const validateAndCleanFilter = async (client, filter) => {
  try {
    if (!filter.claims_ids || !Array.isArray(filter.claims_ids)) {
      return filter;
    }

    // Query to check which claim IDs still exist
    const query = `
      SELECT id 
      FROM claims_dummy 
      WHERE id = ANY($1::int[])
    `;
    
    const result = await client.query(query, [filter.claims_ids]);
    
    // Get the set of existing IDs
    const existingIds = new Set(result.rows.map(row => row.id));
    
    // Filter out non-existing IDs
    const validClaimIds = filter.claims_ids.filter(id => existingIds.has(id));
    
    // If there are any invalid IDs, update the filter
    if (validClaimIds.length !== filter.claims_ids.length) {
      const updateQuery = `
        UPDATE saved_filters 
        SET claims_ids = $1::jsonb,
            last_updated = CURRENT_TIMESTAMP
        WHERE filter_id = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [
        JSON.stringify(validClaimIds),
        filter.filter_id
      ]);

      return updateResult.rows[0];
    }

    return filter;
  } catch (error) {
    console.error('Error validating filter:', error);
    return filter;
  }
};

// Get all saved filters with optional pagination and search
const getSavedFilters = async (req, res) => {
    const client = await pool.connect();
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count
        const countResult = await client.query('SELECT COUNT(*) FROM saved_filters');
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated filters
        const result = await client.query(
            'SELECT * FROM saved_filters ORDER BY last_updated DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        // Validate and clean up each filter
        const validatedFilters = await Promise.all(
            result.rows.map(filter => validateAndCleanFilter(client, filter))
        );

        res.json({
            filters: validatedFilters,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalRecords: totalCount,
                pageSize: limit
            }
        });
    } catch (error) {
        console.error('Error fetching saved filters:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Save a new filter
const saveFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, description, conditions, is_favorite, created_by } = req.body;

        // Validate conditions format first
        if (!Array.isArray(conditions)) {
            return res.status(400).json({ 
                error: 'Invalid conditions format',
                details: 'Conditions must be an array'
            });
        }
        
        await client.query('BEGIN');

        // Check for duplicate name
        const nameCheck = await client.query(
            'SELECT filter_id FROM saved_filters WHERE name = $1',
            [name]
        );
        
        if (nameCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Filter name already exists' });
        }

        // Separate conditions
        const mainConditions = conditions
            .filter(c => c.key === 'Claim Id')
            .map(({ column, operator, value, secondValue }) => ({
                column, operator, value, secondValue
            }));

        const subKeyConditions = conditions
            .filter(c => c.key.startsWith('Sub Key:'))
            .map(({ column, operator, value, secondValue }) => ({
                column, operator, value, secondValue
            }));

        // Build and execute query to get matching IDs
        const { query: idQuery, params: queryParams } = buildIdQuery(mainConditions, subKeyConditions);

        // Execute query and get matching IDs
        const matchingIds = await client.query(idQuery, queryParams);
        const claims_ids = matchingIds.rows.map(row => row.id);

        // Prepare filter config
        const filterConfig = {
            mainConditions: conditions.filter(c => c.key === 'Claim Id'),
            subConditions: conditions.filter(c => c.key.startsWith('Sub Key:')),
            originalPayload: conditions
        };

        // Prepare insert parameters
        const insertParams = [
            name,
            description,
            JSON.stringify(filterConfig),
            JSON.stringify(claims_ids),
            is_favorite || false,
            created_by || 'system'
        ];

        // Execute insert
        const result = await client.query(`
            INSERT INTO saved_filters 
            (name, description, conditions, claims_ids, is_favorite, created_by, last_updated)
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, CURRENT_TIMESTAMP)
            RETURNING *
        `, insertParams);

        await client.query('COMMIT');
        
        res.status(201).json({
            ...result.rows[0],
            matched_claims_count: claims_ids.length
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving filter:', err);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: err.message
        });
    } finally {
        client.release();
    }
};

// Execute filter and save results
const executeFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { filterId } = req.params;
        
        // Get the filter
        const filterResult = await client.query(
            'SELECT * FROM saved_filters WHERE filter_id = $1',
            [filterId]
        );

        if (filterResult.rows.length === 0) {
            throw new Error('Filter not found');
        }

        // Validate and clean up the filter before execution
        const validatedFilter = await validateAndCleanFilter(client, filterResult.rows[0]);

        // Execute the filter with validated claims_ids
        const query = await buildFilterQuery(validatedFilter);
        const result = await client.query(query);

        await client.query('COMMIT');
        res.json(result.rows);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in executeFilter:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Helper function to calculate statistics
const calculateStatistics = async (claims) => {
    try {
        const uniqueClaimIds = new Set(claims.map(c => c.claim_id)).size;
        let totalRecords = 0;
        let minDate = null;
        let maxDate = null;
        let totalAllowedAmount = 0;

        claims.forEach(claim => {
            // Get the grouped data array, ensuring it exists
            const groupedData = Array.isArray(claim.grouped_data) ? claim.grouped_data : [];
            
            // Count total records (including the main record)
            totalRecords += groupedData.length;

            // Process all records in grouped_data
            groupedData.forEach(record => {
                // Process dates
                if (record.admission_date) {
                    const date = new Date(record.admission_date);
                    if (!isNaN(date.getTime())) {
                        if (!minDate || date < minDate) minDate = date;
                        if (!maxDate || date > maxDate) maxDate = date;
                    }
                }

                // Process amounts
                if (record.allowed_amount) {
                    const amount = parseFloat(record.allowed_amount);
                    if (!isNaN(amount)) {
                        totalAllowedAmount += amount;
                    }
                }
            });
        });

        return {
            uniqueClaimIds,
            totalRecords,
            dateRange: {
                min: minDate?.toISOString() || null,
                max: maxDate?.toISOString() || null
            },
            totalAllowedAmount
        };
    } catch (error) {
        console.error('Error calculating statistics:', error);
        throw error;
    }
};

// Load saved filter data and execute query
const savedFilterQueryBuilder = async (filterId, req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get both claims_ids and conditions from saved filter
        const filterQuery = `
            SELECT claims_ids, conditions, name, description, is_favorite, created_by, last_updated
            FROM saved_filters 
            WHERE filter_id = $1
        `;
        const result = await client.query(filterQuery, [filterId]);
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                error: 'Filter not found',
                details: 'The requested filter does not exist'
            });
        }

        // Get the saved filter data
        const savedFilter = result.rows[0];
        const filterConfig = savedFilter.conditions;
        const claimIds = savedFilter.claims_ids;

        // Extract conditions from the saved filter
        const conditions = filterConfig.originalPayload || 
                         (Array.isArray(filterConfig) ? filterConfig : []);

        if (!Array.isArray(conditions)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Invalid filter format',
                details: 'The saved filter has an invalid conditions format'
            });
        }

        // Build query using the conditions instead of just IDs
        const { query, params } = buildFilterQuery(conditions);

        // Modify req object with our query before passing to getClaims
        req.savedFilterQuery = {
            baseQuery: query,
            params: params,
            page: req.query.page || 1,
            limit: req.query.limit || 10
        };

        // Add conditions and metadata to the response data
        req.savedFilterData = {
            filterId,
            name: savedFilter.name,
            description: savedFilter.description,
            is_favorite: savedFilter.is_favorite,
            created_by: savedFilter.created_by,
            last_updated: savedFilter.last_updated,
            conditions: conditions,
            mainConditions: filterConfig.mainConditions || [],
            subConditions: filterConfig.subConditions || []
        };

        await client.query('COMMIT');
        return await getClaims(req, res);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in savedFilterQueryBuilder:', err);
        return res.status(500).json({
            error: 'Error loading saved filter',
            details: err.message
        });
    } finally {
        client.release();
    }
};

// Delete a specific filter
const deleteFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name } = req.params;
        
        await client.query('BEGIN');
        
        // Delete the filter
        const result = await client.query(
            'DELETE FROM saved_filters WHERE name = $1 RETURNING *',
            [name]
        );
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Filter not found' });
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Filter deleted successfully' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting filter:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Delete all filters
const deleteAllFilters = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Delete all filters
        await client.query('DELETE FROM saved_filters');
        
        await client.query('COMMIT');
        res.json({ message: 'All filters deleted successfully' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting all filters:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Update the exports
module.exports = {
    getSavedFilters,
    saveFilter,
    executeFilter,
    savedFilterQueryBuilder,
    deleteFilter,
    deleteAllFilters,
    validateAndCleanFilter
};