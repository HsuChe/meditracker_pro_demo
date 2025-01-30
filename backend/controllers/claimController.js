// controllers/claimController.js
const pool = require('../config/db.config');

const getClaims = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM claims_merged LIMIT 100');
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getClaims
};

