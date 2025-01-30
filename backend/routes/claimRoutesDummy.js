// routes/claimRoutesDummy.js
const express = require('express');
const router = express.Router();
const {
    getDummyClaims,
    getDummyClaimById,
    createDummyClaim,
    updateDummyClaim,
    deleteDummyClaim,
    createBatchClaims
} = require('../controllers/claimControllerDummy');

// Route to get all dummy claims
router.get('/dummy-claims', getDummyClaims);

// Route to create a batch of dummy claims
router.post('/dummy-claims/batch', createBatchClaims);

// These routes should come after the more specific routes
router.get('/dummy-claims/:id', getDummyClaimById);
router.post('/dummy-claims', createDummyClaim);
router.put('/dummy-claims/:id', updateDummyClaim);
router.delete('/dummy-claims/:id', deleteDummyClaim);

module.exports = router;
