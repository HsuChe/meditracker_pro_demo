// server.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const filterRoutes = require('./routes/filterRoutes');
const claimRoutes = require('./routes/claimRoutes');
const ingestedDataRoutes = require('./routes/ingestedDataRoutes');
const mappingRoutes = require('./routes/mappingRoutes');
const dbColumnsRoutes = require('./routes/dbColumnsRoutes');
const fileUploadRoutes = require('./routes/fileUploadRoutes');
const lutController = require('./controllers/lutController');
const filterController = require('./controllers/filterController');
const pool = require('./config/db.config');
const { getConfig: getCorsConfig } = require('./config/cors');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Log environment configuration on startup
console.log('Current environment:', process.env.NODE_ENV);
console.log('Using environment file:', `.env.${process.env.NODE_ENV || 'development'}`);
console.log('Database connection details:', {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD ? '[password provided]' : '[no password]',
  passwordLength: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0
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

// Use environment-specific CORS configuration
app.use(cors({
  ...getCorsConfig(),
  // Explicitly set headers for SSE and CORS
  exposedHeaders: ['Content-Type', 'Transfer-Encoding', 'Accept-Ranges', 'Content-Range'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Log the applied CORS configuration
const appliedConfig = getCorsConfig();
console.log('CORS configured with origins:', Array.isArray(appliedConfig.origin) ? appliedConfig.origin : 'all origins');

// Add a CORS preflight response for critical endpoints
app.options('/api/ingested-data', cors(getCorsConfig()));
app.options('/api/ingested-data/progress', cors(getCorsConfig()));
app.options('/api/file-upload/upload', cors(getCorsConfig()));
app.options('/api/file-upload/progress', cors(getCorsConfig()));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes - Order matters! More specific routes should come first
app.use('/api/db-columns', dbColumnsRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/ingested-data', ingestedDataRoutes);
app.use('/api/file-upload', fileUploadRoutes);
app.use('/api/mappings', mappingRoutes);

// LUT routes (kept separate from claims data)
app.post('/api/luts', lutController.createLUT);
app.get('/api/luts', lutController.getLUTs);
app.get('/api/luts/:id', lutController.getLUTDetails);
app.delete('/api/luts/:id', lutController.deleteLUT);

// Add a root path handler for better user experience
app.get('/', (req, res) => {
  res.json({
    message: 'MediTracker Pro API is running',
    documentation: 'API endpoints start with /api/',
    health: '/api/health',
    version: '1.0.0'
  });
});

// Add a test endpoint to verify the server is running
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    const dbResult = await client.query('SELECT NOW() as time');
    client.release();
    
    res.json({ 
      status: 'ok',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbResult.rows[0].time,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DATABASE
      }
    });
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(500).json({
      status: 'error',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Handle 404 errors for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

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

// Start the server unless we're running unit tests
if (!process.env.JEST_WORKER_ID) {
    // IMPORTANT: For Render deployment, we MUST use the PORT environment variable they provide
    const PORT = process.env.PORT || process.env.BACKEND_PORT || 5001;
    const HOST = '0.0.0.0'; // Bind to all network interfaces
    
    app.listen(PORT, HOST, () => {
        console.log(`Server running on http://${HOST}:${PORT}`);
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));
        console.log('Using PORT:', PORT);
    });
}

module.exports = app;