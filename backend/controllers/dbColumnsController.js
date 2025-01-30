const pool = require('../config/db.config');

const getColumns = async (req, res) => {
    try {
        console.log('Attempting to fetch table columns');
        
        // Query to get column names from the claims table
        const query = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'claims' 
            ORDER BY ordinal_position;
        `;
        
        const result = await pool.query(query);
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