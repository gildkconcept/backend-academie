const express = require('express');
const router = express.Router();



// GET - Récupérer les notifications
router.get('/', (req, res) => {
  res.json({ 
    notifications: [], 
    unreadCount: 0,
    total: 0 
  });
});

// PATCH - Marquer une notification comme lue
router.patch('/:id', (req, res) => {
  res.json({ success: true });
});

// PATCH - Marquer toutes les notifications comme lues
router.patch('/read-all', (req, res) => {
  res.json({ success: true });
});

// DELETE - Supprimer une notification
router.delete('/:id', (req, res) => {
  res.json({ success: true });
});

module.exports = router;