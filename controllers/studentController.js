const StudentService = require('../services/studentService');
const LevelChangeHistory = require('../models/LevelChangeHistory'); // ← AJOUTER

const getAllStudents = async (req, res) => {
  try {
    const { serviceId, level, branch } = req.query;
    const filters = { serviceId, level, branch };
    
    const students = await StudentService.getAllStudents(filters, req.user);
    
    res.json(students);
  } catch (error) {
    console.error('Erreur getAllStudents:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await StudentService.getStudentById(id, req.user);
    
    if (!student) {
      return res.status(404).json({ error: 'Étudiant non trouvé' });
    }
    
    res.json(student);
  } catch (error) {
    console.error('Erreur getStudentById:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

const addStudent = async (req, res) => {
  try {
    const student = await StudentService.addStudent(req.body, req.user);
    
    res.status(201).json({
      success: true,
      message: 'Étudiant ajouté avec succès',
      student,
    });
  } catch (error) {
    console.error('Erreur addStudent:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await StudentService.updateStudent(id, req.body, req.user);
    
    res.json({
      success: true,
      message: 'Étudiant modifié avec succès',
      student,
    });
  } catch (error) {
    console.error('Erreur updateStudent:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    await StudentService.deleteStudent(id, req.user);
    
    res.json({
      success: true,
      message: 'Étudiant supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur deleteStudent:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

// ✅ AMÉLIORÉ - Changer le niveau d'un étudiant avec historique
const updateStudentLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { level, reason } = req.body;
    
    // Récupérer l'ancien niveau avant modification
    const oldStudent = await StudentService.getStudentById(id, req.user);
    const oldLevel = oldStudent.level;
    
    const result = await StudentService.updateStudentLevel(id, level, reason, req.user);
    
    // ✅ Ajouter à l'historique des changements de niveau
    await LevelChangeHistory.create({
      student_id: id,
      old_level: oldLevel,
      new_level: parseInt(level),
      changed_by: req.user.id,
      reason: reason || `Changement manuel par ${req.user.name}`
    });
    
    res.json({
      success: true,
      message: `Niveau changé de ${oldLevel} à ${level}`,
      ...result,
    });
  } catch (error) {
    console.error('Erreur updateStudentLevel:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

// ✅ AMÉLIORÉ - Promotion en masse avec historique
const bulkPromote = async (req, res) => {
  try {
    const { studentIds, targetLevel, reason } = req.body;
    
    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ error: 'Aucun étudiant sélectionné' });
    }
    
    // Récupérer les anciens niveaux avant modification
    const oldLevels = new Map();
    for (const studentId of studentIds) {
      try {
        const student = await StudentService.getStudentById(studentId, req.user);
        oldLevels.set(studentId, student.level);
      } catch (err) {
        console.error(`Erreur récupération étudiant ${studentId}:`, err);
      }
    }
    
    const result = await StudentService.bulkPromote(studentIds, targetLevel, reason, req.user);
    
    // ✅ Ajouter à l'historique pour chaque étudiant promu avec succès
    for (const studentId of result.success || []) {
      await LevelChangeHistory.create({
        student_id: studentId,
        old_level: oldLevels.get(studentId) || 0,
        new_level: parseInt(targetLevel),
        changed_by: req.user.id,
        reason: reason || `Promotion en masse par ${req.user.name}`
      });
    }
    
    res.json({
      success: true,
      message: `${result.success?.length || 0} étudiant(s) promu(s) au niveau ${targetLevel}`,
      ...result,
    });
  } catch (error) {
    console.error('Erreur bulkPromote:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

// ✅ NOUVEAU - Récupérer l'historique des changements de niveau d'un étudiant
const getLevelHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'utilisateur a le droit
    if (req.user.role !== 'superadmin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const history = await LevelChangeHistory.getByStudentId(id);
    res.json(history);
  } catch (error) {
    console.error('Erreur getLevelHistory:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

module.exports = {
  getAllStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
  updateStudentLevel,  // ← AMÉLIORÉ
  bulkPromote,         // ← AMÉLIORÉ
  getLevelHistory,     // ← NOUVEAU
};