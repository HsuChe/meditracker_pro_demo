const pool = require('../config/db.config');

const getDbColumns = async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'claims_dummy'
        ORDER BY column_name ASC;
    `);
    
    const columns = result.rows.map(row => row.column_name);
    res.json(columns);
  } catch (error) {
    console.error('Error fetching database columns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDbColumns
}; 