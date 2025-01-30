const pool = require('../db/db');

const getIngestedData = async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const result = await pool.query(
      'SELECT * FROM ingested_data WHERE activity_status = $1 ORDER BY ingestion_date DESC',
      [status]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ingested data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getIngestedDataById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM ingested_data WHERE ingested_data_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingested data not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ingested data by id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createIngestedData = async (req, res) => {
  try {
    const {
      name,
      type,
      mapping,
      record_count,
      file_size_bytes,
      ingestion_duration_ms
    } = req.body;

    const result = await pool.query(
      `INSERT INTO ingested_data 
       (name, type, mapping, record_count, file_size_bytes, ingestion_duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, type, JSON.stringify(mapping), record_count, file_size_bytes, ingestion_duration_ms]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ingested data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateIngestedDataStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activity_status } = req.body;

    const result = await pool.query(
      'UPDATE ingested_data SET activity_status = $1, updated_at = CURRENT_TIMESTAMP WHERE ingested_data_id = $2 RETURNING *',
      [activity_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ingested data not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ingested data status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getIngestedData,
  getIngestedDataById,
  createIngestedData,
  updateIngestedDataStatus
}; 