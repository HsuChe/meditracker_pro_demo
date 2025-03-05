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
const monitoring = require('../middleware/monitoring');

// Get allowed origin from environment variable with fallback to wildcard
const getAllowedOrigin = () => process.env.FRONTEND_ORIGIN || '*';

// Direct SSE progress endpoint with full CORS support
// This must be BEFORE other routes to ensure correct handling
router.options('/progress', (req, res) => {
  // Set CORS headers for preflight requests
  res.header('Access-Control-Allow-Origin', getAllowedOrigin());
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// List routes first (no parameters)
router.get('/', getIngestedData);
router.get('/deleted-records', getDeletedRecords);
router.delete('/clear-all', clearAllIngestions);

// Apply CORS directly to the POST endpoint
router.options('/', (req, res) => {
  res.header('Access-Control-Allow-Origin', getAllowedOrigin());
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// Direct implementation of the POST handler with CORS
router.post('/', (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', getAllowedOrigin());
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // Call the actual controller
    createIngestedData(req, res);
  } catch (error) {
    console.error('Error in POST handler:', error);
    res.status(500).json({
      error: 'Failed to create ingested data',
      message: error.message || 'Unknown error',
      timestamp: Date.now()
    });
  }
});

// Special named routes BEFORE parameter routes
router.get('/progress', (req, res) => {
  // Direct SSE implementation to avoid nested handler issues
  try {
    const { ingestion_id } = req.query;
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', getAllowedOrigin());
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send an initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      message: 'SSE connection established',
      timestamp: Date.now()
    })}\n\n`);
    
    // Find the active ingestion (latest or specific)
    let targetId = ingestion_id;
    if (!targetId) {
      const allIngestions = monitoring.getAllIngestions();
      const latestIngestion = allIngestions
        .filter(ing => ing.status === 'processing')
        .sort((a, b) => b.startTime - a.startTime)[0];
        
      if (latestIngestion) {
        console.log(`No ingestion_id provided, using latest: ${latestIngestion.id}`);
        targetId = latestIngestion.id;
      }
    }
    
    // Send initial progress data
    if (targetId) {
      const progressData = monitoring.getProgress(targetId);
      if (progressData) {
        res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          status: 'not_found',
          message: `No ingestion found with ID: ${targetId}`,
          timestamp: Date.now()
        })}\n\n`);
      }
    } else {
      // No active ingestions found
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        status: 'no_active_ingestions',
        message: 'No active ingestions found',
        timestamp: Date.now()
      })}\n\n`);
      
      // End connection if there's nothing to track
      setTimeout(() => res.end(), 100);
      return;
    }
    
    // Set up interval for progress updates
    const progressInterval = setInterval(() => {
      try {
        // Re-evaluate target ID (in case we're tracking latest)
        let currentId = targetId;
        if (!ingestion_id) {
          const latestIngestion = monitoring.getAllIngestions()
            .filter(ing => ing.status === 'processing')
            .sort((a, b) => b.startTime - a.startTime)[0];
          currentId = latestIngestion?.id;
        }
        
        if (!currentId) {
          const noData = {
            type: 'progress',
            status: 'no_active_ingestions',
            message: 'No active ingestions found',
            timestamp: Date.now()
          };
          res.write(`data: ${JSON.stringify(noData)}\n\n`);
          clearInterval(progressInterval);
          setTimeout(() => res.end(), 100);
          return;
        }
        
        // Get and send current progress
        const progress = monitoring.getProgress(currentId);
        if (progress) {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
          
          // End connection if process is complete
          if (progress.status === 'completed' || progress.status === 'error') {
            clearInterval(progressInterval);
            
            // Send final message
            const finalData = {
              type: progress.status === 'completed' ? 'complete' : 'error',
              id: currentId,
              result: progress.result || {},
              message: progress.status === 'completed' 
                ? 'Processing completed successfully' 
                : (progress.errors?.[0] || 'Error during processing'),
              timestamp: Date.now()
            };
            res.write(`data: ${JSON.stringify(finalData)}\n\n`);
            
            setTimeout(() => res.end(), 100);
          }
        } else {
          // Handle case where progress is undefined
          const noProgressData = {
            type: 'progress',
            status: 'error',
            message: 'Unable to retrieve progress data',
            timestamp: Date.now()
          };
          res.write(`data: ${JSON.stringify(noProgressData)}\n\n`);
        }
      } catch (error) {
        console.error('Error sending SSE update:', error);
        
        // Send error message and end connection
        const errorData = {
          type: 'error',
          message: error.message || 'An unknown error occurred',
          timestamp: Date.now()
        };
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
        
        clearInterval(progressInterval);
        setTimeout(() => res.end(), 100);
      }
    }, 1000);
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(progressInterval);
      console.log('Client disconnected from progress stream');
    });
    
  } catch (error) {
    console.error('Critical error in SSE endpoint:', error);
    
    // Send error response
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(),
      'Access-Control-Allow-Credentials': 'true'
    });
    
    res.end(JSON.stringify({
      error: 'SSE connection failed',
      message: error.message || 'Unknown error',
      timestamp: Date.now()
    }));
  }
});

// Get history of processing results
router.get('/history', getIngestedDataHistory);

// File upload endpoint (adding here to match existing frontend expectations)
router.post('/upload', uploadMiddleware, handleFileUpload);

// Name-based deletion route
router.delete('/name/:name', deleteIngestionByName);

// Parameter routes AFTER special named routes
router.get('/:id', getIngestedDataById);
router.patch('/:id', updateIngestedDataStatus);
router.delete('/:id', deleteIngestion);

module.exports = router; 