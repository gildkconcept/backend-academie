const express = require('express');
const router = express.Router();
const { login, verify, checkUsername, register, verifyRecovery, resetAccount } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Routes PUBLIQUES (accessibles sans authentification)
router.post('/login', login);
router.post('/register', register);
router.get('/check-username', checkUsername);
router.post('/verify-recovery', verifyRecovery);
router.post('/reset-account', resetAccount);

// Route protégée (nécessite un token)
router.get('/verify', authMiddleware, verify);

module.exports = router;