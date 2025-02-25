import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });

async function waitForDatabase(maxAttempts = 10, delayMs = 1000): Promise<void> {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: 'claims_db_test'
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('Database is ready');
      return;
    } catch (error) {
      console.log(`Waiting for database (attempt ${attempt}/${maxAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Database not ready after maximum attempts');
}

async function setupTestDatabase() {
  // Connect to postgres to create the test database
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: 'postgres' // Connect to default database first
  });

  try {
    await client.connect();
    
    // Create test database if it doesn't exist
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'claims_db_test'
      AND pid <> pg_backend_pid();
    `);
    
    await client.query('DROP DATABASE IF EXISTS claims_db_test');
    await client.query('CREATE DATABASE claims_db_test');
    
    console.log('Test database created successfully');

    // Wait for the database to be ready
    await waitForDatabase();
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

setupTestDatabase().catch(console.error); 