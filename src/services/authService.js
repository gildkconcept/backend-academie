const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const User = require('../models/User');

class AuthService {
  static generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      name: user.name || user.full_name,
      role: user.role,
      serviceId: user.service_id,
      level: user.level,
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  }

  static async validateCredentials(username, password) {
    console.log('🔍 validateCredentials - username:', username);
    
    // Chercher dans users (admins)
    try {
      const user = await User.findByUsername(username);
      console.log('   User trouvé:', user ? 'OUI' : 'NON');
      if (user && await bcrypt.compare(password, user.password)) {
        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            serviceId: user.service_id,
          }
        };
      }
    } catch (err) {
      console.log('   Erreur User.findByUsername:', err.message);
    }
    
    // Chercher dans students
    try {
      const student = await Student.findByUsername(username);
      console.log('   Student trouvé:', student ? 'OUI' : 'NON');
      if (student) {
        const isPasswordValid = await bcrypt.compare(password, student.password);
        console.log('   Mot de passe valide:', isPasswordValid);
        if (isPasswordValid) {
          return {
            success: true,
            user: {
              id: student.id,
              name: student.full_name,
              username: student.username,
              role: 'student',
              serviceId: student.service_id,
              level: student.level,
            }
          };
        }
      }
    } catch (err) {
      console.log('   Erreur Student.findByUsername:', err.message);
    }
    
    return { success: false, error: 'Identifiants incorrects' };
  }

  static async checkUsernameAvailability(username) {
    const student = await Student.findByUsername(username);
    if (!student) {
      return { available: true, suggestions: [] };
    }
    const suggestions = [];
    for (let i = 1; i <= 3; i++) {
      const candidate = `${username}${i}`;
      const existing = await Student.findByUsername(candidate);
      if (!existing) suggestions.push(candidate);
    }
    return { available: false, suggestions };
  }

  static async createStudent(studentData) {
    const { fullName, branch, level, serviceId, baptized, phone, username, password, maisonGrace } = studentData;
    
    const existing = await Student.findByUsername(username);
    if (existing) {
      throw new Error('Nom d\'utilisateur déjà pris');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = fullName.split(' ');
    const prenom = nameParts[0];
    const nom = nameParts.slice(1).join(' ');
    
    const student = await Student.create({
      full_name: fullName,
      prenom,
      nom,
      username,
      branch,
      level: parseInt(level),
      service_id: serviceId,
      baptized: baptized === 'true' || baptized === true,
      phone,
      password: hashedPassword,
      maison_grace: maisonGrace || null,
    });
    
    return student;
  }

  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      let userData = null;
      if (decoded.role === 'superadmin' || decoded.role === 'service_manager') {
        userData = await User.findById(decoded.id);
      } else {
        userData = await Student.findById(decoded.id);
      }
      if (!userData) return null;
      return {
        id: userData.id,
        name: userData.full_name || userData.name,
        username: userData.username,
        role: decoded.role,
        serviceId: userData.service_id,
        level: userData.level,
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthService;