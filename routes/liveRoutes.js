// routes/liveRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  sendHeartbeat,
  getOnlineUsers,
  getConnectionStats,
  disconnectUser
} = require('../controllers/liveController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ==================== HEARTBEAT ====================
router.post('/heartbeat', sendHeartbeat);

// ==================== UTILISATEURS EN LIGNE ====================
router.get('/online-users', getOnlineUsers);
router.get('/stats', roleMiddleware('superadmin'), getConnectionStats);
router.post('/disconnect/:userId', roleMiddleware('superadmin'), disconnectUser);

module.exports = router;