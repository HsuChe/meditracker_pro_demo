import { checkConnection, getTableNames } from '../app/lib/db';

async function testConnection() {
  console.log('\n=== Environment Information ===');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'not set (defaults to development)');
  console.log('Database:', process.env.POSTGRES_DATABASE);
  console.log('Host:', process.env.POSTGRES_HOST);
  console.log('Claims Table:', process.env.CLAIMS_TABLE);
  console.log('============================\n');

  try {
    // Test basic connection
    const isConnected = await checkConnection();
    console.log('Connection test:', isConnected ? 'SUCCESS' : 'FAILED');

    if (isConnected) {
      // Try to list tables
      console.log('\nAttempting to list tables...');
      const tables = await getTableNames();
      console.log('Tables found:', tables.map(t => t.table_name).join(', '));
    }
  } catch (error) {
    console.error('Error testing connection:', error);
  }
}

testConnection().catch(console.error); 