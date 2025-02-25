import { Client } from 'pg';
import 'dotenv/config';

const sslConfig = {
  sslmode: 'require',
  ssl: true
};

async function inspectSchema() {
  const client = new Client({
    host: process.env.PGHOST_UNPOOLED || 'ep-frosty-bush-a5vlnqz9.us-east-2.aws.neon.tech',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'neondb_owner',
    password: process.env.POSTGRES_PASSWORD || 'npg_UlA3uXVIYQy2',
    database: 'claims_db_dummy',
    ...sslConfig
  });

  try {
    await client.connect();
    console.log('Connected to claims_db_dummy database');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables in database:');
    for (const row of tablesResult.rows) {
      console.log(`\n=== Table: ${row.table_name} ===`);
      
      // Get columns for each table
      const columnsResult = await client.query(`
        SELECT 
          column_name, 
          data_type,
          character_maximum_length,
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [row.table_name]);
      
      console.log('Columns:');
      columnsResult.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });

      // Get constraints
      const constraintsResult = await client.query(`
        SELECT con.conname as constraint_name,
               pg_get_constraintdef(con.oid) as constraint_definition
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = $1;
      `, [row.table_name]);

      if (constraintsResult.rows.length > 0) {
        console.log('\nConstraints:');
        constraintsResult.rows.forEach(con => {
          console.log(`  ${con.constraint_name}: ${con.constraint_definition}`);
        });
      }
    }

  } catch (error) {
    console.error('Error inspecting schema:', error);
  } finally {
    await client.end();
  }
}

inspectSchema(); 