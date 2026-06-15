const express = require('express');
const router = express.Router();
const { getRankings } = require('../controllers/rankingController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Route pour le classement simple
router.get('/', roleMiddleware('superadmin'), getRankings);

// Route pour le classement équitable
router.get('/fair', roleMiddleware('superadmin'), getRankings);

module.exports = router;