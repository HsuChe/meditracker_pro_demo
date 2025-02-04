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
    const client = await pool.connect();
    try {
        const { conditions, page = 1, limit = 50 } = req.body;
        const offset = (page - 1) * limit;
        const startTime = Date.now();

        // Validate conditions
        if (conditions) {
            conditions.forEach(condition => {
                if (!VALID_OPERATORS.has(condition.operator)) {
                    throw new Error(`Invalid operator: ${condition.operator}`);
                }
            });
        }

        // Build base query from conditions or use default
        const { query: baseQuery, params } = conditions?.length > 0 
            ? buildFilterQuery(conditions)
            : { query: `SELECT * FROM ${CLAIMS_TABLE}`, params: [] };

        // Get metadata for the filtered records
        const statsQuery = `
            WITH filtered_claims AS (${baseQuery})
            SELECT 
                COUNT(*) as total_records,
                SUM(COALESCE(allowed_amount, 0)) as total_amount,
                AVG(COALESCE(allowed_amount, 0)) as average_amount,
                COUNT(DISTINCT patient_id) as unique_patients,
                MIN(admission_date) as start_date,
                MAX(admission_date) as end_date
            FROM filtered_claims
        `;
        const statsResult = await client.query(statsQuery, params);
        const stats = statsResult.rows[0];

        // Get paginated results
        const paginatedQuery = `
            WITH filtered_claims AS (${baseQuery})
            SELECT * FROM filtered_claims
            ORDER BY claim_merged_id
            LIMIT ${limit} OFFSET ${offset}
        `;
        const result = await client.query(paginatedQuery, params);

        res.json({
            records: result.rows,
            metadata: {
                totalRecords: parseInt(stats.total_records),
                totalAmount: parseFloat(stats.total_amount || 0),
                averageAmount: parseFloat(stats.average_amount || 0),
                uniquePatients: parseInt(stats.unique_patients),
                dateRange: {
                    start: stats.start_date,
                    end: stats.end_date
                },
                currentPage: parseInt(page),
                totalPages: Math.ceil(parseInt(stats.total_records) / limit),
                pageSize: parseInt(limit)
            },
            execution_time_ms: Date.now() - startTime
        });

    } catch (error) {
        console.error('Error executing filter:', error);
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
    const whereClauses = conditions.map((condition, index) => {
        const { column, operator, value, secondValue } = condition;
        const paramBase = index * 2 + 1;
        
        switch(operator) {
            case 'equals':
                return `${column} = $${paramBase}`;
            case 'contains':
                return `${column} ILIKE $${paramBase}`;
            case 'starts_with':
                return `${column} ILIKE $${paramBase}`;
            case 'ends_with':
                return `${column} ILIKE $${paramBase}`;
            case 'is_null':
                return `${column} IS NULL`;
            case 'is_not_null':
                return `${column} IS NOT NULL`;
            case 'greater_than':
                return `${column} > $${paramBase}`;
            case 'less_than':
                return `${column} < $${paramBase}`;
            case 'between':
                return `${column} BETWEEN $${paramBase} AND $${paramBase + 1}`;
            case 'before':
                return `${column}::date < $${paramBase}::date`;
            case 'after':
                return `${column}::date > $${paramBase}::date`;
            default:
                throw new Error(`Unsupported operator: ${operator}`);
        }
    }).filter(Boolean);

    const whereClause = whereClauses.length > 0 
        ? `WHERE ${whereClauses.join(' AND ')}` 
        : '';

    return { 
        query: `
            SELECT 
                c.claim_id,
                jsonb_agg(
                    to_jsonb(c.*) - 'claim_id'  -- Include all columns except claim_id to avoid redundancy
                ) as grouped_data
            FROM ${CLAIMS_TABLE} c
            ${whereClause}
            GROUP BY c.claim_id
            ORDER BY c.claim_id
            LIMIT ${limit} OFFSET ${offset}
        `,
        params: conditions
            .filter(c => !['is_null', 'is_not_null'].includes(c.operator))
            .flatMap(c => c.operator === 'between' ? [c.value, c.secondValue] : [c.value])
    };
};

// Main endpoint for getting filtered claims data
const getClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        const { page = 1, limit = 10 } = req.method === 'GET' ? req.query : req.body;
        const conditions = req.method === 'POST' ? req.body.conditions : [];
        const offset = (page - 1) * limit;

        // Build base query
        const { query: baseQuery, params } = conditions?.length > 0 
            ? buildFilterQuery(conditions)
            : { 
                query: `
                    SELECT 
                        c.claim_id,
                        jsonb_agg(
                            to_jsonb(c.*) - 'claim_id'  -- Include all columns except claim_id to avoid redundancy
                        ) as grouped_data
                    FROM ${CLAIMS_TABLE} c
                    GROUP BY c.claim_id
                    ORDER BY c.claim_id
                    LIMIT ${limit} OFFSET ${offset}
                `, 
                params: [] 
            };

        // Update statistics query
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT claim_id) as unique_claim_ids,
                COUNT(*) as total_records,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date
            FROM ${CLAIMS_TABLE}
            ${conditions.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
        `;

        // Execute queries
        const [statsResult, result] = await Promise.all([
            client.query(statsQuery, params),
            client.query(baseQuery, params)
        ]);

        const stats = statsResult.rows[0];

        res.json({
            claims: result.rows,
            statistics: {
                uniqueClaimIds: parseInt(stats.unique_claim_ids) || 0,
                totalRecords: parseInt(stats.total_records) || 0,
                dateRange: {
                    min: stats.min_date || null,
                    max: stats.max_date || null
                }
            },
            pagination: {
                total: parseInt(stats.unique_claim_ids) || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil((parseInt(stats.unique_claim_ids) || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Error in getClaims:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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