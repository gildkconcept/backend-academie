// services/studentService.js
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');

class StudentService {
  // Récupérer tous les étudiants
  static async getAllStudents(filters, user) {
    // Si c'est un manager, filtrer par son service
    if (user.role === 'service_manager') {
      filters.serviceId = user.serviceId;
    }
    return await Student.findAll(filters);
  }

  // Récupérer un étudiant par ID
  static async getStudentById(id, user) {
    const student = await Student.findById(id);
    
    // Vérifier les droits
    if (user.role === 'service_manager' && student.service_id !== user.serviceId) {
      throw new Error('Accès refusé');
    }
    
    return student;
  }

  // Ajouter un étudiant
  static async addStudent(studentData, user) {
    const { fullName, username, branch, level, baptized, phone, password, serviceId } = studentData;
    
    // Vérifier si le username existe
    const existing = await Student.findByUsername(username);
    if (existing) {
      throw new Error('Nom d\'utilisateur déjà pris');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = fullName.split(' ');
    const prenom = nameParts[0];
    const nom = nameParts.slice(1).join(' ');
    
    // Déterminer le service (manager force son service)
    const targetServiceId = user.role === 'service_manager' ? user.serviceId : serviceId;
    
    const student = await Student.create({
      full_name: fullName,
      prenom,
      nom,
      username,
      branch,
      level: parseInt(level),
      service_id: targetServiceId,
      baptized: baptized === 'true' || baptized === true,
      phone: phone || null,
      password: hashedPassword,
    });
    
    return student;
  }

  // Modifier un étudiant
  static async updateStudent(id, updateData, user) {
    const student = await Student.findById(id);
    
    // Vérifier les droits
    if (user.role === 'service_manager' && student.service_id !== user.serviceId) {
      throw new Error('Accès refusé');
    }
    
    const updated = await Student.update(id, {
      full_name: updateData.fullName,
      branch: updateData.branch,
      level: parseInt(updateData.level),
      baptized: updateData.baptized === 'true' || updateData.baptized === true,
      phone: updateData.phone || null,
      maison_grace: updateData.maisonGrace || null,
    });
    
    return updated;
  }

  // Supprimer un étudiant (soft delete)
  static async deleteStudent(id, user) {
    const student = await Student.findById(id);
    
    // Vérifier les droits
    if (user.role === 'service_manager' && student.service_id !== user.serviceId) {
      throw new Error('Accès refusé');
    }
    
    await Student.softDelete(id);
    return true;
  }

  // ✅ AJOUTÉ - Changer le niveau d'un étudiant
  static async updateStudentLevel(id, level, reason, user) {
    const student = await Student.findById(id);
    
    // Vérifier les droits
    if (user.role === 'service_manager' && student.service_id !== user.serviceId) {
      throw new Error('Accès refusé');
    }
    
    const oldLevel = student.level;
    const updated = await Student.update(id, { level: parseInt(level) });
    
    return { success: true, oldLevel, newLevel: parseInt(level) };
  }

  // ✅ AJOUTÉ - Promotion en masse
  static async bulkPromote(studentIds, targetLevel, reason, user) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const studentId of studentIds) {
      try {
        await this.updateStudentLevel(studentId, targetLevel, reason, user);
        results.success.push(studentId);
      } catch (error) {
        results.failed.push({ id: studentId, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = StudentService;