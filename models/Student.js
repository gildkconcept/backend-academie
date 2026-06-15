const supabase = require('../config/supabase');

class Student {
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

  static async create(studentData) {
    const hasPhoneValue = studentData.has_phone === true;
    const phoneValue = hasPhoneValue ? (studentData.phone || null) : null;
    
    const dataToInsert = {
      full_name: studentData.full_name,
      prenom: studentData.prenom,
      nom: studentData.nom,
      username: studentData.username,
      branch: studentData.branch,
      level: studentData.level,
      service_id: studentData.service_id,
      baptized: studentData.baptized,
      phone: phoneValue,
      password: studentData.password,
      maison_grace: studentData.maison_grace || null,
      has_phone: hasPhoneValue,
      created_at: new Date().toISOString()
    };
    
    console.log('📝 [Student.create] Insertion:', { 
      full_name: dataToInsert.full_name, 
      phone: dataToInsert.phone, 
      has_phone: dataToInsert.has_phone 
    });
    
    const { data, error } = await supabase
      .from('students')
      .insert(dataToInsert)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

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