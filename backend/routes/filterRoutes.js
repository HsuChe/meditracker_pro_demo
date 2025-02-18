// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const {
    getSavedFilters,
    saveFilter,
    executeFilter,
    savedFilterQueryBuilder,
    deleteFilter,
    deleteAllFilters
} = require('../controllers/filterController');

const {
    getClaims,
    getClaimsDataTypes,
    getDiagnosisCodes
} = require('../controllers/claimsController');

// Claims routes
router.post('/claims', getClaims);  // For filtered data
router.get('/claims', getClaims);   // For initial load/pagination
router.get('/claimsDtype', getClaimsDataTypes);

// Filter management routes
router.post('/save', saveFilter);        // Route to save a filter
router.get('/saved', getSavedFilters);   // Route to get saved filters
router.delete('/saved/:name', deleteFilter);  // Route to delete a specific filter
router.delete('/saved', deleteAllFilters);    // Route to delete all filters

// Filter execution routes
router.post('/execute', executeFilter);   // Route to execute a filter
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

// Diagnosis codes route
router.post('/diagnosis-codes', getDiagnosisCodes);

module.exports = router;