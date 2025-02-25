import { sql } from '@vercel/postgres';
import { config } from 'dotenv';
import path from 'path';

// Load production environment variables
config({
  path: path.resolve(process.cwd(), '.env.production')
});

async function testProductionDatabase() {
  try {
    // Test connection
    await sql`SELECT 1`;
    console.log('Production database connection successful');

    // List all tables
    const { rows } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\nAvailable tables in production:');
    rows.forEach(row => console.log(`- ${row.table_name}`));

    // Show sample data counts for existing tables
    console.log('\nTable row counts:');
    const countResults = await sql`
      SELECT 
        (SELECT COUNT(*) FROM claims_dummy) as claims_count,
        (SELECT COUNT(*) FROM saved_mappings) as mappings_count,
        (SELECT COUNT(*) FROM filter_groups) as filter_groups_count;
    `;
    
    console.log(countResults.rows[0]);

  } catch (error) {
    console.error('Production database test failed:', error);
    process.exit(1);
  }
}

testProductionDatabase();