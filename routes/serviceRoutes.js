const express = require('express');
const router = express.Router();
const { getAllServices } = require('../controllers/serviceController');

// Route PUBLIQUE - accessible sans authentification
// Utilisée pour l'inscription des étudiants
router.get('/', getAllServices);

module.exports = router;