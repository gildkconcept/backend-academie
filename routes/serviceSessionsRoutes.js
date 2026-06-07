const express = require('express');
const router = express.Router();

router.get('/history', (req, res) => {
  res.json({ sessions: [], total: 0, stats: {} });
});

module.exports = router;