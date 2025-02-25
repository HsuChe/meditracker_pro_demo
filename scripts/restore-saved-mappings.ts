import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment-specific variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

async function restoreSavedMappings() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE
  });

  try {
    await client.connect();
    console.log('Connected to database');
    console.log('Using environment:', process.env.NODE_ENV || 'development');

    // Drop existing table if it exists
    await client.query('DROP TABLE IF EXISTS saved_mappings CASCADE;');
    console.log('Dropped existing saved_mappings table if it existed');

    // Create sequence
    await client.query('CREATE SEQUENCE IF NOT EXISTS saved_mappings_id_seq;');
    console.log('Created sequence saved_mappings_id_seq');

    // Create saved_mappings table
    await client.query(`
      CREATE TABLE saved_mappings (
        id INTEGER DEFAULT nextval('saved_mappings_id_seq'::regclass) NOT NULL,
        name VARCHAR(255) NOT NULL,
        mappings JSONB NOT NULL,
        is_in_use BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP WITHOUT TIME ZONE,
        PRIMARY KEY (id)
      );
    `);
    console.log('Created saved_mappings table');

    // Add unique constraint on name
    await client.query(`
      ALTER TABLE saved_mappings 
      ADD CONSTRAINT saved_mappings_name_key UNIQUE (name);
    `);
    console.log('Added unique constraint on name');

    // Create indexes
    await client.query('CREATE INDEX idx_saved_mappings_name ON saved_mappings(name);');
    await client.query('CREATE INDEX idx_saved_mappings_is_in_use ON saved_mappings(is_in_use);');
    await client.query('CREATE INDEX idx_saved_mappings_last_used ON saved_mappings(last_used);');
    console.log('Created indexes');

    // Insert default mapping if needed
    await client.query(`
      INSERT INTO saved_mappings (name, mappings, is_in_use)
      VALUES (
        'Default Mapping',
        '{"claim_id": "claim_id", "patient_id": "patient_id", "diagnosis_code": "diagnosis"}'::jsonb,
        true
      )
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('Inserted default mapping');

    console.log('Successfully restored saved_mappings table');

  } catch (error) {
    console.error('Error restoring saved_mappings table:', error);
    throw error;
  } finally {
    await client.end();
  }
}

restoreSavedMappings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 