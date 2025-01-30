// savedFilterRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getSavedFilters, 
    saveFilter, 
    deleteSavedFilter,
    updateClaimsIds 
} = require('../controllers/filterController');

// GET all saved filters
router.get('/', getSavedFilters);

// POST new filter
router.post('/', saveFilter);

// DELETE a filter
router.delete('/:id', deleteSavedFilter);

// UPDATE claims_ids
router.put('/update', updateClaimsIds);

module.exports = router;