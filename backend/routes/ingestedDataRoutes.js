const express = require('express');
const router = express.Router();
const {
  getIngestedData,
  getIngestedDataById,
  createIngestedData,
  updateIngestedDataStatus,
  deleteIngestion,
  clearAllIngestions,
  getDeletedRecords
} = require('../controllers/ingestedDataController');

// Get all ingested data with optional status filter
router.get('/', getIngestedData);

// Create new ingested data record
router.post('/', createIngestedData);

// Clear all ingestions - this must come BEFORE the /:id routes
router.delete('/clear-all', clearAllIngestions);

// Get specific ingested data by ID
router.get('/:id', getIngestedDataById);

// Update ingested data status
router.patch('/:id', updateIngestedDataStatus);

// Delete specific ingestion
router.delete('/:id', deleteIngestion);

// Add route to get deleted records
router.get('/deleted-records', getDeletedRecords);

module.exports = router; 