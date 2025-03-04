const express = require('express');
const router = express.Router();
const {
    getIngestedData,
    getIngestedDataById,
    createIngestedData,
    updateIngestedDataStatus,
    deleteIngestion,
    deleteIngestionByName,
    clearAllIngestions,
    getDeletedRecords,
    getIngestedDataHistory
} = require('../controllers/ingestedDataController');
const { 
    handleProgressStream,
    handleFileUpload,
    uploadMiddleware 
} = require('../controllers/fileUploadController');

// Direct SSE progress endpoint with full CORS support
// This must be BEFORE other routes to ensure correct handling
router.options('/progress', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.accuratiohealth.com');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

router.get('/progress', (req, res) => {
  try {
    // Add CORS headers for SSE
    res.header('Access-Control-Allow-Origin', 'https://www.accuratiohealth.com');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache');
    res.header('Connection', 'keep-alive');
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      message: 'SSE connection established',
      timestamp: Date.now()
    })}\n\n`);
    
    // Pass to the actual handler
    handleProgressStream(req, res);
  } catch (error) {
    console.error('Critical error in SSE endpoint:', error);
    
    // Try to send a response if we can
    try {
      res.status(500).json({
        error: 'SSE connection failed',
        message: error.message || 'Unknown error',
        timestamp: Date.now()
      });
    } catch (responseError) {
      console.error('Failed to send error response:', responseError);
      res.end();
    }
  }
});

// List routes first (no parameters)
router.get('/', getIngestedData);

// Apply CORS directly to the POST endpoint
router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.accuratiohealth.com');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

router.post('/', (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', 'https://www.accuratiohealth.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Call the actual controller
  createIngestedData(req, res);
});

router.get('/deleted-records', getDeletedRecords);
router.delete('/clear-all', clearAllIngestions);

// Parameter routes after
router.get('/:id', getIngestedDataById);
router.patch('/:id', updateIngestedDataStatus);
router.delete('/:id', deleteIngestion);

// Name-based deletion route
router.delete('/name/:name', deleteIngestionByName);

// File upload endpoint (adding here to match existing frontend expectations)
router.post('/upload', uploadMiddleware, handleFileUpload);

// Get history of processing results
router.get('/history', getIngestedDataHistory);

module.exports = router; 