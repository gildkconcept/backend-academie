const express = require('express');
const router = express.Router();
const { getTodayVerse, getAllVerses, createVerse, updateVerse, deleteVerse } = require('../controllers/verseController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

router.get('/today', cacheMiddleware(1800), getTodayVerse);


router.get('/', authMiddleware, roleMiddleware('superadmin'), getAllVerses);

router.post('/', authMiddleware, roleMiddleware('superadmin'), async (req, res, next) => {
  await createVerse(req, res, next);
  invalidateCache('/api/verses/today');
});
router.put('/:id', authMiddleware, roleMiddleware('superadmin'), async (req, res, next) => {
  await updateVerse(req, res, next);
  invalidateCache('/api/verses/today');
});
router.delete('/:id', authMiddleware, roleMiddleware('superadmin'), async (req, res, next) => {
  await deleteVerse(req, res, next);
  invalidateCache('/api/verses/today');
});

module.exports = router;