const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Log the database configuration (with password hidden)
console.log('Database Config:', {
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  port: process.env.POSTGRES_PORT,
  ssl: { rejectUnauthorized: true }
});

// Create a new pool using the environment variables
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  ssl: {
    rejectUnauthorized: false, // For Neon DB
  },
  connectionTimeoutMillis: 5000, // Connection timeout
  query_timeout: 10000 // Query timeout
});

// Add connection error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
router.get('/test-db', async (req, res) => {
  let client;
  console.log('Attempting database connection test...');
  console.log('Connection details:', {
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    port: process.env.POSTGRES_PORT
  });
  
  try {
    // Try to connect and run a simple query
    client = await pool.connect();
    console.log('Successfully connected to database');
    const result = await client.query('SELECT current_timestamp, current_database(), version()');
    
    console.log('Query result:', result.rows[0]);
    res.json({
      status: 'success',
      message: 'Successfully connected to Neon DB',
      data: {
        timestamp: result.rows[0].current_timestamp,
        database: result.rows[0].current_database,
        version: result.rows[0].version
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error.message,
      details: {
        code: error.code,
        hint: error.hint
      }
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Get table names
router.get('/tables', async (req, res) => {
  console.log('Attempting to fetch tables...');
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    client.release();

    console.log('Found tables:', result.rows);
    res.json({
      status: 'success',
      tables: result.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tables',
      error: error.message
    });
  }
});

module.exports = router; 