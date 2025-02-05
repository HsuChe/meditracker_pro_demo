const express = require('express');
const router = express.Router();
const {
  createLUT,
  getLUTs,
  getLUTDetails,
  deleteLUT,
  getDeletedLUTs
} = require('../controllers/lutController');

// Get all active LUTs
router.get('/', getLUTs);

// Get all deleted LUTs
router.get('/deleted', getDeletedLUTs);

// Get specific LUT by ID
router.get('/:id', getLUTDetails);

// Create new LUT
router.post('/', createLUT);

// Delete LUT (marks as deleted)
router.delete('/:id', deleteLUT);

module.exports = router; 