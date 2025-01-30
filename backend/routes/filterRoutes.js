// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getSavedFilters, 
    saveFilter, 
    executeFilter,
    updateFilterClaimsIds,
    getClaims,
    getClaimsCount,
    getClaimsMetadata
} = require('../controllers/filterController');

// Claims endpoints
router.get('/claims/count', getClaimsCount);  // This will be /api/claims/count
router.get('/claims', getClaims);             // This will be /api/claims
router.get('/claims/metadata', getClaimsMetadata);

// Filter-specific endpoints
router.get('/filters/saved', getSavedFilters);
router.post('/filters/save', saveFilter);
router.post('/filters/execute', executeFilter);
router.put('/filters/:filter_id/claims', updateFilterClaimsIds);

module.exports = router;