// routes/notificationsRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  announceToAll,
  announceToService,
  announceToLevel
} = require('../controllers/notificationController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ==================== ROUTES UTILISATEUR ====================
router.get('/', getMyNotifications);
router.patch('/:id', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

// ==================== ROUTES SUPERADMIN ====================
router.post('/', roleMiddleware('superadmin'), createNotification);
router.post('/announcement/all', roleMiddleware('superadmin'), announceToAll);
router.post('/announcement/service/:serviceId', roleMiddleware('superadmin'), announceToService);
router.post('/announcement/level/:level', roleMiddleware('superadmin'), announceToLevel);

module.exports = router;