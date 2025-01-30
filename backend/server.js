// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const filterRoutes = require('./routes/filterRoutes');
const claimRoutes = require('./routes/claimRoutes');
const claimRoutesDummy = require('./routes/claimRoutesDummy'); // Import the dummy claim routes
const ingestedDataRoutes = require('./routes/ingestedDataRoutes'); // Add this line
const mappingRoutes = require('./routes/mappingRoutes'); // Add this line
const dbColumnsRoutes = require('./routes/dbColumnsRoutes'); // Add this line
const lutController = require('./controllers/lutController');

const app = express();

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

// Configure CORS with more specific options
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  maxAge: 86400, // CORS preflight cache time
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/filters', filterRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/dummy-claims', claimRoutesDummy); // Use the dummy claim routes
app.use('/api/ingested-data', ingestedDataRoutes); // Add this line
app.use('/api/mappings', mappingRoutes); // Add this line
app.use('/api/db-columns', dbColumnsRoutes); // Add this line

// LUT routes
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

// Move the server listening part to only run if not being tested
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));
    });
}

// Export the app for testing
module.exports = app;