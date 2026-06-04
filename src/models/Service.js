const supabase = require('../config/supabase');

class Service {
  static async findAll() {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
}

module.exports = Service;