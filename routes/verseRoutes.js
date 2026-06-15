const express = require('express');
const router = express.Router();
const { getTodayVerse, getAllVerses, createVerse, updateVerse, deleteVerse } = require('../controllers/verseController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// ✅ Route PUBLIQUE - PAS de authMiddleware, PAS de roleMiddleware
router.get('/today', getTodayVerse);

// ⚠️ Routes protégées - uniquement pour superadmin
router.get('/', authMiddleware, roleMiddleware('superadmin'), getAllVerses);
router.post('/', authMiddleware, roleMiddleware('superadmin'), createVerse);
router.put('/:id', authMiddleware, roleMiddleware('superadmin'), updateVerse);
router.delete('/:id', authMiddleware, roleMiddleware('superadmin'), deleteVerse);

module.exports = router;