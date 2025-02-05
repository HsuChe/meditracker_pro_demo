const pool = require('../config/db.config');

const createLUT = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, type, data } = req.body;
    
    // Process data into array of entries
    const entries = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Calculate total size based on entries
    const sizeInBytes = entries.reduce((total, entry) => total + Buffer.byteLength(entry, 'utf8'), 0);

    await client.query('BEGIN');

    console.log('Creating ingested_data record...');
    // Create parent ingestion record
    const parentResult = await client.query(
      `INSERT INTO ingested_data 
       (name, record_count, file_size_bytes, ingestion_date, 
        activity_status, processing_status, type, batch_number, total_batches)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 
              'active', 'completed', $4, 1, 1)
       RETURNING ingested_data_id`,
      [name, entries.length, sizeInBytes, type]
    );

    const ingestionId = parentResult.rows[0].ingested_data_id;
    console.log('Created ingested_data record with ID:', ingestionId);

    // Verify the record exists
    const verifyResult = await client.query(
      'SELECT * FROM ingested_data WHERE ingested_data_id = $1',
      [ingestionId]
    );

    if (!verifyResult.rows.length) {
      throw new Error('Failed to create ingested_data record');
    }

    console.log('Inserting entries into lut_entries...');
    // Insert entries into lut_entries table
    for (const entry of entries) {
      await client.query(
        `INSERT INTO lut_entries (ingestion_id, value)
         VALUES ($1, $2)`,
        [ingestionId, entry]
      );
    }
    console.log('Successfully inserted all entries');

    await client.query('COMMIT');
    res.json({ 
      message: 'LUT created successfully',
      ingestion_id: ingestionId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating LUT:', error);
    // Add more detailed error information
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: error.code,
      constraint: error.constraint
    });
  } finally {
    client.release();
  }
};

const getLUTs = async (req, res) => {
  const { page = 1, pageSize = 50, name, fromDate, toDate } = req.query;
  const offset = (page - 1) * pageSize;

  try {
    let query = `
      SELECT *
      FROM ingested_data
      WHERE type = 'lut'
      AND activity_status = 'active'
      AND parent_ingestion_id IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (name) {
      query += ` AND name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }

    if (fromDate) {
      query += ` AND ingestion_date >= $${paramCount}`;
      params.push(fromDate);
      paramCount++;
    }

    if (toDate) {
      query += ` AND ingestion_date <= $${paramCount}`;
      params.push(toDate);
      paramCount++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${query}) as subquery`,
      params
    );

    // Get paginated data
    query += ` ORDER BY ingestion_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
      'SELECT * FROM ingested_data WHERE ingested_data_id = $1 AND type = \'lut\'',
      [id]
    );

    if (lutResult.rows.length === 0) {
      return res.status(404).json({ error: 'LUT not found' });
    }

    // Get LUT entries from lut_entries table
    const entriesResult = await client.query(
      'SELECT value FROM lut_entries WHERE ingestion_id = $1 ORDER BY entry_id',
      [id]
    );

    const lut = lutResult.rows[0];
    const entries = entriesResult.rows.map(row => row.value);

    res.json({
      ...lut,
      entries
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

    await client.query('BEGIN');

    // Delete entries from lut_entries
    await client.query(
      'DELETE FROM lut_entries WHERE ingestion_id = $1',
      [id]
    );

    // Then update ingestion record status
    const result = await client.query(
      `UPDATE ingested_data 
       SET activity_status = 'deleted'
       WHERE ingested_data_id = $1 AND type = 'lut'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'LUT not found' });
    }

    await client.query('COMMIT');
    res.json({ 
      message: 'LUT marked as deleted successfully',
      lut: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error marking LUT as deleted:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getDeletedLUTs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM ingested_data
       WHERE type = 'lut'
       AND activity_status = 'deleted'
       ORDER BY ingestion_date DESC`
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