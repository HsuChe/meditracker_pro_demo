// routes/claimRoutes.js
const express = require('express');
const router = express.Router();
const { getClaims } = require('../controllers/claimController');

router.get('/', getClaims);

module.exports = router;  // Make sure you're exporting the router