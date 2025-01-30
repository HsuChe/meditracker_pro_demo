const express = require('express');
const app = express();
const ingestedDataRoutes = require('./routes/ingested-data.routes');

// Add the new routes
app.use('/api/ingested-data', ingestedDataRoutes);

// ... rest of the file ... 