// filterController.js
const pool = require('../config/db.config');
const { getAllClaims } = require('../routes/claimRoutes');
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_merged';

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
    let query = `SELECT * FROM ${CLAIMS_TABLE} WHERE `;
    let params = [];
    let paramCount = 1;

    const clauses = conditions.map(condition => {
        const { column, operator, value, secondValue } = condition;
        
        // String operators
        switch(operator) {
            case 'equals':
                params.push(value);
                return `${column} = $${paramCount++}`;
                
            case 'contains':
                params.push(`%${value}%`);
                return `${column} ILIKE $${paramCount++}`;
                
            case 'starts_with':
                params.push(`${value}%`);
                return `${column} ILIKE $${paramCount++}`;
                
            case 'ends_with':
                params.push(`%${value}`);
                return `${column} ILIKE $${paramCount++}`;
                
            case 'is_null':
                return `${column} IS NULL`;
                
            case 'is_not_null':
                return `${column} IS NOT NULL`;
                
            // Numeric operators
            case 'greater_than':
                params.push(value);
                return `${column} > $${paramCount++}`;
                
            case 'less_than':
                params.push(value);
                return `${column} < $${paramCount++}`;
                
            case 'between':
                if (!secondValue) {
                    throw new Error('Second value required for between operator');
                }
                params.push(value, secondValue);
                return `${column} BETWEEN $${paramCount++} AND $${paramCount++}`;
                
            // Date operators
            case 'before':
                params.push(value);
                return `${column}::date < $${paramCount++}::date`;
                
            case 'after':
                params.push(value);
                return `${column}::date > $${paramCount++}::date`;
                
            default:
                throw new Error(`Unsupported operator: ${operator}`);
        }
    });

    // If no conditions, return all records
    if (clauses.length === 0) {
        return {
            query: `SELECT * FROM ${CLAIMS_TABLE}`,
            params: []
        };
    }

    return {
        query: query + clauses.join(' AND '),
        params
    };
};

// Add a new function to update claims_ids
const updateFilterClaimsIds = async (req, res) => {
    const client = await pool.connect();
    try {
        const { filter_id } = req.params;
        
        // Get filter conditions
        const filterResult = await client.query(
            'SELECT conditions FROM saved_filters WHERE filter_id = $1',
            [filter_id]
        );

        if (filterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Filter not found' });
        }

        const { conditions } = filterResult.rows[0];

        // Execute filter to get updated claims_ids
        const { query, params } = buildFilterQuery(conditions);
        const claimsResult = await client.query(
            `SELECT claim_merged_id FROM (${query}) AS filtered_claims`,
            params
        );

        const claims_ids = claimsResult.rows.map(row => row.claim_merged_id);

        // Update the filter with new claims_ids
        await client.query(
            `UPDATE saved_filters 
             SET claims_ids = $1,
                 last_updated = CURRENT_TIMESTAMP
             WHERE filter_id = $2
             RETURNING *`,
            [JSON.stringify(claims_ids), filter_id]
        );

        res.json({
            filter_id,
            updated_claims_count: claims_ids.length,
            message: 'Claims IDs updated successfully'
        });
    } catch (err) {
        console.error('Error updating claims IDs:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
        client.release();
    }
};

// Add this new function to get claims with statistics
const getClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        const { page = 1, limit = 10, filterId } = req.query;
        const offset = (page - 1) * limit;
        
        let baseQuery;
        let params;

        if (filterId) {
            // Get claims based on saved filter
            baseQuery = `
                WITH filter_claims AS (
                    SELECT UNNEST(claims_ids::jsonb[]) as claim_id 
                    FROM saved_filters 
                    WHERE filter_id = $1
                )
                SELECT c.* 
                FROM ${CLAIMS_TABLE} c
                INNER JOIN filter_claims fc ON c.claim_merged_id = fc.claim_id::text`;
            params = [filterId, limit, offset];
        } else {
            // Get all claims
            baseQuery = `SELECT * FROM ${CLAIMS_TABLE}`;
            params = [limit, offset];
        }

        // Get statistics from the filtered dataset (baseQuery)
        const statsQuery = `
            WITH filtered_data AS (${baseQuery})
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT claim_id) as unique_claim_ids,
                SUM(CAST(allowed_amount AS DECIMAL(10,2))) as total_allowed_amount,
                MIN(admission_date) as min_date,
                MAX(admission_date) as max_date
            FROM filtered_data`;

        const statsResult = await client.query(
            statsQuery, 
            filterId ? [filterId] : []
        );
        
        // Get paginated data from the same filtered dataset
        const paginatedQuery = `
            WITH filtered_data AS (${baseQuery})
            SELECT * FROM filtered_data
            ORDER BY claim_merged_id 
            LIMIT $${filterId ? 2 : 1} OFFSET $${filterId ? 3 : 2}`;

        const claimsResult = await client.query(paginatedQuery, params);

        const stats = statsResult.rows[0];
        
        res.json({
            claims: claimsResult.rows,
            statistics: {
                totalRecords: parseInt(stats.total_records),
                uniqueClaimIds: parseInt(stats.unique_claim_ids),
                totalAllowedAmount: parseFloat(stats.total_allowed_amount || 0),
                dateRange: {
                    min: stats.min_date,
                    max: stats.max_date
                }
            },
            pagination: {
                total: parseInt(stats.total_records),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(stats.total_records) / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching claims:', error);
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
    updateFilterClaimsIds,
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,  // Add this new export
};