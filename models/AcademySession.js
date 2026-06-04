const supabase = require('../config/supabase');

class AcademySession {
  // Créer une nouvelle session avec un code
  static async create(sessionData) {
    const { data, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Trouver une session par son code à 6 chiffres
  static async findByCode(code) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  // Trouver les sessions actives pour un niveau d'étudiant
  static async findActiveByStudentLevel(studentLevel) {
    const now = new Date().toISOString();
    
    let query = supabase
      .from('sessions')
      .select('*')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });
    
    // Sessions universelles (level IS NULL) OU du niveau de l'étudiant
    query = query.or(`level.is.null,level.eq.${studentLevel}`);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Trouver une session par ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Marquer les étudiants absents (auto après expiration)
  static async markAbsent(sessionId, studentIds) {
    const session = await this.findById(sessionId);
    
    const records = studentIds.map(studentId => ({
      student_id: studentId,
      session_id: sessionId,
      status: 'absent',
      date: session.date,
      scanned_at: new Date().toISOString(),
      method: 'auto_mark'
    }));
    
    const { error } = await supabase
      .from('attendance')
      .insert(records);
    
    if (error) throw error;
  }

  // Vérifier si une session est expirée
  static async isExpired(sessionId) {
    const session = await this.findById(sessionId);
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    return now > expiresAt;
  }

  // Supprimer une session (pour nettoyage)
  static async delete(id) {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
}

module.exports = AcademySession;