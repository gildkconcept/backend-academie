// controllers/badgeController.js
const Badge = require('../models/Badge');
const StudentBadge = require('../models/StudentBadge');
const Student = require('../models/Student');

/**
 * GET - Récupérer tous les badges (superadmin uniquement)
 */
const getAllBadges = async (req, res) => {
  try {
    const badges = await Badge.findAll();
    res.json(badges || []);
  } catch (error) {
    console.error('Erreur getAllBadges:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET - Récupérer les badges d'un étudiant
 */
const getStudentBadges = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les droits
    if (userRole !== 'superadmin' && userId !== studentId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const badges = await StudentBadge.getByStudentId(studentId);
    res.json(badges || []);
  } catch (error) {
    console.error('Erreur getStudentBadges:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Attribuer un badge à un étudiant (superadmin uniquement)
 */
const assignBadge = async (req, res) => {
  try {
    const { studentId, badgeId } = req.body;
    
    if (!studentId || !badgeId) {
      return res.status(400).json({ error: 'studentId et badgeId requis' });
    }
    
    // Vérifier si l'étudiant existe
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }
    
    // Vérifier si le badge existe
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      return res.status(404).json({ error: 'Badge non trouvé' });
    }
    
    // Vérifier si le badge est déjà attribué
    const hasBadge = await StudentBadge.hasBadge(studentId, badgeId);
    if (hasBadge) {
      return res.status(400).json({ error: 'Ce badge a déjà été attribué à cet étudiant' });
    }
    
    await StudentBadge.assign(studentId, badgeId);
    
    res.json({ success: true, message: 'Badge attribué avec succès' });
  } catch (error) {
    console.error('Erreur assignBadge:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Créer un nouveau badge (superadmin uniquement)
 */
const createBadge = async (req, res) => {
  try {
    const { name, description, icon, condition_type, condition_value } = req.body;
    
    if (!name || !description || !condition_type) {
      return res.status(400).json({ error: 'name, description et condition_type requis' });
    }
    
    const badge = await Badge.create({
      name,
      description,
      icon,
      condition_type,
      condition_value
    });
    
    res.status(201).json({ success: true, badge });
  } catch (error) {
    console.error('Erreur createBadge:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllBadges,
  getStudentBadges,
  assignBadge,
  createBadge
};