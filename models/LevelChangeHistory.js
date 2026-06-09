// models/LevelChangeHistory.js
const supabase = require('../config/supabase');

class LevelChangeHistory {
  /**
   * Créer un historique de changement de niveau
   */
  static async create(historyData) {
    const { data, error } = await supabase
      .from('level_change_history')
      .insert({
        student_id: historyData.student_id,
        old_level: historyData.old_level,
        new_level: historyData.new_level,
        changed_by: historyData.changed_by,
        reason: historyData.reason || null,
        changed_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Récupérer l'historique d'un étudiant
   */
  static async getByStudentId(studentId, limit = 10) {
    const { data, error } = await supabase
      .from('level_change_history')
      .select(`
        *,
        changed_by_user:users(id, name, role)
      `)
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  /**
   * Récupérer tous les changements de niveau (admin)
   */
  static async getAll(limit = 100, offset = 0) {
    const { data, error } = await supabase
      .from('level_change_history')
      .select(`
        *,
        student:students(id, full_name, username, branch),
        changed_by_user:users(id, name, role)
      `)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data;
  }
}

module.exports = LevelChangeHistory;