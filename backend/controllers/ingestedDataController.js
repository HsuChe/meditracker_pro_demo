const pool = require('../config/db.config');

const getIngestedData = async (req, res) => {
  const { page = 1, pageSize = 50, name, fromDate, toDate } = req.query;
  const offset = (page - 1) * pageSize;

  try {
    let query = 'SELECT * FROM ingested_data WHERE 1=1';
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
      query.replace('SELECT *', 'SELECT COUNT(*)'),
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
  const client = await pool.connect();
  try {
    const { name, data, mapping_id, record_count, file_size_bytes } = req.body;

    // Debug logging
    console.log('Received request:', {
      name,
      mapping_id,
      record_count,
      file_size_bytes,
      dataLength: data?.length,
      sampleRow: data?.[0]
    });

    // Input validation
    if (!name || !data || !mapping_id || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid input data',
        details: 'Required fields: name, data (array), mapping_id'
      });
    }

    // Verify mapping exists
    const mappingCheck = await client.query(
      'SELECT id, mappings FROM saved_mappings WHERE id = $1',
      [mapping_id]
    );

    if (mappingCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid mapping ID' });
    }

    await client.query('BEGIN');

    try {
      // 1. Insert ingestion record
      const ingestionResult = await client.query(
        `INSERT INTO ingested_data 
         (name, mapping_id, record_count, file_size_bytes, ingestion_date, 
          activity_status, processing_status, type)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 
                'active', 'processing', 'claims')
         RETURNING ingested_data_id`,
        [name, mapping_id, record_count, file_size_bytes]
      );

      const ingestionId = ingestionResult.rows[0].ingested_data_id;

      // 2. Insert transformed data into claims_dummy
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const columns = Object.keys(row);
        const values = Object.values(row);
        
        // Debug logging for the first row
        if (i === 0) {
          console.log('First row insert:', {
            columns,
            values,
            query: `INSERT INTO claims_dummy 
              (${columns.join(', ')}, ingestion_id)
              VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})`
          });
        }

        await client.query(
          `INSERT INTO claims_dummy 
           (${columns.join(', ')}, ingestion_id)
           VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})`,
          [...values, ingestionId]
        );
      }

      // 3. Update ingestion status to completed
      await client.query(
        `UPDATE ingested_data 
         SET processing_status = 'completed'
         WHERE ingested_data_id = $1`,
        [ingestionId]
      );

      // 4. Update last_used timestamp on the mapping
      await client.query(
        'UPDATE saved_mappings SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
        [mapping_id]
      );

      await client.query('COMMIT');
      
      res.status(201).json({
        ingestion_id: ingestionId,
        records_processed: data.length,
        status: 'completed'
      });

    } catch (error) {
      console.error('Database operation failed:', {
        error: error.message,
        detail: error.detail,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ingested data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: error.code
    });
  } finally {
    client.release();
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

const deleteIngestion = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { deleted_by, deletion_reason } = req.body; // Add these to the request

    // First, copy records to the deleted_claims_log before deleting
    await client.query(`
      INSERT INTO deleted_claims_log (
        claim_dummy_id, claim_id, line_id, ingestion_id, 
        deleted_by, deletion_reason, record_data
      )
      SELECT 
        id, claim_id, line_id, ingestion_id,
        $1, $2, row_to_json(claims_dummy)
      FROM claims_dummy
      WHERE ingestion_id = $3
    `, [deleted_by || 'system', deletion_reason || 'Ingestion deleted', id]);

    // Then delete the claims
    await client.query(
      'DELETE FROM claims_dummy WHERE ingestion_id = $1',
      [id]
    );
    
    // Delete the ingestion record
    await client.query(
      'DELETE FROM ingested_data WHERE ingested_data_id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    res.json({ message: 'Ingestion and associated claims deleted successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteIngestion:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const clearAllIngestions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete all claims from claims_dummy table
    await client.query('DELETE FROM claims_dummy');
    
    // Delete all records from ingested_data table
    await client.query('DELETE FROM ingested_data');
    
    await client.query('COMMIT');
    res.json({ message: 'All ingestion data cleared successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing ingestion data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Add a function to query deleted records
const getDeletedRecords = async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 50, 
      startDate, 
      endDate, 
      ingestionId 
    } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [];
    let whereClause = '';

    if (startDate && endDate) {
      params.push(startDate, endDate);
      whereClause += `deleted_at BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    if (ingestionId) {
      if (whereClause) whereClause += ' AND ';
      params.push(ingestionId);
      whereClause += `ingestion_id = $${params.length}`;
    }

    if (whereClause) whereClause = 'WHERE ' + whereClause;

    const query = `
      SELECT * FROM deleted_claims_log
      ${whereClause}
      ORDER BY deleted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(query, [...params, pageSize, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deleted records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getIngestedData,
  getIngestedDataById,
  createIngestedData,
  updateIngestedDataStatus,
  deleteIngestion,
  clearAllIngestions,
  getDeletedRecords
}; 