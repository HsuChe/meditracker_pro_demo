/**
 * Setup script for test environment
 * 
 * This script:
 * 1. Verifies the test database connection
 * 2. Runs migrations for the test database
 * 3. Seeds minimal test data
 */

require('dotenv').config({ path: '.env.test' });
const { execSync } = require('child_process');
const path = require('path');

// Ensure we're using the test environment
process.env.NODE_ENV = 'test';

console.log('🔍 Setting up test environment...');
console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔌 Backend URL: ${process.env.NEXT_PUBLIC_BACKEND_URL || 'Not set'}`);

// Function to run a command and log its output
function runCommand(command, description) {
  console.log(`\n🚀 ${description}...`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed successfully`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    console.error(error.message);
    process.exit(1);
  }
}

// Main setup process
async function setupTestEnvironment() {
  try {
    // 1. Test database connection
    runCommand('node scripts/test-db-connection.js', 'Testing database connection');
    
    // 2. Run migrations
    runCommand('cross-env NODE_ENV=test node scripts/migrate.js', 'Running database migrations');
    
    // 3. Seed test data
    runCommand('cross-env NODE_ENV=test node scripts/seed-test-data.js', 'Seeding test data');
    
    console.log('\n✨ Test environment setup complete! ✨');
    console.log('👉 You can now run the test server with:');
    console.log('   npm run test:server');
    console.log('👉 Or run the frontend with test backend:');
    console.log('   ./start-test.ps1');
    
  } catch (error) {
    console.error('❌ Test environment setup failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
setupTestEnvironment(); 