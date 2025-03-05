/**
 * Fix for allowed_amount data type issue
 * 
 * This script:
 * 1. Alters the claims_dummy table to ensure allowed_amount is DECIMAL(10,2)
 * 2. Updates existing data to convert string values to numeric
 * 3. Adds a patch to the ingestedDataController.js to properly handle numeric types
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configure database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || null,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'meditracker',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Log connection info (masking password)
console.log('Database connection info:');
console.log('  Host:', process.env.POSTGRES_HOST || 'localhost');
console.log('  Port:', process.env.POSTGRES_PORT || 5432);
console.log('  Database:', process.env.POSTGRES_DB || 'meditracker');
console.log('  User:', process.env.POSTGRES_USER || 'postgres');
console.log('  SSL:', process.env.POSTGRES_SSL === 'true' ? 'enabled' : 'disabled');

async function fixAllowedAmountType() {
  const client = await pool.connect();
  
  try {
    console.log('Starting allowed_amount data type fix...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // 1. Check current column type
    const columnCheck = await client.query(`
      SELECT data_type, column_name
      FROM information_schema.columns
      WHERE table_name = 'claims_dummy' AND column_name = 'allowed_amount'
    `);
    
    if (columnCheck.rows.length === 0) {
      throw new Error('allowed_amount column not found in claims_dummy table');
    }
    
    const currentType = columnCheck.rows[0].data_type;
    console.log(`Current allowed_amount data type: ${currentType}`);
    
    // 2. If not already DECIMAL, alter the column
    if (currentType !== 'numeric') {
      console.log('Altering allowed_amount column to DECIMAL(10,2)...');
      
      // First, create a temporary column
      await client.query(`
        ALTER TABLE claims_dummy 
        ADD COLUMN allowed_amount_numeric DECIMAL(10,2)
      `);
      
      // Update the temporary column with converted values
      console.log('Converting existing string values to numeric...');
      await client.query(`
        UPDATE claims_dummy
        SET allowed_amount_numeric = 
          CASE 
            WHEN allowed_amount IS NULL THEN NULL
            WHEN allowed_amount = '' THEN NULL
            WHEN allowed_amount ~ '^[0-9]+(\.[0-9]+)?$' THEN allowed_amount::DECIMAL(10,2)
            ELSE NULL
          END
      `);
      
      // Drop the original column and rename the new one
      await client.query(`
        ALTER TABLE claims_dummy DROP COLUMN allowed_amount;
        ALTER TABLE claims_dummy RENAME COLUMN allowed_amount_numeric TO allowed_amount;
      `);
      
      console.log('Column type successfully changed to DECIMAL(10,2)');
    } else {
      console.log('Column is already DECIMAL type, no need to alter');
    }
    
    // 3. Patch the ingestedDataController.js file to properly handle numeric types
    console.log('Patching ingestedDataController.js...');
    
    const controllerPath = path.join(__dirname, '..', 'backend', 'controllers', 'ingestedDataController.js');
    
    // Check if file exists
    if (!fs.existsSync(controllerPath)) {
      console.log('Warning: ingestedDataController.js not found at expected path');
      console.log('Please manually update the controller to properly handle numeric types');
    } else {
      // Create backup
      fs.copyFileSync(controllerPath, `${controllerPath}.bak`);
      console.log(`Backup created at ${controllerPath}.bak`);
      
      // Read file
      let content = fs.readFileSync(controllerPath, 'utf8');
      
      // Find the createIngestedData function and modify it
      const insertPattern = /const query = `INSERT INTO claims_dummy[\s\S]*?await client\.query\(query, \[\.\.\.\s*values,\s*ingestionId\]\);/;
      
      const newInsertCode = `const query = \`INSERT INTO claims_dummy 
         (\${columns.join(', ')}, ingestion_id)
         VALUES (\${columns.map((_, i) => \`$\${i + 1}\`).join(', ')}, $\${columns.length + 1})\`;
      
      // Ensure numeric types are properly handled
      const typedValues = values.map((value, i) => {
        const column = columns[i];
        const constraints = columnConstraints[column];
        
        // If column is numeric/decimal type and value is not null, ensure it's a number
        if (constraints && 
            (constraints.dataType === 'numeric' || constraints.dataType === 'decimal') && 
            value !== null) {
          return Number(value);
        }
        return value;
      });
      
      await client.query(query, [...typedValues, ingestionId]);`;
      
      // Replace the code
      content = content.replace(insertPattern, newInsertCode);
      
      // Write the updated file
      fs.writeFileSync(controllerPath, content);
      console.log('ingestedDataController.js successfully patched');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Fix completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing allowed_amount data type:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixAllowedAmountType()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 