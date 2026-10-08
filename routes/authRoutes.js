const express = require('express');
const router = express.Router();
const { login, verify, checkUsername, register, verifyRecovery, resetAccount } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Limiteurs par CIBLE (numéro de téléphone / token) et non par IP : les appels
// du site passent par le proxy Vercel, donc l'IP vue par le serveur est partagée.
// Un attaquant ne peut ainsi pas deviner les infos d'un même compte à répétition,
// sans jamais bloquer les autres utilisateurs.
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives pour ce numéro, réessayez dans 15 minutes.' },
  keyGenerator: (req) => `recovery_${String(req.body?.phone || 'unknown').replace(/\D/g, '')}`,
  validate: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
  keyGenerator: (req) => `reset_${String(req.body?.recoveryToken || 'unknown').slice(0, 64)}`,
  validate: false,
});

// Routes PUBLIQUES (accessibles sans authentification)
router.post('/login', login);
router.post('/register', register);
router.get('/check-username', checkUsername);
router.post('/verify-recovery', recoveryLimiter, verifyRecovery);
router.post('/reset-account', resetLimiter, resetAccount);

// Route protégée (nécessite un token)
router.get('/verify', authMiddleware, verify);

module.exports = router;