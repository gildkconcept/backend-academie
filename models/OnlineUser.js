// models/OnlineUser.js
const supabase = require('../config/supabase');

class OnlineUser {
  /**
   * Créer ou mettre à jour un utilisateur en ligne
   */
  static async upsert(userData) {
    // Vérifier si l'utilisateur existe déjà
    const { data: existing } = await supabase
      .from('online_users')
      .select('id')
      .eq('user_id', userData.user_id)
      .maybeSingle();
    
    if (existing) {
      // Mettre à jour
      const { data, error } = await supabase
        .from('online_users')
        .update({
          last_seen: new Date().toISOString(),
          current_page: userData.current_page || null,
          is_online: true
        })
        .eq('user_id', userData.user_id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Créer
      const { data, error } = await supabase
        .from('online_users')
        .insert({
          user_id: userData.user_id,
          user_name: userData.user_name,
          user_role: userData.user_role,
          profile_image_url: userData.profile_image_url || null,
          service_id: userData.service_id || null,
          level: userData.level || null,
          branch: userData.branch || null,
          is_online: true,
          connected_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          current_page: userData.current_page || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }

  /**
   * Marquer un utilisateur comme hors ligne
   */
  static async setOffline(userId) {
    const { error } = await supabase
      .from('online_users')
      .update({
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    if (error) throw error;
  }

  /**
   * Nettoyer les utilisateurs inactifs (plus de 5 minutes)
   */
  static async cleanupInactive() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('online_users')
      .update({ is_online: false })
      .lt('last_seen', fiveMinutesAgo);
    
    if (error) throw error;
  }

  /**
   * Récupérer tous les utilisateurs en ligne
   */
  static async getOnlineUsers(filters = {}) {
    let query = supabase
      .from('online_users')
      .select('*')
      .order('last_seen', { ascending: false });
    
    if (filters.isOnline === true) {
      query = query.eq('is_online', true);
    }
    if (filters.role && filters.role !== 'all') {
      query = query.eq('user_role', filters.role);
    }
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
}

module.exports = OnlineUser;