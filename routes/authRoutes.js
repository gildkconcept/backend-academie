const express = require('express');
const router = express.Router();
const { login, verify, checkUsername, register } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/verify', authMiddleware, verify);
router.get('/check-username', checkUsername);

module.exports = router;