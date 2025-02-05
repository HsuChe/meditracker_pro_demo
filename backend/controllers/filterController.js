// filterController.js
const pool = require('../config/db.config');
const { getAllClaims } = require('../routes/claimRoutes');
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';

// Update VALID_OPERATORS to match frontend operators
const VALID_OPERATORS = new Set([
    'equals', 'contains', 'starts_with', 'ends_with', 
    'is_null', 'is_not_null', 'greater_than', 'less_than',
    'between', 'before', 'after'
]);

// Add this helper function at the top level, before any other functions
const buildWhereClauses = (conditions) => {
    const clauses = [];
    const params = [];

    console.log('Building where clauses for conditions:', conditions);

    conditions.forEach(condition => {
        const { column, operator, value, secondValue } = condition;
        
        // Skip if value is null/undefined (unless it's is_null/is_not_null operator)
        if (value === null && !['is_null', 'is_not_null'].includes(operator)) {
            console.log('Skipping condition with null value:', condition);
            return;
        }

        // Don't add parameter for is_null/is_not_null operators
        if (!['is_null', 'is_not_null'].includes(operator)) {
            params.push(value);
            const paramIndex = params.length;

            // Helper function to determine type casting
            const getTypeCasting = (val) => {
                if (!isNaN(val) && typeof val !== 'boolean') {
                    return 'numeric';
                }
                return 'text';
            };

            const valueType = getTypeCasting(value);

            switch(operator) {
                case 'equals':
                    clauses.push(`${column}::${valueType} = $${paramIndex}::${valueType}`);
                    break;
                case 'contains':
                    clauses.push(`${column}::text ILIKE '%' || $${paramIndex}::text || '%'`);
                    break;
                case 'starts_with':
                    clauses.push(`${column}::text ILIKE $${paramIndex}::text || '%'`);
                    break;
                case 'ends_with':
                    clauses.push(`${column}::text ILIKE '%' || $${paramIndex}::text`);
                    break;
                case 'greater_than':
                    clauses.push(`${column}::${valueType} > $${paramIndex}::${valueType}`);
                    break;
                case 'less_than':
                    clauses.push(`${column}::${valueType} < $${paramIndex}::${valueType}`);
                    break;
                case 'before':
                    clauses.push(`${column}::date < $${paramIndex}::date`);
                    break;
                case 'after':
                    clauses.push(`${column}::date > $${paramIndex}::date`);
                    break;
                case 'between':
                    const secondValueType = getTypeCasting(secondValue);
                    clauses.push(`${column}::${valueType} BETWEEN $${paramIndex}::${valueType} AND $${paramIndex + 1}::${secondValueType}`);
                    if (secondValue !== null) {
                        params.push(secondValue);
                    }
                    break;
                default:
                    console.log('Unsupported operator:', operator);
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

    console.log('Generated clauses and params:', { clauses, params });
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

    console.log('Query building debug:', {
        mainWhereClauses: mainWhere.clauses,
        mainWhereParams: mainWhere.params,
        subWhereClauses: subWhere.clauses,
        subWhereParams: subWhere.params,
        finalQuery: query,
        finalParams: allParams
    });

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
        
        console.log('=== Save Filter Debug ===');
        console.log('1. Incoming payload:', {
            name,
            description,
            conditions: JSON.stringify(conditions, null, 2),
            is_favorite,
            created_by
        });
        
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

        console.log('2. Separated conditions:', {
            mainConditions,
            subKeyConditions
        });

        // Build and execute query to get matching IDs
        const { query: idQuery, params: queryParams } = buildIdQuery(mainConditions, subKeyConditions);

        console.log('3. Query details:', {
            query: idQuery,
            params: queryParams,
            paramCount: queryParams.length,
            mainConditions,
            subKeyConditions
        });

        // Execute query and get matching IDs
        const matchingIds = await client.query(idQuery, queryParams);
        console.log('Query executed successfully');
        const claims_ids = matchingIds.rows.map(row => row.id);
        console.log('4. Matching IDs:', claims_ids);

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

        console.log('5. Insert operation:', {
            params: insertParams,
            paramCount: insertParams.length
        });

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
        console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            query: err.query,
            parameters: err.parameters
        });
        res.status(500).json({ 
            error: 'Internal server error', 
            details: err.message,
            stack: err.stack
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
        console.log('\n' + step + ':', JSON.stringify(data, null, 2));
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
const buildFilterQuery = (mainConditions, subKeyColumn = null, subKeyConditions = []) => {
    // Add detailed logging for query transformation
    console.log('\n=== Query Building Process ===');
    console.log('1. Initial Parameters:', {
        mainConditions: JSON.stringify(mainConditions, null, 2),
        subKeyColumn,
        subKeyConditions: JSON.stringify(subKeyConditions, null, 2)
    });

    const params = [];
    
    // Helper function to build WHERE clauses
    const buildWhereClauses = (conditions) => {
        return conditions.map((condition) => {
            const { column, operator, value } = condition;
            
            // Handle array of values
            if (Array.isArray(value)) {
                console.log(`Building array condition for ${column}:`, value);
                
                switch(operator) {
                    case 'equals':
                        value.forEach(v => params.push(v));
                        const placeholders = value.map((_, i) => `$${params.length - i}`).reverse();
                        return `${column}::text = ANY(ARRAY[${placeholders.join(', ')}]::text[])`;
                    
                    case 'contains':
                        const containsClauses = value.map(v => {
                            params.push(v);
                            return `${column}::text ILIKE '%' || $${params.length}::text || '%'`;
                        });
                        return `(${containsClauses.join(' OR ')})`;
                    
                    default:
                        console.log('Unsupported operator for array values:', operator);
                        return null;
                }
            }
            
            // Handle single value
            params.push(value);
            const paramNum = params.length;
            
            switch(operator) {
                case 'equals':
                    return `${column}::text = $${paramNum}::text`;
                case 'contains':
                    return `${column}::text ILIKE '%' || $${paramNum}::text || '%'`;
                case 'starts_with':
                    return `${column} ILIKE $${paramNum} || '%'`;
                case 'ends_with':
                    return `${column} ILIKE '%' || $${paramNum}`;
                case 'is_null':
                    return `${column} IS NULL`;
                case 'is_not_null':
                    return `${column} IS NOT NULL`;
                case 'greater_than':
                    return `${column} > $${paramNum}`;
                case 'less_than':
                    return `${column} < $${paramNum}`;
                case 'before':
                    return `${column}::date < $${paramNum}::date`;
                case 'after':
                    return `${column}::date > $${paramNum}::date`;
                default:
                    console.log('Unsupported operator:', operator);
                    return null;
            }
        }).filter(Boolean);
    };

    // Build main and sub conditions
    const mainWhereClauses = buildWhereClauses(mainConditions);
    const subWhereClauses = buildWhereClauses(subKeyConditions);

    console.log('2. Generated Where Clauses:', {
        mainWhereClauses: mainWhereClauses.join(' AND '),
        subWhereClauses: subWhereClauses.join(' AND ')
    });

    // If we have a subKeyColumn, build a hierarchical query
    if (subKeyColumn) {
        const mainWhereClause = mainWhereClauses.length > 0 
            ? `WHERE ${mainWhereClauses.join(' AND ')}` 
            : '';

        console.log('3. Building Hierarchical Query:', {
            hasMainConditions: mainWhereClauses.length > 0,
            hasSubConditions: subWhereClauses.length > 0,
            mainWhereClause,
            subKeyColumn
        });

        const finalQuery = `
            WITH matching_claims AS (
                -- First find claims that match the main conditions
                SELECT DISTINCT c1.claim_id
                FROM ${CLAIMS_TABLE} c1
                ${mainWhereClause}
                AND EXISTS (
                    -- Then ensure it has at least one line item matching sub conditions
                    SELECT 1
                    FROM ${CLAIMS_TABLE} c2
                    WHERE c2.claim_id = c1.claim_id
                    ${subWhereClauses.length > 0 ? 'AND ' + subWhereClauses.join(' AND ') : ''}
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
                ${subWhereClauses.length > 0 ? 'AND ' + subWhereClauses.join(' AND ') : ''}
            ) ml ON true
            GROUP BY c.claim_id, c.*
            ORDER BY c.claim_id
        `;

        console.log('4. Final Hierarchical Query Structure:', {
            withClause: 'matching_claims CTE to find parent claims',
            mainSelect: 'Building hierarchical JSON with parent and children',
            joins: 'Using INNER JOIN with matching_claims and LEFT JOIN LATERAL for children',
            grouping: 'Grouped by claim_id and all parent columns',
            parameters: params,
            parameterMapping: params.map((p, i) => `$${i + 1} = ${p}`)
        });

        return { query: finalQuery, params, whereClauses: [...mainWhereClauses, ...subWhereClauses] };
    }

    // Default non-hierarchical query for main conditions only
    const whereClause = mainWhereClauses.length > 0 
        ? `WHERE ${mainWhereClauses.join(' AND ')}` 
        : '';

    const finalQuery = `
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
        ${whereClause}
        GROUP BY c.claim_id
        ORDER BY c.claim_id
    `;

    console.log('Final query:', {
        sql: finalQuery,
        params,
        paramMapping: params.map((p, i) => `$${i + 1} = ${p}`)
    });

    return { query: finalQuery, params, whereClauses: mainWhereClauses };
};

// Add this new function after the existing functions
const savedFilterQueryBuilder = async (filterId, req, res) => {
    try {
        // Update query to get both claims_ids and conditions
        const filterQuery = `
            SELECT claims_ids, conditions
            FROM saved_filters 
            WHERE filter_id = $1
        `;
        const result = await pool.query(filterQuery, [filterId]);
        
        // Store conditions in the request object
        const savedFilter = result.rows[0];
        const conditions = savedFilter.conditions;
        req.savedFilterConditions = conditions;

        // Build query to get claims using those IDs
        const claimIds = savedFilter.claims_ids;
        const query = `
            SELECT 
                c.claim_id,
                COALESCE(
                    jsonb_agg(
                        CASE 
                            WHEN c.claim_id IS NOT NULL THEN to_jsonb(c.*)
                            ELSE NULL
                        END
                        ORDER BY c.line_id
                    ) FILTER (WHERE c.claim_id IS NOT NULL),
                    '[]'::jsonb
                ) as grouped_data
            FROM ${CLAIMS_TABLE} c
            WHERE c.id = ANY($1::int[])
            GROUP BY c.claim_id
            ORDER BY c.claim_id
        `;

        // Modify req object with our query before passing to getClaims
        req.savedFilterQuery = {
            baseQuery: query,
            params: [claimIds],
            page: req.query.page || 1,
            limit: req.query.limit || 10
        };

        // Add conditions to the response data in getClaims
        req.savedFilterData = {
            conditions: conditions
        };

        return await getClaims(req, res);
    } catch (err) {
        console.error('Error in savedFilterQueryBuilder:', err);
        throw err;
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
        const page = parseInt(req.savedFilterQuery?.page || req.query.page || 1);
        const limit = parseInt(req.savedFilterQuery?.limit || req.query.limit || 10);
        const offset = (page - 1) * limit;

        // If this is a POST request with conditions, always use those instead of saved filter
        let query, params;
        if (req.method === 'POST' && req.body.conditions) {
            const conditions = req.body.conditions;
            const { query: baseQuery, params: queryParams } = buildFilterQuery(conditions);
            query = baseQuery;
            params = queryParams;
        } else if (req.savedFilterQuery) {
            // Fall back to saved filter query if no conditions provided
            query = req.savedFilterQuery.baseQuery;
            params = req.savedFilterQuery.params;
        } else {
            // Default query for initial load
            query = `
                SELECT 
                    c.claim_id,
                    jsonb_agg(
                        to_jsonb(c.*)
                    ) as grouped_data
                FROM ${CLAIMS_TABLE} c
                GROUP BY c.claim_id
                ORDER BY c.claim_id
            `;
            params = [];
        }

        // Add pagination to the query
        const paginatedQuery = `
            WITH base_results AS (
                ${query}
            )
            SELECT *
            FROM base_results
            LIMIT ${limit} OFFSET ${offset}
        `;

        // Execute query
        const results = await client.query(paginatedQuery, params);

        // Calculate total count
        let totalCount;
        if (req.savedFilterQuery && !req.body.conditions) {
            totalCount = params[0].length;  // Use length of claims_ids array for saved filters
        } else {
            const countResult = await client.query('SELECT COUNT(DISTINCT claim_id) FROM claims_dummy');
            totalCount = parseInt(countResult.rows[0].count);
        }

        // Calculate statistics from the results
        const stats = calculateStatisticsFromResults(results.rows);

        // Return response
        res.json({
            claims: results.rows,
            statistics: stats,
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

// Add this helper function to calculate statistics
const calculateStatisticsFromResults = (claims) => {
    let uniqueClaimIds = new Set();
    let totalRecords = 0;
    let minDate = null;
    let maxDate = null;
    let totalAllowedAmount = 0;

    claims.forEach(claim => {
        // Count unique claim IDs
        uniqueClaimIds.add(claim.claim_id);

        // Process grouped data
        const groupedData = claim.grouped_data || [];
        totalRecords += groupedData.length;

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
        uniqueClaimIds: uniqueClaimIds.size,
        totalRecords: totalRecords,
        dateRange: {
            min: minDate?.toISOString() || null,
            max: maxDate?.toISOString() || null
        },
        totalAllowedAmount: totalAllowedAmount
    };
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

// Update the exports
module.exports = {
    getSavedFilters,
    saveFilter,
    executeFilter,
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,
    savedFilterQueryBuilder,
};