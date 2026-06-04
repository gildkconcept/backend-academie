const express = require('express');
const router = express.Router();
const { generateCode, verifyCode, getActiveSessions, markAbsent } = require('../controllers/sessionController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/generate', roleMiddleware('superadmin'), generateCode);
router.post('/verify', verifyCode);
router.get('/active', getActiveSessions);
router.post('/mark-absent', roleMiddleware('superadmin'), markAbsent);

module.exports = router;