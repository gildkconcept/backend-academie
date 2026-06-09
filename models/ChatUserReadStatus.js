// models/ChatUserReadStatus.js
const supabase = require('../config/supabase');

class ChatUserReadStatus {
  /**
   * Marquer les messages d'un groupe comme lus pour un utilisateur
   */
  static async markAsRead(groupId, userId) {
    const { error } = await supabase
      .from('chat_user_read_status')
      .upsert({
        group_id: groupId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
        is_read: true
      });
    
    if (error) throw error;
  }

  /**
   * Récupérer la dernière date de lecture d'un utilisateur pour un groupe
   */
  static async getLastRead(groupId, userId) {
    const { data, error } = await supabase
      .from('chat_user_read_status')
      .select('last_read_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    return data?.last_read_at || null;
  }

  /**
   * Compter les messages non lus pour un utilisateur dans un groupe
   */
  static async countUnread(groupId, userId) {
    const lastRead = await this.getLastRead(groupId, userId);
    
    let query = supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .neq('sender_id', userId);
    
    if (lastRead) {
      query = query.gt('created_at', lastRead);
    }
    
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
}

module.exports = ChatUserReadStatus;