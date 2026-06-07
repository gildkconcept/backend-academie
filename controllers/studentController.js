const StudentService = require('../services/studentService');

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

// ⚠️ NOUVEAU : Changer le niveau d'un étudiant
const updateStudentLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { level, reason } = req.body;
    
    const result = await StudentService.updateStudentLevel(id, level, reason, req.user);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Erreur updateStudentLevel:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

// ⚠️ NOUVEAU : Promotion en masse
const bulkPromote = async (req, res) => {
  try {
    const { studentIds, targetLevel, reason } = req.body;
    
    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ error: 'Aucun étudiant sélectionné' });
    }
    
    const result = await StudentService.bulkPromote(studentIds, targetLevel, reason, req.user);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Erreur bulkPromote:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

module.exports = {
  getAllStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
  updateStudentLevel,  // ← AJOUTÉ
  bulkPromote,         // ← AJOUTÉ
};