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
  getLevelHistory,           // ← AJOUTER
} = require('../controllers/studentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

// Routes protégées
router.use(authMiddleware);

// ==================== ROUTES EXISTANTES ====================

// GET - Liste des étudiants (avec filtres)
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

// ✅ NOUVEAU - Historique des changements de niveau
router.get('/:id/level-history', roleMiddleware('superadmin'), getLevelHistory);

// POST - Ajouter un étudiant (manager ou superadmin)
router.post('/', roleMiddleware('superadmin', 'service_manager'), addStudent);

// PUT - Modifier un étudiant
router.put('/:id', roleMiddleware('superadmin', 'service_manager'), updateStudent);

// DELETE - Supprimer un étudiant (soft delete)
router.delete('/:id', roleMiddleware('superadmin', 'service_manager'), deleteStudent);

// PUT - Changer le niveau (superadmin uniquement)
router.put('/:id/level', roleMiddleware('superadmin'), updateStudentLevel);

// POST - Promotion en masse (superadmin uniquement)
router.post('/bulk-promote', roleMiddleware('superadmin'), bulkPromote);

// ==================== NOUVELLES ROUTES ====================

// GET - Récupérer les étudiants supprimés (soft delete)
router.get('/deleted', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*, services(id, name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Erreur récupération étudiants supprimés:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Restaurer un étudiant supprimé
router.post('/:id/restore', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('students')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Étudiant restauré avec succès' });
  } catch (error) {
    console.error('Erreur restauration:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Statistiques des étudiants sans téléphone
router.get('/no-phone-stats', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, service_id, level, branch, baptized, maison_grace')
      .is('phone', null)
      .is('deleted_at', null);
    
    if (error) throw error;
    
    res.json({
      total: data?.length || 0,
      students: data || []
    });
  } catch (error) {
    console.error('Erreur stats no phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Créer un étudiant sans téléphone
router.post('/create-no-phone', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { fullName, branch, level, serviceId, baptized, maisonGrace, profileImageUrl } = req.body;
    
    if (!fullName || !branch || !serviceId) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    
    let username = fullName.toLowerCase().replace(/\s/g, '');
    let counter = 1;
    let existing = await supabase.from('students').select('id').eq('username', username).single();
    while (existing.data) {
      username = `${fullName.toLowerCase().replace(/\s/g, '')}${counter}`;
      existing = await supabase.from('students').select('id').eq('username', username).single();
      counter++;
    }
    
    const defaultPassword = 'default123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const nameParts = fullName.split(' ');
    const prenom = nameParts[0];
    const nom = nameParts.slice(1).join(' ');
    
    const { data, error } = await supabase
      .from('students')
      .insert({
        full_name: fullName,
        prenom,
        nom,
        username,
        branch,
        level: parseInt(level),
        service_id: serviceId,
        baptized: baptized === 'true' || baptized === true,
        maison_grace: maisonGrace || null,
        profile_image_url: profileImageUrl || null,
        password: hashedPassword,
        has_phone: false,
        phone: null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      message: 'Étudiant sans téléphone créé avec succès',
      student: data,
      defaultPassword
    });
  } catch (error) {
    console.error('Erreur création no phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer tous les IDs des étudiants (pour notifications)
router.get('/all-ids', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .is('deleted_at', null);
    
    if (error) throw error;
    res.json({ studentIds: data?.map(s => s.id) || [] });
  } catch (error) {
    console.error('Erreur récupération IDs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Étudiants par service
router.get('/by-service', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { serviceId } = req.query;
    
    if (!serviceId) {
      return res.status(400).json({ error: 'serviceId requis' });
    }
    
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('service_id', serviceId)
      .is('deleted_at', null);
    
    if (error) throw error;
    res.json({ studentIds: data?.map(s => s.id) || [] });
  } catch (error) {
    console.error('Erreur récupération par service:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Étudiants par niveau
router.get('/by-level', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { level } = req.query;
    
    if (!level) {
      return res.status(400).json({ error: 'level requis' });
    }
    
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('level', parseInt(level))
      .is('deleted_at', null);
    
    if (error) throw error;
    res.json({ studentIds: data?.map(s => s.id) || [] });
  } catch (error) {
    console.error('Erreur récupération par niveau:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;