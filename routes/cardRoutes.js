// routes/cardRoutes.js
// Routes PRIVÉES (après authMiddleware) : /api/cards/...
const express = require('express');
const router = express.Router();
const { roleMiddleware } = require('../middleware/auth');
const cardService = require('../services/cardService');

const handleError = (res, error, label) => {
  if (error instanceof cardService.CardError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(`Erreur ${label}:`, error);
  res.status(500).json({ error: 'Erreur serveur' });
};

// GET /api/cards/me — la carte de l'étudiant connecté (et seulement la sienne)
router.get('/me', roleMiddleware('student'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const data = await cardService.getMyCard(req.user.id);
    res.json(data);
  } catch (error) {
    handleError(res, error, 'getMyCard');
  }
});

// POST /api/cards/:studentId/revoke — révoquer une carte (superadmin)
router.post('/:studentId/revoke', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const result = await cardService.setCardStatus(req.params.studentId, 'revoked', {
      reason: req.body?.reason,
      adminId: req.user.id,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'revokeCard');
  }
});

// POST /api/cards/:studentId/reactivate — réactiver une carte (superadmin)
router.post('/:studentId/reactivate', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const result = await cardService.setCardStatus(req.params.studentId, 'active', {
      adminId: req.user.id,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'reactivateCard');
  }
});

module.exports = router;