const express = require('express');
const router = express.Router();
const { getAllServices } = require('../controllers/serviceController');
const { cacheMiddleware } = require('../middleware/cache');


router.get('/', cacheMiddleware(600), getAllServices);

module.exports = router;