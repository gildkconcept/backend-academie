// models/Notification.js
const supabase = require('../config/supabase');

class Notification {
  /**
   * Créer une notification
   */
  static async create(notificationData) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationData.user_id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'announcement',
        link: notificationData.link || null,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Créer plusieurs notifications en masse
   */
  static async createMany(notifications) {
    const notificationsWithDates = notifications.map(n => ({
      ...n,
      created_at: new Date().toISOString(),
      is_read: false
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notificationsWithDates);
    
    if (error) throw error;
  }

  /**
   * Récupérer les notifications d'un utilisateur
   */
  static async findByUserId(userId, limit = 50, unreadOnly = false) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Compter les notifications non lues d'un utilisateur
   */
  static async countUnread(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
    return count || 0;
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(id, userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  }

  /**
   * Marquer toutes les notifications d'un utilisateur comme lues
   */
  static async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
  }

  /**
   * Supprimer une notification
   */
  static async delete(id, userId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  }
}

module.exports = Notification;