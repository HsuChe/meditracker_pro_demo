// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const {
    getClaims,
    getClaimsDataTypes,
    saveFilter,
    getSavedFilters,
    executeFilter,
    loadSavedFilterData,
    savedFilterQueryBuilder,
    runOperatorTests
} = require('../controllers/filterController');

// Claims routes
router.post('/claims', getClaims);  // For filtered data
router.get('/claims', getClaims);   // For initial load/pagination
router.get('/claimsDtype', getClaimsDataTypes);

// Add these new routes
router.post('/save', saveFilter);        // Route to save a filter
router.get('/saved', getSavedFilters);   // Route to get saved filters
router.post('/execute', executeFilter);   // Route to execute a filter

// Add this new route
router.get('/execute/:filterId', async (req, res) => {
    try {
        await savedFilterQueryBuilder(req.params.filterId, req, res);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to execute saved filter', 
            details: error.message 
        });
    }
});

// Add test route
router.get('/test-operators', runOperatorTests);

module.exports = router;