const supabase = require('../config/supabase');

class User {
  // Trouver un utilisateur par username
  static async findByUsername(username) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  // Trouver un utilisateur par ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
}

module.exports = User;