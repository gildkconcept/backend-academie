const express = require('express');
const router = express.Router();
const { getRankings } = require('../controllers/rankingController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.get('/', roleMiddleware('superadmin'), getRankings);

module.exports = router;