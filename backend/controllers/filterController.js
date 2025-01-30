// filterController.js
const pool = require('../config/db.config');

const getSavedFilters = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM saved_filters ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching saved filters:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const saveFilter = async (req, res) => {
    const { filter_name, conditions, claims_ids } = req.body;
    
    try {
        // Ensure claims_ids is an array and contains only numbers
        const validatedClaimsIds = Array.isArray(claims_ids) 
            ? claims_ids.map(Number).filter(id => !isNaN(id))
            : [];

        const result = await pool.query(
            'INSERT INTO saved_filters (name, conditions, claims_ids, created_at, last_updated) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            [
                filter_name,
                JSON.stringify(conditions),
                JSON.stringify(validatedClaimsIds)
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error saving filter:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteFilter = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM saved_filters WHERE id = $1', [id]);
        res.json({ message: 'Filter deleted successfully' });
    } catch (err) {
        console.error('Error deleting filter:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateClaimsIds = async (req, res) => {
    const { filterId, claims_ids } = req.body;
    
    // Add input validation
    if (!filterId || !Array.isArray(claims_ids)) {
        console.error('Invalid input:', { filterId, claims_ids });
        return res.status(400).json({ 
            error: 'Invalid input', 
            details: 'filterId and claims_ids array are required' 
        });
    }

    try {
        // Ensure claims_ids is an array of numbers
        const validatedClaimsIds = claims_ids
            .map(id => Number(id))
            .filter(id => !isNaN(id));

        // Add logging to help debug
        console.log('Updating filter:', {
            filterId,
            validatedClaimsIds,
            claimsIdsJson: JSON.stringify(validatedClaimsIds)
        });

        const result = await pool.query(
            `UPDATE saved_filters 
             SET claims_ids = $1::jsonb, 
                 last_updated = CURRENT_TIMESTAMP 
             WHERE id = $2 
             RETURNING *`,
            [JSON.stringify(validatedClaimsIds), filterId]
        );

        if (result.rows.length === 0) {
            console.error('Filter not found:', filterId);
            return res.status(404).json({ 
                error: 'Filter not found',
                filterId 
            });
        }

        // Add logging for successful update
        console.log('Successfully updated filter:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        // Detailed error logging
        console.error('Database error:', {
            error: err.message,
            stack: err.stack,
            query: err.query
        });
        res.status(500).json({ 
            error: 'Failed to update claims_ids',
            details: err.message 
        });
    }
};

module.exports = {
    getSavedFilters,
    saveFilter,
    deleteFilter,
    updateClaimsIds
};