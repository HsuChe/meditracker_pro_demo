import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment-specific variables
config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

export async function GET() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  });

  try {
    await client.connect();
    console.log('Connected to database successfully');
    
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM 
        information_schema.columns 
      WHERE 
        table_name = $1
      ORDER BY 
        ordinal_position;
    `;

    const result = await client.query(query, [process.env.CLAIMS_TABLE || 'claims_dummy']);
    console.log(`Found ${result.rows.length} columns`);
    
    return NextResponse.json({
      columns: result.rows,
      message: 'Schema fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching schema:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch schema information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
} 