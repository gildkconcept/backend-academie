// models/LevelChangeHistory.js
const supabase = require('../config/supabase');

class LevelChangeHistory {
  /**
   * Vérifier si la table student_level_history existe
   */
  static async tableExists() {
    try {
      const { error } = await supabase
        .from('student_level_history')  // ← Nom corrigé
        .select('id', { count: 'exact', head: true })
        .limit(1);
      
      if (error && error.message && error.message.includes('does not exist')) {
        return false;
      }
      return true;
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        return false;
      }
      console.error('Erreur vérification table:', error);
      return false;
    }
  }

  /**
   * Créer un historique de changement de niveau
   */
  static async create(historyData) {
    const exists = await this.tableExists();
    if (!exists) {
      console.warn('⚠️ Table student_level_history n\'existe pas, historique ignoré');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('student_level_history')  // ← Nom corrigé
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
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.warn('⚠️ Table student_level_history n\'existe pas, historique ignoré');
        return null;
      }
      throw error;
    }
  }

  /**
   * Récupérer l'historique d'un étudiant
   */
  static async getByStudentId(studentId, limit = 10) {
    const exists = await this.tableExists();
    if (!exists) {
      console.warn('⚠️ Table student_level_history n\'existe pas, retour tableau vide');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('student_level_history')  // ← Nom corrigé
        .select(`
          *,
          changed_by_user:users(id, name, role)
        `)
        .eq('student_id', studentId)
        .order('changed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.warn('⚠️ Table student_level_history n\'existe pas, retour tableau vide');
        return [];
      }
      throw error;
    }
  }

  /**
   * Récupérer tous les changements de niveau (admin)
   */
  static async getAll(limit = 100, offset = 0) {
    const exists = await this.tableExists();
    if (!exists) {
      console.warn('⚠️ Table student_level_history n\'existe pas, retour tableau vide');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('student_level_history')  // ← Nom corrigé
        .select(`
          *,
          student:students(id, full_name, username, branch),
          changed_by_user:users(id, name, role)
        `)
        .order('changed_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.warn('⚠️ Table student_level_history n\'existe pas, retour tableau vide');
        return [];
      }
      throw error;
    }
  }
}

module.exports = LevelChangeHistory;