const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
  updateStudentLevel,
  bulkPromote,
} = require('../controllers/studentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Routes protégées
router.use(authMiddleware);

// GET - Liste des étudiants
router.get('/', getAllStudents);

// GET - Branches uniques (pour les filtres)
router.get('/branches', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('branch')
      .is('deleted_at', null);
    
    if (error) throw error;
    const branches = [...new Set(data.map(s => s.branch))].sort();
    res.json(branches);
  } catch (error) {
    console.error('Erreur récupération branches:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Étudiant par ID
router.get('/:id', getStudentById);

// POST - Ajouter un étudiant (manager ou superadmin)
router.post('/', roleMiddleware('superadmin', 'service_manager'), addStudent);

// PUT - Modifier un étudiant
router.put('/:id', roleMiddleware('superadmin', 'service_manager'), updateStudent);

// DELETE - Supprimer un étudiant
router.delete('/:id', roleMiddleware('superadmin', 'service_manager'), deleteStudent);

// PUT - Changer le niveau (superadmin uniquement)
router.put('/:id/level', roleMiddleware('superadmin'), updateStudentLevel);

// POST - Promotion en masse (superadmin uniquement)
router.post('/bulk-promote', roleMiddleware('superadmin'), bulkPromote);

module.exports = router;