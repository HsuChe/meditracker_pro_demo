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
router.get('/', getDummyClaims);

// Route to get a single dummy claim by ID
router.get('/:id', getDummyClaimById);

// Route to create a new dummy claim
router.post('/', createDummyClaim);

// Route to update an existing dummy claim
router.put('/:id', updateDummyClaim);

// Route to delete a dummy claim
router.delete('/:id', deleteDummyClaim);

// Route to create a batch of dummy claims
router.post('/batch', createBatchClaims);

module.exports = router;
