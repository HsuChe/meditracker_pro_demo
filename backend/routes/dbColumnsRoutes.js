const express = require('express');
const router = express.Router();
const { getDbColumns } = require('../controllers/dbColumnsController');

router.get('/', getDbColumns);

module.exports = router; 