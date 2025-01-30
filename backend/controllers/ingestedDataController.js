const pool = require('../config/db.config');

const getIngestedData = async (req, res) => {
  const { page = 1, pageSize = 50, name, fromDate, toDate } = req.query;
  const offset = (page - 1) * pageSize;

  try {
    // First get the count with a simpler query
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ingested_data i
      WHERE i.parent_ingestion_id IS NULL
    `;
    
    const countParams = [];
    let paramCount = 1;

    if (name) {
      countQuery += ` AND i.name ILIKE $${paramCount}`;
      countParams.push(`%${name}%`);
      paramCount++;
    }

    if (fromDate) {
      countQuery += ` AND i.ingestion_date >= $${paramCount}`;
      countParams.push(fromDate);
      paramCount++;
    }

    if (toDate) {
      countQuery += ` AND i.ingestion_date <= $${paramCount}`;
      countParams.push(toDate);
      paramCount++;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Then get the data
    let query = `
      SELECT 
        i.*,
        COALESCE(b.batch_count, 0) as batch_count
      FROM ingested_data i
      LEFT JOIN (
        SELECT parent_ingestion_id, COUNT(*) as batch_count
        FROM ingested_data
        WHERE parent_ingestion_id IS NOT NULL
        GROUP BY parent_ingestion_id
      ) b ON i.ingested_data_id = b.parent_ingestion_id
      WHERE i.parent_ingestion_id IS NULL
    `;
    
    const params = [];
    let queryParamCount = 1;

    if (name) {
      query += ` AND i.name ILIKE $${queryParamCount}`;
      params.push(`%${name}%`);
      queryParamCount++;
    }

    if (fromDate) {
      query += ` AND i.ingestion_date >= $${queryParamCount}`;
      params.push(fromDate);
      queryParamCount++;
    }

    if (toDate) {
      query += ` AND i.ingestion_date <= $${queryParamCount}`;
      params.push(toDate);
      queryParamCount++;
    }

    query += ` ORDER BY i.ingestion_date DESC LIMIT $${queryParamCount} OFFSET $${queryParamCount + 1}`;
    const parentResults = await pool.query(query, [...params, pageSize, offset]);

    // Fetch batch details for each parent
    const batchDetails = await Promise.all(
      parentResults.rows.map(async parent => {
        const batchQuery = `
          SELECT *
          FROM ingested_data
          WHERE parent_ingestion_id = $1
          ORDER BY batch_number
        `;
        const batchResult = await pool.query(batchQuery, [parent.ingested_data_id]);
        return {
          ...parent,
          batches: batchResult.rows
        };
      })
    );

    res.json({
      records: batchDetails,
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(totalCount / pageSize),
        totalRecords: totalCount
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
    const { 
      name, 
      data, 
      mapping_id, 
      record_count, 
      file_size_bytes,
      batch_number,
      total_batches,
      parent_ingestion_id  // This will be null for first batch
    } = req.body;

    await client.query('BEGIN');

    // If this is the first batch (batch_number === 1), create parent record
    let parentId = parent_ingestion_id;
    if (batch_number === 1) {
      const parentResult = await client.query(
        `INSERT INTO ingested_data 
         (name, mapping_id, record_count, file_size_bytes, ingestion_date, 
          activity_status, processing_status, type)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 
                'active', 'processing', 'claims')
         RETURNING ingested_data_id`,
        [name, mapping_id, record_count * total_batches, file_size_bytes * total_batches]
      );
      parentId = parentResult.rows[0].ingested_data_id;
    }

    // Insert batch record
    const ingestionResult = await client.query(
      `INSERT INTO ingested_data 
       (name, mapping_id, record_count, file_size_bytes, ingestion_date, 
        activity_status, processing_status, type, 
        batch_number, total_batches, parent_ingestion_id)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 
              'active', 'processing', 'claims',
              $5, $6, $7)
       RETURNING ingested_data_id`,
      [name, mapping_id, record_count, file_size_bytes, 
       batch_number, total_batches, parentId]
    );

    const ingestionId = ingestionResult.rows[0].ingested_data_id;

    // Insert claims data
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const columns = Object.keys(row);
      const values = Object.values(row);
      
      await client.query(
        `INSERT INTO claims_dummy 
         (${columns.join(', ')}, ingestion_id)
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})`,
        [...values, ingestionId]
      );
    }

    // Update status if this is the last batch
    if (batch_number === total_batches) {
      await client.query(
        `UPDATE ingested_data 
         SET processing_status = 'completed'
         WHERE ingested_data_id = $1 OR ingested_data_id = $2`,
        [parentId, ingestionId]
      );
    } else {
      await client.query(
        `UPDATE ingested_data 
         SET processing_status = 'completed'
         WHERE ingested_data_id = $1`,
        [ingestionId]
      );
    }

    await client.query('COMMIT');
    
    res.status(201).json({
      ingestion_id: ingestionId,
      parent_ingestion_id: parentId,
      records_processed: data.length,
      status: 'completed'
    });

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
    
    // First delete all claims data
    await client.query('DELETE FROM claims_dummy');
    
    // Then delete all ingestion records
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