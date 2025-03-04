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

// List routes first (no parameters)
router.get('/', getIngestedData);
router.post('/', createIngestedData);
router.get('/deleted-records', getDeletedRecords);
router.delete('/clear-all', clearAllIngestions);

// Parameter routes after
router.get('/:id', getIngestedDataById);
router.patch('/:id', updateIngestedDataStatus);
router.delete('/:id', deleteIngestion);

// Name-based deletion route
router.delete('/name/:name', deleteIngestionByName);

// Add progress endpoint for Server-Sent Events (SSE)
router.get('/progress', handleProgressStream);

// File upload endpoint (adding here to match existing frontend expectations)
router.post('/upload', uploadMiddleware, handleFileUpload);

// Get history of processing results
router.get('/history', getIngestedDataHistory);

module.exports = router; 