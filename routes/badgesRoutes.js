// routes/badgesRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  getAllBadges,
  getStudentBadges,
  assignBadge,
  createBadge
} = require('../controllers/badgeController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ==================== ROUTES SUPERADMIN ====================
router.get('/', roleMiddleware('superadmin'), getAllBadges);
router.post('/', roleMiddleware('superadmin'), createBadge);
router.post('/assign', roleMiddleware('superadmin'), assignBadge);

// ==================== ROUTES UTILISATEUR ====================
router.get('/student/:studentId', getStudentBadges);

module.exports = router;