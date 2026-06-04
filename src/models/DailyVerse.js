const supabase = require('../config/supabase');

class DailyVerse {
  static async getToday() {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('daily_verse')
      .select('*')
      .eq('displayed_date', today)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
      const { data: lastVerse } = await supabase
        .from('daily_verse')
        .select('*')
        .eq('is_active', true)
        .order('displayed_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return lastVerse;
    }
    
    return data;
  }

  static async getAll() {
    const { data, error } = await supabase
      .from('daily_verse')
      .select('*')
      .order('displayed_date', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async create(verseData, userId) {
    const { data, error } = await supabase
      .from('daily_verse')
      .insert({ ...verseData, created_by: userId })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async update(id, verseData) {
    const { data, error } = await supabase
      .from('daily_verse')
      .update({ ...verseData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase
      .from('daily_verse')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}

module.exports = DailyVerse;