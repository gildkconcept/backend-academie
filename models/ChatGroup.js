// models/ChatGroup.js
const supabase = require('../config/supabase');

class ChatGroup {
  /**
   * Créer un nouveau groupe de discussion
   */
  static async create(groupData) {
    const { data, error } = await supabase
      .from('chat_groups')
      .insert({
        name: groupData.name,
        type: groupData.type,
        branch: groupData.branch || null,
        level: groupData.level || null,
        service_id: groupData.service_id || null,
        created_by: groupData.created_by,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Trouver un groupe par son ID
   */
  static async findById(id) {
    const { data, error } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Compter les membres d'un groupe
   */
  static async countMembers(groupId) {
    const { count, error } = await supabase
      .from('chat_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);
    
    if (error) throw error;
    return count || 0;
  }

  /**
   * Récupérer les groupes d'un utilisateur avec leurs messages non lus
   */
  static async findByUserId(userId, userRole, userData = null) {
    // Récupérer les groupes
    let query = supabase
      .from('chat_groups')
      .select(`
        *,
        members:chat_group_members(count)
      `);
    
    // Filtrer selon le rôle
    if (userRole === 'student' && userData) {
      query = query.or(
        `type.eq.special,` +
        `and(type.eq.level,level.eq.${userData.level}),` +
        `and(type.eq.branch,branch.eq.${userData.branch}),` +
        `and(type.eq.service,service_id.eq.${userData.service_id})`
      );
    } else if (userRole === 'service_manager') {
      query = query.or(`type.eq.special,type.eq.service,type.eq.all`);
    }
    
    const { data: groups, error } = await query;
    if (error) throw error;
    
    // Enrichir avec les derniers messages et compteurs de non-lus
    const enrichedGroups = await Promise.all((groups || []).map(async (group) => {
      // Dernier message
      const { data: lastMessage } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('group_id', group.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // ✅ CORRIGÉ - Utiliser chat_message_reads au lieu de chat_user_read_status
      // Récupérer les IDs des messages déjà lus par l'utilisateur
      const { data: readMessages } = await supabase
        .from('chat_message_reads')
        .select('message_id')
        .eq('reader_id', userId);
      
      const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
      
      // Compter les messages non lus
      const { count: unreadCount, error: countError } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .eq('is_deleted', false)
        .not('id', 'in', `(${Array.from(readMessageIds).join(',') || 'NULL'})`);
      
      if (countError && !readMessageIds.size) {
        // Si pas de messages lus, compter tous les messages
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('is_deleted', false);
        return {
          ...group,
          lastMessage,
          unreadCount: count || 0
        };
      }
      
      return {
        ...group,
        lastMessage,
        unreadCount: unreadCount || 0
      };
    }));
    
    return enrichedGroups;
  }

  /**
   * Récupérer les membres d'un groupe
   */
  static async getMembers(groupId) {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        user_id,
        joined_at,
        user:users!user_id(id, name, role, profile_image_url)
      `)
      .eq('group_id', groupId);
    
    if (error) throw error;
    return data;
  }

  /**
   * Ajouter un membre au groupe
   */
  static async addMember(groupId, userId) {
    const { error } = await supabase
      .from('chat_group_members')
      .insert({
        group_id: groupId,
        user_id: userId,
        joined_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }

  /**
   * Ajouter plusieurs membres au groupe
   */
  static async addMembers(groupId, userIds) {
    const members = userIds.map(userId => ({
      group_id: groupId,
      user_id: userId,
      joined_at: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('chat_group_members')
      .insert(members);
    
    if (error) throw error;
  }

  /**
   * Retirer un membre du groupe
   */
  static async removeMember(groupId, userId) {
    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    
    if (error) throw error;
  }

  /**
   * Vérifier si un utilisateur est membre du groupe
   */
  static async isMember(groupId, userId) {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  }
}

module.exports = ChatGroup;