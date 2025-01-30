const express = require('express');
const router = express.Router();
const pool = require('../config/db.config');

// Get columns from ingested_data table
router.get('/', async (req, res) => {
    try {
        // Get the column names from the claims_dummy table
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'claims_dummy'
            AND column_name NOT IN ('id', 'ingestion_id', 'created_at', 'updated_at')
            ORDER BY column_name;
        `);
        
        const columns = result.rows.map(row => row.column_name);
        res.json(columns);
    } catch (error) {
        console.error('Error fetching database columns:', error);
        res.status(500).json({ error: 'Failed to fetch database columns' });
    }
});

module.exports = router; 