// models/ChatMessage.js
const supabase = require('../config/supabase');

class ChatMessage {
  /**
   * Créer un nouveau message
   */
  static async create(messageData) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        group_id: messageData.group_id,
        sender_id: messageData.sender_id,
        sender_name: messageData.sender_name,
        sender_type: messageData.sender_type,
        content: messageData.content,
        type: messageData.type || 'text',
        reply_to: messageData.reply_to || null,
        created_at: new Date().toISOString(),
        is_edited: false,
        is_deleted: false
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les messages d'un groupe
   */
  static async findByGroupId(groupId, limit = 50, before = null) {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (before) {
      query = query.lt('created_at', before);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Récupérer les messages de réponse
    const replyIds = (data || []).filter(m => m.reply_to).map(m => m.reply_to);
    let replyMessages = [];
    if (replyIds.length > 0) {
      const { data: replies } = await supabase
        .from('chat_messages')
        .select('*')
        .in('id', replyIds);
      replyMessages = replies || [];
    }
    
    // Enrichir avec les messages de réponse et inverser l'ordre
    const enriched = (data || []).map(msg => ({
      ...msg,
      reply_to_message: replyMessages.find(r => r.id === msg.reply_to) || null
    })).reverse();
    
    return enriched;
  }

  /**
   * Récupérer un message par son ID
   */
  static async findById(id) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un message
   */
  static async update(id, updates) {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content: updates.content,
        is_edited: true,
        edited_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Supprimer un message (soft delete)
   */
  static async softDelete(id) {
    const { error } = await supabase
      .from('chat_messages')
      .update({
        is_deleted: true,
        content: null,
        deleted_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) throw error;
  }
}

module.exports = ChatMessage;