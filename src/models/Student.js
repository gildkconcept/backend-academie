const supabase = require('../config/supabase');

class Student {
  // Trouver tous les étudiants
  static async findAll(filters = {}) {
    let query = supabase
      .from('students')
      .select('*, services(id, name)')
      .is('deleted_at', null)
      .order('full_name');
    
    if (filters.serviceId && filters.serviceId !== 'all') {
      query = query.eq('service_id', filters.serviceId);
    }
    if (filters.level && filters.level !== 'all') {
      query = query.eq('level', parseInt(filters.level));
    }
    if (filters.branch && filters.branch !== 'all') {
      query = query.eq('branch', filters.branch);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Trouver par username
  static async findByUsername(username) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  // Trouver par ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('students')
      .select('*, services(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Créer un étudiant
  static async create(studentData) {
    const { data, error } = await supabase
      .from('students')
      .insert(studentData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Mettre à jour
  static async update(id, updateData) {
    const { data, error } = await supabase
      .from('students')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Suppression logique
  static async softDelete(id) {
    const { error } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }
}

module.exports = Student;