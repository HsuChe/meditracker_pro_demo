const pool = require('../config/db.config');

const getIngestedData = async (req, res) => {
  const { page = 1, pageSize = 50, name, fromDate, toDate, type } = req.query;
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

    if (type) {
      countQuery += ` AND i.type = $${paramCount}`;
      countParams.push(type);
      paramCount++;
    }

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

    if (type) {
      query += ` AND i.type = $${queryParamCount}`;
      params.push(type);
      queryParamCount++;
    }

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

// Function to fetch column constraints from the database
const getColumnConstraints = async (client, tableName) => {
  const query = `
    SELECT 
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      pg_get_constraintdef(con.oid) as check_constraint
    FROM information_schema.columns c
    LEFT JOIN pg_constraint con ON con.conrelid = (SELECT oid FROM pg_class WHERE relname = $1)
    AND con.contype = 'c'
    AND array_position(con.conkey, c.ordinal_position) IS NOT NULL
    WHERE c.table_name = $1;
  `;
  
  const result = await client.query(query, [tableName]);
  return result.rows.reduce((acc, row) => {
    if (!acc[row.column_name]) {
      acc[row.column_name] = {
        dataType: row.data_type,
        maxLength: row.character_maximum_length,
        precision: row.numeric_precision,
        scale: row.numeric_scale,
        isNullable: row.is_nullable === 'YES',
        checkConstraints: []
      };
    }
    if (row.check_constraint) {
      acc[row.column_name].checkConstraints.push(row.check_constraint);
    }
    return acc;
  }, {});
};

// Function to validate and transform a value based on constraints
const validateAndTransformValue = (value, column, constraints) => {
  if (value === '' || value === 'null' || value === 'nan' || value === undefined || value === null) {
    return constraints.isNullable ? null : value;
  }

  const strValue = String(value);

  switch (constraints.dataType) {
    case 'timestamp':
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      if (!value || value === '' || value === 'null' || value === 'nan') return null;
      try {
        // Handle numeric timestamps (Unix timestamps)
        if (!isNaN(value)) {
          const timestamp = new Date(Number(value) * 1000);
          if (timestamp.toString() === 'Invalid Date') return null;
          return timestamp.toISOString();
        }
        // Handle string dates
        const timestamp = new Date(value);
        if (timestamp.toString() === 'Invalid Date') return null;
        return timestamp.toISOString();
      } catch (e) {
        console.log(`WARNING: Invalid timestamp value: ${value}`);
        return null;
      }

    case 'date':
      if (!value || value === '' || value === 'null' || value === 'nan') return null;
      try {
        // Handle numeric dates (Unix timestamps)
        if (!isNaN(value)) {
          const date = new Date(Number(value) * 1000);
          if (date.toString() === 'Invalid Date') return null;
          return date.toISOString().split('T')[0];
        }
        // Handle string dates
        const date = new Date(value);
        if (date.toString() === 'Invalid Date') return null;
        return date.toISOString().split('T')[0];
      } catch (e) {
        console.log(`WARNING: Invalid date value: ${value}`);
        return null;
      }

    case 'boolean':
      if (['t', 'true', '1', 'y', 'yes'].includes(strValue.toLowerCase())) return true;
      if (['f', 'false', '0', 'n', 'no'].includes(strValue.toLowerCase())) return false;
      return null;

    case 'integer':
    case 'bigint':
      const num = Number(value);
      if (isNaN(num)) return null;
      
      // Check numeric constraints if they exist
      for (const constraint of constraints.checkConstraints) {
        if (constraint.includes('BETWEEN') || constraint.includes('>=') || constraint.includes('<=')) {
          const [min, max] = constraint.match(/\d+/g).map(Number);
          if (num < min || num > max) return null;
        }
      }
      // Ensure we're returning a number, not a string
      return Math.floor(num);

    case 'numeric':
    case 'decimal':
      const decNum = Number(value);
      if (isNaN(decNum)) return null;
      // Ensure we're returning a number, not a string
      return decNum;

    case 'character varying':
      // Check length constraint
      if (constraints.maxLength && strValue.length > constraints.maxLength) {
        return null;
      }
      
      // Check pattern constraints if they exist
      for (const constraint of constraints.checkConstraints) {
        if (constraint.includes('~')) {
          const pattern = constraint.match(/'([^']+)'/)[1];
          if (!new RegExp(pattern).test(strValue)) return null;
        } else if (constraint.includes('IN')) {
          const values = constraint.match(/'([^']+)'/g).map(v => v.replace(/'/g, ''));
          if (!values.includes(strValue)) return null;
        } else if (constraint.includes('>=') && constraint.includes('<=')) {
          const [min, max] = constraint.match(/'\d+'/g).map(v => v.replace(/'/g, ''));
          if (strValue < min || strValue > max) return null;
        }
      }
      return strValue;

    default:
      return value;
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
      parent_ingestion_id
    } = req.body;

    console.log(`Starting ingestion process for batch ${batch_number}/${total_batches} with ${data.length} records`);

    await client.query('BEGIN');

    // Get column constraints
    console.log('Fetching column constraints...');
    const columnConstraints = await getColumnConstraints(client, 'claims_dummy');
    console.log(`Retrieved constraints for ${Object.keys(columnConstraints).length} columns`);

    // If this is the first batch (batch_number === 1), create parent record
    let parentId = parent_ingestion_id;
    if (batch_number === 1) {
      console.log('Creating parent ingestion record...');
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
      console.log(`Created parent ingestion record with ID: ${parentId}`);
    } else {
      console.log(`Using existing parent ingestion ID: ${parentId}`);
    }

    // Insert batch record
    console.log('Creating batch ingestion record...');
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
    console.log(`Created batch ingestion record with ID: ${ingestionId}`);

    // Define numeric columns that need special handling
    const numericColumns = [
      'total_charges', 
      'allowed_amount', 
      'amount_paid', 
      'balance_due', 
      'lab_service_charge', 
      'line_charges'
    ];

    const integerColumns = [
      'units_days',
      'place_of_service',
      'provider_id',
      'facility_id',
      'patient_id'
    ];

    // Insert claims data
    console.log(`Starting to insert ${data.length} claims records...`);
    const startTime = Date.now();
    let insertedCount = 0;
    let lastLogTime = startTime;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const columns = Object.keys(row);
      
      const values = Object.entries(row).map(([column, value]) => {
        const constraints = columnConstraints[column];
        if (!constraints) return value; // Column not found in constraints
        
        return validateAndTransformValue(value, column, constraints);
      });
      
      // Ensure numeric types are properly handled
      const typedValues = values.map((value, i) => {
        const column = columns[i];
        
        // Skip null values
        if (value === null || value === undefined || value === '') {
          return null;
        }
        
        // Handle numeric columns
        if (numericColumns.includes(column)) {
          return Number(value);
        }
        
        // Handle integer columns
        if (integerColumns.includes(column)) {
          return parseInt(value, 10);
        }
        
        return value;
      });
      
      const query = `INSERT INTO claims_dummy 
         (${columns.join(', ')}, ingestion_id)
         VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1})`;
      
      console.log(`Inserting data with proper type handling for ${columns.length} columns`);
      await client.query(query, [...typedValues, ingestionId]);
      
      insertedCount++;
      
      // Log progress every 100 records or 5 seconds
      const currentTime = Date.now();
      if (insertedCount % 100 === 0 || currentTime - lastLogTime > 5000) {
        const elapsedSeconds = (currentTime - startTime) / 1000;
        const recordsPerSecond = insertedCount / elapsedSeconds;
        console.log(`Progress: ${insertedCount}/${data.length} records inserted (${Math.round(insertedCount/data.length*100)}%) - ${recordsPerSecond.toFixed(2)} records/sec`);
        lastLogTime = currentTime;
      }
    }

    const totalElapsedSeconds = (Date.now() - startTime) / 1000;
    console.log(`Completed inserting ${insertedCount} records in ${totalElapsedSeconds.toFixed(2)} seconds (${(insertedCount/totalElapsedSeconds).toFixed(2)} records/sec)`);

    // Update status if this is the last batch
    console.log('Updating ingestion status...');
    if (batch_number === total_batches) {
      await client.query(
        `UPDATE ingested_data 
         SET processing_status = 'completed'
         WHERE ingested_data_id = $1 OR ingested_data_id = $2`,
        [parentId, ingestionId]
      );
      console.log(`Updated status to 'completed' for parent (${parentId}) and batch (${ingestionId})`);
    } else {
      await client.query(
        `UPDATE ingested_data 
         SET processing_status = 'completed'
         WHERE ingested_data_id = $1`,
        [ingestionId]
      );
      console.log(`Updated status to 'completed' for batch (${ingestionId})`);
    }

    console.log('Committing transaction...');
    await client.query('COMMIT');
    console.log('Transaction committed successfully');
    
    res.status(201).json({
      ingestion_id: ingestionId,
      parent_ingestion_id: parentId,
      records_processed: data.length,
      status: 'completed'
    });
    console.log(`Ingestion process completed successfully for batch ${batch_number}/${total_batches}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating ingested data:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
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
    const { deleted_by, deletion_reason } = req.body;

    // First check if this is a parent ingestion and get its type
    const ingestionCheck = await client.query(
      `SELECT type, parent_ingestion_id 
       FROM ingested_data 
       WHERE ingested_data_id = $1`,
      [id]
    );

    if (ingestionCheck.rows.length === 0) {
      throw new Error('Ingestion record not found');
    }

    const { type, parent_ingestion_id } = ingestionCheck.rows[0];
    const isParent = parent_ingestion_id === null;

    // If this is a parent record, we need to delete all child records first
    if (isParent) {
      if (type === 'lut') {
        // For LUT ingestions, delete entries first
        await client.query(
          'DELETE FROM lut_entries WHERE ingestion_id = $1',
          [id]
        );
      } else {
        // For claims ingestions, copy to deleted_claims_log first
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
      }

      // Delete all child ingestion records
      await client.query(
        'DELETE FROM ingested_data WHERE parent_ingestion_id = $1',
        [id]
      );
    }
    
    // Finally delete the ingestion record itself
    await client.query(
      'DELETE FROM ingested_data WHERE ingested_data_id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    res.json({ 
      message: `${type === 'lut' ? 'LUT' : 'Ingestion'} and associated ${type === 'lut' ? 'entries' : 'claims'} deleted successfully`,
      deletedId: id
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteIngestion:', error);
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

const deleteIngestionByName = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name } = req.params;
    const { deleted_by, deletion_reason } = req.body;

    // First get all ingestion records with this name
    const ingestionCheck = await client.query(
      `SELECT ingested_data_id, type, parent_ingestion_id 
       FROM ingested_data 
       WHERE name = $1`,
      [name]
    );

    if (ingestionCheck.rows.length === 0) {
      throw new Error('No ingestion records found with this name');
    }

    const type = ingestionCheck.rows[0].type;
    const ingestionIds = ingestionCheck.rows.map(row => row.ingested_data_id);

    if (type === 'lut') {
      // For LUT ingestions, delete entries first
      await client.query(
        'DELETE FROM lut_entries WHERE ingestion_id = ANY($1)',
        [ingestionIds]
      );
    } else {
      // For claims ingestions, copy to deleted_claims_log first
      await client.query(`
        INSERT INTO deleted_claims_log (
          claim_dummy_id, claim_id, line_id, ingestion_id, 
          deleted_by, deletion_reason, record_data
        )
        SELECT 
          id, claim_id, line_id, ingestion_id,
          $1, $2, row_to_json(claims_dummy)
        FROM claims_dummy
        WHERE ingestion_id = ANY($3)
      `, [deleted_by || 'system', deletion_reason || 'Ingestion deleted', ingestionIds]);

      // Then delete the claims
      await client.query(
        'DELETE FROM claims_dummy WHERE ingestion_id = ANY($1)',
        [ingestionIds]
      );
    }

    // Delete all ingestion records with this name
    await client.query(
      'DELETE FROM ingested_data WHERE name = $1',
      [name]
    );
    
    await client.query('COMMIT');
    res.json({ 
      message: `All ${type === 'lut' ? 'LUT' : 'Ingestion'} batches and associated ${type === 'lut' ? 'entries' : 'claims'} deleted successfully`,
      deletedName: name,
      batchesDeleted: ingestionCheck.rows.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteIngestionByName:', error);
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

const clearAllIngestions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // First, copy all claims records to the deleted_claims_log
    await client.query(`
      INSERT INTO deleted_claims_log (
        claim_dummy_id, claim_id, line_id, ingestion_id, 
        deleted_by, deletion_reason, record_data
      )
      SELECT 
        id, claim_id, line_id, ingestion_id,
        'system', 'Bulk deletion - clear all', row_to_json(claims_dummy)
      FROM claims_dummy
    `);

    // Delete LUT entries first due to foreign key constraint
    await client.query('DELETE FROM lut_entries');

    // Delete all claims data
    await client.query('DELETE FROM claims_dummy');
    
    // Delete child ingestion records first (where parent_ingestion_id is not null)
    await client.query(`
      DELETE FROM ingested_data 
      WHERE parent_ingestion_id IS NOT NULL
    `);
    
    // Finally delete parent ingestion records
    await client.query(`
      DELETE FROM ingested_data 
      WHERE parent_ingestion_id IS NULL
    `);
    
    await client.query('COMMIT');
    res.json({ message: 'All ingestion data cleared successfully' });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing ingestion data:', error);
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
  deleteIngestionByName,
  clearAllIngestions,
  getDeletedRecords
}; 