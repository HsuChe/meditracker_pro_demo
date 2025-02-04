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
    console.log('Executing filter with request:', {
        body: req.body,
        conditions: req.body.conditions
    });

    const client = await pool.connect();
    try {
        const { conditions } = req.body;

        // Validate conditions
        if (!conditions || !Array.isArray(conditions)) {
            return res.status(400).json({
                error: 'Invalid conditions format',
                details: 'Conditions must be an array'
            });
        }

        // Get query from buildFilterQuery
        const { query, params } = buildFilterQuery(conditions);

        console.log('Executing query:', {
            query,
            params
        });

        // Execute query
        const result = await client.query(query, params);

        // Forward the results to getClaims format
        return getClaims(req, res);

    } catch (error) {
        console.error('Error in executeFilter:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    } finally {
        client.release();
    }
};

// Helper function to build filter query
const buildFilterQuery = (conditions) => {
    console.log('Starting to build query with conditions:', conditions);
    const params = [];
    
    const whereClauses = conditions.map((condition, index) => {
        const { column, operator, value } = condition;
        
        // Handle array of values
        if (Array.isArray(value)) {
            console.log(`Building array condition for ${column}:`, value);
            
            switch(operator) {
                case 'equals':
                    // Add all values to params
                    value.forEach(v => params.push(v));
                    // Create ($1, $2, $3) style placeholders
                    const placeholders = value.map((_, i) => `$${params.length - i}`).reverse();
                    return `${column}::text = ANY(ARRAY[${placeholders.join(', ')}]::text[])`;
                
                case 'contains':
                    // For contains with multiple values, use OR
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
        
        // Handle single value (existing code)
        params.push(value);
        const paramNum = params.length;  // Use params.length for parameter number
        
        console.log(`Building condition for ${column}:`, {
            value,
            paramNum: `$${paramNum}`
        });

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

    const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

    const finalQuery = `
        SELECT 
            c.claim_id,
            jsonb_agg(
                to_jsonb(c.*)
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

    return { query: finalQuery, params, whereClauses };
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
        const schema = await getClaimsSchema();
        res.json({
            success: true,
            data: schema.map(col => ({
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