// routes/filterRoutes.js
const express = require('express');
const router = express.Router();
const {
    getClaims,
    getClaimsDataTypes
} = require('../controllers/filterController');

// Claims routes
router.post('/claims', getClaims);  // For filtered data
router.get('/claims', getClaims);   // For initial load/pagination
router.get('/claimsDtype', getClaimsDataTypes);

module.exports = router;