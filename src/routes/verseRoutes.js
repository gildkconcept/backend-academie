const express = require('express');
const router = express.Router();
const { getTodayVerse, getAllVerses, createVerse, updateVerse, deleteVerse } = require('../controllers/verseController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Route publique
router.get('/today', getTodayVerse);

// Routes protégées
router.use(authMiddleware);
router.get('/', roleMiddleware('superadmin'), getAllVerses);
router.post('/', roleMiddleware('superadmin'), createVerse);
router.put('/:id', roleMiddleware('superadmin'), updateVerse);
router.delete('/:id', roleMiddleware('superadmin'), deleteVerse);

module.exports = router;