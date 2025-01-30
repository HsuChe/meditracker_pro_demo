const pool = require('../config/db.config');

const createLUT = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, type, data } = req.body;
    
    // Split data into rows (either from CSV or manual input)
    const entries = type === 'MANUAL' 
      ? data.split('\n').map(line => line.trim()).filter(Boolean)
      : data;

    // Calculate size
    const dataString = entries.join('\n');
    const sizeInBytes = Buffer.byteLength(dataString, 'utf8');

    await client.query('BEGIN');

    // Create LUT record
    const lutResult = await client.query(
      `INSERT INTO lookup_tables (name, type, record_count, file_size_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING lut_id`,
      [name, type, entries.length, sizeInBytes]
    );

    const lutId = lutResult.rows[0].lut_id;

    // Insert entries
    for (const entry of entries) {
      await client.query(
        'INSERT INTO lut_entries (lut_id, value) VALUES ($1, $2)',
        [lutId, entry]
      );
    }

    await client.query('COMMIT');
    res.json({ 
      message: 'LUT created successfully',
      lut_id: lutId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating LUT:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getLUTs = async (req, res) => {
  const { page = 1, pageSize = 50, name, fromDate, toDate } = req.query;
  const offset = (page - 1) * pageSize;

  try {
    let query = `
      SELECT lt.*, COUNT(le.entry_id) as record_count
      FROM lookup_tables lt
      LEFT JOIN lut_entries le ON lt.lut_id = le.lut_id
      WHERE lt.activity_status = 'active'
    `;
    const params = [];
    let paramCount = 1;

    if (name) {
      query += ` AND lt.name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    if (fromDate) {
      query += ` AND lt.ingestion_date >= $${paramCount}`;
      params.push(fromDate);
      paramCount++;
    }

    if (toDate) {
      query += ` AND lt.ingestion_date <= $${paramCount}`;
      params.push(toDate);
      paramCount++;
    }

    query += ` GROUP BY lt.lut_id ORDER BY lt.ingestion_date DESC`;

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) as subquery`,
      params
    );

    // Get paginated data
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    const dataResult = await pool.query(query, [...params, pageSize, offset]);

    res.json({
      records: dataResult.rows,
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
        totalRecords: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching LUTs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLUTDetails = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Get LUT metadata
    const lutResult = await client.query(
      'SELECT * FROM lookup_tables WHERE lut_id = $1',
      [id]
    );

    if (lutResult.rows.length === 0) {
      return res.status(404).json({ error: 'LUT not found' });
    }

    // Get LUT entries
    const entriesResult = await client.query(
      'SELECT * FROM lut_entries WHERE lut_id = $1 ORDER BY entry_id',
      [id]
    );

    res.json({
      ...lutResult.rows[0],
      entries: entriesResult.rows
    });

  } catch (error) {
    console.error('Error fetching LUT details:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const deleteLUT = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Update activity_status to 'deleted' instead of deleting
    const result = await client.query(
      `UPDATE lookup_tables 
       SET activity_status = 'deleted'
       WHERE lut_id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LUT not found' });
    }

    res.json({ 
      message: 'LUT marked as deleted successfully',
      lut: result.rows[0]
    });

  } catch (error) {
    console.error('Error marking LUT as deleted:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getDeletedLUTs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lt.*, COUNT(le.entry_id) as record_count
       FROM lookup_tables lt
       LEFT JOIN lut_entries le ON lt.lut_id = le.lut_id
       WHERE lt.activity_status = 'deleted'
       GROUP BY lt.lut_id
       ORDER BY lt.ingestion_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deleted LUTs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createLUT,
  getLUTs,
  getLUTDetails,
  deleteLUT,
  getDeletedLUTs
}; 