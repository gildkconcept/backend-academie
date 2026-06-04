const express = require('express');
const router = express.Router();
const { getAllServices } = require('../controllers/serviceController');
const { authMiddleware } = require('../middleware/auth');

// Route publique
router.get('/', getAllServices);

// Routes protégées (si tu en ajoutes d'autres)
// router.use(authMiddleware);
// router.post('/', roleMiddleware('superadmin'), createService);

module.exports = router;