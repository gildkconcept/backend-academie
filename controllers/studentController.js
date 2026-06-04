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

module.exports = {
  getAllStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
};