// routes/sessionRoutes.js
const express = require('express');
const router = express.Router();
const { 
  generateCode, 
  verifyCode, 
  getActiveSessions, 
  markAbsent,
  getSessionHistory,
  getSessionDetails,
  getAllSessionsHistory
} = require('../controllers/sessionController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// POST - Générer un code de présence (superadmin uniquement)
router.post('/generate', roleMiddleware('superadmin'), generateCode);

// POST - Vérifier un code (étudiant)
router.post('/verify', verifyCode);

// GET - Sessions actives pour l'étudiant connecté
router.get('/active', getActiveSessions);

// GET - Historique des sessions de l'étudiant
router.get('/history', getSessionHistory);

// GET - Récupérer toutes les sessions (superadmin)
router.get('/all-history', roleMiddleware('superadmin'), getAllSessionsHistory);

// GET - Détails d'une session spécifique
router.get('/:sessionId/details', getSessionDetails);

// POST - Marquer les absents automatiquement (superadmin)
router.post('/mark-absent', roleMiddleware('superadmin'), markAbsent);

module.exports = router;