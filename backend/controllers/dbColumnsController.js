const pool = require('../config/db.config');

const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';

const getColumns = async (req, res) => {
    try {
        console.log('Attempting to fetch table columns');
        console.log('Using table:', CLAIMS_TABLE);
        
        // Query to get column names from the claims table
        const query = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `;
        
        const result = await pool.query(query, [CLAIMS_TABLE]);
        const columns = result.rows.map(row => row.column_name);
        
        console.log('Successfully fetched columns:', columns);
        res.json(columns);
    } catch (error) {
        console.error('Error fetching table columns:', error);
        res.status(500).json({ 
            error: 'Failed to fetch database columns',
            details: error.message 
        });
    }
};

module.exports = {
    getColumns
}; 