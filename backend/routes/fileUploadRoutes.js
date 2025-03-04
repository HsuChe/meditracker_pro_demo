const express = require('express');
const router = express.Router();
const {
  uploadMiddleware,
  handleFileUpload,
  handleProgressStream,
  handleTestProcess
} = require('../controllers/fileUploadController');

// File upload endpoint
router.post('/upload', uploadMiddleware, handleFileUpload);

// SSE progress endpoint
router.get('/progress', handleProgressStream);

// Test process endpoint
router.get('/test-process', handleTestProcess);
router.post('/test-process', handleTestProcess);

module.exports = router; 