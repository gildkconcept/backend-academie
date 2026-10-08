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
   * 🔧 FIX : récupère UNIQUEMENT la liste des groupes de l'utilisateur,
   * avec le comptage des membres (déjà inclus gratuitement via le select
   * imbriqué). L'enrichissement (dernier message, non-lus, avatars) est
   * fait par le contrôleur en requêtes groupées, pas ici en boucle.
   * Avant : cette méthode faisait ~3 requêtes Supabase PAR GROUPE.
   * Maintenant : une seule requête, quel que soit le nombre de groupes.
   */
  static async findByUserId(userId, userRole, userData = null) {
    let query = supabase
      .from('chat_groups')
      .select(`
        *,
        members:chat_group_members(count)
      `);

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
    return groups || [];
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