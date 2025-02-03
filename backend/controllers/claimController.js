// controllers/claimController.js
const pool = require('../config/db.config');
const format = require('pg-format');

const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_merged';

// Utility function to get table metadata
const getTableMetadata = async (client) => {
    try {
        // Get primary key column
        const pkQuery = `
            SELECT a.attname as column_name
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
                AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass
            AND i.indisprimary;
        `;
        const pkResult = await client.query(pkQuery, [CLAIMS_TABLE]);
        const primaryKeyColumn = pkResult.rows[0]?.column_name;

        // Get all columns
        const columnsQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `;
        const columnsResult = await client.query(columnsQuery, [CLAIMS_TABLE]);
        const columns = columnsResult.rows;

        return {
            primaryKeyColumn,
            columns
        };
    } catch (error) {
        console.error('Error getting table metadata:', error);
        throw error;
    }
};

// Get claims with pagination and optional filters
const getClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        const { page = 1, limit = 100, sortBy = 'claim_id', sortOrder = 'ASC' } = req.query;
        const offset = (page - 1) * limit;

        const metadata = await getTableMetadata(client);
        const { primaryKeyColumn } = metadata;

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM ${CLAIMS_TABLE}`;
        const countResult = await client.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated records
        const query = `
            SELECT * FROM ${CLAIMS_TABLE}
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT $1 OFFSET $2
        `;
        const result = await client.query(query, [limit, offset]);

        res.json({
            records: result.rows,
            metadata: {
                totalRecords: totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                pageSize: parseInt(limit),
                primaryKeyColumn,
                columns: metadata.columns
            }
        });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

// Get a single claim by ID
const getClaimById = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const metadata = await getTableMetadata(client);
        const { primaryKeyColumn } = metadata;

        const query = `
            SELECT * FROM ${CLAIMS_TABLE}
            WHERE ${primaryKeyColumn} = $1
        `;
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching claim:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

// Create a new claim
const createClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const metadata = await getTableMetadata(client);
        const { columns } = metadata;

        // Filter out primary key if it's serial/auto-increment
        const insertableColumns = columns.filter(col => 
            !col.column_name.endsWith('_id') || 
            !['serial', 'bigserial'].includes(col.data_type.toLowerCase())
        );

        const columnNames = insertableColumns.map(col => col.column_name);
        const values = columnNames.map(col => req.body[col]);
        const placeholders = columnNames.map((_, i) => `$${i + 1}`);

        const query = `
            INSERT INTO ${CLAIMS_TABLE} (${columnNames.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *;
        `;

        const result = await client.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating claim:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

// Update an existing claim
const updateClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const metadata = await getTableMetadata(client);
        const { primaryKeyColumn, columns } = metadata;

        // Filter out primary key from updates
        const updatableColumns = columns.filter(col => col.column_name !== primaryKeyColumn);
        const updates = [];
        const values = [];
        let paramCount = 1;

        updatableColumns.forEach(col => {
            if (req.body[col.column_name] !== undefined) {
                updates.push(`${col.column_name} = $${paramCount}`);
                values.push(req.body[col.column_name]);
                paramCount++;
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(id);
        const query = `
            UPDATE ${CLAIMS_TABLE}
            SET ${updates.join(', ')}
            WHERE ${primaryKeyColumn} = $${paramCount}
            RETURNING *;
        `;

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating claim:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

// Delete a claim
const deleteClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const metadata = await getTableMetadata(client);
        const { primaryKeyColumn } = metadata;

        const query = `
            DELETE FROM ${CLAIMS_TABLE}
            WHERE ${primaryKeyColumn} = $1
            RETURNING *;
        `;
        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Claim not found' });
        }

        res.json({ message: 'Claim deleted successfully', deletedClaim: result.rows[0] });
    } catch (error) {
        console.error('Error deleting claim:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

// Get table metadata (useful for frontend)
const getClaimsMetadata = async (req, res) => {
    const client = await pool.connect();
    try {
        const metadata = await getTableMetadata(client);
        res.json(metadata);
    } catch (error) {
        console.error('Error fetching claims metadata:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getClaims,
    getClaimById,
    createClaim,
    updateClaim,
    deleteClaim,
    getClaimsMetadata
};