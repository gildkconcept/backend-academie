const express = require('express');
const router = express.Router();
const { getRankings } = require('../controllers/rankingController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

router.use(authMiddleware);
router.get('/', roleMiddleware('superadmin'), cacheMiddleware(180), getRankings);
router.get('/fair', roleMiddleware('superadmin'), cacheMiddleware(180), getRankings);

module.exports = router;