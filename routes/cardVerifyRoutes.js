// routes/cardVerifyRoutes.js
// Route PUBLIQUE de vérification (montée AVANT authMiddleware dans app.js) :
//   GET /api/cards/verify/:token
// Elle ne renvoie que : statut, numéro de carte, nom, photo (désactivable).
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const cardService = require('../services/cardService');

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, status: 'rate_limited', error: 'Trop de vérifications, réessayez dans une minute.' },
});

router.get('/:token', verifyLimiter, async (req, res) => {
  // Pas de cache : une carte révoquée doit être signalée immédiatement
  res.set('Cache-Control', 'no-store');
  try {
    const { httpStatus, body } = await cardService.verifyCard(req.params.token);
    res.status(httpStatus).json(body);
  } catch (error) {
    if (error instanceof cardService.CardError) {
      return res.status(error.status).json({ valid: false, status: 'unavailable' });
    }
    console.error('Erreur verifyCard:', error);
    res.status(500).json({ valid: false, status: 'error' });
  }
});

module.exports = router;