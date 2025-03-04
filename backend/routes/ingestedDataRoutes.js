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
    getDeletedRecords
} = require('../controllers/ingestedDataController');

// List routes first (no parameters)
router.get('/', getIngestedData);
router.post('/', createIngestedData);
router.get('/deleted-records', getDeletedRecords);
router.delete('/clear-all', clearAllIngestions);

// SSE endpoint for progress tracking
router.get('/progress', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send an initial message
    res.write('data: {"type":"progress","current":0}\n\n');
    
    // Keep the connection alive with a ping every 15 seconds
    const pingInterval = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
    }, 15000);
    
    // Handle client disconnect
    req.on('close', () => {
        clearInterval(pingInterval);
    });
});

// Test process endpoint
router.get('/test-process', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.json({ 
        success: true, 
        message: 'Test process endpoint is working correctly',
        timestamp: new Date().toISOString() 
    });
});

// Parameter routes after
router.get('/:id', getIngestedDataById);
router.patch('/:id', updateIngestedDataStatus);
router.delete('/:id', deleteIngestion);

// Name-based deletion route
router.delete('/name/:name', deleteIngestionByName);

module.exports = router; 