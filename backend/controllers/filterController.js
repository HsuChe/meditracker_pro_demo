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

// Save a new filter
const saveFilter = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, description, conditions } = req.body;
        
        // Debug logging
        console.log('Saving filter:', { name, description });
        console.log('Conditions:', JSON.stringify(conditions, null, 2));
        
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
            console.log('Invalid conditions format:', conditions);
            return res.status(400).json({ 
                error: 'Invalid conditions format',
                details: 'Conditions must be an array'
            });
        }

        // Validate each condition
        for (const condition of conditions) {
            console.log('Validating condition:', condition);
            
            if (!condition.column || !condition.operator) {
                console.log('Missing required fields in condition:', condition);
                return res.status(400).json({
                    error: 'Invalid condition format',
                    details: 'Each condition must have column and operator'
                });
            }
            if (!VALID_OPERATORS.has(condition.operator)) {
                console.log('Invalid operator:', condition.operator);
                console.log('Valid operators:', Array.from(VALID_OPERATORS));
                return res.status(400).json({
                    error: 'Invalid operator',
                    details: `Operator "${condition.operator}" is not valid. Valid operators are: ${Array.from(VALID_OPERATORS).join(', ')}`
                });
            }
        }

        // Execute the filter to get matching claims_ids
        const { query, params } = buildFilterQuery(conditions);
        const claimsResult = await client.query(
            `SELECT claim_merged_id FROM (${query}) AS filtered_claims`,
            params
        );

        const claims_ids = claimsResult.rows.map(row => row.claim_merged_id);

        // Insert new filter with the matched claims_ids
        const result = await client.query(
            `INSERT INTO saved_filters 
             (name, description, conditions, claims_ids, created_by)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
             RETURNING *`,
            [
                name, 
                description, 
                JSON.stringify(conditions), // Explicitly stringify the conditions
                JSON.stringify(claims_ids), // Explicitly stringify the claims_ids
                req.user?.username || 'system'
            ]
        );

        await client.query('COMMIT');
        
        res.status(201).json({
            ...result.rows[0],
            matched_claims_count: claims_ids.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving filter:', err);
        console.error('Failed request body:', req.body);
        
        // Better error handling
        if (err.code === '22P02') {
            return res.status(400).json({ 
                error: 'Invalid JSON format',
                details: err.detail
            });
        }
        
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

// Main endpoint that uses the built query
const getClaims = async (req, res) => {
    console.log('Received filter request:', {
        method: req.method,
        body: req.body,
        query: req.query,
        conditions: req.method === 'POST' ? req.body.conditions : [],
        page: req.method === 'POST' ? req.body.page : req.query.page,
        limit: req.method === 'POST' ? req.body.limit : req.query.limit
    });

    const client = await pool.connect();
    try {
        // Get pagination params, ensuring defaults if undefined
        const page = parseInt(req.method === 'POST' ? req.body.page : req.query.page) || 1;
        const limit = parseInt(req.method === 'POST' ? req.body.limit : req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Get conditions only from POST requests
        const conditions = req.method === 'POST' ? (req.body.conditions || []) : [];

        // Get the base query from buildFilterQuery
        const { query: baseQuery, params, whereClauses } = conditions.length > 0 
            ? buildFilterQuery(conditions)
            : { 
                query: `
                    SELECT 
                        c.claim_id,
                        jsonb_agg(
                            to_jsonb(c.*)
                        ) as grouped_data
                    FROM ${CLAIMS_TABLE} c
                    GROUP BY c.claim_id
                    ORDER BY c.claim_id
                `, 
                params: [],
                whereClauses: []
            };

        console.log('Executing query with:', {
            baseQuery,
            params,
            page,
            limit,
            offset
        });

        // Add pagination to the base query
        const paginatedQuery = `
            WITH base_results AS (
                ${baseQuery}
            )
            SELECT *
            FROM base_results
            LIMIT ${limit} OFFSET ${offset}
        `;

        // Get statistics using the same conditions
        const statsQuery = `
            WITH filtered_data AS (
                SELECT c.*
                FROM ${CLAIMS_TABLE} c
                ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
            )
            SELECT 
                COUNT(DISTINCT claim_id) as unique_claim_ids,
                COUNT(*) as total_records,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date,
                SUM(allowed_amount) as total_allowed_amount
            FROM filtered_data
        `;

        // Execute both queries
        const [results, stats] = await Promise.all([
            client.query(paginatedQuery, params),
            client.query(statsQuery, params)
        ]);

        // Return the structure that page.tsx expects
        res.json({
            claims: results.rows,
            statistics: {
                uniqueClaimIds: parseInt(stats.rows[0].unique_claim_ids),
                totalRecords: parseInt(stats.rows[0].total_records),
                dateRange: {
                    min: stats.rows[0].min_date,
                    max: stats.rows[0].max_date
                },
                totalAllowedAmount: parseFloat(stats.rows[0].total_allowed_amount)
            },
            pagination: {
                total: parseInt(stats.rows[0].unique_claim_ids),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(stats.rows[0].unique_claim_ids) / limit)
            }
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

// Update the exports
module.exports = {
    getSavedFilters,
    saveFilter,
    executeFilter,
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,
};