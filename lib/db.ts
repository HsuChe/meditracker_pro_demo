import { sql } from '@vercel/postgres';
import { Client, QueryResult, QueryResultRow } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment-specific variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

// Database configuration for direct PostgreSQL connection (development)
export const dbConfig = {
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
};

// Get a PostgreSQL client for development environment
export async function getClient() {
  const client = new Client(dbConfig);
  await client.connect();
  return client;
}

// Use Vercel Postgres for production environment
export async function query<T extends QueryResultRow>(query: string, values?: any[]): Promise<QueryResult<T>> {
  if (process.env.NODE_ENV === 'production') {
    // Use Vercel Postgres in production
    const result = await sql.query<T>(query, values);
    return result;
  } else {
    // Use direct PostgreSQL connection in development
    const client = await getClient();
    try {
      const result = await client.query<T>(query, values);
      return result;
    } finally {
      await client.end();
    }
  }
}

// Helper function to check database connection
export async function checkConnection() {
  try {
    if (process.env.NODE_ENV === 'production') {
      await sql`SELECT 1`;
    } else {
      const client = await getClient();
      await client.query('SELECT 1');
      await client.end();
    }
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Helper function to get table names
export async function getTableNames(): Promise<{ table_name: string }[]> {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  
  if (process.env.NODE_ENV === 'production') {
    const result = await sql.query<{ table_name: string }>(query);
    return result.rows;
  } else {
    const client = await getClient();
    try {
      const result = await client.query<{ table_name: string }>(query);
      return result.rows;
    } finally {
      await client.end();
    }
  }
}

// Helper function to execute a transaction
export async function executeTransaction<T extends QueryResultRow>(queries: string[]): Promise<QueryResult<T>[]> {
  if (process.env.NODE_ENV === 'production') {
    // For production, execute queries in sequence since Vercel Postgres doesn't support transactions
    const results: QueryResult<T>[] = [];
    for (const query of queries) {
      const result = await sql.query<T>(query);
      results.push(result);
    }
    return results;
  } else {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const results: QueryResult<T>[] = [];
      for (const query of queries) {
        const result = await client.query<T>(query);
        results.push(result);
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
}