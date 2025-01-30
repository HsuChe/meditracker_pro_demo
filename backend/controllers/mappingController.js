const pool = require('../config/db.config');

const getMappings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sm.*, 
             COUNT(id.mapping_id) as usage_count
      FROM saved_mappings sm
      LEFT JOIN ingested_data id ON sm.id = id.mapping_id
      GROUP BY sm.id
      ORDER BY sm.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMappingById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM saved_mappings WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }
    
    // Update last_used timestamp
    await pool.query(
      'UPDATE saved_mappings SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching mapping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createMapping = async (req, res) => {
  try {
    const { name, mappings } = req.body;

    // Check if name already exists
    const existingMapping = await pool.query(
      'SELECT id FROM saved_mappings WHERE name = $1',
      [name]
    );

    if (existingMapping.rows.length > 0) {
      return res.status(400).json({ error: 'Mapping name already exists' });
    }

    const result = await pool.query(
      `INSERT INTO saved_mappings (name, mappings)
       VALUES ($1, $2)
       RETURNING *`,
      [name, JSON.stringify(mappings)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating mapping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteMapping = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if mapping is in use
    const mappingCheck = await pool.query(
      'SELECT is_in_use FROM saved_mappings WHERE id = $1',
      [id]
    );

    if (mappingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    if (mappingCheck.rows[0].is_in_use) {
      return res.status(400).json({ error: 'Cannot delete mapping that is in use' });
    }

    await pool.query('DELETE FROM saved_mappings WHERE id = $1', [id]);
    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateMappingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_in_use } = req.body;

    // Check if mapping is being used in any ingested_data
    const usageCheck = await pool.query(
      'SELECT COUNT(*) FROM ingested_data WHERE mapping_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot modify status of mapping that is in use' });
    }

    const result = await pool.query(
      'UPDATE saved_mappings SET is_in_use = $1 WHERE id = $2 RETURNING *',
      [is_in_use, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating mapping status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMappings,
  getMappingById,
  createMapping,
  deleteMapping,
  updateMappingStatus
}; 