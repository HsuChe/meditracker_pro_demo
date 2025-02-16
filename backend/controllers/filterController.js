// filterController.js
const pool = require('../config/db.config');
const { getAllClaims } = require('../routes/claimRoutes');
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';

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

// Optimized query builder that separates statistics collection from data fetching
const buildOptimizedCombinedQuery = (baseQuery, conditions, limit, offset) => {
    // First, extract the WHERE clause from baseQuery
    const whereConditions = extractWhereConditions(baseQuery);

    // Build a more efficient query that avoids unnecessary JSON operations
    const optimizedQuery = `
        WITH base_stats AS (
            -- Get statistics directly from the table, avoiding JSON operations
            SELECT 
                COUNT(DISTINCT claim_id) as unique_claims,
                COUNT(*) as total_records,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date,
                SUM(COALESCE(allowed_amount, 0)) as total_amount
            FROM ${CLAIMS_TABLE}
            WHERE ${whereConditions}
        ),
        paginated_claims AS (
            -- Your original baseQuery with pagination
            ${baseQuery}
            LIMIT ${limit} 
            OFFSET ${offset}
        )
        SELECT 
            -- Get the statistics
            json_build_object(
                'uniqueClaimIds', (SELECT unique_claims FROM base_stats),
                'totalRecords', (SELECT total_records FROM base_stats),
                'dateRange', json_build_object(
                    'min', (SELECT min_date::text FROM base_stats),
                    'max', (SELECT max_date::text FROM base_stats)
                ),
                'totalAllowedAmount', (SELECT total_amount FROM base_stats)
            ) as statistics,
            -- Get the paginated claims data
            COALESCE(
                (SELECT jsonb_agg(t) FROM paginated_claims t),
                '[]'::jsonb
            ) as claims
    `;

    return optimizedQuery;
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

// Get all saved filters with optional pagination and search
const getSavedFilters = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, sortBy = 'last_updated', sortOrder = 'DESC' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT f.*, 
                   COUNT(h.history_id) as run_count,
                   MAX(h.run_timestamp) as last_run
            FROM saved_filters f
            LEFT JOIN filter_results_history h ON f.filter_id = h.filter_id
        `;

        const params = [];
        if (search) {
            query += ` WHERE f.name ILIKE $1 OR f.description ILIKE $1`;
            params.push(`%${search}%`);
        }

        query += ` GROUP BY f.filter_id
                  ORDER BY ${sortBy} ${sortOrder}
                  LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

        const result = await pool.query(query, [...params, limit, offset]);
        
        // Get total count for pagination
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM saved_filters' + (search ? ' WHERE name ILIKE $1 OR description ILIKE $1' : ''),
            search ? [`%${search}%`] : []
        );

        res.json({
            filters: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching saved filters:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
};

// Build query to get matching IDs
const buildIdQuery = (mainConditions, subKeyConditions) => {
    let query = `
        WITH matching_claims AS (
            SELECT DISTINCT c1.id
            FROM ${CLAIMS_TABLE} c1
    `;

    const mainWhere = buildWhereClauses(mainConditions);
    const subWhere = buildWhereClauses(subKeyConditions);
    
    let paramOffset = 0;
    let allParams = [];

    // Add WHERE clause for main conditions
    if (mainWhere.clauses.length) {
        // Adjust parameter indices for main conditions
        const adjustedMainClauses = mainWhere.clauses.map(clause => {
            return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + paramOffset}`);
        });
        query += ` WHERE ${adjustedMainClauses.join(' AND ')}`;
        allParams = [...mainWhere.params];
        paramOffset = mainWhere.params.length;
    } else {
        query += ` WHERE TRUE`;
    }

    // Add sub conditions if they exist
    if (subWhere.clauses.length) {
        // Adjust parameter indices for sub conditions
        const adjustedSubClauses = subWhere.clauses.map(clause => {
            return clause.replace(/\$(\d+)/g, (match, num) => `$${parseInt(num) + paramOffset}`);
        });
        query += `
            AND EXISTS (
                SELECT 1
                FROM ${CLAIMS_TABLE} c2
                WHERE c2.claim_id = c1.claim_id
                AND ${adjustedSubClauses.join(' AND ')}
            )
        `;
        allParams = [...allParams, ...subWhere.params];
    }

    query += `) SELECT id FROM matching_claims`;

    return {
        query,
        params: allParams
    };
};

// Save a new filter
const saveFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, description, conditions, is_favorite, created_by } = req.body;
        
        await client.query('BEGIN');

        // Check for duplicate name
        const nameCheck = await client.query(
            'SELECT filter_id FROM saved_filters WHERE name = $1',
            [name]
        );
        
        if (nameCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Filter name already exists' });
        }

        // Validate conditions format
        if (!Array.isArray(conditions)) {
            return res.status(400).json({ 
                error: 'Invalid conditions format',
                details: 'Conditions must be an array'
            });
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
    const debugLogs = [];
    const log = (step, data) => {
        debugLogs.push({ step, data });
    };

    log('=== Execute Filter Process ===', null);
    log('1. Received Payload', req.body);

    try {
        const { conditions } = req.body;
        
        // Separate main and sub conditions
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

        // Extract sub key column if sub conditions exist
        const subKeyColumn = subKeyConditions.length > 0 
            ? conditions.find(c => c.key.startsWith('Sub Key:'))?.key.split(': ')[1]
            : null;

        log('2. Processed Conditions', {
            mainConditions,
            subKeyColumn,
            subKeyConditions
        });

        // Build WHERE clauses for both main and sub conditions
        const buildWhereClauses = (conditions) => {
            const clauses = [];
            const params = [];

            conditions.forEach(condition => {
                const { column, operator, value, secondValue } = condition;
                
                // Add parameter
                params.push(value);
                const paramIndex = params.length;

                switch(operator) {
                    case 'equals':
                        clauses.push(`${column}::text = $${paramIndex}::text`);
                        break;
                    case 'contains':
                        clauses.push(`${column}::text ILIKE '%' || $${paramIndex}::text || '%'`);
                        break;
                    // Add other operators as needed
                }
            });

            return { clauses, params };
        };

        const mainWhere = buildWhereClauses(mainConditions);
        const subWhere = buildWhereClauses(subKeyConditions);

        log('3. Generated WHERE Clauses', {
            main: mainWhere.clauses,
            sub: subWhere.clauses
        });

        // Build the complete query
        const buildFilterQuery = () => {
            const allParams = [...mainWhere.params, ...subWhere.params];
            
            if (subKeyColumn) {
                // Build hierarchical query
                return {
                    query: `
                        WITH matching_claims AS (
                            SELECT DISTINCT c1.claim_id
                            FROM ${CLAIMS_TABLE} c1
                            WHERE ${mainWhere.clauses.length ? mainWhere.clauses.join(' AND ') : 'TRUE'}
                            AND EXISTS (
                                SELECT 1
                                FROM ${CLAIMS_TABLE} c2
                                WHERE c2.claim_id = c1.claim_id
                                ${subWhere.clauses.length ? 'AND ' + subWhere.clauses.join(' AND ') : ''}
                            )
                        )
                        SELECT 
                            jsonb_build_object(
                                'data', to_jsonb(c.*),
                                'children', COALESCE(
                                    jsonb_agg(
                                        jsonb_build_object(
                                            'data', to_jsonb(ml.*)
                                        )
                                    ) FILTER (WHERE ml.claim_id IS NOT NULL),
                                    '[]'::jsonb
                                )
                            ) as hierarchical_data
                        FROM ${CLAIMS_TABLE} c
                        INNER JOIN matching_claims mc ON c.claim_id = mc.claim_id
                        LEFT JOIN LATERAL (
                            SELECT *
                            FROM ${CLAIMS_TABLE} ml
                            WHERE ml.claim_id = c.claim_id
                            ${subWhere.clauses.length ? 'AND ' + subWhere.clauses.join(' AND ') : ''}
                        ) ml ON true
                        GROUP BY c.claim_id, c.*
                        ORDER BY c.claim_id
                    `,
                    params: allParams
                };
            }

            // Build flat query
            return {
                query: `
                    SELECT 
                        c.claim_id,
                        COALESCE(
                            jsonb_agg(
                                CASE 
                                    WHEN c.claim_id IS NOT NULL THEN c.*
                                    ELSE NULL
                                END
                                ORDER BY c.line_id
                            ) FILTER (WHERE c.claim_id IS NOT NULL),
                            '[]'::jsonb
                        ) as grouped_data
                    FROM ${CLAIMS_TABLE} c
                    WHERE ${mainWhere.clauses.length ? mainWhere.clauses.join(' AND ') : 'TRUE'}
                    GROUP BY c.claim_id
                    ORDER BY c.claim_id
                `,
                params: mainWhere.params
            };
        };

        const { query, params } = buildFilterQuery();
        
        log('4. Final Query', { query, params });

        // Execute query and get results
        const client = await pool.connect();
        try {
            const result = await client.query(query, params);
            
            // Transform results based on query type
            const transformedResults = subKeyColumn
                ? result.rows.map(row => ({
                    ...row.hierarchical_data.data,
                    grouped_data: row.hierarchical_data.children.map(child => child.data)
                }))
                : result.rows;

            // Calculate statistics
            const statistics = await calculateStatistics(transformedResults);

            // Return response
            res.json({
                claims: transformedResults,
                statistics,
                pagination: {
                    total: transformedResults.length,
                    page: req.body.page || 1,
                    limit: req.body.limit || 10,
                    pages: Math.ceil(transformedResults.length / (req.body.limit || 10))
                },
                debug: debugLogs
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error in executeFilter:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            debug: debugLogs
        });
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

// Helper function to build filter query
const buildFilterQuery = (conditions) => {
    const { clauses, params } = buildWhereClauses(conditions);
    
    const query = `
        SELECT 
            c.claim_id,
            jsonb_agg(
                to_jsonb(c.*)
                ORDER BY c.line_id
            ) as grouped_data
        FROM ${CLAIMS_TABLE} c
        ${clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : ''}
        GROUP BY c.claim_id
    `;

    return { query, params };
};

// Add this new function after the existing functions
const savedFilterQueryBuilder = async (filterId, req, res) => {
    try {
        // Get both claims_ids and conditions from saved filter
        const filterQuery = `
            SELECT claims_ids, conditions, name, description, is_favorite, created_by, last_updated
            FROM saved_filters 
            WHERE filter_id = $1
        `;
        const result = await pool.query(filterQuery, [filterId]);
        
        if (result.rows.length === 0) {
            throw new Error('Filter not found');
        }

        // Get the saved filter data
        const savedFilter = result.rows[0];
        const filterConfig = savedFilter.conditions;
        const claimIds = savedFilter.claims_ids;

        // Extract conditions from the saved filter
        const conditions = filterConfig.originalPayload || 
                         (Array.isArray(filterConfig) ? filterConfig : []);

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

        return await getClaims(req, res);
    } catch (err) {
        console.error('Error in savedFilterQueryBuilder:', err);
        res.status(500).json({
            error: 'Error loading saved filter',
            details: err.message,
            stack: err.stack
        });
    }
};

// Update getClaims to include conditions in response
const getClaims = async (req, res) => {
    console.log('Received filter request:', {
        method: req.method,
        body: req.body,
        query: req.query,
        savedFilterQuery: req.savedFilterQuery
    });

    const client = await pool.connect();
    try {
        // Get pagination params, ensuring defaults if undefined
        const page = parseInt(req.savedFilterQuery?.page || req.query.page || req.body?.page || 1);
        const limit = parseInt(req.savedFilterQuery?.limit || req.query.limit || req.body?.limit || 10);
        const offset = (page - 1) * limit;

        // Determine which conditions to use
        let baseQuery, params, isSavedFilter = false;
        
        // Check for conditions in both POST body and query params
        const conditions = req.body.conditions || 
                         (req.query.conditions ? JSON.parse(req.query.conditions) : null);

        if (conditions) {
            // Use conditions from either POST or GET
            const { query: builtQuery, params: queryParams } = buildFilterQuery(conditions);
            baseQuery = builtQuery;
            params = queryParams;
        } else if (req.savedFilterQuery) {
            // Use saved filter query
            baseQuery = req.savedFilterQuery.baseQuery;
            params = req.savedFilterQuery.params;
            isSavedFilter = true;
        } else {
            // Default query for initial load
            baseQuery = `
                SELECT 
                    c.claim_id,
                    jsonb_agg(
                        to_jsonb(c.*)
                        ORDER BY c.line_id
                    ) as grouped_data
                FROM ${CLAIMS_TABLE} c
                GROUP BY c.claim_id
            `;
            params = [];
        }

        // Use the optimized query builder
        const combinedQuery = buildOptimizedCombinedQuery(baseQuery, conditions, limit, offset);

        // Execute the query with parameters
        const result = await client.query(combinedQuery, params);

        if (!result.rows || result.rows.length === 0) {
            return res.json({
                claims: [],
                statistics: {
                    uniqueClaimIds: 0,
                    totalRecords: 0,
                    dateRange: { min: null, max: null },
                    totalAllowedAmount: 0
                },
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: 0
                },
                savedFilterData: req.savedFilterData
            });
        }

        const { statistics, claims } = result.rows[0];
        const totalCount = isSavedFilter && !req.body.conditions && params[0] 
            ? params[0].length 
            : parseInt(statistics.uniqueClaimIds || 0);

        // Return response with exact same structure as before
        res.json({
            claims: claims || [],
            statistics: {
                uniqueClaimIds: parseInt(statistics.uniqueClaimIds),
                totalRecords: parseInt(statistics.totalRecords),
                dateRange: {
                    min: statistics.dateRange.min,
                    max: statistics.dateRange.max
                },
                totalAllowedAmount: parseFloat(statistics.totalAllowedAmount)
            },
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            },
            savedFilterData: req.savedFilterData
        });

    } catch (error) {
        console.error('Error in getClaims:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Update this function with the simpler query and parameterized values
const getClaimsSchema = async () => {
    const query = `
        SELECT 
            column_name, 
            data_type 
        FROM 
            information_schema.columns 
        WHERE 
            table_name = $1
        ORDER BY ordinal_position;
    `;
    
    try {
        const result = await pool.query(query, [CLAIMS_TABLE]);
        return result.rows;
    } catch (error) {
        console.error('Error fetching claims schema:', error);
        throw error;
    }
};

// Helper function to map Postgres types to frontend types
const mapPostgresTypeToFrontend = (postgresType) => {
    const typeMapping = {
        'character varying': 'string',
        'varchar': 'string',
        'text': 'string',
        'integer': 'number',
        'numeric': 'number',
        'decimal': 'number',
        'double precision': 'number',
        'boolean': 'boolean',
        'date': 'date',
        'timestamp': 'date',
        'timestamp with time zone': 'date',
        'timestamp without time zone': 'date'
    };

    return typeMapping[postgresType.toLowerCase()] || 'string';
};

// Add this new handler function
const getClaimsDataTypes = async (req, res) => {
    try {
        const { keyColumn } = req.query;
        const schema = await getClaimsSchema();
        
        // Filter out the key column if provided
        const filteredSchema = keyColumn 
            ? schema.filter(col => col.column_name !== keyColumn)
            : schema;

        res.json({
            success: true,
            data: filteredSchema.map(col => ({
                column: col.column_name,
                type: mapPostgresTypeToFrontend(col.data_type)
            }))
        });
    } catch (error) {
        console.error('Error fetching claims data types:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
};

// Add test function at the end of the file, before module.exports
const testOperators = async () => {
    const client = await pool.connect();
    try {
        console.log('=== Testing Filter Operators ===');
        
        // Test cases for each operator
        const testCases = [
            {
                name: 'equals',
                condition: {
                    column: 'claim_id',
                    operator: 'equals',
                    value: '00HUIYNB'
                }
            },
            {
                name: 'contains',
                condition: {
                    column: 'claim_id',
                    operator: 'contains',
                    value: 'HUI'
                }
            },
            {
                name: 'starts_with',
                condition: {
                    column: 'claim_id',
                    operator: 'starts_with',
                    value: '00'
                }
            },
            {
                name: 'ends_with',
                condition: {
                    column: 'claim_id',
                    operator: 'ends_with',
                    value: 'YNB'
                }
            },
            {
                name: 'is_null',
                condition: {
                    column: 'claim_type',
                    operator: 'is_null',
                    value: null
                }
            },
            {
                name: 'is_not_null',
                condition: {
                    column: 'claim_id',
                    operator: 'is_not_null',
                    value: null
                }
            },
            {
                name: 'greater_than',
                condition: {
                    column: 'allowed_amount',
                    operator: 'greater_than',
                    value: '3000'
                }
            },
            {
                name: 'less_than',
                condition: {
                    column: 'allowed_amount',
                    operator: 'less_than',
                    value: '5000'
                }
            },
            {
                name: 'between',
                condition: {
                    column: 'allowed_amount',
                    operator: 'between',
                    value: '3000',
                    secondValue: '5000'
                }
            },
            {
                name: 'before',
                condition: {
                    column: 'admission_date',
                    operator: 'before',
                    value: '2023-01-01'
                }
            },
            {
                name: 'after',
                condition: {
                    column: 'admission_date',
                    operator: 'after',
                    value: '2022-01-01'
                }
            }
        ];

        // Test each operator
        for (const testCase of testCases) {
            console.log(`\nTesting operator: ${testCase.name}`);
            
            const { query, params } = buildFilterQuery([testCase.condition]);
            console.log('Query:', query);
            console.log('Params:', params);

            try {
                const result = await client.query(query, params);
                console.log(`Results for ${testCase.name}:`, {
                    rowCount: result.rows.length,
                    sampleRow: result.rows[0]
                });
            } catch (error) {
                console.error(`Error testing ${testCase.name}:`, error);
            }
        }

    } catch (error) {
        console.error('Error in operator testing:', error);
    } finally {
        client.release();
    }
};

// Add route handler for testing
const runOperatorTests = async (req, res) => {
    try {
        await testOperators();
        res.json({ message: 'Operator tests completed. Check server logs for results.' });
    } catch (error) {
        res.status(500).json({ error: 'Error running operator tests', details: error.message });
    }
};

const getDiagnosisCodes = async (req, res) => {
  const client = await pool.connect();
  try {
    const { ingestedIds } = req.body;

    if (!ingestedIds || !Array.isArray(ingestedIds) || ingestedIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty ingested IDs array' });
    }

    // First, verify the ingested data records exist and are of type 'lut'
    const verifyQuery = `
      SELECT ingested_data_id, name, type 
      FROM ingested_data 
      WHERE ingested_data_id = ANY($1) AND type = 'lut'
    `;
    const verifyResult = await client.query(verifyQuery, [ingestedIds]);

    const query = `
      SELECT DISTINCT le.value as diagnosis_code, i.name as ingested_name, i.ingested_data_id
      FROM lut_entries le
      INNER JOIN ingested_data i ON le.ingestion_id = i.ingested_data_id
      WHERE i.ingested_data_id = ANY($1)
      AND i.type = 'lut'
      ORDER BY i.ingested_data_id, le.value
    `;

    const result = await client.query(query, [ingestedIds]);

    // Group diagnosis codes by ingested data
    const groupedData = result.rows.reduce((acc, row) => {
      if (!acc[row.ingested_name]) {
        acc[row.ingested_name] = {
          ingested_data_id: row.ingested_data_id,
          diagnosis_codes: []
        };
      }
      acc[row.ingested_name].diagnosis_codes.push(row.diagnosis_code);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedData
    });

  } catch (error) {
    console.error('Error fetching diagnosis codes:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    client.release();
  }
};

const deleteFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { name } = req.params;
        
        // Delete the filter
        const result = await client.query(
            'DELETE FROM saved_filters WHERE name = $1 RETURNING *',
            [name]
        );
        
        if (result.rows.length === 0) {
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
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,
    savedFilterQueryBuilder,
    runOperatorTests,
    getDiagnosisCodes,
    deleteFilter,
    deleteAllFilters
};