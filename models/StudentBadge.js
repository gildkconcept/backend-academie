// models/StudentBadge.js
const supabase = require('../config/supabase');

class StudentBadge {
  /**
   * Attribuer un badge à un étudiant
   */
  static async assign(studentId, badgeId) {
    const { data, error } = await supabase
      .from('student_badges')
      .insert({
        student_id: studentId,
        badge_id: badgeId,
        awarded_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Vérifier si un étudiant a déjà un badge
   */
  static async hasBadge(studentId, badgeId) {
    const { data, error } = await supabase
      .from('student_badges')
      .select('id')
      .eq('student_id', studentId)
      .eq('badge_id', badgeId)
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  }

  /**
   * Récupérer tous les badges d'un étudiant
   */
  static async getByStudentId(studentId) {
    const { data, error } = await supabase
      .from('student_badges')
      .select(`
        *,
        badge:badges(*)
      `)
      .eq('student_id', studentId)
      .order('awarded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer les étudiants qui ont un badge spécifique
   */
  static async getStudentsByBadgeId(badgeId) {
    const { data, error } = await supabase
      .from('student_badges')
      .select(`
        *,
        student:students(id, full_name, username, branch, level)
      `)
      .eq('badge_id', badgeId)
      .order('awarded_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
}

module.exports = StudentBadge;