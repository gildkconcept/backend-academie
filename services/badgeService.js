// services/badgeService.js
const Badge = require('../models/Badge');
const StudentBadge = require('../models/StudentBadge');
const Student = require('../models/Student');

class BadgeService {
  /**
   * Récupérer tous les badges
   */
  static async getAllBadges() {
    return await Badge.findAll();
  }

  /**
   * Récupérer un badge par son ID
   */
  static async getBadgeById(badgeId) {
    return await Badge.findById(badgeId);
  }

  /**
   * Créer un badge
   */
  static async createBadge(badgeData) {
    return await Badge.create(badgeData);
  }

  /**
   * Récupérer les badges d'un étudiant
   */
  static async getStudentBadges(studentId) {
    return await StudentBadge.getByStudentId(studentId);
  }

  /**
   * Attribuer un badge à un étudiant
   */
  static async assignBadge(studentId, badgeId) {
    // Vérifier si l'étudiant existe
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Étudiant non trouvé');
    }
    
    // Vérifier si le badge existe
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      throw new Error('Badge non trouvé');
    }
    
    // Vérifier si le badge est déjà attribué
    const hasBadge = await StudentBadge.hasBadge(studentId, badgeId);
    if (hasBadge) {
      throw new Error('Ce badge a déjà été attribué à cet étudiant');
    }
    
    return await StudentBadge.assign(studentId, badgeId);
  }

  /**
   * Vérifier et attribuer automatiquement les badges basés sur les conditions
   */
  static async checkAndAwardBadges(studentId, conditionType, conditionValue = null) {
    const allBadges = await Badge.findAll();
    const eligibleBadges = allBadges.filter(b => b.condition_type === conditionType);
    
    const awardedBadges = [];
    for (const badge of eligibleBadges) {
      const hasBadge = await StudentBadge.hasBadge(studentId, badge.id);
      if (!hasBadge) {
        // Vérifier la condition spécifique
        let isEligible = false;
        
        switch (conditionType) {
          case 'perfect_quiz':
            isEligible = conditionValue === 100;
            break;
          case 'perfect_attendance':
            isEligible = conditionValue === 100;
            break;
          case 'faithful_sunday':
            // Logique pour la fidélité du dimanche
            isEligible = conditionValue >= 80;
            break;
          default:
            isEligible = true;
        }
        
        if (isEligible) {
          await StudentBadge.assign(studentId, badge.id);
          awardedBadges.push(badge);
        }
      }
    }
    
    return awardedBadges;
  }
}

module.exports = BadgeService;