import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

export const testDbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DATABASE || 'claims_db_test',
};

// Get a test database client
export async function getTestClient(): Promise<Client> {
  const client = new Client(testDbConfig);
  await client.connect();
  return client;
}

// Initialize test database schema
export async function initTestDb() {
  const client = await getTestClient();
  try {
    // Drop existing tables in correct order
    await client.query(`
      DROP TABLE IF EXISTS filters CASCADE;
      DROP TABLE IF EXISTS filter_groups CASCADE;
      DROP TABLE IF EXISTS claims_dummy CASCADE;
      DROP TABLE IF EXISTS ingested_data CASCADE;
      DROP TABLE IF EXISTS saved_mappings CASCADE;
      DROP TABLE IF EXISTS test_transactions CASCADE;
    `);

    // Create tables in correct order
    await client.query(`
      CREATE TABLE test_transactions (
        id SERIAL PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE saved_mappings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        mapping JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE ingested_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE claims_dummy (
        id SERIAL PRIMARY KEY,
        claim_data JSONB NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE filter_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        filters JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE filters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        conditions JSONB NOT NULL,
        group_id INTEGER REFERENCES filter_groups(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert some initial test data
    await client.query(`
      INSERT INTO filter_groups (name, filters) VALUES 
      ('Test Group 1', '{"conditions": []}'),
      ('Test Group 2', '{"conditions": []}');
    `);
  } catch (error) {
    console.error('Error initializing test database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Clean up test database
export async function cleanupTestDb() {
  const client = await getTestClient();
  try {
    await client.query(`
      DROP TABLE IF EXISTS filters CASCADE;
      DROP TABLE IF EXISTS filter_groups CASCADE;
      DROP TABLE IF EXISTS claims_dummy CASCADE;
      DROP TABLE IF EXISTS ingested_data CASCADE;
      DROP TABLE IF EXISTS saved_mappings CASCADE;
      DROP TABLE IF EXISTS test_transactions CASCADE;
    `);
  } finally {
    await client.end();
  }
}

// Reset test database (clean and reinitialize)
export async function resetTestDb() {
  await cleanupTestDb();
  await initTestDb();
} 