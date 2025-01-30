// savedFilterRoutes.js
const express = require('express');
const router = express.Router();
const { 
    getSavedFilters, 
    saveFilter, 
    deleteFilter,
    updateClaimsIds 
} = require('../controllers/filterController');

// GET all saved filters
router.get('/', getSavedFilters);

// POST new filter
router.post('/', saveFilter);

// DELETE a filter
router.delete('/:id', deleteFilter);

// UPDATE claims_ids
router.put('/update', updateClaimsIds);

module.exports = router;