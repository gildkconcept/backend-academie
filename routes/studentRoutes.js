const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Toutes les routes nécessitent authentification
router.use(authMiddleware);

// Routes
router.get('/', getAllStudents);
router.get('/:id', getStudentById);
router.post('/', roleMiddleware('superadmin', 'service_manager'), addStudent);
router.put('/:id', roleMiddleware('superadmin', 'service_manager'), updateStudent);
router.delete('/:id', roleMiddleware('superadmin', 'service_manager'), deleteStudent);

module.exports = router;