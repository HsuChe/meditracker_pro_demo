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
        const { filter_id } = req.params;
        const { page = 1, limit = 50, sortBy = 'claim_merged_id', sortOrder = 'ASC' } = req.query;
        const offset = (page - 1) * limit;
        const startTime = Date.now();

        // Get filter conditions
        const filterResult = await client.query(
            'SELECT * FROM saved_filters WHERE filter_id = $1',
            [filter_id]
        );

        if (filterResult.rows.length === 0) {
            return res.status(404).json({ error: 'Filter not found' });
        }

        const filter = filterResult.rows[0];
        // Parse the conditions as they come as string from database
        const conditions = typeof filter.conditions === 'string' 
            ? JSON.parse(filter.conditions) 
            : filter.conditions;

        // Build and execute query based on conditions
        const { query, params } = buildFilterQuery(conditions);
        
        // Add pagination and sorting
        const paginatedQuery = `
            ${query}
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT $${params.length + 1} 
            OFFSET $${params.length + 2}
        `;
        
        // Get total count
        const countResult = await client.query(
            `SELECT COUNT(*) FROM (${query}) AS filtered_count`,
            params
        );

        // Get paginated results
        const queryResult = await client.query(
            paginatedQuery,
            [...params, limit, offset]
        );

        // Save execution history
        await client.query(
            `INSERT INTO filter_results_history 
             (filter_id, execution_time_ms, results_count, conditions_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [
                filter_id,
                Date.now() - startTime,
                parseInt(countResult.rows[0].count),
                JSON.stringify(conditions)
            ]
        );

        // Update filter metadata
        await client.query(
            `UPDATE saved_filters 
             SET last_run = CURRENT_TIMESTAMP,
                 run_count = run_count + 1,
                 claims_ids = $1
             WHERE filter_id = $2`,
            [JSON.stringify(queryResult.rows.map(r => r.claim_merged_id)), filter_id]
        );

        res.json({
            results: queryResult.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            },
            execution_time_ms: Date.now() - startTime
        });
    } catch (err) {
        console.error('Error executing filter:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
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

module.exports = {
    getSavedFilters,
    saveFilter,
    executeFilter,
    updateFilterClaimsIds
};