// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getSavedFilters, 
    saveFilter, 
    executeFilter,
    updateFilterClaimsIds 
} = require('../controllers/filterController');

// Get all saved filters with pagination and search
router.get('/', getSavedFilters);

// Save a new filter
router.post('/', saveFilter);

// Execute a filter and get results
router.post('/:filter_id/execute', executeFilter);

// Update claims_ids for a filter
router.put('/:filter_id/claims', updateFilterClaimsIds);

module.exports = router;