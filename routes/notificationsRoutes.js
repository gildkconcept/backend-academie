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

// ==================== ROUTES SPÉCIFIQUES (DOIVENT ÊTRE AVANT /:id) ====================
router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead);      // ← IMPORTANT : avant /:id
router.post('/', roleMiddleware('superadmin'), createNotification);

// ==================== ROUTES SUPERADMIN POUR ANNONCES ====================
router.post('/announcement/all', roleMiddleware('superadmin'), announceToAll);
router.post('/announcement/service/:serviceId', roleMiddleware('superadmin'), announceToService);
router.post('/announcement/level/:level', roleMiddleware('superadmin'), announceToLevel);

// ==================== ROUTES DYNAMIQUES (AVEC ID) - APRÈS LES ROUTES SPÉCIFIQUES ====================
router.patch('/:id', markAsRead);              // Capture l'ID UUID
router.delete('/:id', deleteNotification);

module.exports = router;