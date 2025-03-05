// Fix production schema to match development/test environments
require('dotenv').config({ path: `.env.production` });
const { Client } = require('pg');

// Common SSL configuration for Neon
const sslConfig = {
  sslmode: 'require',
  ssl: true
};

async function fixProductionSchema() {
  console.log('Connecting to production database to fix schema...');
  
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'ep-frosty-bush-a5vlnqz9-pooler.us-east-2.aws.neon.tech',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'neondb_owner',
    password: process.env.POSTGRES_PASSWORD || 'npg_UlA3uXVIYQy2',
    database: process.env.POSTGRES_DATABASE || 'neondb',
    ...sslConfig
  });

  try {
    await client.connect();
    console.log('Connected to production database');

    // Check if ingestion_date column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ingested_data' AND column_name = 'ingestion_date'
    `);

    if (checkResult.rows.length === 0) {
      console.log('Adding ingestion_date column to ingested_data table...');
      
      // Add ingestion_date column with default value of created_at
      await client.query(`
        ALTER TABLE ingested_data 
        ADD COLUMN ingestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      
      // Update existing rows to set ingestion_date = created_at
      await client.query(`
        UPDATE ingested_data 
        SET ingestion_date = created_at 
        WHERE ingestion_date IS NULL
      `);
      
      console.log('Successfully added ingestion_date column');
    } else {
      console.log('ingestion_date column already exists');
    }

    // Check if updated_at column exists
    const checkUpdatedAtResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ingested_data' AND column_name = 'updated_at'
    `);

    if (checkUpdatedAtResult.rows.length === 0) {
      console.log('Adding updated_at column to ingested_data table...');
      
      // Add updated_at column with default value
      await client.query(`
        ALTER TABLE ingested_data 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      
      console.log('Successfully added updated_at column');
    } else {
      console.log('updated_at column already exists');
    }

    console.log('Schema fix completed successfully');
  } catch (error) {
    console.error('Error fixing schema:', error);
  } finally {
    await client.end();
  }
}

fixProductionSchema(); 