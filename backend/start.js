// start.js - A simple wrapper for server.js that ensures proper port binding for Render
console.log('Starting server with Render configuration...');

// Log all environment variables related to ports
console.log('Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('BACKEND_PORT:', process.env.BACKEND_PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Ensure PORT is set for Render
if (!process.env.PORT) {
  console.warn('WARNING: PORT environment variable is not set. Render requires this to be set.');
  console.log('Setting default PORT to 10000');
  process.env.PORT = 10000;
}

// Start the actual server
require('./server.js'); 