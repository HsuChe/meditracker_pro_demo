import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load development environment variables
config({
  path: path.resolve(process.cwd(), '.env.development')
});

async function testDatabase() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB
  });

  try {
    await client.connect();
    console.log('Database connection successful');

    // List all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\nAvailable tables:');
    result.rows.forEach(row => console.log(`- ${row.table_name}`));

    // Show sample data from claims_dummy
    console.log('\nSample claims data:');
    const claimsResult = await client.query('SELECT * FROM claims_dummy LIMIT 3');
    console.log(claimsResult.rows);

    // Show sample mappings
    console.log('\nSample mappings:');
    const mappingsResult = await client.query('SELECT * FROM saved_mappings LIMIT 2');
    console.log(mappingsResult.rows);

    await client.end();
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();