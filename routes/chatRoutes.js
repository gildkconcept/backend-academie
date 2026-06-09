// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  getGroups,
  createGroup,
  getGroupMembers,
  addMembers,
  leaveGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead
} = require('../controllers/chatController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// ==================== GROUPES ====================
router.get('/groups', getGroups);
router.post('/groups', roleMiddleware('superadmin'), createGroup);
router.get('/groups/:groupId/members', getGroupMembers);
router.post('/groups/:groupId/members', roleMiddleware('superadmin'), addMembers);
router.post('/groups/:groupId/leave', leaveGroup);

// ==================== MESSAGES ====================
router.get('/messages', getMessages);
router.post('/messages', sendMessage);
router.put('/messages', editMessage);
router.delete('/messages', deleteMessage);

// ==================== STATUT DE LECTURE ====================
router.post('/mark-read', markAsRead);

module.exports = router;