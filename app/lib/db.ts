import { Client, QueryResult, QueryResultRow, QueryConfig } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production'
  : process.env.NODE_ENV === 'test'
  ? '.env.test'
  : '.env';  // default to local development

console.log(`Using database config from: ${envFile} (${process.env.NODE_ENV} environment)`);

config({ path: path.resolve(process.cwd(), envFile) });

// For production, use the full connection URL which includes SSL config
const productionConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
};

// For local development and testing, use individual config parameters
const localConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE
};

// Use the appropriate config based on environment
export const dbConfig = process.env.NODE_ENV === 'production' ? productionConfig : localConfig;

// Get a new database client
export async function getClient(): Promise<Client> {
  const client = new Client(dbConfig);
  await client.connect();
  return client;
}

// Execute a query
export async function query<T extends QueryResultRow = any>(
  query: string | QueryConfig,
  values?: any[]
): Promise<QueryResult<T>> {
  const client = await getClient();
  try {
    if (typeof query === 'string') {
      return await client.query<T>(query, values);
    } else {
      return await client.query<T>(query);
    }
  } finally {
    await client.end();
  }
}

// Check database connection
export async function checkConnection(): Promise<boolean> {
  try {
    const client = await getClient();
    await client.end();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

// Get all table names in the database
export async function getTableNames(): Promise<{ table_name: string }[]> {
  const sql = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
  `;
  const result = await query<{ table_name: string }>(sql);
  return result.rows;
}

// Execute multiple queries in a transaction
export async function executeTransaction<T extends QueryResultRow = any>(
  queries: (string | QueryConfig)[]
): Promise<QueryResult<T>[]> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const results: QueryResult<T>[] = [];
    
    for (const query of queries) {
      if (typeof query === 'string') {
        const result = await client.query<T>(query);
        results.push(result);
      } else {
        const result = await client.query<T>(query);
        results.push(result);
      }
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}