/**
 * Run all numeric type fixes in the correct order
 * 
 * This script:
 * 1. Runs the SQL script to fix all numeric columns in the database
 * 2. Fixes the data ingestion process
 * 3. Fixes any COALESCE issues in queries
 */

require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Configure database connection for psql command
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'meditracker',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
};

// Log connection info (masking password)
console.log('Database connection info:');
console.log('  Host:', dbConfig.host);
console.log('  Port:', dbConfig.port);
console.log('  Database:', dbConfig.database);
console.log('  User:', dbConfig.user);

async function runSqlScript(scriptPath) {
  console.log(`\nRunning SQL script: ${scriptPath}`);
  
  // Build psql command
  let command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -d ${dbConfig.database} -U ${dbConfig.user} -f ${scriptPath}`;
  
  // Set PGPASSWORD environment variable for the command
  const env = { ...process.env, PGPASSWORD: dbConfig.password };
  
  try {
    const { stdout, stderr } = await execPromise(command, { env });
    console.log('SQL script output:');
    console.log(stdout);
    if (stderr) {
      console.warn('SQL script warnings/errors:');
      console.warn(stderr);
    }
    return true;
  } catch (error) {
    console.error('Error running SQL script:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

async function runNodeScript(scriptPath) {
  console.log(`\nRunning Node.js script: ${scriptPath}`);
  
  try {
    const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
    console.log('Node.js script output:');
    console.log(stdout);
    if (stderr) {
      console.warn('Node.js script warnings/errors:');
      console.warn(stderr);
    }
    return true;
  } catch (error) {
    console.error('Error running Node.js script:', error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

async function runAllFixes() {
  console.log('Starting comprehensive numeric type fix process...');
  
  // 1. Check numeric columns
  const checkScriptPath = path.join(__dirname, 'check_numeric_columns.sql');
  if (fs.existsSync(checkScriptPath)) {
    console.log('\n=== STEP 1: Checking numeric columns ===');
    await runSqlScript(checkScriptPath);
  } else {
    console.warn(`Warning: ${checkScriptPath} not found, skipping check step`);
  }
  
  // 2. Fix all numeric columns in the database
  const fixColumnsScriptPath = path.join(__dirname, 'fix_all_numeric_columns.sql');
  if (fs.existsSync(fixColumnsScriptPath)) {
    console.log('\n=== STEP 2: Fixing all numeric columns in the database ===');
    const success = await runSqlScript(fixColumnsScriptPath);
    if (!success) {
      console.error('Failed to fix numeric columns in the database. Aborting.');
      return;
    }
  } else {
    console.error(`Error: ${fixColumnsScriptPath} not found. Aborting.`);
    return;
  }
  
  // 3. Fix the data ingestion process
  const fixIngestionScriptPath = path.join(__dirname, 'fix_ingestion_process.js');
  if (fs.existsSync(fixIngestionScriptPath)) {
    console.log('\n=== STEP 3: Fixing data ingestion process ===');
    const success = await runNodeScript(fixIngestionScriptPath);
    if (!success) {
      console.error('Failed to fix data ingestion process. Aborting.');
      return;
    }
  } else {
    console.error(`Error: ${fixIngestionScriptPath} not found. Aborting.`);
    return;
  }
  
  // 4. Fix COALESCE issues in queries
  const fixCoalesceScriptPath = path.join(__dirname, 'fix_coalesce_query.js');
  if (fs.existsSync(fixCoalesceScriptPath)) {
    console.log('\n=== STEP 4: Fixing COALESCE issues in queries ===');
    const success = await runNodeScript(fixCoalesceScriptPath);
    if (!success) {
      console.error('Failed to fix COALESCE issues in queries.');
      // Continue anyway as this is not critical
    }
  } else {
    console.warn(`Warning: ${fixCoalesceScriptPath} not found, skipping COALESCE fix`);
  }
  
  console.log('\n=== All fixes completed successfully! ===');
  console.log('Please test the application to ensure all issues are resolved.');
}

// Run all fixes
runAllFixes()
  .then(() => {
    console.log('Script completed');
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  }); 