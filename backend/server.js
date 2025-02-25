// server.js
const path = require('path');

// Debug: Log all environment variables (excluding sensitive data)
console.log('DEBUG - Available environment variables:', Object.keys(process.env));
console.log('DEBUG - Current working directory:', process.cwd());
console.log('DEBUG - NODE_ENV value:', process.env.NODE_ENV);

// Load environment variables based on NODE_ENV
const envPath = path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`);
console.log('DEBUG - Attempting to load env file from:', envPath);

try {
  require('dotenv').config({
    path: envPath
  });
  console.log('DEBUG - Env file loaded successfully');
} catch (error) {
  console.log('DEBUG - Error loading env file:', error.message);
}

// Verify required environment variables
const requiredEnvVars = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DATABASE',
  'DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  console.log('Current environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
    POSTGRES_USER: process.env.POSTGRES_USER,
    DATABASE_URL: process.env.DATABASE_URL ? '[URL PROVIDED]' : undefined
  });
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const filterRoutes = require('./routes/filterRoutes');
const claimRoutes = require('./routes/claimRoutes');
const ingestedDataRoutes = require('./routes/ingestedDataRoutes');
const mappingRoutes = require('./routes/mappingRoutes');
const dbColumnsRoutes = require('./routes/dbColumnsRoutes');
const lutController = require('./controllers/lutController');
const filterController = require('./controllers/filterController');
const testRoutes = require('./routes/testRoutes');

const app = express();

// Log environment configuration on startup
console.log('Current environment:', process.env.NODE_ENV);
console.log('Environment source:', process.env.DATABASE_URL ? 'Direct env variables' : '.env file');
console.log('Database connection details:', {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD ? '[password provided]' : '[no password]',
  passwordLength: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0,
  database_url: process.env.DATABASE_URL ? '[url provided]' : '[no url provided]'
});

// Increase payload size limits even further for large CSV files
app.use(express.json({ 
  limit: '500mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  limit: '500mb', 
  extended: true,
  parameterLimit: 50000
}));

// Configure CORS for development and production
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'https://accuratiohealth.com',
    'https://www.accuratiohealth.com',
    /\.onrender\.com$/,  // Allow all Render domains
    /\.vercel\.app$/     // Allow all Vercel preview domains
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  maxAge: 86400,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MediTracker Pro API Server',
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      test: '/api/test/test-db',
      tables: '/api/test/tables'
    }
  });
});

// Routes - Order matters! More specific routes should come first
app.use('/api/test', testRoutes);
app.use('/api/db-columns', dbColumnsRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/ingested-data', ingestedDataRoutes);
app.use('/api/mappings', mappingRoutes);

// LUT routes (kept separate from claims data)
app.post('/api/luts', lutController.createLUT);
app.get('/api/luts', lutController.getLUTs);
app.get('/api/luts/:id', lutController.getLUTDetails);
app.delete('/api/luts/:id', lutController.deleteLUT);

// More detailed error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body ? JSON.stringify(req.body).slice(0, 200) + '...' : null // Log partial body for debugging
  });

  // Handle specific types of errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ 
      error: 'Invalid JSON',
      details: err.message
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      details: 'The uploaded file exceeds the maximum size limit'
    });
  }

  res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Add a test endpoint to verify the server is running
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Start the server unless we're running unit tests
if (!process.env.JEST_WORKER_ID) {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));
    });
}

module.exports = app;