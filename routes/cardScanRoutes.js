// routes/cardScanRoutes.js
// Pointage par carte : /api/card-scan/...  (superadmin uniquement, vérifié côté serveur)
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { roleMiddleware } = require('../middleware/auth');
const cardService = require('../services/cardService');
const scanService = require('../services/cardScanService');

// Toutes les routes de ce fichier sont réservées au superadmin
router.use(roleMiddleware('superadmin'));

// Limite par administrateur (et non par adresse IP) : large, pour ne jamais gêner un vrai pointage
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => `card_scan_${req.user?.id || 'anonyme'}`,
  message: { ok: false, outcome: 'rate_limited', message: 'Trop de scans en peu de temps, patientez quelques secondes.' },
});

const handleError = (res, error, label) => {
  if (error instanceof cardService.CardError) {
    return res.status(error.status).json({ ok: false, error: error.message, message: error.message });
  }
  console.error(`Erreur ${label}:`, error);
  res.status(500).json({
    ok: false,
    outcome: 'technical',
    error: 'Erreur serveur',
    message: "Impossible d'enregistrer la présence, veuillez réessayer",
  });
};

// GET /api/card-scan/sessions — séances du jour
router.get('/sessions', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ sessions: await scanService.listScannableSessions() });
  } catch (error) {
    handleError(res, error, 'listScannableSessions');
  }
});

// GET /api/card-scan/sessions/:sessionId/attendance — présents d'une séance (code + carte + manuel)
router.get('/sessions/:sessionId/attendance', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await scanService.getSessionAttendance(req.params.sessionId));
  } catch (error) {
    handleError(res, error, 'getSessionAttendance');
  }
});

// POST /api/card-scan/scan — { sessionId, token }
router.post('/scan', scanLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { sessionId, token } = req.body || {};
    res.json(await scanService.scanCard({ sessionId, token }));
  } catch (error) {
    handleError(res, error, 'scanCard');
  }
});

// GET /api/card-scan/missing-cards — combien d'étudiants actifs n'ont pas encore de carte
router.get('/missing-cards', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await cardService.countMissingCards());
  } catch (error) {
    handleError(res, error, 'countMissingCards');
  }
});

// POST /api/card-scan/generate-missing-cards — crée les cartes manquantes (relançable sans risque)
router.post('/generate-missing-cards', async (req, res) => {
  try {
    res.json({ success: true, ...(await cardService.backfillMissingCards()) });
  } catch (error) {
    handleError(res, error, 'backfillMissingCards');
  }
});

module.exports = router;