const express = require('express');
const router = express.Router();
const {
  getMappings,
  getMappingById,
  createMapping,
  deleteMapping,
  updateMappingStatus
} = require('../controllers/mappingController');

// Get all mappings
router.get('/', getMappings);

// Get specific mapping by ID
router.get('/:id', getMappingById);

// Create new mapping
router.post('/', createMapping);

// Delete mapping
router.delete('/:id', deleteMapping);

// Update mapping status
router.patch('/:id/status', updateMappingStatus);

module.exports = router; 