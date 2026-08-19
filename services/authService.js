const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const User = require('../models/User');

// 🔧 FIX : erreur dédiée pour distinguer une vraie panne (Supabase down,
// timeout réseau...) d'un simple "mauvais identifiants". Le contrôleur
// s'en sert pour répondre différemment (503 au lieu de 401) et pour NE
// PAS compter ça comme une tentative de connexion échouée.
class InfraError extends Error {
  constructor(message) {
    super(message);
    this.isInfraError = true;
  }
}

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

    // 🔧 FIX : on ne catch plus silencieusement les erreurs de recherche.
    // Une erreur ici = vrai problème d'infrastructure (Supabase down,
    // timeout...), PAS un "utilisateur non trouvé" (ça, c'est `data: null`
    // sans erreur, géré normalement plus bas).
    let user = null;
    try {
      user = await User.findByUsername(username);
    } catch (err) {
      console.error('🔥 Erreur infra User.findByUsername:', err.message);
      throw new InfraError('Erreur de connexion à la base de données');
    }

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

    let student = null;
    try {
      student = await Student.findByUsername(username);
    } catch (err) {
      console.error('🔥 Erreur infra Student.findByUsername:', err.message);
      throw new InfraError('Erreur de connexion à la base de données');
    }

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

    // Ici, et seulement ici, c'est un vrai échec d'identifiants.
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
    const { fullName, branch, level, serviceId, baptized, phone, username, password, maisonGrace, hasPhone } = studentData;

    console.log('📝 [AuthService] Création étudiant:', { username, phone, hasPhone });

    const existing = await Student.findByUsername(username);
    if (existing) {
      throw new Error('Nom d\'utilisateur déjà pris');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = fullName.split(' ');
    const prenom = nameParts[0];
    const nom = nameParts.slice(1).join(' ');

    const hasPhoneValue = hasPhone === true || (phone && phone.toString().trim() !== '');
    const finalPhone = hasPhoneValue ? (phone || null) : null;

    console.log('📱 has_phone final:', hasPhoneValue);
    console.log('📞 Téléphone final:', finalPhone);

    const student = await Student.create({
      full_name: fullName,
      prenom,
      nom,
      username,
      branch,
      level: parseInt(level),
      service_id: serviceId,
      baptized: baptized === 'true' || baptized === true,
      phone: finalPhone,
      password: hashedPassword,
      maison_grace: maisonGrace || null,
      has_phone: hasPhoneValue
    });

    return student;
  }

  /**
   * 🔧 FIX : nouvelle signature de retour pour distinguer précisément
   * chaque cas d'échec :
   *   - { valid: false, reason: 'invalid_token' }  -> token expiré/malformé/signature invalide
   *   - { valid: false, reason: 'user_not_found' } -> token valide mais compte supprimé entre-temps
   *   - { valid: true, user: {...} }                -> tout va bien
   * Et lève une InfraError si le problème vient de la base de données,
   * plutôt que de faire croire à l'utilisateur que son token est mauvais.
   */
  static async verifyToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Ici : token expiré, signature invalide, malformé... un vrai
      // problème de token, pas d'infrastructure.
      return { valid: false, reason: 'invalid_token' };
    }

    try {
      let userData = null;
      if (decoded.role === 'superadmin' || decoded.role === 'service_manager') {
        userData = await User.findById(decoded.id);
      } else {
        userData = await Student.findById(decoded.id);
      }

      if (!userData) {
        return { valid: false, reason: 'user_not_found' };
      }

      return {
        valid: true,
        user: {
          id: userData.id,
          name: userData.full_name || userData.name,
          username: userData.username,
          role: decoded.role,
          serviceId: userData.service_id,
          level: userData.level,
        }
      };
    } catch (dbError) {
      console.error('🔥 Erreur infra verifyToken:', dbError.message);
      throw new InfraError('Erreur de connexion à la base de données');
    }
  }
}

module.exports = AuthService;