// models/Badge.js
const supabase = require('../config/supabase');

class Badge {
  /**
   * Récupérer tous les badges
   */
  static async findAll() {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer un badge par son ID
   */
  static async findById(id) {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Créer un badge
   */
  static async create(badgeData) {
    const { data, error } = await supabase
      .from('badges')
      .insert({
        name: badgeData.name,
        description: badgeData.description,
        icon: badgeData.icon || null,
        condition_type: badgeData.condition_type,
        condition_value: badgeData.condition_value || null
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

module.exports = Badge;