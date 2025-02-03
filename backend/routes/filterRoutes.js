// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const {
    getSavedFilters,
    saveFilter,
    executeFilter,
    updateFilterClaimsIds,
    getClaims,
    getClaimsDataTypes
} = require('../controllers/filterController');

// Filter routes
router.get('/saved', getSavedFilters);
router.post('/save', saveFilter);
router.post('/execute', executeFilter);
router.put('/:filter_id/update-claims', updateFilterClaimsIds);

// Claims routes
router.get('/claims', getClaims);
router.get('/claimsDtype', getClaimsDataTypes);

module.exports = router;