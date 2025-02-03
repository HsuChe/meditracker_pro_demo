// routes/claimRoutes.js
const express = require('express');
const router = express.Router();
const {
    getClaims,
    getClaimById,
    createClaim,
    updateClaim,
    deleteClaim,
    getClaimsMetadata
} = require('../controllers/claimController');

// Get claims metadata (table structure, primary key)
router.get('/metadata', getClaimsMetadata);

// Get all claims (paginated)
router.get('/', getClaims);

// Get single claim by ID
router.get('/:id', getClaimById);

// Create new claim
router.post('/', createClaim);

// Update existing claim
router.put('/:id', updateClaim);

// Delete claim
router.delete('/:id', deleteClaim);

module.exports = router;