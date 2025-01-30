// filterController.js
const pool = require('../config/db.config');

const VALID_OPERATORS = new Set([
    'equals', 'notEquals', 'contains', 'doesNotContain', 
    'startsWith', 'endsWith', 'matchesRegex', 'isIn', 
    'isNotIn', 'isNull', 'isNotNull', 'greaterThan',
    'lessThan', 'greaterThanEquals', 'lessThanEquals',
    'between', 'percentageOfTotal', 'before', 'after',
    'daysSince'
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

        // Build base query from conditions or use default
        const { query: baseQuery, params } = conditions?.length > 0 
            ? buildFilterQuery(conditions)
            : { query: 'SELECT * FROM claims_dummy', params: [] };

        // Get metadata for the filtered (or all) records
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
                currentPage: parseInt(page),
                totalPages: Math.ceil(parseInt(stats.total_records) / limit),
                pageSize: parseInt(limit),
                dateRange: {
                    start: stats.start_date,
                    end: stats.end_date
                }
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
    let query = 'SELECT * FROM claims_dummy WHERE ';
    let params = [];
    let paramCount = 1;

    const clauses = conditions.map(condition => {
        const { column, operator, value, secondValue } = condition;
        
        // String operators
        if (operator === 'equals') {
            params.push(value);
            return `${column} = $${paramCount++}`;
        } else if (operator === 'notEquals') {
            params.push(value);
            return `${column} != $${paramCount++}`;
        } else if (operator === 'contains') {
            params.push(`%${value}%`);
            return `${column} ILIKE $${paramCount++}`;
        } else if (operator === 'doesNotContain') {
            params.push(`%${value}%`);
            return `${column} NOT ILIKE $${paramCount++}`;
        } else if (operator === 'startsWith') {
            params.push(`${value}%`);
            return `${column} ILIKE $${paramCount++}`;
        } else if (operator === 'endsWith') {
            params.push(`%${value}`);
            return `${column} ILIKE $${paramCount++}`;
        } else if (operator === 'matchesRegex') {
            params.push(value);
            return `${column} ~ $${paramCount++}`;
        } else if (operator === 'isIn') {
            const values = Array.isArray(value) ? value : [value];
            params.push(values);
            return `${column} = ANY($${paramCount++})`; 
        } else if (operator === 'isNotIn') {
            const values = Array.isArray(value) ? value : [value];
            params.push(values);
            return `${column} != ALL($${paramCount++})`;
        } else if (operator === 'isNull') {
            return `${column} IS NULL`;
        } else if (operator === 'isNotNull') {
            return `${column} IS NOT NULL`;
        }
        
        // Numeric operators
        else if (operator === 'greaterThan') {
            params.push(value);
            return `${column} > $${paramCount++}`;
        } else if (operator === 'lessThan') {
            params.push(value);
            return `${column} < $${paramCount++}`;
        } else if (operator === 'greaterThanEquals') {
            params.push(value);
            return `${column} >= $${paramCount++}`;
        } else if (operator === 'lessThanEquals') {
            params.push(value);
            return `${column} <= $${paramCount++}`;
        } else if (operator === 'between') {
            params.push(value, secondValue);
            return `${column} BETWEEN $${paramCount++} AND $${paramCount++}`;
        } else if (operator === 'percentageOfTotal') {
            params.push(value);
            return `(${column} * 100.0 / (SELECT SUM(${column}) FROM claims_dummy)) > $${paramCount++}`;
        }
        
        // Date operators
        else if (operator === 'before') {
            params.push(value);
            return `${column}::date < $${paramCount++}::date`;
        } else if (operator === 'after') {
            params.push(value);
            return `${column}::date > $${paramCount++}::date`;
        } else if (operator === 'daysSince') {
            params.push(value);
            return `DATE_PART('day', NOW() - ${column}::date) > $${paramCount++}`;
        }
        
        // Default equals operator
        params.push(value);
        return `${column} = $${paramCount++}`;
    });

    // If no conditions, return all records
    if (clauses.length === 0) {
        return {
            query: 'SELECT * FROM claims_dummy',
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
        const { limit = 10, offset = 0 } = req.query;
        
        // Get paginated records with offset
        const result = await client.query(
            `SELECT * FROM claims_dummy 
             ORDER BY claim_merged_id 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json(result.rows);
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

// Keep the count endpoint for pagination
const getClaimsCount = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT COUNT(*) FROM claims_dummy');
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting claims count:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    } finally {
        client.release();
    }
};

// Add this new function to get total statistics
const getClaimsMetadata = async (req, res) => {
    const client = await pool.connect();
    try {
        const statsQuery = `
            SELECT 
                SUM(COALESCE(allowed_amount, 0)) as total_amount,
                AVG(COALESCE(allowed_amount, 0)) as average_amount,
                COUNT(DISTINCT patient_id) as unique_patients
            FROM claims_dummy
        `;
        const result = await client.query(statsQuery);
        const stats = result.rows[0];

        res.json({
            totalAmount: parseFloat(stats.total_amount || 0),
            averageAmount: parseFloat(stats.average_amount || 0),
            uniquePatients: parseInt(stats.unique_patients || 0)
        });
    } catch (error) {
        console.error('Error getting claims metadata:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    } finally {
        client.release();
    }
};

module.exports = {
    getSavedFilters,
    saveFilter,
    executeFilter,
    updateFilterClaimsIds,
    getClaims,
    getClaimsCount,
    getClaimsMetadata
};