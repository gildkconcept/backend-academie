// controllers/chatController.js
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const Student = require('../models/Student');
const User = require('../models/User');
const supabase = require('../config/supabase');

// ==================== GROUPES ====================

/**
 * GET - Récupérer les groupes de l'utilisateur
 * 🔧 FIX N+1 : avant, cette fonction (+ ChatGroup.findByUserId en amont)
 * faisait jusqu'à ~70 requêtes Supabase pour un utilisateur dans 10
 * groupes (3-4 requêtes PAR groupe, en double avec le modèle).
 * Maintenant : un nombre FIXE de requêtes (~5), quel que soit le nombre
 * de groupes. Tout le calcul par groupe (dernier message, non-lus) se
 * fait en mémoire JS à partir de données chargées en une fois.
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

    if (!groups || groups.length === 0) {
      return res.json({ groups: [] });
    }

    const groupIds = groups.map(g => g.id);

    // 1 requête : tous les messages non supprimés des groupes concernés,
    // du plus récent au plus ancien (on ne garde que le premier par
    // groupe pour le "dernier message").
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('id, group_id, content, sender_id, sender_name, sender_type, created_at')
      .in('group_id', groupIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // 1 requête : tous les messages déjà lus par cet utilisateur (tous
    // groupes confondus), pour calculer les compteurs de non-lus en mémoire.
    const { data: readMessages } = await supabase
      .from('chat_message_reads')
      .select('message_id')
      .eq('reader_id', userId);
    const readMessageIds = new Set((readMessages || []).map(r => r.message_id));

    // Calcul en mémoire : dernier message par groupe + comptage des non-lus
    const lastMessageByGroup = new Map();
    const unreadCountByGroup = new Map();
    const studentSenderIds = new Set();
    const otherSenderIds = new Set();

    (allMessages || []).forEach(msg => {
      if (!lastMessageByGroup.has(msg.group_id)) {
        lastMessageByGroup.set(msg.group_id, msg);
        if (msg.sender_type === 'student') studentSenderIds.add(msg.sender_id);
        else otherSenderIds.add(msg.sender_id);
      }
      if (!readMessageIds.has(msg.id) && msg.sender_id !== userId) {
        unreadCountByGroup.set(msg.group_id, (unreadCountByGroup.get(msg.group_id) || 0) + 1);
      }
    });

    // Au maximum 2 requêtes (une pour les avatars étudiants, une pour les
    // avatars staff), au lieu d'une requête par dernier message.
    const avatarMap = new Map();
    if (studentSenderIds.size > 0) {
      const { data: studentAvatars } = await supabase
        .from('students')
        .select('id, profile_image_url')
        .in('id', Array.from(studentSenderIds));
      (studentAvatars || []).forEach(s => avatarMap.set(s.id, s.profile_image_url));
    }
    if (otherSenderIds.size > 0) {
      const { data: userAvatars } = await supabase
        .from('users')
        .select('id, profile_image_url')
        .in('id', Array.from(otherSenderIds));
      (userAvatars || []).forEach(u => avatarMap.set(u.id, u.profile_image_url));
    }

    // Assemblage final : aucune requête Supabase supplémentaire ici.
    const enrichedGroups = groups.map(group => {
      const memberCount = group.members?.[0]?.count || 0;
      const msg = lastMessageByGroup.get(group.id);

      let lastMessage = null;
      if (msg) {
        const messageDate = new Date(msg.created_at);
        const now = new Date();
        const diff = now.getTime() - messageDate.getTime();

        let timeFormatted;
        if (diff < 60000) timeFormatted = 'À l\'instant';
        else if (diff < 3600000) timeFormatted = `Il y a ${Math.floor(diff / 60000)} min`;
        else if (diff < 86400000) timeFormatted = messageDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        else timeFormatted = messageDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

        lastMessage = {
          content: msg.content,
          senderName: msg.sender_name,
          senderId: msg.sender_id,
          senderType: msg.sender_type,
          senderAvatar: avatarMap.get(msg.sender_id) || null,
          time: timeFormatted
        };
      }

      return {
        id: group.id,
        name: group.name,
        type: group.type,
        branch: group.branch,
        level: group.level,
        service_id: group.service_id,
        memberCount,
        lastMessage,
        unreadCount: unreadCountByGroup.get(group.id) || 0
      };
    });

    res.json({ groups: enrichedGroups });
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

    const group = await ChatGroup.create({
      name,
      type,
      branch,
      level,
      service_id,
      created_by: req.user.id
    });

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
 */
const getMessages = async (req, res) => {
  try {
    const { groupId, limit = 50, before } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }

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

    const isMember = await ChatGroup.isMember(groupId, userId);

    if (!isMember && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

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
 */
const markAsRead = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }

    const isMember = await ChatGroup.isMember(groupId, userId);

    if (!isMember && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('group_id', groupId);

    if (messagesError) throw messagesError;

    if (messages && messages.length > 0) {
      const messageIds = messages.map(msg => msg.id);

      const { error: deleteError } = await supabase
        .from('chat_message_reads')
        .delete()
        .in('message_id', messageIds)
        .eq('reader_id', userId);

      if (deleteError) throw deleteError;

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