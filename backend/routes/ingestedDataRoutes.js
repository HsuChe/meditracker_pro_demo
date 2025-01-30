const express = require('express');
const router = express.Router();
const {
    getIngestedData,
    getIngestedDataById,
    createIngestedData,
    updateIngestedDataStatus,
    deleteIngestion,
    clearAllIngestions,
    getDeletedRecords
} = require('../controllers/ingestedDataController');

// List routes first (no parameters)
router.get('/', getIngestedData);
router.post('/', createIngestedData);
router.get('/deleted-records', getDeletedRecords);
router.delete('/clear-all', clearAllIngestions);

// Parameter routes after
router.get('/:id', getIngestedDataById);
router.patch('/:id', updateIngestedDataStatus);
router.delete('/:id', deleteIngestion);

module.exports = router; 