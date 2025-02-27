// config/db.config.js
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({
    path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

const isProduction = process.env.NODE_ENV === 'production';
console.log('Current environment:', process.env.NODE_ENV);
console.log('Using environment file:', `.env.${process.env.NODE_ENV || 'development'}`);

// Configure SSL for production (Neon DB requires SSL)
const sslConfig = isProduction ? {
    rejectUnauthorized: true,
    require: true
} : false;

// For Render deployment, use DATABASE_URL if available
let poolConfig;

if (process.env.DATABASE_URL && isProduction) {
    // Parse the connection string for Render
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig
    };
    console.log('Using connection string from DATABASE_URL');
} else {
    // Use individual connection parameters
    poolConfig = {
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DATABASE,
        password: process.env.POSTGRES_PASSWORD,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        ssl: sslConfig
    };
}

const pool = new Pool(poolConfig);

// Log connection details (without sensitive info)
console.log('Database connection details:', {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD ? '[password provided]' : undefined,
    passwordLength: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0,
    usingSSL: !!poolConfig.ssl
});

// Add error handling for the pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); // Exit on critical database errors in production
});

module.exports = pool;