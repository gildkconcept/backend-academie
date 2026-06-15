// controllers/chatController.js
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const Student = require('../models/Student');
const User = require('../models/User');
const supabase = require('../config/supabase');

// ==================== GROUPES ====================

/**
 * GET - Récupérer les groupes de l'utilisateur
 */
const getGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let userData = null;
    
    if (userRole === 'student') {
      userData = await Student.findById(userId);
    }
    
    const groups = await ChatGroup.findByUserId(userId, userRole, userData);
    
    // Enrichir les groupes avec les infos manquantes
    const enrichedGroups = await Promise.all((groups || []).map(async (group) => {
      // 1. Compter les membres
      const { count: memberCount } = await supabase
        .from('chat_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);
      
      // 2. Traiter le dernier message
      let lastMessage = null;
      if (group.lastMessage) {
        // Formater la date
        const messageDate = new Date(group.lastMessage.created_at);
        const now = new Date();
        const diff = now.getTime() - messageDate.getTime();
        
        let timeFormatted;
        if (diff < 60000) timeFormatted = 'À l\'instant';
        else if (diff < 3600000) timeFormatted = `Il y a ${Math.floor(diff / 60000)} min`;
        else if (diff < 86400000) timeFormatted = messageDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        else timeFormatted = messageDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        
        // Récupérer l'avatar de l'expéditeur
        const table = group.lastMessage.sender_type === 'student' ? 'students' : 'users';
        const { data: userAvatar } = await supabase
          .from(table)
          .select('profile_image_url')
          .eq('id', group.lastMessage.sender_id)
          .maybeSingle();
        
        lastMessage = {
          content: group.lastMessage.content,
          senderName: group.lastMessage.sender_name,
          senderId: group.lastMessage.sender_id,
          senderType: group.lastMessage.sender_type,
          senderAvatar: userAvatar?.profile_image_url || null,
          time: timeFormatted
        };
      }
      
      // 3. Compter les messages non lus
      let unreadCount = 0;
      const { data: readMessages } = await supabase
        .from('chat_message_reads')
        .select('message_id')
        .eq('reader_id', userId);
      
      const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
      
      if (readMessageIds.size > 0) {
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('is_deleted', false)
          .not('id', 'in', `(${Array.from(readMessageIds).join(',')})`);
        unreadCount = count || 0;
      } else {
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('is_deleted', false);
        unreadCount = count || 0;
      }
      
      return {
        id: group.id,
        name: group.name,
        type: group.type,
        branch: group.branch,
        level: group.level,
        service_id: group.service_id,
        memberCount: memberCount || 0,
        lastMessage,
        unreadCount
      };
    }));
    
    res.json({ groups: enrichedGroups || [] });
  } catch (error) {
    console.error('Erreur getGroups:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Créer un nouveau groupe (superadmin uniquement)
 */
const createGroup = async (req, res) => {
  try {
    const { name, type, branch, level, service_id, memberIds = [] } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'name et type requis' });
    }
    
    // Créer le groupe
    const group = await ChatGroup.create({
      name,
      type,
      branch,
      level,
      service_id,
      created_by: req.user.id
    });
    
    // Ajouter les membres
    const members = [...memberIds];
    if (!members.includes(req.user.id)) {
      members.push(req.user.id);
    }
    
    if (members.length > 0) {
      await ChatGroup.addMembers(group.id, members);
    }
    
    res.status(201).json({ success: true, group });
  } catch (error) {
    console.error('Erreur createGroup:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET - Récupérer les membres d'un groupe
 */
const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    // Vérifier que l'utilisateur est membre
    const isMember = await ChatGroup.isMember(groupId, userId);
    if (!isMember && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const members = await ChatGroup.getMembers(groupId);
    res.json({ members: members || [] });
  } catch (error) {
    console.error('Erreur getGroupMembers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Ajouter des membres à un groupe (superadmin uniquement)
 */
const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    
    if (!memberIds || !memberIds.length) {
      return res.status(400).json({ error: 'memberIds requis' });
    }
    
    await ChatGroup.addMembers(groupId, memberIds);
    res.json({ success: true, message: `${memberIds.length} membre(s) ajouté(s)` });
  } catch (error) {
    console.error('Erreur addMembers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Quitter un groupe
 */
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    await ChatGroup.removeMember(groupId, userId);
    res.json({ success: true, message: 'Vous avez quitté le groupe' });
  } catch (error) {
    console.error('Erreur leaveGroup:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MESSAGES ====================

/**
 * GET - Récupérer les messages d'un groupe
 * ✅ CORRIGÉ - Autorise le superadmin même s'il n'est pas membre
 */
const getMessages = async (req, res) => {
  try {
    const { groupId, limit = 50, before } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }
    
    // Vérifier que l'utilisateur est membre (sauf pour superadmin)
    const isMember = await ChatGroup.isMember(groupId, userId);
    
    if (!isMember && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const messages = await ChatMessage.findByGroupId(groupId, parseInt(limit), before);
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Erreur getMessages:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Envoyer un message
 * ✅ CORRIGÉ - Autorise le superadmin et l'ajoute au groupe si nécessaire
 */
const sendMessage = async (req, res) => {
  try {
    const { groupId, content, replyTo, type = 'text' } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userRole = req.user.role;
    
    if (!groupId || !content) {
      return res.status(400).json({ error: 'groupId et content requis' });
    }
    
    // Vérifier que l'utilisateur est membre (sauf pour superadmin)
    const isMember = await ChatGroup.isMember(groupId, userId);
    
    if (!isMember && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    // Si superadmin et pas membre, l'ajouter automatiquement au groupe
    if (!isMember && userRole === 'superadmin') {
      await ChatGroup.addMember(groupId, userId);
      console.log(`✅ Superadmin ${userName} ajouté au groupe ${groupId}`);
    }
    
    const message = await ChatMessage.create({
      group_id: groupId,
      sender_id: userId,
      sender_name: userName,
      sender_type: userRole === 'student' ? 'student' : userRole,
      content,
      type,
      reply_to: replyTo || null
    });
    
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT - Modifier un message
 */
const editMessage = async (req, res) => {
  try {
    const { messageId, content } = req.body;
    const userId = req.user.id;
    
    if (!messageId || !content) {
      return res.status(400).json({ error: 'messageId et content requis' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres messages' });
    }
    
    await ChatMessage.update(messageId, { content });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur editMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE - Supprimer un message
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!messageId) {
      return res.status(400).json({ error: 'messageId requis' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    if (message.sender_id !== userId && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await ChatMessage.softDelete(messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur deleteMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== STATUT DE LECTURE ====================

/**
 * POST - Marquer les messages d'un groupe comme lus
 * ✅ CORRIGÉ - Autorise le superadmin même s'il n'est pas membre
 */
const markAsRead = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }
    
    // Vérifier que l'utilisateur a accès au groupe (sauf pour superadmin)
    const isMember = await ChatGroup.isMember(groupId, userId);
    
    if (!isMember && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    // Récupérer tous les messages du groupe
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('group_id', groupId);
    
    if (messagesError) throw messagesError;
    
    if (messages && messages.length > 0) {
      const messageIds = messages.map(msg => msg.id);
      
      // 1. Supprimer les anciennes entrées de lecture pour ces messages
      const { error: deleteError } = await supabase
        .from('chat_message_reads')
        .delete()
        .in('message_id', messageIds)
        .eq('reader_id', userId);
      
      if (deleteError) throw deleteError;
      
      // 2. Insérer les nouvelles entrées de lecture
      const reads = messages.map(msg => ({
        message_id: msg.id,
        reader_id: userId,
        reader_type: userRole === 'student' ? 'student' : userRole,
        read_at: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('chat_message_reads')
        .insert(reads);
      
      if (insertError) throw insertError;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur markAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getGroups,
  createGroup,
  getGroupMembers,
  addMembers,
  leaveGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead
};