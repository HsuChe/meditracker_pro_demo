import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load development environment variables
config({
  path: path.resolve(process.cwd(), '.env.development')
});

async function setupLocalDb() {
  // Create a client to connect to the default postgres database
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: 'postgres' // Connect to default database first
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create the database if it doesn't exist
    const dbName = process.env.POSTGRES_DB;
    try {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created successfully`);
    } catch (error: any) {
      if (error.code === '42P04') {
        console.log(`Database ${dbName} already exists`);
      } else {
        throw error;
      }
    }

    // Close connection to postgres database
    await client.end();

    // Connect to our newly created database
    const appClient = new Client({
      host: process.env.POSTGRES_HOST,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: dbName
    });

    await appClient.connect();
    console.log(`Connected to ${dbName} database`);

    // Create extensions if needed
    await appClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('Extensions created successfully');

    await appClient.end();
    console.log('Local database setup completed successfully');

  } catch (error) {
    console.error('Error setting up local database:', error);
    process.exit(1);
  }
}

setupLocalDb();